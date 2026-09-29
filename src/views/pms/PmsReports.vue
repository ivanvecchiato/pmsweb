<template>
  <div class="reports-page">
    <header class="reports-hero">
      <div>
        <span class="eyebrow">REPORT PMS / {{ reportLabels[activeReport].label }}</span>
        <h1>{{ reportLabels[activeReport].title }}</h1>
        <p>{{ reportLabels[activeReport].description }}</p>
      </div>
      <span class="hero-badge">Hotel</span>
    </header>

    <nav class="report-tabs" aria-label="Tipologia report">
      <button type="button" :class="{ active: activeReport === 'sales' }" :aria-current="activeReport === 'sales' ? 'page' : undefined" @click="selectReport('sales')">Vendite</button>
      <button type="button" :class="{ active: activeReport === 'presences' }" :aria-current="activeReport === 'presences' ? 'page' : undefined" @click="selectReport('presences')">Presenze</button>
      <button type="button" :class="{ active: activeReport === 'bookings' }" :aria-current="activeReport === 'bookings' ? 'page' : undefined" @click="selectReport('bookings')">Prenotazioni</button>
      <button type="button" :class="{ active: activeReport === 'occupancy' }" :aria-current="activeReport === 'occupancy' ? 'page' : undefined" @click="selectReport('occupancy')">Occupazione</button>
      <button type="button" :class="{ active: activeReport === 'economics' }" :aria-current="activeReport === 'economics' ? 'page' : undefined" @click="selectReport('economics')">ADR e RevPAR</button>
      <button type="button" :class="{ active: activeReport === 'analytical' }" :aria-current="activeReport === 'analytical' ? 'page' : undefined" @click="selectReport('analytical')">Dati analitici</button>
      <button type="button" :class="{ active: activeReport === 'channels' }" :aria-current="activeReport === 'channels' ? 'page' : undefined" @click="selectReport('channels')">Canali</button>
    </nav>

    <form class="filters-card" @submit.prevent="loadReport">
      <div class="filters-heading">
        <div><strong>Periodo di analisi</strong><span>{{ reportLabels[activeReport].periodHint }}</span></div>
        <div class="quick-periods">
          <button type="button" @click="selectPeriod('month')">Questo mese</button>
          <button type="button" @click="selectPeriod('previous')">Mese scorso</button>
        </div>
      </div>
      <div class="filter-fields">
        <label>Dal <input v-model="fromDate" type="date" required></label>
        <label>Al <input v-model="toDate" type="date" required></label>
        <label v-if="activeReport === 'presences'">Tipologia <select v-model="presenceRoomType" @change="loadReport"><option value="">Tutte le tipologie</option><option v-for="type in report?.filters?.roomTypes || []" :key="type.id" :value="type.id">{{ type.label }}</option></select></label>
        <label v-if="activeReport === 'presences'">Canale <select v-model="presenceChannel" @change="loadReport"><option value="">Tutti i canali</option><option v-for="channel in report?.filters?.channels || []" :key="channel" :value="channel">{{ channel }}</option></select></label>
        <button type="submit" :disabled="loading">{{ loading ? 'Caricamento…' : 'Aggiorna report' }}</button>
      </div>
    </form>

    <div v-if="error" class="report-error" role="alert">
      <span>{{ error }}</span>
      <button type="button" @click="loadReport">Riprova</button>
    </div>
    <div v-else-if="loading && !report" class="report-state">Caricamento del report…</div>
    <template v-else-if="report">
      <div v-if="loading" class="refresh-note">Aggiornamento in corso…</div>
      <template v-if="activeReport === 'sales'">
      <section class="metric-grid" aria-label="Riepilogo vendite">
        <article class="metric-card metric-primary">
          <span class="metric-label">Vendite fiscalizzate</span>
          <strong>{{ money(report.totals.sales) }}</strong>
          <small>{{ report.totals.documents }} documenti nel periodo</small>
        </article>
        <article class="metric-card"><span class="metric-label">Soggiorno al saldo</span><strong>{{ money(report.totals.stays) }}</strong><small>Al netto degli acconti già versati</small></article>
        <article class="metric-card"><span class="metric-label">Acconti emessi</span><strong>{{ money(report.totals.deposits) }}</strong><small>Documenti di deposito</small></article>
        <article class="metric-card"><span class="metric-label">Servizi e altri extra</span><strong>{{ money(report.totals.services + report.totals.restaurant + report.totals.hotel) }}</strong><small>Servizi, ristorante e hotel</small></article>
        <article class="metric-card"><span class="metric-label">Bar</span><strong>{{ money(report.totals.bar) }}</strong><small>Incluso nel conto hotel</small></article>
        <article class="metric-card"><span class="metric-label">Tassa di soggiorno</span><strong>{{ money(report.totals.cityTax) }}</strong><small>Esposta separatamente</small></article>
      </section>

      <section class="panel trend-panel">
        <div class="section-header"><div><span class="eyebrow">ANDAMENTO</span><h2>Vendite giornaliere</h2></div><span class="section-total">{{ money(report.totals.sales) }} nel periodo</span></div>
        <div v-if="report.days.length" class="trend-bars">
          <div v-for="day in report.days" :key="day.date" class="trend-row">
            <time :datetime="day.date">{{ shortDate(day.date) }}</time>
            <div class="bar-track"><div class="bar-fill" :style="{ width: `${Math.max(2, day.amount / maxDayAmount * 100)}%` }"></div></div>
            <strong>{{ money(day.amount) }}</strong>
          </div>
        </div>
        <p v-else class="empty-state">Nessun documento fiscale nel periodo selezionato.</p>
      </section>

      <section v-if="report.roomTypes.length" class="panel distribution-panel">
        <div class="section-header"><div><span class="eyebrow">MIX ECONOMICO</span><h2>Ricavi camera per tipologia</h2></div><span class="section-total">{{ money(report.totals.deposits + report.totals.stays) }} nel periodo</span></div>
        <p class="panel-intro">Acconti fiscalizzati e soggiorno al saldo, al netto degli acconti già versati. La quota esclude extra e tassa di soggiorno.</p>
        <div class="report-table-wrap">
          <table class="report-table distribution-table sales-type-table">
            <thead><tr><th scope="col">Tipologia</th><th scope="col">Quota ricavi camera</th><th scope="col" class="number-cell">Ricavi camera</th></tr></thead>
            <tbody><tr v-for="entry in report.roomTypes" :key="entry.roomType"><th scope="row">{{ entry.roomType }}</th><td><div class="share-cell"><div class="bar-track"><div class="bar-fill" :style="{ width: `${Math.max(0, entry.amount) / maxRoomTypeAmount * 100}%` }"></div></div><span>{{ entry.percentage }}%</span></div></td><td class="number-cell">{{ money(entry.amount) }}</td></tr></tbody>
          </table>
        </div>
      </section>

      <section v-if="report.channels.length" class="panel channels-panel">
        <div class="section-header"><div><span class="eyebrow">ORIGINE</span><h2>Vendite per canale</h2></div></div>
        <div class="channel-grid"><article v-for="entry in report.channels" :key="entry.channel" class="channel-card"><span>{{ entry.channel }}</span><strong>{{ money(entry.amount) }}</strong><small>{{ entry.percentage }}% del periodo</small></article></div>
      </section>

      <section class="panel documents-panel">
        <div class="section-header"><div><span class="eyebrow">DETTAGLIO</span><h2>Documenti emessi</h2></div><span class="count-badge">{{ report.rows.length }}</span></div>
        <p class="panel-intro">Seleziona un documento per vedere come contribuisce al totale.</p>
        <div v-if="report.rows.length" class="document-grid">
          <article v-for="row in visibleRows" :key="row.id" class="document-card">
            <button type="button" class="document-trigger" :aria-expanded="expandedId === row.id" @click="expandedId = expandedId === row.id ? null : row.id">
              <span class="document-top"><span class="type-badge" :class="{ deposit: row.type === 'deposit' }">{{ row.type === 'deposit' ? 'Acconto' : 'Saldo conto' }}</span><time :datetime="row.closedAt">{{ dateTime(row.closedAt) }}</time></span>
              <span class="document-main"><span><strong>{{ row.guest || 'Ospite' }}</strong><small>Camera {{ row.room || '—' }} · {{ row.roomType || 'Tipologia non indicata' }}</small></span><b>{{ money(row.amount) }}</b></span>
              <span class="document-bottom"><span>{{ row.channel || 'Canale non classificato' }}</span><span>Documento {{ row.progressivo || '—' }} <span aria-hidden>⌄</span></span></span>
            </button>
            <div v-if="expandedId === row.id" class="document-detail">
              <div v-for="part in componentLabels" :key="part.key" v-show="row.components[part.key]" class="detail-line"><span>{{ part.label }}</span><strong>{{ money(row.components[part.key]) }}</strong></div>
              <router-link v-if="hasPermission('home')" :to="{ path: '/accounts', query: { documentId: row.id, from: row.date, to: row.date } }">Apri documento →</router-link>
            </div>
          </article>
        </div>
        <p v-else class="empty-state">Nessun documento da mostrare.</p>
        <button v-if="report.rows.length > visibleCount" type="button" class="more-button" @click="visibleCount += 12">Mostra altri documenti</button>
      </section>
      </template>

      <template v-else-if="activeReport === 'presences'">
        <section class="metric-grid presence-metrics" aria-label="Riepilogo presenze">
          <article class="metric-card metric-primary"><span class="metric-label">Pernottamenti</span><strong>{{ report.totals.nights }}</strong><small>Notti concluse nel periodo</small></article>
          <article class="metric-card"><span class="metric-label">Ospiti registrati</span><strong>{{ report.totals.guests }}</strong><small>Un record per ospite e soggiorno</small></article>
          <article class="metric-card"><span class="metric-label">Arrivi</span><strong>{{ report.totals.arrivals }}</strong><small>Check-in individuali nel periodo</small></article>
          <article class="metric-card"><span class="metric-label">Partenze effettive</span><strong>{{ report.totals.departures }}</strong><small>Ospiti con checkout eseguito</small></article>
        </section>
        <div class="demographics-line" aria-label="Composizione per età">
          <strong>Età all'arrivo</strong><span>{{ report.totals.adults }} maggiorenni</span><span>{{ report.totals.minors }} minori</span><span>{{ report.totals.ageUnknown }} non disponibile</span>
        </div>

        <section class="panel trend-panel">
          <div class="section-header"><div><span class="eyebrow">ANDAMENTO</span><h2>Pernottamenti per giorno</h2></div><span class="section-total">{{ report.totals.nights }} notti nel periodo</span></div>
          <p class="panel-intro">La notte corrente compare solo dopo che è trascorsa.</p>
          <div v-if="report.days.length" class="trend-bars">
            <div v-for="day in report.days" :key="day.date" class="trend-row presence-trend-row">
              <time :datetime="day.date">{{ shortDate(day.date) }}</time>
              <div class="bar-track"><div class="bar-fill" :style="{ width: `${day.nights ? Math.max(2, day.nights / maxNights * 100) : 0}%` }"></div></div>
              <strong>{{ day.nights }} notti</strong>
              <span class="movement-count">{{ day.arrivals }} arrivi · {{ day.departures }} partenze</span>
            </div>
          </div>
          <p v-else class="empty-state">Nessuna presenza registrata nel periodo selezionato.</p>
        </section>

        <section class="panel distribution-panel">
          <div class="section-header"><div><span class="eyebrow">COMPOSIZIONE</span><h2>Distribuzione ospiti</h2></div></div>
          <div class="distribution-tabs" role="group" aria-label="Dimensione della distribuzione">
            <button v-for="option in distributionOptions" :key="option.key" type="button" :class="{ active: distributionType === option.key }" :aria-pressed="distributionType === option.key" @click="distributionType = option.key">{{ option.label }}</button>
          </div>
          <div v-if="distributionRows.length" class="report-table-wrap distribution-wrap">
            <table class="report-table distribution-table">
              <thead><tr><th scope="col">{{ distributionOptions.find(option => option.key === distributionType).label }}</th><th scope="col">Incidenza</th><th scope="col" class="number-cell">Ospiti</th></tr></thead>
              <tbody><tr v-for="entry in distributionRows" :key="entry.key"><th scope="row">{{ entry.label }}</th><td><div class="share-cell"><div class="bar-track"><div class="bar-fill" :style="{ width: `${entry.guests / maxDistribution * 100}%` }"></div></div><span>{{ report.totals.guests ? Math.round(entry.guests / report.totals.guests * 100) : 0 }}%</span></div></td><td class="number-cell">{{ entry.guests }}</td></tr></tbody>
            </table>
          </div>
          <p v-else class="empty-state">Nessun dato per questa distribuzione.</p>
        </section>

        <section class="panel documents-panel">
          <div class="section-header"><div><span class="eyebrow">DETTAGLIO</span><h2>Ospiti registrati</h2></div><span class="count-badge">{{ report.rows.length }}</span></div>
          <p class="panel-intro">Le date e le notti appartengono al singolo ospite, non alla prenotazione nel suo complesso.</p>
          <div v-if="report.rows.length" class="report-table-wrap">
            <table class="report-table guest-table">
              <thead><tr><th scope="col">Ospite</th><th scope="col">Camera</th><th scope="col">Arrivo</th><th scope="col">Partenza</th><th scope="col" class="number-cell">Notti</th><th scope="col">Nazionalità</th><th scope="col">Provenienza</th><th scope="col">Canale</th></tr></thead>
              <tbody><tr v-for="row in visibleRows" :key="row.id"><th scope="row"><span class="guest-name">{{ row.guest || 'Ospite' }}</span><small>{{ row.ageGroup === 'adult' ? 'Maggiorenne' : row.ageGroup === 'minor' ? 'Minore' : 'Età non disponibile' }}</small></th><td>{{ row.room || '—' }}<small>{{ row.roomType }}</small></td><td>{{ row.checkin }}</td><td><span>{{ row.checkout }}</span><small>{{ row.departure ? 'Effettiva' : 'Prevista' }}</small></td><td class="number-cell">{{ row.nights }}</td><td>{{ countryName(row.nationality) }}</td><td>{{ countryName(row.origin) }}</td><td>{{ row.channel }}</td></tr></tbody>
            </table>
          </div>
          <p v-else class="empty-state">Nessun ospite da mostrare.</p>
          <button v-if="report.rows.length > visibleCount" type="button" class="more-button" @click="visibleCount += 12">Mostra altri ospiti</button>
        </section>
      </template>

      <template v-else-if="activeReport === 'occupancy'">
        <div v-if="report.dataQuality.excludedRoom500" class="report-warning" role="status">Camera 500 esclusa: {{ report.dataQuality.excludedRoom500 }} {{ report.dataQuality.excludedRoom500 === 1 ? 'prenotazione' : 'prenotazioni' }} senza riscontro nell'inventario locale.</div>
        <section class="metric-grid occupancy-metrics" aria-label="Riepilogo occupazione">
          <article class="metric-card metric-primary"><span class="metric-label">Tasso di occupazione</span><strong>{{ report.totals.occupancyRate === null ? '—' : `${report.totals.occupancyRate}%` }}</strong><small>Camere-notte vendute / disponibili</small></article>
          <article class="metric-card"><span class="metric-label">Camere-notte vendute</span><strong>{{ report.totals.soldRoomNights }}</strong><small>Camera fisica occupata per notte</small></article>
          <article class="metric-card"><span class="metric-label">Camere-notte disponibili</span><strong>{{ report.totals.availableRoomNights }}</strong><small>{{ report.totals.physicalRooms }} camere × {{ report.totals.periodDays }} notti</small></article>
        </section>
        <div v-if="report.totals.conflicts || report.totals.technicalOverbookings" class="report-warning" role="status">
          {{ report.totals.conflicts }} sovrapposizioni sulla stessa camera · {{ report.totals.technicalOverbookings }} camere-notte tecniche Over. Non aumentano le camere vendute né la capacità.
        </div>
        <section class="panel">
          <div class="section-header"><div><span class="eyebrow">ANDAMENTO</span><h2>Occupazione per notte</h2></div><span class="section-total">{{ report.totals.occupancyRate === null ? '—' : `${report.totals.occupancyRate}%` }} nel periodo</span></div>
          <p class="panel-intro">Il tasso del periodo è ponderato sulle camere-notte, non è la media delle percentuali giornaliere. Le notti future riflettono le prenotazioni attuali.</p>
          <div class="report-table-wrap occupancy-days-wrap"><table class="report-table occupancy-table"><thead><tr><th scope="col">Notte</th><th scope="col">Occupazione</th><th scope="col" class="number-cell">Vendute</th><th scope="col" class="number-cell">Disponibili</th><th scope="col" class="number-cell">Anomalie</th></tr></thead><tbody><tr v-for="day in report.days" :key="day.date"><th scope="row"><time :datetime="day.date">{{ shortDate(day.date) }}</time></th><td><div class="share-cell"><div class="bar-track"><div class="bar-fill" :style="{ width: `${day.occupancyRate || 0}%` }"></div></div><span>{{ day.occupancyRate === null ? '—' : `${day.occupancyRate}%` }}</span></div></td><td class="number-cell">{{ day.soldRoomNights }}</td><td class="number-cell">{{ day.availableRoomNights }}</td><td class="number-cell">{{ day.conflicts + day.technicalOverbookings || '—' }}</td></tr></tbody></table></div>
        </section>
        <section class="panel">
          <div class="section-header"><div><span class="eyebrow">TIPOLOGIE</span><h2>Occupazione per tipologia</h2></div><span class="count-badge">{{ report.roomTypes.length }}</span></div>
          <div v-if="report.roomTypes.length" class="report-table-wrap"><table class="report-table occupancy-table"><thead><tr><th scope="col">Tipologia</th><th scope="col">Occupazione</th><th scope="col" class="number-cell">Camere</th><th scope="col" class="number-cell">Vendute</th><th scope="col" class="number-cell">Disponibili</th></tr></thead><tbody><tr v-for="type in report.roomTypes" :key="type.id"><th scope="row">{{ type.label }}</th><td><div class="share-cell"><div class="bar-track"><div class="bar-fill" :style="{ width: `${type.occupancyRate}%` }"></div></div><span>{{ type.occupancyRate }}%</span></div></td><td class="number-cell">{{ type.rooms }}</td><td class="number-cell">{{ type.soldRoomNights }}</td><td class="number-cell">{{ type.availableRoomNights }}</td></tr></tbody></table></div>
          <p v-else class="empty-state">Nessuna camera fisica configurata.</p>
        </section>
        <section class="panel">
          <div class="section-header"><div><span class="eyebrow">DETTAGLIO</span><h2>Singole camere</h2></div><span class="count-badge">{{ report.rooms.length }}</span></div>
          <div v-if="report.rooms.length" class="report-table-wrap occupancy-rooms-wrap"><table class="report-table occupancy-table"><thead><tr><th scope="col">Camera</th><th scope="col">Tipologia</th><th scope="col">Occupazione</th><th scope="col" class="number-cell">Notti vendute</th><th scope="col" class="number-cell">Notti disponibili</th></tr></thead><tbody><tr v-for="room in report.rooms" :key="room.id"><th scope="row">{{ room.room }}</th><td>{{ room.roomType }}</td><td><div class="share-cell"><div class="bar-track"><div class="bar-fill" :style="{ width: `${room.occupancyRate}%` }"></div></div><span>{{ room.occupancyRate }}%</span></div></td><td class="number-cell">{{ room.soldRoomNights }}</td><td class="number-cell">{{ room.availableRoomNights }}</td></tr></tbody></table></div>
          <p v-else class="empty-state">Nessuna camera fisica configurata.</p>
        </section>
      </template>

      <template v-else-if="activeReport === 'economics'">
        <div v-if="report.dataQuality.missingPriceReservations" class="report-warning" role="status">{{ report.dataQuality.missingPriceReservations }} prenotazioni senza prezzo camera utilizzabile: ADR e RevPAR del periodo non sono determinabili.</div>
        <div v-if="report.dataQuality.excludedRoom500" class="report-warning" role="status">Camera 500 esclusa: {{ report.dataQuality.excludedRoom500 }} {{ report.dataQuality.excludedRoom500 === 1 ? 'prenotazione' : 'prenotazioni' }} senza riscontro nell'inventario locale.</div>
        <section class="metric-grid economics-metrics" aria-label="Indicatori economici camere">
          <article class="metric-card metric-primary"><span class="metric-label">ADR · tariffa media venduta</span><strong>{{ report.totals.adr === null ? '—' : money(report.totals.adr) }}</strong><small>Ricavo camera / camere-notte vendute</small></article>
          <article class="metric-card"><span class="metric-label">RevPAR · ricavo per camera disponibile</span><strong>{{ report.totals.revpar === null ? '—' : money(report.totals.revpar) }}</strong><small>Ricavo camera / camere-notte disponibili</small></article>
        </section>
        <div class="demographics-line" aria-label="Base di calcolo"><strong>Base del periodo</strong><span>Ricavo camera: {{ report.totals.roomRevenue === null ? 'non determinabile' : money(report.totals.roomRevenue) }}</span><span>{{ report.totals.soldRoomNights }} camere-notte vendute</span><span>{{ report.totals.availableRoomNights }} camere-notte disponibili</span></div>
        <section class="panel">
          <div class="section-header"><div><span class="eyebrow">STAY DATE</span><h2>Ricavo e rendimento per notte</h2></div></div>
          <p class="panel-intro">Il ricavo segue la notte di soggiorno, non la data del documento fiscale. Extra e tassa di soggiorno sono esclusi. Il periodo è calcolato sui totali, non sulla media degli indicatori giornalieri.</p>
          <div class="report-table-wrap occupancy-days-wrap"><table class="report-table economics-table"><thead><tr><th scope="col">Notte</th><th scope="col" class="number-cell">Ricavo camera</th><th scope="col" class="number-cell">Vendute</th><th scope="col" class="number-cell">Disponibili</th><th scope="col" class="number-cell">ADR</th><th scope="col" class="number-cell">RevPAR</th></tr></thead><tbody><tr v-for="day in report.days" :key="day.date"><th scope="row"><time :datetime="day.date">{{ shortDate(day.date) }}</time></th><td class="number-cell">{{ day.roomRevenue === null ? '—' : money(day.roomRevenue) }}</td><td class="number-cell">{{ day.soldRoomNights }}</td><td class="number-cell">{{ day.availableRoomNights }}</td><td class="number-cell">{{ day.adr === null ? '—' : money(day.adr) }}</td><td class="number-cell">{{ day.revpar === null ? '—' : money(day.revpar) }}</td></tr></tbody></table></div>
        </section>
      </template>

      <template v-else-if="activeReport === 'analytical'">
        <div v-if="report.dataQuality.missingPriceReservations || report.dataQuality.incompleteExtraReservations" class="report-warning" role="status">Ricavo non determinabile: {{ report.dataQuality.missingPriceReservations }} prenotazioni senza prezzo camera completo e {{ report.dataQuality.incompleteExtraReservations }} con extra incompleti.</div>
        <div v-if="report.dataQuality.pendingBookings || report.dataQuality.invalidFallbackBookings" class="report-warning" role="status">Ricavo per ospite: {{ report.dataQuality.pendingBookings }} prenotazioni con persone specificate ma senza presenze registrate restano in sospeso; {{ report.dataQuality.invalidFallbackBookings }} prenotazioni senza persone specificate non hanno un numero previsto valido. I loro ricavi non entrano nella media per ospite.</div>
        <div v-if="report.dataQuality.excludedRoom500" class="report-warning" role="status">Camera 500 esclusa: {{ report.dataQuality.excludedRoom500 }} {{ report.dataQuality.excludedRoom500 === 1 ? 'prenotazione' : 'prenotazioni' }} senza riscontro nell'inventario locale.</div>
        <section class="metric-grid analytical-metrics" aria-label="Indicatori analitici">
          <article class="metric-card metric-primary"><span class="metric-label">TRevPAR · ricavo totale per camera disponibile</span><strong>{{ report.totals.trevpar === null ? '—' : money(report.totals.trevpar) }}</strong><small>Camere ed extra / camere-notte disponibili</small></article>
          <article class="metric-card"><span class="metric-label">Ricavo medio per prenotazione</span><strong>{{ report.totals.revenuePerBooking === null ? '—' : money(report.totals.revenuePerBooking) }}</strong><small>Ricavo del periodo / prenotazioni con soggiorno nel periodo</small></article>
          <article class="metric-card"><span class="metric-label">Ricavo medio per ospite</span><strong>{{ report.totals.revenuePerGuest === null ? '—' : money(report.totals.revenuePerGuest) }}</strong><small>Solo prenotazioni con presenze registrate o pax preliminare</small></article>
        </section>
        <div class="demographics-line" aria-label="Base di calcolo"><strong>Base del periodo</strong><span>{{ report.totals.bookings }} prenotazioni</span><span>{{ report.totals.registeredGuests }} presenze registrate</span><span>{{ report.totals.fallbackGuests }} ospiti previsti da prenotazioni senza persone specificate</span><span>{{ report.totals.availableRoomNights }} camere-notte disponibili</span><span>Ricavo totale: {{ report.totals.totalRevenue === null ? 'non determinabile' : money(report.totals.totalRevenue) }}</span></div>
        <section class="panel">
          <div class="section-header"><div><span class="eyebrow">EXTRA</span><h2>Ricavi aggiuntivi</h2></div><span class="section-total">{{ report.totals.extraRevenue === null ? '—' : money(report.totals.extraRevenue) }} nel periodo</span></div>
          <p class="panel-intro">I servizi hotel sono conteggiati nel giorno di attribuzione; il bar alla data del saldo del suo documento. Il dettaglio delle consumazioni resta nelle statistiche bar. La tassa di soggiorno è esclusa.</p>
          <div class="report-table-wrap"><table class="report-table analytical-summary-table"><thead><tr><th scope="col">Indicatore</th><th scope="col" class="number-cell">Valore</th><th scope="col">Calcolo</th></tr></thead><tbody><tr><th scope="row">Ricavo extra per prenotazione</th><td class="number-cell">{{ report.totals.extraPerBooking === null ? '—' : money(report.totals.extraPerBooking) }}</td><td>Extra del periodo / prenotazioni</td></tr><tr><th scope="row">Ricavo extra per ospite</th><td class="number-cell">{{ report.totals.extraPerGuest === null ? '—' : money(report.totals.extraPerGuest) }}</td><td>Extra delle prenotazioni conteggiabili / presenze registrate e pax preliminare</td></tr></tbody></table></div>
        </section>
        <section class="panel">
          <div class="section-header"><div><span class="eyebrow">STAY DATE</span><h2>Composizione del ricavo per notte</h2></div></div>
          <p class="panel-intro">Il ricavo camera segue le notti di soggiorno; gli extra seguono il giorno di attribuzione o saldo. Il TRevPAR del periodo è calcolato sui totali, non come media dei valori giornalieri.</p>
          <div class="report-table-wrap occupancy-days-wrap"><table class="report-table analytical-days-table"><thead><tr><th scope="col">Notte</th><th scope="col" class="number-cell">Camere</th><th scope="col" class="number-cell">Extra</th><th scope="col" class="number-cell">Totale</th><th scope="col" class="number-cell">Disponibili</th><th scope="col" class="number-cell">TRevPAR</th></tr></thead><tbody><tr v-for="day in report.days" :key="day.date"><th scope="row"><time :datetime="day.date">{{ shortDate(day.date) }}</time></th><td class="number-cell">{{ day.roomRevenue === null ? '—' : money(day.roomRevenue) }}</td><td class="number-cell">{{ day.extraRevenue === null ? '—' : money(day.extraRevenue) }}</td><td class="number-cell">{{ day.totalRevenue === null ? '—' : money(day.totalRevenue) }}</td><td class="number-cell">{{ day.availableRoomNights }}</td><td class="number-cell">{{ day.trevpar === null ? '—' : money(day.trevpar) }}</td></tr></tbody></table></div>
        </section>
      </template>

      <template v-else-if="activeReport === 'channels'">
        <div v-if="report.dataQuality.missingPriceReservations" class="report-warning" role="status">{{ report.dataQuality.missingPriceReservations }} prenotazioni senza prezzo camera completo: il ricavo e le quote economiche non sono determinabili.</div>
        <div v-if="report.dataQuality.excludedRoom500" class="report-warning" role="status">Camera 500 esclusa: {{ report.dataQuality.excludedRoom500 }} {{ report.dataQuality.excludedRoom500 === 1 ? 'prenotazione' : 'prenotazioni' }} senza riscontro nell'inventario locale.</div>
        <div class="demographics-line" aria-label="Totali del periodo"><strong>Totali del periodo</strong><span>{{ report.totals.bookings }} prenotazioni</span><span>{{ report.totals.roomNights }} camere-notte</span><span>Ricavo camera: {{ report.totals.roomRevenue === null ? 'non determinabile' : money(report.totals.roomRevenue) }}</span></div>
        <section class="panel">
          <div class="section-header"><div><span class="eyebrow">MIX COMMERCIALE</span><h2>Distribuzione per canale</h2></div><span class="count-badge">{{ report.channels.length }} canali</span></div>
          <p class="panel-intro">Ogni prenotazione è attribuita al proprio canale. Camere-notte e ricavo camera seguono le notti di soggiorno nel periodo; le quote sono calcolate sui rispettivi totali. Gli extra non sono inclusi.</p>
          <div v-if="report.channels.length" class="report-table-wrap"><table class="report-table channels-table"><thead><tr><th scope="col">Canale</th><th scope="col" class="number-cell">Prenotazioni · quota</th><th scope="col" class="number-cell">Camere-notte · quota</th><th scope="col" class="number-cell">Ricavo camera · quota</th></tr></thead><tbody><tr v-for="channel in report.channels" :key="channel.channel" :class="{ 'channel-unclassified': channel.channel === 'Non classificato' }"><th scope="row">{{ channel.channel }}</th><td class="number-cell"><strong>{{ channel.bookings }}</strong><small>{{ channel.bookingShare }}%</small></td><td class="number-cell"><strong>{{ channel.roomNights }}</strong><small>{{ channel.roomNightShare }}%</small></td><td class="number-cell"><strong>{{ channel.roomRevenue === null ? '—' : money(channel.roomRevenue) }}</strong><small>{{ channel.revenueShare === null ? '—' : `${channel.revenueShare}%` }}</small></td></tr></tbody></table></div>
          <p v-else class="empty-state">Nessuna prenotazione nel periodo selezionato.</p>
          <p v-if="report.dataQuality.unclassifiedBookings" class="panel-intro">{{ report.dataQuality.unclassifiedBookings }} {{ report.dataQuality.unclassifiedBookings === 1 ? 'prenotazione senza canale' : 'prenotazioni senza canale' }}: mantenute in “Non classificato”, non nel canale diretto.</p>
        </section>
      </template>

      <template v-else>
        <div v-if="report.dataQuality?.warning" class="report-warning" role="status">{{ report.dataQuality.warning.message }} Il dettaglio degli eventi potrebbe essere incompleto.</div>
        <section class="metric-grid bookings-metrics" aria-label="Riepilogo prenotazioni">
          <article class="metric-card metric-primary"><span class="metric-label">Create</span><strong>{{ report.totals.created }}</strong><small>Per data di creazione</small></article>
          <article class="metric-card"><span class="metric-label">Ora confermate</span><strong>{{ report.totals.confirmed }}</strong><small>Tra le create nel periodo</small></article>
          <article class="metric-card"><span class="metric-label">Modifiche</span><strong>{{ report.totals.modified }}</strong><small>Operazioni nel periodo</small></article>
          <article class="metric-card"><span class="metric-label">Cancellazioni</span><strong>{{ report.totals.cancelled }}</strong><small>Per data di cancellazione</small></article>
          <article class="metric-card"><span class="metric-label">No-show</span><strong>{{ report.totals.noShows }}</strong><small>Separati dalle cancellazioni</small></article>
        </section>

        <section class="panel">
          <div class="section-header"><div><span class="eyebrow">COORTE DI ARRIVO</span><h2>Tassi di cancellazione e no-show</h2></div><span class="section-total">{{ report.cohort.bookings }} prenotazioni con check-in previsto</span></div>
          <p class="panel-intro">I tassi considerano lo stato attuale delle prenotazioni con check-in previsto nel periodo. Sono distinti dai conteggi sopra, che seguono la data effettiva dell'evento.</p>
          <div class="report-table-wrap"><table class="report-table booking-rates-table"><thead><tr><th scope="col">Esito</th><th scope="col" class="number-cell">Prenotazioni</th><th scope="col" class="number-cell">Tasso sulla coorte</th></tr></thead><tbody><tr><th scope="row">Cancellazioni</th><td class="number-cell">{{ report.cohort.cancelled }} / {{ report.cohort.bookings }}</td><td class="number-cell"><strong>{{ report.cohort.cancellationRate === null ? '—' : `${report.cohort.cancellationRate}%` }}</strong></td></tr><tr><th scope="row">No-show</th><td class="number-cell">{{ report.cohort.noShows }} / {{ report.cohort.bookings }}</td><td class="number-cell"><strong>{{ report.cohort.noShowRate === null ? '—' : `${report.cohort.noShowRate}%` }}</strong></td></tr></tbody></table></div>
        </section>

        <section class="panel">
          <div class="section-header"><div><span class="eyebrow">ANDAMENTO</span><h2>Movimenti per giorno</h2></div></div>
          <p class="panel-intro">Le confermate sono uno stato attuale delle prenotazioni create, non un evento giornaliero. Una prenotazione può comparire in più colonne.</p>
          <div v-if="report.days.length" class="report-table-wrap booking-days-wrap">
            <table class="report-table booking-days-table">
              <thead><tr><th scope="col">Giorno</th><th scope="col" class="number-cell">Create</th><th scope="col" class="number-cell">Modifiche</th><th scope="col" class="number-cell">Cancellazioni</th><th scope="col" class="number-cell">No-show</th></tr></thead>
              <tbody><tr v-for="day in report.days" :key="day.date"><th scope="row"><time :datetime="day.date">{{ shortDate(day.date) }}</time></th><td class="number-cell">{{ day.created }}</td><td class="number-cell">{{ day.modified }}</td><td class="number-cell">{{ day.cancelled }}</td><td class="number-cell">{{ day.noShows }}</td></tr></tbody>
            </table>
          </div>
          <p v-else class="empty-state">Nessun movimento nel periodo selezionato.</p>
        </section>

        <section class="panel">
          <div class="section-header"><div><span class="eyebrow">DETTAGLIO</span><h2>Movimenti prenotazioni</h2></div><span class="count-badge">{{ bookingRows.length }}</span></div>
          <div class="booking-detail-filter"><label>Tipo movimento <select v-model="bookingEventType"><option value="all">Tutti</option><option value="created">Creazioni</option><option value="modified">Modifiche</option><option value="cancelled">Cancellazioni</option><option value="noShow">No-show</option></select></label></div>
          <div v-if="bookingRows.length" class="report-table-wrap">
            <table class="report-table booking-detail-table">
              <thead><tr><th scope="col">Quando</th><th scope="col">Movimento</th><th scope="col">Prenotazione</th><th scope="col">Ospite</th><th scope="col">Camera</th><th scope="col">Canale</th><th scope="col">Soggiorno</th></tr></thead>
              <tbody><tr v-for="row in visibleBookingRows" :key="row.id"><td>{{ dateTime(row.timestamp) }}</td><td><span class="booking-event" :class="row.type">{{ bookingEventLabels[row.type] }}</span><small v-if="row.type === 'created' && row.confirmed">Ora confermata</small></td><th scope="row">{{ row.reservationId }}</th><td>{{ row.guest || '—' }}</td><td>{{ row.room || '—' }}<small>{{ row.roomType }}</small></td><td>{{ row.channel || '—' }}</td><td>{{ row.checkin || '—' }} <span v-if="row.checkout">→ {{ row.checkout }}</span></td></tr></tbody>
            </table>
          </div>
          <p v-else class="empty-state">Nessun movimento da mostrare.</p>
          <button v-if="bookingRows.length > visibleCount" type="button" class="more-button" @click="visibleCount += 12">Mostra altri movimenti</button>
        </section>
      </template>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import { useAuth } from '@/composables/useAuth'

