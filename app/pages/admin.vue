<script setup lang="ts">
/**
 * Pagina admin (/admin).
 *
 * Mostra un form di login con password quando l'utente non è loggato, e la
 * lista dei lead quando è loggato. Lo stato della sessione (`loggedIn`)
 * decide quale vista viene mostrata, quindi login/logout cambiano
 * automaticamente l'interfaccia.
 */
const { loggedIn, fetch: refreshSession, clear } = useUserSession();

const password = ref("");
const errorMsg = ref("");

// Carica i lead in modo differito (immediate: false): l'endpoint richiede una
// sessione, quindi facciamo la richiesta solo dopo aver verificato il login.
const { data: leads, refresh: refreshLeads } = await useFetch("/api/leads", {
  immediate: false,
});

const view = ref<"new" | "archived">("new");
const categoryFilter = ref("all");
const priorityFilter = ref("all");

const filterLeads = computed(
  () =>
    leads.value?.filter(
      (lead) =>
        (view.value === "new" ? !lead.handled : lead.handled) &&
        (categoryFilter.value === "all" ||
          lead.category === categoryFilter.value) &&
        (priorityFilter.value === "all" ||
          lead.priority === priorityFilter.value),
    ) ?? [],
);

// Già loggato (es. dopo un ricaricamento della pagina con un cookie valido): carica subito.
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

    <div class="filter-bar">
      <div class="view-tabs">
        <button
          class="tab"
          :class="{ 'tab-active': view === 'new' }"
          @click="view = 'new'"
        >
          New {{ leads?.filter((l) => !l.handled).length ?? 0 }}
        </button>
        <button
          class="tab"
          :class="{ 'tab-active': view === 'archived' }"
          @click="view = 'archived'"
        >
          Archived {{ leads?.filter((l) => l.handled).length ?? 0 }}
        </button>
      </div>

      <div class="filter-selects">
        <select v-model="categoryFilter">
          <option value="all">All categories</option>
          <option value="commercial">Commercial</option>
          <option value="support">Support</option>
          <option value="spam">Spam</option>
          <option value="collaboration">Collaboration</option>
          <option value="other">Other</option>
        </select>
        <select v-model="priorityFilter">
          <option value="all">All priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>
    </div>

    <p v-if="!filterLeads || filterLeads.length === 0" class="empty">
      No leads to display.
    </p>

    <ul class="leads">
      <li v-for="lead in filterLeads" :key="lead.id" class="lead">
        <div class="lead-top">
          <span class="lead-name">{{ lead.name }}</span>
          <time class="lead-date">{{ formatDate(lead.created_at) }}</time>
        </div>
        <div v-if="lead.category" class="lead-tags">
          <span class="tag tag-category">{{ lead.category }}</span>
          <span class="tag" :class="`tag-priority-${lead.priority}`">
            {{ lead.priority }}
          </span>
        </div>
        <a class="lead-email" :href="`mailto:${lead.email}`">{{
          lead.email
        }}</a>
        <p class="lead-message">{{ lead.message }}</p>
        <button class="toggle" @click="toggleHandled(lead.id, lead.handled)">
          {{ lead.handled ? "Mark as to-do" : "Mark as handled" }}
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
:global(body) {
  background: #f7f7f8;
}

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
  background: #4f46e5;
  color: #fff;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

button:hover {
  background: #4338ca;
}

button.ghost {
  background: transparent;
  color: #6b7280;
  border: 1px solid #d1d5db;
}

button.ghost:hover {
  background: #f3f4f6;
  color: #374151;
}

.error {
  color: #dc2626;
}

.admin-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2rem;
}

.admin-header h1 {
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0;
}

.empty {
  color: #6b7280;
}

.filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1.3rem;
}

.view-tabs {
  display: flex;
  gap: 0.4rem;
}

.tab {
  background: transparent;
  color: #6b7280;
  font-weight: 600;
  font-size: 0.85rem;
  padding: 0.4rem 0.85rem;
  border-radius: 999px;
}

.tab:hover {
  background: #eef2ff;
  color: #4338ca;
}

.tab-active,
.tab-active:hover {
  background: #4f46e5;
  color: #fff;
}

.filter-selects {
  display: flex;
  gap: 0.5rem;
}

.filter-selects select {
  font-size: 0.85rem;
  padding: 0.4rem 0.6rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  color: #374151;
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

/* Card floats over the page background via shadow, not a hard border, for
   a softer sense of depth while staying flat/minimal. */
.lead {
  background: #ffffff;
  border: 1px solid #f0f0f1;
  border-radius: 10px;
  box-shadow:
    0 1px 2px rgba(16, 24, 40, 0.04),
    0 1px 3px rgba(16, 24, 40, 0.06);
  padding: 1.15rem 1.35rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
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

.lead-tags {
  display: flex;
  gap: 0.4rem;
}

.tag {
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: capitalize;
}

.tag-category {
  background: #eef2ff;
  color: #4338ca;
}

.tag-priority-high {
  background: #fee2e2;
  color: #dc2626;
}

.tag-priority-medium {
  background: #fef3c7;
  color: #b45309;
}

.tag-priority-low {
  background: #f3f4f6;
  color: #6b7280;
}

.lead-email {
  color: #4f46e5;
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
  color: #4f46e5;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.toggle:hover {
  background: #f3f4f6;
}
</style>
