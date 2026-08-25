<script setup lang="ts">
/**
 * ContactForm
 *
 * Form di contatto accessibile e autonomo: validazione lato client, un
 * honeypot anti-spam, un contatore di caratteri e gestione dello stato di
 * invio/reset. Invia i dati all'endpoint /api/contact e mostra un messaggio
 * di successo o di errore.
 *
 * Lo stile è guidato da custom properties CSS (vedi il blocco <style>), così
 * si può cambiare tema senza modificare questo file.
 */
import { EMAIL_REGEX, FIELD_LIMITS } from "#shared/contact-form";

const form = reactive({
  name: "",
  email: "",
  message: "",
  company: "",
});

const errors = reactive({
  name: "",
  email: "",
  message: "",
});

const status = ref<"idle" | "sending" | "success" | "error">("idle");

const isMessageTooLong = computed(
  () => form.message.length > FIELD_LIMITS.message,
);

async function handleSubmit() {
  if (!validate()) {
    return;
  }
  status.value = "sending";

  try {
    await $fetch("/api/contact", {
      method: "POST",
      body: form,
    });
    status.value = "success";
  } catch (e) {
    status.value = "error";
  }
}

function validate() {
  errors.name = "";
  errors.email = "";
  errors.message = "";

  if (form.name.trim() === "") {
    errors.name = "Name is required.";
  } else if (form.name.length > FIELD_LIMITS.name) {
    errors.name = `Name must be less than ${FIELD_LIMITS.name} characters.`;
  }

  if (form.email.trim() === "") {
    errors.email = "Email is required.";
  } else if (!EMAIL_REGEX.test(form.email)) {
    errors.email = "Please enter a valid email address.";
  } else if (form.email.length > FIELD_LIMITS.email) {
    errors.email = `Email must be less than ${FIELD_LIMITS.email} characters.`;
  }

  if (form.message.trim() === "") {
    errors.message = "Message is required.";
  } else if (form.message.length > FIELD_LIMITS.message) {
    errors.message = `Message must be less than ${FIELD_LIMITS.message} characters.`;
  }

  return errors.name === "" && errors.email === "" && errors.message === "";
}

// Indirizzo mostrato nel messaggio di errore ("scrivici direttamente a ...").
// Sostituiscilo con la tua email di contatto.
const contactEmail = "you@example.com";

function resetForm() {
  form.name = "";
  form.email = "";
  form.message = "";
  form.company = "";
  errors.name = "";
  errors.email = "";
  errors.message = "";
  status.value = "idle";
}
</script>

<template>
  <form class="contact-form" @submit.prevent="handleSubmit">
    <!-- Honeypot anti-spam: nascosto agli umani, spesso compilato dai bot -->
    <div class="honeypot" aria-hidden="true">
      <label for="company">Company</label>
      <input
        id="company"
        type="text"
        v-model="form.company"
        tabindex="-1"
        autocomplete="off"
      />
    </div>

    <div class="contact-form__field">
      <label class="contact-form__label" for="name">
        Name <span class="contact-form__required">*</span>
      </label>
      <input
        id="name"
        class="contact-form__input"
        type="text"
        v-model="form.name"
        @input="errors.name = ''"
        aria-required="true"
        aria-describedby="name-error"
      />
      <p
        v-if="errors.name"
        id="name-error"
        class="contact-form__error"
        role="alert"
      >
        {{ errors.name }}
      </p>
    </div>

    <div class="contact-form__field">
      <label class="contact-form__label" for="email">
        Email <span class="contact-form__required">*</span>
      </label>
      <input
        id="email"
        class="contact-form__input"
        type="email"
        v-model="form.email"
        @input="errors.email = ''"
        aria-required="true"
        aria-describedby="email-error"
      />
      <p
        v-if="errors.email"
        id="email-error"
        class="contact-form__error"
        role="alert"
      >
        {{ errors.email }}
      </p>
    </div>

    <div class="contact-form__field">
      <label class="contact-form__label" for="message">
        Message <span class="contact-form__required">*</span>
      </label>
      <textarea
        id="message"
        class="contact-form__textarea"
        v-model="form.message"
        @input="errors.message = ''"
        aria-required="true"
        aria-describedby="message-error"
      ></textarea>
      <p
        class="contact-form__counter"
        :class="{ 'contact-form__counter--over-limit': isMessageTooLong }"
      >
        {{ form.message.length }} / {{ FIELD_LIMITS.message }}
      </p>
      <p
        v-if="errors.message"
        id="message-error"
        class="contact-form__error"
        role="alert"
      >
        {{ errors.message }}
      </p>
    </div>

    <div class="contact-form__actions">
      <button
        type="submit"
        class="contact-form__button contact-form__button--submit"
        :disabled="status === 'sending'"
      >
        {{ status === "sending" ? "Sending..." : "Send" }}
      </button>
      <button
        type="button"
        class="contact-form__button contact-form__button--reset"
        @click="resetForm"
      >
        Reset
      </button>
    </div>

    <p
      v-if="status === 'success'"
      class="contact-form__status contact-form__status--success"
      role="status"
    >
      Your message has been sent successfully!
    </p>
    <p
      v-if="status === 'error'"
      class="contact-form__status contact-form__status--error"
      role="alert"
    >
      There was an error sending your message. Please write to us directly at
      {{ contactEmail }}.
    </p>
  </form>
