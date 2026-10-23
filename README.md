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

La stessa codebase viene compilata con un target esplicito: `npm run build:local`
produce `dist/` con API e autenticazione LAN; `npm run build:cloud` produce
`dist-cloud/` con Firebase Authentication e Firestore. Il dominio del browser
non cambia il target e il cloud non ripiega sul server locale.

Il tableau condiviso legge camere e prenotazioni dalle collezioni canoniche
Firestore e riceve aggiornamenti realtime. Il login online usa email/password
e un profilo operatore abilitato. Il backend cloud gestisce prenotazioni, prezzi, conflitti e acconti con fiscalizzazione
differita. La replica bidirezionale è installata e attiva sul server di test, con dati riallineati
direttamente senza backup o fallback. Prima del rilascio restano backend e regole Firebase.

### Configurazione e sviluppo

Configurare le variabili `VITE_FIREBASE_*` in `.env` come indicato in
`.env.example`. Il target cloud forza l'uso di Firebase e disabilita gli URL
API LAN indipendentemente da `VITE_DATA_SOURCE` nel file `.env`.

```sh
npm run dev:cloud
npm run build:cloud
npm run preview:cloud
```

### Deploy su Firebase Hosting

```sh
npm run deploy:firebase
```

Il predeploy compila il target cloud e Hosting pubblica solo `dist-cloud/`.
Il deploy locale rifiuta le build marcate cloud. Prerequisiti, limiti attuali,
account e collaudi sono descritti in [docs/PIANO-CLOUD.md](docs/PIANO-CLOUD.md).

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
