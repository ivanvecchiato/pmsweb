# Beach Pricing Strategy - Preventivi e Prenotazioni

## Overview

Questa documentazione descrive la strategia implementata per il calcolo dei prezzi beach nel sistema PMS, con distinzione tra:
- **Preventivi (Quotes)**: Calcolo per **tipo ombrellone** (place_type)
- **Prenotazioni reali**: Calcolo per **posto specifico** (fila + riga)

---

## Architettura della Soluzione

### Principi Fondamentali

1. **Preventivo per tipo**: Il client richiede un'anteprima di prezzo senza impegnarsi su un posto specifico; il server calcola la tariffa basandosi solo sul type di ombrellone.

2. **Prenotazione per posto**: Quando il client prenota un posto reale, il server valorizza il prezzo in base alle coordinate specifiche (fila/riga/zona), con fallback su place_type se il matching puntuale fallisce.

3. **Nessun nuovo endpoint**: La strategia utilizza gli endpoint esistenti:
   - `POST /api/pms/quotes/save` (preventivi)
   - `POST /api/pms/beach/new_reservation` (creazione prenotazione)
   - `POST /api/pms/beach/updatereservation` (aggiornamento prenotazione)

4. **Ricalcolo server-side**: Tutti i totali e i breakdown giornalieri sono calcolati lato server per garantire coerenza e sicurezza.

---

## API Endpoint - Comportamento Nuovo

### POST `/api/pms/quotes/save` (Preventivo - Type-based)

**Payload di input:**
```json
{
  "type": "beach",
  "checkin": "2026-04-01",
  "checkout": "2026-04-03",
  "place_type_id": 2,
  "customer": "Mario Rossi"
}
```

**Risposta:**
```json
{
  "id": "19d25cf1359046327dab22d28",
  "type": "beach",
  "checkin": "2026-04-01",
  "checkout": "2026-04-03",
  "place_type_id": 2,
  "total_price": 20,
  "pricing_mode": "type",
  "price_per_day": [
    {
      "day": 91,
      "date": "2026-04-01",
      "pricelist": 1,
      "price_per_place": 10,
      "source": "type"
    },
    {
      "day": 92,
      "date": "2026-04-02",
      "pricelist": 1,
      "price_per_place": 10,
      "source": "type"
    }
  ],
  "createdAt": "2026-03-25T17:21:00.000Z"
}
```

**Comportamento:**
- Calcola il prezzo usando solo il `place_type_id`
- Itera su ogni giorno dell'intervallo [checkin, checkout)
- Per ogni giorno, legge la pricelist dal timeTable
- Cerca il prezzo nel listino filtrando per place_type
- Somma i prezzi giornalieri per ottenere il totale
- Memorizza breakdown giornaliero in `price_per_day`

---

### POST `/api/pms/beach/new_reservation` (Prenotazione - Place-based)

**Payload di input:**
```json
{
  "placeId": 11,
  "checkin": "2026-04-01",
  "checkout": "2026-04-03",
  "accountholder": {
    "firstname": "Mario",
    "lastname": "Rossi"
  }
}
```

**Risposta:**
```json
{
  "success": true,
  "message": "Reservation added successfully",
  "id": "19d25cf13cad279a444c66118"
}
```

**Comportamento:**
- Ricalcola automaticamente il prezzo lato server
- Ricerca il posto da `planDB` usando `placeId`
- Estrae `place_type.id`, `fila`, `riga`, `zona` dal posto
- Per ogni giorno dell'intervallo, cerca il prezzo con **priorità**:
  1. Match puntuale su (fila + riga)
  2. Fallback su place_type se il match puntuale non esiste
3. Popola i campi aggiuntivi:
   - `price_total`: Totale periodo
   - `price_per_place`: Alias per total (per compatibilità)
   - `price_per_day`: Breakdown giornaliero
   - `pricing_mode`: "place"
- Salva la prenotazione con tutti questi campi persistiti

---

### POST `/api/pms/beach/updatereservation` (Aggiornamento - Place-based)

**Payload di input:**
```json
{
  "id": "19d25cf13cad279a444c66118",
  "placeId": 16,
  "checkin": "2026-04-01",
  "checkout": "2026-04-04"
}
```

