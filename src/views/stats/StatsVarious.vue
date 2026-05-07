<template>
  <div class="stats-various">
    <section class="hero-card">
      <div>
        <h1>Statistiche Varie</h1>
        <p>Area pronta per analisi operative trasversali, anomalie e indicatori sintetici.</p>
      </div>
      <span class="status-pill">In allestimento</span>
    </section>

    <section class="placeholder-grid">
      <article class="placeholder-card">
        <span class="card-kicker">Prossimo blocco</span>
        <h2>Analisi miste per reparto</h2>
        <p>Spazio pensato per confronti rapidi tra hotel, beach e bar con lo stesso linguaggio visuale del resto della dashboard.</p>
      </article>
      <article class="placeholder-card accent">
        <span class="card-kicker">Roadmap</span>
        <ul>
          <li>Trend incrociati per periodo</li>
          <li>Anomalie operative e picchi</li>
          <li>Indicatori sintetici per turno</li>
        </ul>
      </article>
    </section>
  </div>
</template>

<script setup>
</script>

<style scoped>
.stats-various {
  padding: 8px;
  min-height: calc(100vh - 120px);
  display: grid;
  gap: 20px;
}

.hero-card,
.placeholder-card {
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow: var(--ds-shadow-card);
  backdrop-filter: blur(18px);
}

.hero-card {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 24px 28px;
  border-radius: 28px;
}

.hero-card h1 {
  margin: 0;
  color: var(--ds-text);
  font-size: clamp(1.8rem, 2vw, 2.2rem);
  font-weight: 800;
  letter-spacing: -0.04em;
}

.hero-card p {
  margin: 10px 0 0;
  color: var(--ds-text-soft);
  max-width: 640px;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  min-height: 38px;
  padding: 0 14px;
  border-radius: 999px;
  background: rgba(14, 165, 233, 0.1);
  border: 1px solid rgba(14, 165, 233, 0.18);
  color: #0369a1;
  font-size: 0.8rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.placeholder-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}

.placeholder-card {
  border-radius: 24px;
  padding: 24px;
}

.placeholder-card.accent {
  background: linear-gradient(135deg, rgba(239, 248, 255, 0.88), rgba(255, 247, 237, 0.84));
}

.card-kicker {
  display: inline-block;
  margin-bottom: 12px;
  color: var(--ds-text-soft);
  font-size: 0.74rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.placeholder-card h2 {
  margin: 0 0 12px;
  color: var(--ds-text);
  font-size: 1.2rem;
  font-weight: 800;
}

.placeholder-card p,
.placeholder-card li {
  color: var(--ds-text-soft);
}

.placeholder-card ul {
  margin: 0;
  padding-left: 18px;
}

@media (max-width: 860px) {
  .hero-card,
  .placeholder-grid {
    grid-template-columns: 1fr;
  }

  .hero-card {
    flex-direction: column;
  }
}
</style>
