<script setup lang="ts">
const { loggedIn, fetch: refreshSession, clear } = useUserSession();

const password = ref("");
const errorMsg = ref("");
const { data: leads, refresh: refreshLeads } = await useFetch("/api/leads", {
  immediate: false,
});

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
</script>

<template>
  <div v-if="!loggedIn" class="auth">
    <h1>Login admin</h1>
    <form class="login-form" @submit.prevent="login">
      <input v-model="password" type="password" placeholder="Password" />
      <button type="submit">Login</button>
    </form>
    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
  </div>

  <div v-else class="admin">
    <header class="admin-header">
      <h1>Area admin</h1>
      <button class="ghost" @click="logout">Esci</button>
    </header>

    <p v-if="!leads || leads.length === 0" class="empty">
      Nessun lead per ora.
    </p>

    <ul class="leads">
      <li v-for="lead in leads" :key="lead.id" class="lead">
        <div class="lead-top">
          <span class="lead-name">{{ lead.name }}</span>
          <time class="lead-date">{{ formatDate(lead.created_at) }}</time>
        </div>
        <a class="lead-email" :href="`mailto:${lead.email}`">{{ lead.email }}</a>
        <p class="lead-message">{{ lead.message }}</p>
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
}

.empty {
  color: #6b7280;
}

.leads {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.lead {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 0.75rem 1rem;
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
  margin: 0.5rem 0 0;
  white-space: pre-wrap;
  color: #374151;
}
</style>
