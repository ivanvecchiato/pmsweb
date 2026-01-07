<template>
  <div id="app">
    <aside class="sidebar" role="navigation" aria-label="Sidebar menu">
      <nav class="menu">
        <router-link
          to="/"
          :class="['menu-item', { active: route.path === '/' }]"
          aria-label="Vai alla Home"
        >
          <span class="icon" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
              <path d="M3 9.5L12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V9.5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
          <span class="label">Home</span>
        </router-link>

        <router-link
          to="/customers"
          :class="['menu-item', { active: route.path === '/customers' }]"
          aria-label="Gestione Clienti"
        >
          <span class="icon" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
              <path d="M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 21v-1.5C2 16.5 6.7 15 8 15s6 1.5 6 4.5V21H2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
          <span class="label">Clienti</span>
        </router-link>
      </nav>
    </aside>

    <main class="content">
      <router-view />
    </main>
  </div>
</template>

<script setup>
// Usato per determinare la route corrente e impostare lo stato "active" sugli item
import { useRoute } from 'vue-router'
const route = useRoute()
</script>

<style scoped>
:root { --primary: #1976d2; --onprimary: #ffffff; --bg: #f6f8fa; }
#app { min-height: 100vh; display:flex; flex-direction:row; background:var(--bg); font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }

/* Sidebar */
/* Icon SVGs use currentColor so they stay monochrome and match text color */
.icon svg { width:20px; height:20px; display:block; }
.menu-item .icon { line-height:0; }
.sidebar {
  width:64px;
  background:var(--primary);
  color:var(--onprimary);
  padding:12px 8px;
  display:flex;
  flex-direction:column;
  gap:8px;
  align-items:center;
  position:sticky;
  top:0;
  min-height:100vh;
  box-shadow:2px 0 6px rgba(0,0,0,0.06);
  z-index:10;
}

.menu { display:flex; flex-direction:column; gap:8px; width:100%; align-items:center; }
.menu-item { display:flex; align-items:center; gap:8px; padding:10px; color:inherit; text-decoration:none; border-radius:8px; width:100%; justify-content:center; box-sizing:border-box; }
.menu-item .icon { font-size:20px; display:inline-block; }
.menu-item .label { display:none; font-weight:600; }
.menu-item:hover { background:rgba(255,255,255,0.08); transform:translateY(-1px); }
.menu-item.active { background:var(--onprimary); color:var(--primary); }

.content { padding:16px; flex:1; min-height:100vh; }

/* wider screens: expand sidebar and show labels */
@media(min-width:600px) {
  .sidebar { width:200px; align-items:flex-start; padding:16px; }
  .menu { align-items:flex-start; }
  .menu-item { justify-content:flex-start; padding:10px 12px; }
  .menu-item .label { display:inline-block; }
}

/* focus styles */
.menu-item:focus { outline:2px solid rgba(255,255,255,0.25); outline-offset:2px; }
</style>