**Comportamento:**
- Identico a `new_reservation`, ma aggiorna una prenotazione esistente
- Ricalcola il prezzo secondo il criterio place-based
- Aggiorna tutti i campi di prezzo e breakdown

---

## Campo `pricing_mode`

Nuovo campo comune a tutte le entità di prezzo:

| Valore | Contesto | Significato |
|--------|----------|------------|
| `type` | Quote beach | Prezzo calcolato usando solo place_type, indipendentemente dall'ubicazione fisica |
| `place` | Prenotazione beach | Prezzo calcolato usando coordinate specifiche (fila+riga), potenzialmente diverso per lo stesso place_type |

---

## Gestione dei Prezzi Giornalieri Mancanti

### Scenario: Giorno senza pricelist (pricelist = 0)

Se il giorno non ha un listino configurato:
- `price_per_day[].price_per_place`: 0
- `price_per_day[].source`: "none"
- Il totale include comunque il giorno con contributo 0

### Scenario: place_type non trovato nel listino

Se il type richiesto non esiste nel listino del giorno:
- Il prezzo viene impostato a 0
- Viene logato un warning con chiave univoca (non ripetuto)
- Il totale include comunque il giorno con contributo 0

---

## Normalizazione Dati

Per evitare mismatch silenzioso tra string e number nei campi coordinate:

```javascript
toNumber(value)       // Converte value a numero, ritorna null se non valido
normalizeIsoDate()    // Normalizza date string a YYYY-MM-DD
```

Questi sono applicati in:
- Lookup nel listino per fila/riga
- Confronto place_type.id
- Validation di input

---

## Funzioni Interne Chiave (repo.js)

### `async calculateBeachPeriodPricing(input)`
Funzione unica che calcola il prezzo di un periodo per beach.

**Parametri:**
```javascript
{
  checkin: "2026-04-01",           // ISO string
  checkout: "2026-04-03",          // ISO string
  placeId: 11,                     // Opzionale, se useSpecificPlace=true
  placeTypeId: 2,                  // Opzionale, estratto da place se placeId fornito
  useSpecificPlace: true|false,    // Se true, usa coordinate place; se false, solo type
  place: {...}                     // Opzionale, oggetto place da planDB
}
```

**Output:**
```javascript
{
  success: true,
  pricing_mode: "place" | "type",
  total_price: 20,
  price_per_day: [
    { day, date, pricelist, price_per_place, source }
  ],
  place_type_id: 2
}
```

### `async getBeachDayPrice(criteria, timeTable, day, dateIso)`
Ricerca il prezzo di un singolo giorno secondo i criteri specificati.

**Criteri:**
```javascript
{
  placeTypeId: 2,
  fila: 6,
  riga: 2,
  zona: "A",
  useSpecificPlace: true
}
```

**Logic:**
1. Legge l'entry timeTable per il giorno
2. Se pricelist = 0, ritorna price = 0
3. Carica il listino da beachPricesdb
4. Chiama `findBeachPriceEntry()` con i criteri
5. Ritorna { price, pricelist, source }

### `findBeachPriceEntry(listino, criteria)`
Ricerca l'entry di prezzo nel listino con priorità:
1. Se `useSpecificPlace` e (fila, riga) forniti: ricerca match puntuale
2. Altrimenti: ricerca per `place_type.id`
3. Se nessun match: ritorna null

---

## Test di Validazione Eseguiti

### Test 1: Quote A (type=2)
- Input: type=2, checkin=2026-04-01, checkout=2026-04-03
- Risultato: total_price=20, pricing_mode=type, 2 giorni
- ✅ Passato

### Test 2: Quote B (type=2, omitted placeId)
- Input: type=2, checkin=2026-04-01, checkout=2026-04-03 (nessun placeId)
- Risultato: total_price=20, pricing_mode=type, 2 giorni
- ✅ Passato
- **Asserzione**: Test 1 == Test 2 (stesso totale con type identico)

### Test 3: Reservation A (placeId=11, type=2)
- Input: placeId=11, checkin=2026-04-01, checkout=2026-04-03
- Risultato: price_total=20, pricing_mode=place, 2 giorni
- ✅ Passato

### Test 4: Reservation B (placeId=16, type=2)
- Input: placeId=16, checkin=2026-04-01, checkout=2026-04-03
- Risultato: price_total=60, pricing_mode=place, 2 giorni
- ✅ Passato
- **Asserzione**: Test 3 != Test 4 (totali diversi per stessi giorni ma posti diversi con prezzi differenti)

