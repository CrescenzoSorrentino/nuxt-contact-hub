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

const view = ref<"new" | "archived" | "trash">("new");
const categoryFilter = ref("all");
const priorityFilter = ref("all");

function matchesView(lead: { deleted_at: string | null; handled: boolean }) {
  if (view.value === "trash") {
    return lead.deleted_at !== null;
  }

  if (lead.deleted_at !== null) {
    return false;
  }

  if (view.value === "new") {
    return !lead.handled;
  }

  return lead.handled;
}

const filterLeads = computed(
  () =>
    leads.value?.filter(
      (lead) =>
        matchesView(lead) &&
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

function daysUntilDeletion(deletedAt: string) {
  const now = Date.now();
  const msElapsed = now - new Date(deletedAt).getTime();
  const daysElapsed = msElapsed / (1000 * 60 * 60 * 24);
  const daysRemaining = Math.ceil(30 - daysElapsed);

  return daysRemaining;
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

async function sendReply(id: number) {
  await $fetch(`/api/leads/${id}/reply`, {
    method: "POST",
    body: { message: replyText.value },
  });
  cancelReply();
}

async function generateDraft(lead: { id: number; message: string }) {
  const result = await $fetch(`/api/leads/${lead.id}/draft`, {
    method: "POST",
    body: { originalMessage: lead.message, draft: replyText.value },
  });
  replyText.value = result.draft;
}

// Solo un lead alla volta può avere il composer di risposta aperto.
const replyingId = ref<number | null>(null);
const replyText = ref("");

function openReply(id: number) {
  replyingId.value = id;
  replyText.value = "";
}

function cancelReply() {
  replyingId.value = null;
  replyText.value = "";
}

async function moveToTrash(id: number) {
  await $fetch(`/api/leads/${id}`, {
    method: "PATCH",
    body: { deleted_at: new Date().toISOString() },
  });
  await refreshLeads();
}

async function restoreFromTrash(id: number) {
  await $fetch(`/api/leads/${id}`, {
    method: "PATCH",
    body: { deleted_at: null },
  });
  await refreshLeads();
}

async function deleteNow(id: number) {
  await $fetch(`/api/leads/${id}`, { method: "DELETE" });
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
        <button
          class="tab"
          :class="{ 'tab-active': view === 'trash' }"
          @click="view = 'trash'"
        >
          Trash {{ leads?.filter((l) => l.deleted_at !== null).length ?? 0 }}
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
          <span v-if="view === 'trash'" class="days-left">
            {{ daysUntilDeletion(lead.deleted_at!) }} days left
          </span>
          <time v-else class="lead-date">{{ formatDate(lead.created_at) }}</time>
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

        <div v-if="replyingId === lead.id" class="reply-box">
          <textarea
            v-model="replyText"
            class="reply-textarea"
            placeholder="Write your reply..."
          ></textarea>
          <div class="reply-actions">
            <button class="ghost" @click="cancelReply">Cancel</button>
            <button class="reply-ai" @click="generateDraft(lead)">
              {{ replyText.trim() ? "Improve with AI" : "Generate with AI" }}
            </button>
            <button class="reply-send" @click="sendReply(lead.id)">Send</button>
          </div>
        </div>

        <div v-if="view === 'trash'" class="lead-actions">
          <button class="ghost" @click="restoreFromTrash(lead.id)">
            Restore
          </button>
          <button class="danger" @click="deleteNow(lead.id)">Delete now</button>
        </div>
        <div v-else class="lead-actions">
          <button class="delete-soft" @click="moveToTrash(lead.id)">
            Delete
          </button>
          <div class="lead-actions-primary">
            <button class="ghost" @click="openReply(lead.id)">Reply</button>
            <button
              class="toggle"
              @click="toggleHandled(lead.id, lead.handled)"
            >
              {{ lead.handled ? "Mark as to-do" : "Mark as handled" }}
            </button>
          </div>
        </div>
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

.days-left {
  color: #b45309;
  font-size: 0.85rem;
  font-weight: 600;
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

/* Bassa/media/alta come una sola scala di intensità (neutro -> ambra ->
   arancio scuro), non tre colori indipendenti — più satura e scura
   man mano che la priorità sale. */
.tag-priority-low {
  background: #f3f4f6;
  color: #6b7280;
}

.tag-priority-medium {
  background: #fef9e7;
  color: #b45309;
}

.tag-priority-high {
  background: #fff3e8;
  color: #c2410c;
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

.lead-actions {
  display: flex;
  justify-content: space-between;
  margin-top: 0.4rem;
}

.toggle {
  padding: 0.4rem 0.85rem;
  font-size: 0.85rem;
  background: transparent;
  color: #4f46e5;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.danger {
  padding: 0.4rem 0.85rem;
  font-size: 0.85rem;
  background: transparent;
  color: #dc2626;
  border: 1px solid #fecaca;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.danger:hover {
  background: #fef2f2;
}

.lead-actions-primary {
  display: flex;
  gap: 0.5rem;
}

/* Più tenue di .danger: sposta nel cestino (recuperabile), non cancella
   per sempre — un accenno di colore per distinguerlo dalle azioni
   sicure, senza l'urgenza visiva riservata a "Delete now". */
.delete-soft {
  padding: 0.4rem 0.85rem;
  font-size: 0.85rem;
  background: transparent;
  color: #b91c1c;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.delete-soft:hover {
  background: #fef2f2;
  border-color: #fecaca;
}

.reply-box {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.4rem;
  padding-top: 0.9rem;
  border-top: 1px solid #f0f0f1;
}

.reply-textarea {
  font: inherit;
  font-size: 0.9rem;
  padding: 0.6rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  min-height: 5rem;
  resize: vertical;
  color: #374151;
}

.reply-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.reply-ai {
  background: #eef2ff;
  color: #4338ca;
}

.reply-ai:hover {
  background: #e0e7ff;
}

.reply-send {
  background: #4f46e5;
  color: #fff;
}

.toggle:hover {
  background: #f3f4f6;
}
</style>