</template>

<style scoped>
.contact-form {
  /* === Variabili personalizzabili: sovrascrivile dal tuo CSS === */
  --cf-font: inherit;
  --cf-color-text: #1a1a1a;
  --cf-color-label: #333333;
  --cf-color-border: #cccccc;
  --cf-color-focus: #2563eb;
  --cf-color-error: #d33333;
  --cf-color-button-bg: #1a1a1a;
  --cf-color-button-text: #ffffff;
  --cf-spacing: 1rem;
  --cf-radius: 6px;
  --cf-max-width: 32rem;

  /* === Layout di base === */
  display: flex;
  flex-direction: column;
  gap: var(--cf-spacing);
  max-width: var(--cf-max-width);
  font-family: var(--cf-font);
  color: var(--cf-color-text);
}

.contact-form__field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.contact-form__label {
  font-size: 0.9rem;
  color: var(--cf-color-label);
}

.contact-form__required {
  color: var(--cf-color-error);
}

.contact-form__input,
.contact-form__textarea {
  font: inherit;
  padding: 0.6rem 0.7rem;
  border: 1px solid var(--cf-color-border);
  border-radius: var(--cf-radius);
  background: #ffffff;
  color: inherit;
}

.contact-form__textarea {
  min-height: 8rem;
  resize: vertical;
}

.contact-form__input:focus,
.contact-form__textarea:focus {
  outline: 2px solid var(--cf-color-focus);
  outline-offset: 1px;
  border-color: var(--cf-color-focus);
}

.contact-form__error {
  margin: 0;
  font-size: 0.85rem;
  color: var(--cf-color-error);
}

.contact-form__counter {
  margin: 0;
  font-size: 0.8rem;
  color: var(--cf-color-label);
  text-align: right;
}

.contact-form__counter--over-limit {
  color: var(--cf-color-error);
}

.contact-form__actions {
  display: flex;
  gap: 0.5rem;
}

.contact-form__button {
  font: inherit;
  padding: 0.6rem 1.2rem;
  border: 1px solid transparent;
  border-radius: var(--cf-radius);
  cursor: pointer;
}

.contact-form__button--submit {
  background: var(--cf-color-button-bg);
  color: var(--cf-color-button-text);
}

.contact-form__button--submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.contact-form__button--reset {
  background: transparent;
  border-color: var(--cf-color-border);
  color: inherit;
}

.contact-form__status {
  margin: 0;
  padding: 0.7rem 0.9rem;
  border-radius: var(--cf-radius);
  font-size: 0.9rem;
}

.contact-form__status--success {
  background: #e8f5e9;
  color: #1b5e20;
}

.contact-form__status--error {
  background: #fdecea;
  color: #b71c1c;
}

/* Honeypot: spostato fuori schermo (NON display:none, che alcuni bot ignorano) */
.honeypot {
  position: absolute;
  left: -5000px;
}
</style>