const { currentUser, hasPermission } = useAuth()
const today = new Date()
const fromDate = ref(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`)
const toDate = ref(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`)
const activeReport = ref('sales')
const reportLabels = {
  sales: { label: 'VENDITE', title: 'Vendite per periodo', description: 'Documenti fiscali emessi, attribuiti al giorno di emissione.', periodHint: "Le date si riferiscono all'emissione fiscale." },
  presences: { label: 'PRESENZE', title: 'Presenze per periodo', description: 'Ospiti registrati, arrivi, partenze e pernottamenti effettivi.', periodHint: 'Arrivi e partenze seguono le date individuali degli ospiti.' },
  bookings: { label: 'PRENOTAZIONI', title: 'Prenotazioni per periodo', description: 'Creazioni, stato di conferma e movimenti delle prenotazioni.', periodHint: 'Creazioni e movimenti seguono la data del rispettivo evento.' },
  occupancy: { label: 'OCCUPAZIONE', title: 'Tasso di occupazione', description: 'Camere fisiche vendute rispetto alla capacità del periodo.', periodHint: 'Ogni notte va dal check-in incluso al checkout escluso.' },
  economics: { label: 'ADR E REVPAR', title: 'Rendimento economico delle camere', description: 'Tariffa media venduta e ricavo per camera disponibile.', periodHint: 'Il ricavo è attribuito alle notti di soggiorno, non all’incasso.' },
  analytical: { label: 'DATI ANALITICI', title: 'Ricavi complessivi del periodo', description: 'Rendimento delle camere e degli extra per disponibilità, prenotazione e ospite.', periodHint: 'Le camere seguono le notti di soggiorno; gli extra il giorno di attribuzione o saldo.' },
  channels: { label: 'CANALI', title: 'Distribuzione per canale', description: 'Prenotazioni, camere-notte e ricavo camera per provenienza commerciale.', periodHint: 'Prenotazioni e ricavi sono attribuiti alle notti di soggiorno nel periodo.' }
}
const report = ref(null)
const loading = ref(false)
const error = ref('')
const expandedId = ref(null)
const visibleCount = ref(12)
const bookingEventType = ref('all')
const bookingEventLabels = { created: 'Creazione', modified: 'Modifica', cancelled: 'Cancellazione', noShow: 'No-show' }
const presenceRoomType = ref('')
const presenceChannel = ref('')
const distributionType = ref('nationalities')
const distributionOptions = [
  { key: 'nationalities', label: 'Nazionalità' },
  { key: 'origins', label: 'Provenienza' },
  { key: 'roomTypes', label: 'Tipologia' },
  { key: 'channels', label: 'Canale' }
]
const maxDayAmount = computed(() => Math.max(1, ...((report.value?.days || []).map(day => day.amount))))
const maxRoomTypeAmount = computed(() => Math.max(1, ...((report.value?.roomTypes || []).map(entry => entry.amount))))
const maxNights = computed(() => Math.max(1, ...((report.value?.days || []).map(day => day.nights))))
const visibleRows = computed(() => report.value?.rows.slice(0, visibleCount.value) || [])
const bookingRows = computed(() => (report.value?.rows || []).filter(row => bookingEventType.value === 'all' || row.type === bookingEventType.value))
const visibleBookingRows = computed(() => bookingRows.value.slice(0, visibleCount.value))
const distributionRows = computed(() => (report.value?.[distributionType.value] || []).map(entry => ({
  key: entry.id || entry.code || entry.channel,
  label: distributionType.value === 'roomTypes' ? entry.label : distributionType.value === 'channels' ? entry.channel : countryName(entry.code),
  guests: entry.guests
})))
const maxDistribution = computed(() => Math.max(1, ...distributionRows.value.map(entry => entry.guests)))
const countryNames = new Intl.DisplayNames(['it'], { type: 'region' })
const componentLabels = [
  { key: 'deposits', label: 'Acconto' }, { key: 'stays', label: 'Soggiorno al saldo' },
  { key: 'services', label: 'Servizi' }, { key: 'bar', label: 'Bar' },
  { key: 'restaurant', label: 'Ristorante' }, { key: 'hotel', label: 'Altri extra hotel' },
  { key: 'cityTax', label: 'Tassa di soggiorno' }
]
const money = value => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value)
const shortDate = value => new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short' }).format(new Date(`${value}T12:00:00`))
const dateTime = value => new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Rome' }).format(new Date(value))
const countryName = code => /^[A-Z]{2}$/.test(code) ? countryNames.of(code) : code

