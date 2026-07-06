<script setup lang="ts">
/**
 * Admin page (/admin).
 *
 * Shows a password login form when logged out, and the list of leads when
 * logged in. The session state (`loggedIn`) drives which view is rendered, so
 * logging in or out automatically swaps the UI.
 */
const { loggedIn, fetch: refreshSession, clear } = useUserSession();

const password = ref("");
const errorMsg = ref("");

// Load the leads lazily (immediate: false): the endpoint requires a session,
// so we only fetch after we know the user is logged in.
const { data: leads, refresh: refreshLeads } = await useFetch("/api/leads", {
  immediate: false,
});

// Already logged in (e.g. after a page reload with a valid cookie): load now.
if (loggedIn.value) {
  await refreshLeads();
}

async function logout() {
  await clear();
  await refreshLeads();
}

async function login() {
  errorMsg.value = "";
  try {
    await $fetch("/api/admin/login", {
      method: "POST",
      body: { password: password.value },
    });
    await refreshSession();
    await refreshLeads();
    password.value = "";
  } catch {
    errorMsg.value = "Wrong password";
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function toggleHandled(id: number, current: boolean) {
  await $fetch(`/api/leads/${id}`, {
    method: "PATCH",
    body: { handled: !current },
  });
  await refreshLeads();
}
</script>

<template>
  <div v-if="!loggedIn" class="auth">
    <h1>Admin login</h1>
    <form class="login-form" @submit.prevent="login">
      <input v-model="password" type="password" placeholder="Password" />
      <button type="submit">Login</button>
    </form>
    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
  </div>

  <div v-else class="admin">
    <header class="admin-header">
      <h1>Admin area</h1>
      <button class="ghost" @click="logout">Log out</button>
    </header>

    <p v-if="!leads || leads.length === 0" class="empty">
      No leads to display.
    </p>

    <ul class="leads">
      <li
        v-for="lead in leads"
        :key="lead.id"
        class="lead"
        :class="{ 'is-handled': lead.handled }"
      >
        <div class="lead-top">
          <span class="lead-name">
            <Icon v-if="lead.handled" name="lucide:check" class="lead-check" />
            {{ lead.name }}
          </span>
          <time class="lead-date">{{ formatDate(lead.created_at) }}</time>
        </div>
        <a class="lead-email" :href="`mailto:${lead.email}`">{{ lead.email }}</a>
        <p class="lead-message">{{ lead.message }}</p>
        <button class="toggle" @click="toggleHandled(lead.id, lead.handled)">
          {{ lead.handled ? "Mark as to-do" : "Mark as handled" }}
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.auth,
.admin {
  max-width: 640px;
  margin: 2rem auto;
  padding: 0 1rem;
  font-family: system-ui, sans-serif;
  color: #1f2937;
}

.login-form {
  display: flex;
  gap: 0.5rem;
}

input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 1rem;
}

button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  background: #2563eb;
  color: #fff;
  font-size: 1rem;
  cursor: pointer;
}

button.ghost {
  background: transparent;
  color: #6b7280;
  border: 1px solid #d1d5db;
}

.error {
  color: #dc2626;
}

.admin-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.empty {
  color: #6b7280;
}

/* Spacing between cards. */
.leads {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

/* Plain card, with consistent internal spacing (gap) so nothing looks
   thrown together. */
.lead {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1.1rem 1.3rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

/* Handled leads recede slightly and get a green check before the name. */
.lead.is-handled {
  background: #fafafa;
}

.lead.is-handled .lead-name {
  color: #6b7280;
}

.lead-check {
  color: #16a34a;
  font-size: 1.1em;
  vertical-align: -0.15em;
  margin-right: 0.25rem;
}

.lead-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
}

.lead-name {
  font-weight: 600;
}

.lead-date {
  color: #9ca3af;
  font-size: 0.85rem;
  white-space: nowrap;
}

.lead-email {
  color: #2563eb;
  text-decoration: none;
  font-size: 0.9rem;
}

.lead-message {
  margin: 0;
  color: #374151;
  line-height: 1.5;
  white-space: pre-wrap;
}

.toggle {
  align-self: flex-end;
  margin-top: 0.4rem;
  padding: 0.4rem 0.85rem;
  font-size: 0.85rem;
  background: transparent;
  color: #2563eb;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  cursor: pointer;
}

.toggle:hover {
  background: #f3f4f6;
}
</style>
