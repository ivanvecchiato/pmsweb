# pmsweb

Applicazione Vue 3 (Vite) per la gestione PMS/bar. Supporta due modalità operative:

| Modalità | Quando si usa | Sorgente dati |
|---|---|---|
| **Locale (rete LAN)** | Browser punta a `http://<ip-mbar-server>` | mbar-server (`/api/*`) |
| **Web (Firebase)** | Browser punta a `https://mpos-dbce8.web.app` | Firestore |

---

## Modalità locale (rete LAN)

L'app viene servita direttamente da **mbar-server** (Node.js) sulla rete locale.
Tutte le chiamate `/api/*` arrivano al backend senza intermediari.

### Setup

```sh
npm install
cp .env.example .env
# lascia VITE_DATA_SOURCE=api (o non impostarlo)
```

### Build e deploy su mbar-server

```sh
npm run build:deploy:mbar
```

Lo script copia `dist/` nella cartella `htdocs/` di mbar-server
(configurabile con la variabile d'ambiente `MBAR_HTDOCS`).

### Sviluppo con hot-reload

```sh
npm run dev
```

Vite proxia `/api/*` verso `http://localhost:8088` (mbar-server in locale).

---

## Modalità web (Firebase Hosting)

L'app è pubblicata su Firebase Hosting. Non c'è un backend remoto:
i dati vengono letti/scritti su **Firestore**.

Le statistiche (`/api/mbar/*`) vengono calcolate in tempo reale dalla collezione
`order_facts`, che mbar-server popola automaticamente a ogni chiusura conto.

### Come funziona il bridge

- Tutte le `GET /api/*` cercano i dati nella collezione `api_cache` di Firestore.
- Le `GET /api/mbar/*` (statistiche) aggregano i dati dalla collezione `order_facts`.
- Tutte le `POST/PUT/PATCH/DELETE` vengono accumulatre in `api_mutations`
  e applicate da mbar-server al rientro in rete locale.

### Setup `.env` per il deploy Firebase

```env
VITE_DATA_SOURCE=firebase

VITE_PMS_API_BASE_URL=
VITE_FIREBASE_BRIDGE_BYPASS_PREFIXES=/api/mbar/

VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...

VITE_FIREBASE_API_COLLECTION=api_cache
VITE_FIREBASE_MUTATIONS_COLLECTION=api_mutations
VITE_FIREBASE_STATS_DOCS_COLLECTION=order_facts
```

> **Importante:** lasciare `VITE_PMS_API_BASE_URL` vuoto.
> Se valorizzato, il bridge tenta di chiamare quell'URL invece di usare Firestore.

### Build e deploy su Firebase Hosting

```sh
npm run build:deploy:firebase
```

### Migrazione dati storici

Per portare su Firestore le statistiche pregresse presenti nel database SQLite locale,
eseguire da `mbar-server`:

```sh
# Migra tutto il pregresso
node scripts/migrate-order-facts-to-firestore.js

# Solo un anno specifico
node scripts/migrate-order-facts-to-firestore.js --year=2025
```

Lo script è idempotente: rieseguendolo non crea duplicati.

---

## Collezioni Firestore

| Collezione | Contenuto |
|---|---|
| `api_cache` | Risposte statiche alle chiamate GET (configurazioni, listini, ecc.) |
| `api_mutations` | Coda delle modifiche effettuate offline (POST/PUT/DELETE) |
| `order_facts` | Righe di vendita per il calcolo delle statistiche |
| `conti` | Tavoli/conti aperti, sincronizzati in tempo reale da mbar-server |

### Struttura documento `api_cache`

Opzione 1 — risposta fissa per endpoint:
```json
{
  "method": "get",
  "endpoint": "/api/pms/getrates",
  "response": [ { "id": 1, "name": "Listino Beach" } ]
}
```

Opzione 2 — varianti per query string:
```json
{
  "method": "get",
  "endpoint": "/api/pms/getrates",
  "responses": {
    "type=hotel": [ { "id": 10 } ],
    "type=beach": [ { "id": 20 } ],
    "__default": []
  }
}
```

---

## Script disponibili

| Comando | Descrizione |
|---|---|
| `npm run dev` | Dev server con proxy verso mbar-server locale |
| `npm run build` | Build produzione |
| `npm run build:deploy:mbar` | Build + copia in `htdocs/` di mbar-server |
| `npm run build:deploy:firebase` | Build + deploy su Firebase Hosting |
| `npm run build:deploy:vercel` | Build + deploy su Vercel |
