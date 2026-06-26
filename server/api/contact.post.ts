import { EMAIL_REGEX, FIELD_LIMITS } from "#shared/contact-form";
import { Resend } from "resend";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Escapes the HTML-special characters in a string so user input can be safely
 * embedded in the HTML email body (prevents HTML/markup injection).
 * The "&" replacement must run first, otherwise it would double-escape the
 * entities produced by the other replacements.
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
 * Receives the contact form submission and runs it through a series of gates:
 * honeypot -> rate limit -> validation -> send email. A request only sends an
 * email if it passes every gate. Credentials are read from runtimeConfig
 * (see nuxt.config.ts and .env.example).
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  // Honeypot: bots tend to fill every field, including the hidden "company"
  // one. If it is filled, pretend success without sending, so the bot does not
  // learn it was rejected.
  if (body.company) {
    return { ok: true };
  }

  const config = useRuntimeConfig(event);

  // Rate limiting (fail-open): allow at most 5 requests per hour per IP.
  // The Redis call is wrapped in try/catch so that if Redis is unreachable we
  // let the request through rather than breaking the form. The actual "429"
  // is thrown OUTSIDE the try/catch, so a genuine "limit exceeded" is never
  // swallowed by the catch.
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
    // Redis unreachable -> fail open: do not block the request.
    console.error("Rate limiting unavailable (failing open):", e);
  }

  if (limitExceeded) {
    throw createError({
      statusCode: 429,
      statusMessage: "Too many requests",
    });
  }

  // Server-side re-validation. The client already validates, but client checks
  // are not a security guarantee, so we re-check everything here using the same
  // shared rules. "!body.x" also guards against missing fields (undefined).
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

  const supabase = serverSupabase();

  const { error: dbError } = await supabase.from("leads").insert({
    name: body.name,
    email: body.email,
    message: body.message,
  });

  if (dbError) {
    console.error("Database insert failed:", dbError);

    throw createError({
      statusCode: 500,
      statusMessage: "Database insert failed",
    });
  }

  if (!config.resendApiKey) {
    return {
      ok: true,
    };
  }
  
  // Send the email. Every user-provided value is escaped before being placed
  // in the HTML body. "replyTo" is set to the visitor's address so you can
  // reply to them directly with one click.
  const resend = new Resend(config.resendApiKey);

  const html = `
    <h2>New contact form message</h2>
    <p><strong>Name:</strong> ${escapeHtml(body.name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(body.email)}</p>
    <p><strong>Message:</strong></p>
    <p>${escapeHtml(body.message)}</p>
  `;

  // The Resend SDK returns an { data, error } object instead of throwing, so
  // we check "error" ourselves and surface a 500 on failure.
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

  // Optional confirmation email to the visitor (off by default).
  // It is a "nice to have": if it fails we only log it, we do NOT fail the
  // request, because the main email to you already succeeded.
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