---

## Struttura dati persistita nel DB

### beachReservationDB

Nuovi campi aggiunti:
```json
{
  "id": "...",
  "placeId": 11,
  "checkin": "2026-04-01",
  "checkout": "2026-04-03",
  "price_total": 20,
  "price_per_place": 20,
  "pricing_mode": "place",
  "price_per_day": [
    { "day": 91, "date": "2026-04-01", "pricelist": 1, "price_per_place": 10, "source": "place" },
    { "day": 92, "date": "2026-04-02", "pricelist": 1, "price_per_place": 10, "source": "place" }
  ],
  "datetime": "2026-03-25T17:21:00...",
  "accountholder": {...}
}
```

### quotesDB

Nuovi campi aggiunti:
```json
{
  "id": "...",
  "type": "beach",
  "checkin": "2026-04-01",
  "checkout": "2026-04-03",
  "place_type_id": 2,
  "total_price": 20,
  "price_per_place": 20,
  "pricing_mode": "type",
  "price_per_day": [
    { "day": 91, "date": "2026-04-01", "pricelist": 1, "price_per_place": 10, "source": "type" },
    { "day": 92, "date": "2026-04-02", "pricelist": 1, "price_per_place": 10, "source": "type" }
  ],
  "createdAt": "2026-03-25T17:21:00...",
  "customer": "Mario Rossi"
}
```

---

## Retrocompatibilità

- Endpoint preesistenti rimangono invariati; non è stato aggiunto alcun nuovo endpoint
- I nuovi campi (price_total, pricing_mode, price_per_day) sono aggiunti senza rompere i client che ignorano questi campi
- Update availability plan in memoria usa il criterio place-based per coherenza con prenotazioni

---

## Utilizzo in altri Progetti

Per integrare questa strategia di pricing in altri progetti:

1. **Copiare le funzioni core da repo.js:**
   - `toNumber()`, `normalizeIsoDate()`, `getPlaceTypeIdFromPayload()`
   - `getTimeTableItem()`, `findBeachPriceEntry()`, `getBeachDayPrice()`
   - `calculateBeachPeriodPricing()`, `getPlaceById()`

2. **Adattare le chiamate nei flussi di salvataggio:**
   - Nel salvataggio quote: chiamare con `useSpecificPlace: false`
   - Nel salvataggio prenotazione: chiamare con `useSpecificPlace: true` e fornire `placeId`

3. **Verificare la fonte dei dati:**
   - Assicurarsi che timeTable, pricesDB, planDB siano popolati in modo coerente
   - I campi coordinate (fila, riga) devono essere numerici o normalizzabili a numero

4. **Logging e Monitoraggio:**
   - I warning su prezzi non trovati vengono loggati con chiave univoca per evitare flood
   - Campo `source` in price_per_day aiuta a debuggare il criteria utilizzato

---

## Query Utili per Verifica

### Controllare preventivi beach creati
```
GET http://localhost:8081/api/pms/quotes/getbytype?type=beach
```

### Controllare prenotazioni beach in un range
```
GET http://localhost:8081/api/pms/beach/getbookingsbyrange?from=2026-04-01&to=2026-04-05
```

### Controllare disponibilità/prezzo di un posto nel timeplan caricato
```
GET http://localhost:8081/api/pms/availability?place=11&start=2026-04-01&end=2026-04-03
```

---

## Changelog Implementazione

| Data | Modifica | File |
|------|----------|------|
| 2026-03-25 | Implementazione funzioni di pricing separate (type vs place) | repo.js |
| 2026-03-25 | Integrazione calcolo in saveQuote(), newBeachReservations(), updateBeachReservation() | repo.js |
| 2026-03-25 | Aggiunta normalizzazione tipo-dato per fila/riga/place_type | repo.js |
| 2026-03-25 | Test end-to-end: 4 test API su quote e prenotazioni | (test in PowerShell) |
| 2026-03-25 | Documentazione strategia creata | docs/BEACH_PRICING_STRATEGY.md |

---

**Status**: ✅ Implementazione completata e validata

Per domande o chiarimenti, consultare repo.js righe 1-550 per la logica completa.
