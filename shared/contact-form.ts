/**
 * Regole di validazione condivise per il form di contatto.
 *
 * Questo file è l'unica fonte di verità, importato SIA dal componente client
 * (per un feedback immediato all'utente) SIA dall'endpoint server (per la
 * ri-validazione di sicurezza). Tenere le regole qui significa che i due lati
 * non possono mai disallinearsi.
 *
 * In Nuxt è disponibile tramite l'alias `#shared`:
 *   import { FIELD_LIMITS, EMAIL_REGEX } from '#shared/contact-form'
 *
 * Nota: queste sono solo REGOLE. L'indirizzo email di destinazione è
 * configurazione e vive altrove (una prop sul client, una variabile
 * d'ambiente sul server).
 */

/**
 * Lunghezza massima consentita per campo, in caratteri.
 * Usata su entrambi i lati per rifiutare payload troppo grandi e tenere i limiti allineati.
 */
export const FIELD_LIMITS = {
  name: 100,
  email: 200,
  message: 5000,
} as const

/**
 * Regex di validazione email.
 *
 * Volutamente pragmatica, non un'implementazione completa dell'RFC 5322:
 * controlla la forma "qualcosa@qualcosa.qualcosa" senza spazi, che intercetta
 * i refusi più comuni. L'unico controllo davvero affidabile è inviare
 * un'email vera.
 */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Forma dei dati del form di contatto, riusata sul client e sul server così
 * la struttura dati è descritta in un unico posto.
 */
export interface ContactFormData {
  name: string
  email: string
  message: string
}
