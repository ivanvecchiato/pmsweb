<template>
  <div class="area-overview">
    <p class="area-description">{{ route.meta.description }} Scegli la funzione da aprire.</p>
    <div class="area-grid">
      <router-link v-for="item in items" :key="item.path" :to="item.path" class="area-card">
        <strong>{{ item.meta.title }}</strong>
        <span>{{ item.meta.description }}</span>
        <span class="area-card-action">Apri →</span>
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router'

defineProps({ items: { type: Array, required: true } })
const route = useRoute()
</script>

<style scoped>
.area-description {
  margin: 0 0 20px;
  color: var(--ds-text-soft);
}

.area-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
  gap: 16px;
}

.area-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 24px;
  border: 1px solid var(--ds-border);
  border-radius: 18px;
  background: var(--ds-surface-strong);
  color: var(--ds-text);
  text-decoration: none;
  box-shadow: var(--ds-shadow-card);
}

.area-card:hover {
  border-color: var(--ds-primary);
  background: var(--ds-surface-muted);
}

.area-card:focus-visible {
  outline: 2px solid var(--ds-primary);
  outline-offset: 3px;
}

.area-card strong {
  font-size: 1.05rem;
}

.area-card span {
  color: var(--ds-text-soft);
  line-height: 1.5;
}

.area-card .area-card-action {
  margin-top: auto;
  padding-top: 8px;
  color: var(--ds-primary);
  font-weight: 600;
}
</style>
