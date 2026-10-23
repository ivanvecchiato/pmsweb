# Integrazione server PMS cloud

Installata e attivata il 20 ottobre 2026 in `mbar-server`, su autorizzazione dell'utente. Questa è un'installazione di test: riallineamento diretto, senza backup, archivi, retrocompatibilità o fallback. Le copie di backup della preparazione sono state eliminate.

## Codice installato

- `index.js`: avvio del connettore e del consumer fiscale nel normale processo server.
- `modules/firestoreOutbox.js`: coda esistente collegata al commit revisionato, senza ricerca alternativa della revisione nel checkpoint.
- `pms/modules/firestore.js`: propagazione della revisione nelle cancellazioni.
- `pms/repo.js`: motore prezzi condiviso, identificativi e stato canonico degli acconti, emissione fiscale differita idempotente.
- `pms/pms.js` e `pms/modules/h5s-gateway.js`: identificativo H5S canonico e metodo condiviso per acconti esterni, conservando gli acconti locali negli aggiornamenti del provider.
- `data/shared/Guest.js`: il produttore degli ospiti usa soltanto il campo canonico `document.issued_by`.
- `hotelCloudSync.js`: listener Firestore, persistenza locale, SSE, checkpoint e pubblicazione del piano camere. All'avvio salta le righe già identiche al checkpoint; controlla e applica le modifiche effettive.
- `hotelFiscalJobs.js`: consumer fiscale con esiti incerti da verificare prima di ripetere una stampa.
- `reservationSync.js`, `hotel.js`, `hotelPricing.js`: protocollo di revisione e regole condivise con le Functions.

L'attivazione è il campo `enabled` di `database/hotel/cloud-sync.json`, unica configurazione persistente. Il server avvia il connettore da solo; non serve un processo separato o un flag d'ambiente.

## Riallineamento eseguito

Copie locale e cloud: 2038 prenotazioni, 73 camere, 7 listini, 365 giorni di calendario, 3 servizi. Lo storico iniziale locale era di 11 record; il collaudo finale ha prodotto le normali revisioni operative. I vecchi record presenti soltanto nel cloud sono stati eliminati.

Tutte le prenotazioni hanno una revisione iniziale confermata. I 1224 acconti hanno identificativi: 1217 conservano il riferimento di fattura; 7 senza riferimento restano da verificare, senza emissione automatica. Le 19 prenotazioni storiche senza camera non hanno ricevuto assegnazioni inventate.

```sh
node scripts/realign-hotel-cloud.mjs         # controlla soltanto input e conteggi
node scripts/realign-hotel-cloud.mjs --apply # reset diretto a server fermo
```

## Verifiche

Sul server e Firestore reali di test: creazione locale → cloud, modifica cloud → server senza riavvio e con evento SSE, seconda modifica locale → cloud, eliminazione propagata. La prenotazione fittizia è stata rimossa.

Passano i controlli server di sintassi, SQLite ed eventi hotel. Gli emulatori verificano inoltre disponibilità concorrente, revisioni, conflitti, riconnessione, riavvio, modifiche camere e consumer fiscale con stampante simulata. Il browser verifica il tableau cloud contro gli emulatori. Restano pubblicazione del backend/webapp e prova fisica della stampante.
