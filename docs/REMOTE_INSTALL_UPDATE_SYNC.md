# Aggiornamento Installazione Remota con Sincronizzazione Dati

## Runbook Rapido

```sh
npm install
npm run firebase:login
npm run build
npm run seed:firebase
npm run backfill:documenti:dry
npm run backfill:documenti
npm run sync:documenti:raw:dry
npm run sync:documenti:raw
npm run build:deploy:firebase
npm run build:deploy:vercel
```

Questa guida descrive come aggiornare un'installazione remota di `pmsweb` (Firebase Hosting / Vercel) quando esistono dati locali da sincronizzare.

## Obiettivo

Allineare frontend remoto e dati in Firestore senza perdere storico.

Flussi dati previsti:

1. `api_cache`: cache risposte endpoint GET `/api/*` usata dal bridge frontend.
2. `order_facts`: dati OLAP per statistiche (righe vendita).
3. `documenti_raw`: replica grezza dei documenti locali (`documenti.json`).

## Prerequisiti

1. Node.js compatibile con `package.json`.
2. Accesso al progetto Firebase (`mpos-dbce8` o altro).
3. File `.env` valorizzato con credenziali Firebase.
4. Se usi seed da API locale: backend locale raggiungibile (default `http://localhost:8088`).

## Configurazione minima `.env`

```dotenv
VITE_DATA_SOURCE=firebase

VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...

VITE_FIREBASE_API_COLLECTION=api_cache
VITE_FIREBASE_MUTATIONS_COLLECTION=api_mutations
VITE_FIREBASE_STATS_DOCS_COLLECTION=order_facts
VITE_FIREBASE_RAW_DOCS_COLLECTION=documenti_raw
```

Note:

1. `VITE_STATS_API_BASE_URL` è opzionale e serve solo se vuoi bypassare Firestore per `/api/mbar/*`.
2. `VITE_PMS_API_BASE_URL` in modalità `firebase` non è usata per le normali letture `/api/*` (intercettate dal bridge).

## Procedura Standard di Aggiornamento

### 1) Aggiorna codice e dipendenze

```sh
npm install
```

### 2) Login Firebase CLI

```sh
npm run firebase:login
```

### 3) Build frontend

```sh
npm run build
```

### 4) Seed cache endpoint (`api_cache`)

Serve per evitare errori tipo `Nessun dato Firebase per GET /api/...`.

```sh
npm run seed:firebase
```

Se backend locale non è su `:8088`:

```sh
MBAR_API=http://localhost:PORTA node scripts/seed-firebase-cache.mjs
```

### 5) Sync OLAP pregresso su `order_facts`

Usare per statistiche su dati storici mancanti.

Dry-run:

```sh
npm run backfill:documenti:dry
```

Esecuzione reale:

```sh
npm run backfill:documenti
```

Se devi ripulire vecchi record legacy inseriti con mapping errato:

```sh
npm run backfill:documenti:cleanup
```

### 6) Replica grezza `documenti.json` su `documenti_raw`

Usare per avere copia raw completa documentale in Firestore.

Dry-run:

```sh
npm run sync:documenti:raw:dry
```

Esecuzione reale:

```sh
npm run sync:documenti:raw
```

Limitare batch (test):

```sh
npm run sync:documenti:raw -- --max=300
```

La sync è idempotente: usa document ID deterministici (`setDoc` con `merge`), quindi riesecuzioni successive aggiornano e non duplicano logicamente i record.

### 7) Deploy remoto frontend

Firebase Hosting:

```sh
npm run build:deploy:firebase
```

Vercel:

```sh
npm run build:deploy:vercel
```

## Verifiche Post-Deploy

1. Login applicazione remoto ok.
2. Pagine listini/prodotti senza errori `Nessun dato Firebase per GET ...`.
3. Sezione statistiche coerente con `order_facts`.
4. Presenza collection Firestore:
   1. `api_cache`
   2. `api_mutations`
   3. `order_facts`
   4. `documenti_raw`

## Strategia Operativa Consigliata

1. Prima migrazione: eseguire tutti i passi 1-7.
2. Aggiornamenti ordinari (senza nuovi storici): passi 1, 3, 7.
3. Import storico aggiuntivo: ripetere passi 5 e/o 6 in base al tipo dato.

## Troubleshooting Rapido

1. `Failed to authenticate`:
   1. eseguire `npm run firebase:login`.
2. `Failed to get Firebase project your-firebase-project-id`:
   1. correggere `.firebaserc` con project id reale.
3. `Nessun dato Firebase per GET /api/...`:
   1. eseguire `npm run seed:firebase`.
4. `RESOURCE_EXHAUSTED` durante sync grandi:
   1. rilanciare in batch con `--max=`; gli script hanno retry/backoff.
5. Dati duplicati in report:
   1. verificare di non confondere `order_facts` (OLAP) con `documenti_raw` (replica raw).

## Comandi Riepilogo

```sh
npm run seed:firebase
npm run backfill:documenti:dry
npm run backfill:documenti
npm run backfill:documenti:cleanup
npm run sync:documenti:raw:dry
npm run sync:documenti:raw
npm run build:deploy:firebase
```