let requestId = 0
const selectReport = type => {
  if (activeReport.value === type) return
  activeReport.value = type
  report.value = null
  loadReport()
}

const selectPeriod = period => {
  const start = new Date(today.getFullYear(), today.getMonth() + (period === 'previous' ? -1 : 0), 1)
  const end = period === 'previous' ? new Date(today.getFullYear(), today.getMonth(), 0) : today
  fromDate.value = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`
  toDate.value = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
  loadReport()
}

const loadReport = async () => {
  const currentRequest = ++requestId
  if (!fromDate.value || !toDate.value || fromDate.value > toDate.value) {
    error.value = 'Seleziona un intervallo di date valido.'
    report.value = null
    loading.value = false
    return
  }
  loading.value = true
  error.value = ''
  try {
    const end = new Date(`${toDate.value}T00:00:00Z`)
    end.setUTCDate(end.getUTCDate() + 1)
    const response = await axios.get(`/api/pms/hotel/reports/${activeReport.value}`, {
      params: {
        from: fromDate.value,
        to: end.toISOString().slice(0, 10),
        ...(activeReport.value === 'presences' ? { roomType: presenceRoomType.value, channel: presenceChannel.value } : {})
      },
      headers: { Authorization: `Bearer ${currentUser.value.token}` },
      mbarDirect: true
    })
    if (currentRequest !== requestId) return
    report.value = response.data
    expandedId.value = null
    visibleCount.value = 12
  } catch (cause) {
    if (currentRequest !== requestId) return
    error.value = cause.response?.data?.error || 'Impossibile caricare il report.'
  } finally {
    if (currentRequest === requestId) loading.value = false
  }
}

onMounted(loadReport)
</script>

<style scoped>
.reports-page{display:grid;gap:22px;max-width:1380px;margin:auto;padding-bottom:40px;color:#17324d}.reports-hero{display:flex;justify-content:space-between;align-items:flex-start;padding:32px 36px;border-radius:26px;background:linear-gradient(125deg,#153959,#1a6581 65%,#278794);color:white;box-shadow:0 18px 42px rgba(18,64,89,.16)}.eyebrow{font-size:11px;font-weight:800;letter-spacing:.16em}.reports-hero .eyebrow{color:#9ee2db}.reports-hero h1{margin:10px 0 7px;font-size:clamp(28px,3vw,40px);letter-spacing:-.04em}.reports-hero p{margin:0;color:#d9edf1}.hero-badge{padding:8px 13px;border:1px solid #ffffff50;border-radius:100px;font-weight:700;font-size:12px}.filters-card,.panel{padding:24px;border:1px solid #dbe7ed;border-radius:22px;background:#fff;box-shadow:0 8px 28px rgba(28,66,91,.05)}.filters-heading,.section-header{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}.filters-heading>div:first-child{display:grid;gap:4px}.filters-heading strong{font-size:18px}.filters-heading span,.panel-intro{color:#627b8c}.quick-periods{display:flex;gap:7px}.quick-periods button,.more-button{border:1px solid #d3e2e9;border-radius:10px;background:#f4f9fb;color:#25536d;padding:9px 12px;font-weight:700;cursor:pointer}.filter-fields{display:flex;flex-wrap:wrap;align-items:end;gap:12px;margin-top:20px}.filter-fields label{display:grid;gap:6px;font-size:12px;font-weight:800;color:#5e7687}.filter-fields input{min-height:42px;padding:8px 11px;border:1px solid #cddde6;border-radius:10px;font:inherit;color:#17324d}.filter-fields>button{min-height:42px;padding:0 18px;border:0;border-radius:10px;background:#177a88;color:white;font-weight:800;cursor:pointer}.filter-fields>button:disabled{opacity:.6}.report-error{display:flex;justify-content:space-between;gap:16px;padding:16px 20px;border-radius:14px;background:#fff0ef;color:#a3342b}.report-error button{border:0;background:none;color:inherit;font-weight:800;cursor:pointer}.report-state,.empty-state{padding:32px;color:#627b8c;text-align:center}.refresh-note{color:#477387;font-size:13px}.metric-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.metric-card{display:grid;align-content:space-between;gap:12px;min-height:148px;padding:20px 22px;border:1px solid #dae9ed;border-radius:20px;background:#fff;box-shadow:0 6px 20px rgba(28,66,91,.05)}.metric-card strong{font-size:clamp(22px,2.2vw,30px);letter-spacing:-.04em}.metric-card small{color:#6b8190}.metric-label{font-size:13px;font-weight:800;color:#5c7485}.metric-primary{background:#e9f6f4;border-color:#acdcd6}.metric-primary strong{color:#126875}.section-header h2{margin:6px 0 0;font-size:23px;letter-spacing:-.025em}.section-header .eyebrow{color:#27818c}.section-total,.count-badge{padding:8px 12px;border-radius:100px;background:#edf6f7;color:#226874;font-size:12px;font-weight:800}.trend-bars{display:grid;gap:10px;margin-top:24px;max-height:365px;overflow:auto}.trend-row{display:grid;grid-template-columns:65px minmax(0,1fr) 105px;align-items:center;gap:12px;font-size:13px}.trend-row time{color:#617989}.trend-row strong{text-align:right}.bar-track{height:13px;border-radius:100px;background:#edf3f6;overflow:hidden}.bar-fill{height:100%;border-radius:100px;background:linear-gradient(90deg,#42c2b7,#197d8c)}.channel-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;margin-top:20px}.channel-card{display:grid;gap:7px;padding:16px;border-radius:14px;background:#f2f8fa}.channel-card span{font-size:13px;font-weight:800}.channel-card strong{font-size:20px}.channel-card small{color:#6a8190}.panel-intro{margin:8px 0 20px;font-size:13px}.document-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.document-card{border:1px solid #dce8ee;border-radius:17px;background:#fbfdfe;overflow:hidden}.document-trigger{display:grid;gap:15px;width:100%;padding:17px;text-align:left;border:0;background:none;color:inherit;cursor:pointer}.document-trigger:hover{background:#f3f9fa}.document-top,.document-main,.document-bottom{display:flex;justify-content:space-between;align-items:center;gap:12px}.document-top time,.document-bottom,.document-main small{color:#6a8190;font-size:12px}.type-badge{padding:5px 9px;border-radius:100px;background:#e7f3f8;color:#246985;font-size:11px;font-weight:800}.type-badge.deposit{background:#fff3dd;color:#976816}.document-main strong,.document-main small{display:block}.document-main strong{font-size:16px}.document-main small{margin-top:4px}.document-main b{white-space:nowrap;font-size:20px}.document-bottom{padding-top:11px;border-top:1px solid #e8f0f3}.document-detail{display:grid;gap:9px;padding:15px 17px 17px;border-top:1px solid #dce8ee;background:white}.detail-line{display:flex;justify-content:space-between;gap:12px;font-size:13px}.document-detail a{margin-top:5px;color:#177a88;font-weight:800;text-decoration:none}.more-button{display:block;margin:18px auto 0}@media(max-width:900px){.metric-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.document-grid{grid-template-columns:1fr}}@media(max-width:600px){.reports-hero{padding:25px}.filters-heading{display:grid}.metric-grid{grid-template-columns:1fr}.trend-row{grid-template-columns:55px minmax(0,1fr) 90px;gap:8px}.section-total{display:none}}
.report-tabs{display:flex;gap:6px;padding:5px;width:max-content;border:1px solid #dbe7ed;border-radius:13px;background:#eaf2f5}.report-tabs button{padding:10px 19px;border:0;border-radius:9px;background:transparent;color:#527083;font-weight:800;cursor:pointer}.report-tabs button.active{background:#fff;color:#126875;box-shadow:0 2px 8px rgba(28,66,91,.12)}.presence-metrics{grid-template-columns:repeat(4,minmax(0,1fr))}.demographics-line{display:flex;flex-wrap:wrap;align-items:center;gap:10px 24px;padding:4px 2px;color:#617989;font-size:13px}.demographics-line strong{color:#17324d}.presence-trend-row{grid-template-columns:65px minmax(0,1fr) 85px 190px}.movement-count{color:#627b8c;text-align:right;font-size:12px}.distribution-tabs{display:flex;flex-wrap:wrap;gap:6px;margin:22px 0 4px;padding-bottom:12px;border-bottom:1px solid #e2ebef}.distribution-tabs button{padding:8px 13px;border:0;border-radius:8px;background:transparent;color:#5d7888;font-weight:700;cursor:pointer}.distribution-tabs button.active{background:#e9f6f4;color:#126875}.report-table-wrap{overflow-x:auto}.report-table{width:100%;border-collapse:collapse;font-size:13px}.report-table th,.report-table td{padding:12px 14px;border-bottom:1px solid #e5edf1;text-align:left;vertical-align:middle}.report-table thead th{color:#678090;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}.report-table tbody th{font-weight:700}.report-table tbody tr:hover{background:#f7fbfc}.report-table .number-cell{text-align:right;font-variant-numeric:tabular-nums}.distribution-wrap{max-height:430px;overflow:auto}.distribution-table th:first-child{width:34%}.distribution-table td:nth-child(2){width:52%}.distribution-table thead{position:sticky;top:0;background:#fff;z-index:1}.share-cell{display:flex;align-items:center;gap:12px}.share-cell .bar-track{flex:1;height:8px}.share-cell span{min-width:40px;color:#627b8c;text-align:right;font-variant-numeric:tabular-nums}.guest-table{min-width:900px}.guest-table small{display:block;margin-top:3px;color:#718795;font-size:11px;font-weight:400}.guest-name{white-space:nowrap}@media(max-width:1100px){.presence-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:900px){.presence-trend-row{grid-template-columns:55px minmax(0,1fr) 75px}.movement-count{grid-column:2 / -1;text-align:left}}@media(max-width:600px){.presence-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.presence-metrics .metric-card{min-height:125px;padding:16px}.presence-trend-row{grid-template-columns:55px minmax(0,1fr) 75px}.report-tabs{width:100%}.report-tabs button{flex:1}.distribution-table th:first-child{width:40%}.distribution-table td:nth-child(2){width:42%}.report-table th,.report-table td{padding:10px 8px}}
.filter-fields select{min-height:42px;min-width:150px;padding:8px 11px;border:1px solid #cddde6;border-radius:10px;background:#fff;color:#17324d;font:inherit}
.sales-type-table{min-width:560px}
.report-warning{padding:14px 18px;border:1px solid #ead8a6;border-radius:12px;background:#fff8e6;color:#765a20;font-size:13px}
.bookings-metrics{grid-template-columns:repeat(5,minmax(0,1fr))}.booking-days-wrap{max-height:390px;overflow:auto}.booking-days-table{min-width:540px}.booking-days-table thead{position:sticky;top:0;background:#fff;z-index:1}.booking-detail-filter{display:flex;justify-content:flex-end;margin:12px 0 18px}.booking-detail-filter label{display:grid;gap:6px;color:#5e7687;font-size:12px;font-weight:800}.booking-detail-filter select{min-height:38px;min-width:170px;padding:7px 10px;border:1px solid #cddde6;border-radius:9px;background:#fff;color:#17324d;font:inherit}.booking-detail-table{min-width:1050px}.booking-detail-table small{display:block;margin-top:4px;color:#718795;font-size:11px;font-weight:400}.booking-detail-table th,.booking-detail-table td{white-space:nowrap}.booking-event{display:inline-block;padding:5px 9px;border-radius:100px;background:#e7f3f8;color:#246985;font-size:11px;font-weight:800}.booking-event.cancelled,.booking-event.noShow{background:#fff0eb;color:#a04d36}.booking-event.modified{background:#eef2f9;color:#506c94}@media(max-width:1100px){.bookings-metrics{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:600px){.bookings-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.bookings-metrics .metric-card{min-height:125px;padding:16px}}
.occupancy-days-wrap,.occupancy-rooms-wrap{max-height:430px;overflow:auto}.occupancy-table{min-width:640px}.occupancy-table thead{position:sticky;top:0;background:#fff;z-index:1}.occupancy-table td:nth-child(2) .share-cell{min-width:150px}@media(max-width:600px){.report-tabs{overflow-x:auto}.report-tabs button{flex:none;padding:10px 12px}}
.economics-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.economics-table{min-width:760px}.economics-table thead{position:sticky;top:0;background:#fff;z-index:1}@media(max-width:600px){.economics-metrics{grid-template-columns:1fr}}
.analytical-summary-table{min-width:560px}.analytical-days-table{min-width:720px}.analytical-days-table thead{position:sticky;top:0;background:#fff;z-index:1}
.report-tabs{max-width:100%;overflow-x:auto}.report-tabs button{flex:none;white-space:nowrap}.channels-table{min-width:680px}.channels-table td strong,.channels-table td small{display:block}.channels-table td small{margin-top:4px;color:#718795;font-size:11px}.channels-table .channel-unclassified{background:#fff8e6}
.booking-rates-table{min-width:480px}.booking-rates-table th:first-child{width:45%}.booking-rates-table td strong{font-size:16px;color:#126875}
</style>
