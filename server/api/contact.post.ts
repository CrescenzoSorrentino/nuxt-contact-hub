import { EMAIL_REGEX, FIELD_LIMITS } from "#shared/contact-form";
import { Resend } from "resend";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Fa l'escape dei caratteri speciali HTML in una stringa, così l'input
 * dell'utente può essere inserito in sicurezza nel corpo HTML dell'email
 * (previene l'injection di HTML/markup).
 * La sostituzione di "&" deve girare per prima, altrimenti farebbe il doppio
 * escape delle entità prodotte dalle altre sostituzioni.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * POST /api/contact
 *
 * Riceve l'invio del form di contatto e lo fa passare attraverso una serie di
 * controlli: honeypot -> rate limit -> validazione -> invio email. Una
 * richiesta invia un'email solo se supera ogni controllo. Le credenziali
 * vengono lette da runtimeConfig (vedi nuxt.config.ts e .env.example).
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  // Honeypot: i bot tendono a compilare ogni campo, incluso quello nascosto
  // "company". Se è compilato, fingiamo un successo senza inviare, così il
  // bot non impara che è stato rifiutato.
  if (body.company) {
    return { ok: true };
  }

  const config = useRuntimeConfig(event);

  // Rate limiting (fail-open): al massimo 5 richieste all'ora per IP.
  // La chiamata a Redis è dentro un try/catch così se Redis è irraggiungibile
  // lasciamo passare la richiesta invece di rompere il form. Il vero "429"
  // viene lanciato FUORI dal try/catch, così un "limite superato" vero non
  // viene mai inghiottito dal catch.
  let limitExceeded = false;
  try {
    const redis = new Redis({
      url: config.upstashRedisRestUrl,
      token: config.upstashRedisRestToken,
    });
    const ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "1 h"),
    });
    const ip = getRequestIP(event, { xForwardedFor: true }) ?? "unknown";
    const { success } = await ratelimit.limit(ip);
    limitExceeded = !success;
  } catch (e) {
    // Redis irraggiungibile -> fail open: non blocchiamo la richiesta.
    console.error("Rate limiting unavailable (failing open):", e);
  }

  if (limitExceeded) {
    throw createError({
      statusCode: 429,
      statusMessage: "Too many requests",
    });
  }

  // Ri-validazione lato server. Il client valida già, ma i controlli client
  // non sono una garanzia di sicurezza, quindi ricontrolliamo tutto qui
  // usando le stesse regole condivise. "!body.x" protegge anche dai campi
  // mancanti (undefined).
  if (
    !body.name ||
    body.name.trim() === "" ||
    body.name.length > FIELD_LIMITS.name
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid name",
    });
  }

  if (
    !body.email ||
    body.email.trim() === "" ||
    body.email.length > FIELD_LIMITS.email ||
    !EMAIL_REGEX.test(body.email)
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid email",
    });
  }

  if (
    !body.message ||
    body.message.trim() === "" ||
    body.message.length > FIELD_LIMITS.message
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid message",
    });
  }

  // Salva il lead prima di inviare qualsiasi email, così un invio viene
  // sempre memorizzato anche quando l'email è disattivata o fallisce. "id" e
  // "created_at" vengono compilati automaticamente dal database.
  const supabase = serverSupabase();

  const triage = await triageLead(body.message);

  const { error: dbError } = await supabase.from("leads").insert({
    name: body.name,
    email: body.email,
    message: body.message,
    category: triage?.category,
    priority: triage?.priority,
  });

  if (dbError) {
    console.error("Database insert failed:", dbError);

    throw createError({
      statusCode: 500,
      statusMessage: "Database insert failed",
    });
  }

  if (triage?.category === "spam") return { ok: true };

  // L'email è opzionale: se Resend non è configurato, basta aver salvato il
  // lead, quindi restituiamo successo senza provare a inviare nulla.
  if (!config.resendApiKey) {
    return {
      ok: true,
    };
  }

  // Invia l'email. Ogni valore fornito dall'utente viene sottoposto a escape
  // prima di essere inserito nel corpo HTML. "replyTo" è impostato
  // sull'indirizzo del visitatore così puoi rispondergli con un click.
  const resend = new Resend(config.resendApiKey);

  const html = `
    <h2>New contact form message</h2>
    <p><strong>Name:</strong> ${escapeHtml(body.name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(body.email)}</p>
    <p><strong>Message:</strong></p>
    <p>${escapeHtml(body.message)}</p>
  `;

  // L'SDK di Resend restituisce un oggetto { data, error } invece di lanciare
  // un'eccezione, quindi controlliamo "error" noi stessi e mostriamo un 500 in caso di fallimento.
  const { error } = await resend.emails.send({
    from: config.contactFromEmail,
    to: config.contactRecipientEmail,
    replyTo: body.email,
    subject: `New message from ${body.name}`,
    html,
  });

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "Email sending failed",
    });
  }

  // Email di conferma opzionale per il visitatore (disattivata di default).
  // È un "sarebbe carino averla": se fallisce ci limitiamo a loggarla, NON
  // facciamo fallire la richiesta, perché l'email principale verso di te è
  // già andata a buon fine.
  if (config.contactSendConfirmation) {
    const { error: confirmationError } = await resend.emails.send({
      from: config.contactFromEmail,
      to: body.email,
      subject: "We received your message",
      html: `
        <h2>Thanks for reaching out!</h2>
        <p>Hi ${escapeHtml(body.name)}, we received your message and will get back to you soon.</p>
        <p><strong>Your message:</strong></p>
        <p>${escapeHtml(body.message)}</p>
      `,
    });

    if (confirmationError) {
      console.error("Confirmation email failed:", confirmationError);
    }
  }

  return { ok: true };
});
