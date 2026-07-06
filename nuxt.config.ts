// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  modules: ["nuxt-auth-utils", "@nuxt/icon"],

  runtimeConfig: {
    resendApiKey: "",
    contactRecipientEmail: "",
    contactFromEmail: "",
    upstashRedisRestUrl: "",
    upstashRedisRestToken: "",
    contactSendConfirmation: false,
    supabaseUrl: "",
    supabaseServiceRoleKey: "",
    adminPassword: "",
  },
});
