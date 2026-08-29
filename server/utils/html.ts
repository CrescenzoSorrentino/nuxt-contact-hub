/**
 * Fa l'escape dei caratteri speciali HTML in una stringa, così l'input
 * dell'utente può essere inserito in sicurezza nel corpo HTML dell'email
 * (previene l'injection di HTML/markup).
 * La sostituzione di "&" deve girare per prima, altrimenti farebbe il doppio
 * escape delle entità prodotte dalle altre sostituzioni.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
