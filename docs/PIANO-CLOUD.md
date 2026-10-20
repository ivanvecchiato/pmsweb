# Gestionale PMS cloud

## Stato attuale dopo la revisione

Tutte le modifiche di questa sessione ai file preesistenti dell’app sono state rimosse. Il sorgente locale è tornato allo stato iniziale della sessione, preservando la modifica preesistente dell’utente “Hospitality Suite” e gli asset dell’utente.

Il lavoro cloud, inclusi i nuovi file e i test, è conservato in `docs/cloud-development.patch` e non è attivo nell’app. Le sezioni di avanzamento sotto descrivono il lavoro archiviato, non funzionalità attualmente presenti nel sorgente locale. La prosecuzione cloud dovrà avvenire in una copia di lavoro separata, senza applicare questa patch all’app locale.

Il riallineamento dei dati Firestore (73 camere identiche al server) e l’aggiunta dell’indice cloud restano effettuati: non hanno modificato API o database locali.

## Obiettivo

Gestionale autonomo per gli operatori remoti, anche ad albergo chiuso e server locale spento. Il cloud non è un fallback della LAN. Prima versione: tableau hotel, piano camere, elenco e dettaglio prenotazioni, creazione, modifica, spostamento, annullamento, prezzi, dati intestatario, storico e acconti. Gli acconti contribuiscono subito al saldo; la fiscalizzazione è differita al server locale con stampante disponibile.

## Avanzamento

- Implementato il primo passo: autenticazione Firebase email/password, recupero password, ripristino sessione prima del router, profilo operatore osservato in tempo reale.
- Il login LAN conserva il contratto `/api/pms/web-login`.
- Implementato il tableau cloud in consultazione: piano camere dalla collezione Firestore `rooms`, prenotazioni per sovrapposizione di date, aggiornamenti in tempo reale, dettaglio con prezzo e acconti, storico pubblicato e arrivi/partenze dalla stessa sorgente.
- Le letture dell’elenco prenotazioni e del dettaglio passano ora dalle collezioni hotel.
- Da implementare: backend cloud di validazione/salvataggio, disponibilità atomica, prezzi per nuove operazioni, gestione acconti, sincronizzazione bidirezionale e fiscalizzazione differita.
- Non pubblicare questa fase come gestionale cloud completo: il bridge attuale accoda ancora le mutazioni senza consumer.

## Configurazione dell'accesso online

1. Abilitare Email/Password in Firebase Authentication e configurare il dominio autorizzato e il template italiano di recupero password.
2. Creare l'account operatore in Authentication. Non copiare i PIN locali nel cloud.
3. Creare con un ambiente amministrativo fidato `pms_web_users/{uid}`:

```json
{
  "operatorId": 1,
  "name": "Operatore",
  "role": "staff",
  "enabled": true,
  "permissions": { "home": true, "customers": true }
}
```

`operatorId` corrisponde all'ID operatore locale. `uid` è l'ID di Authentication, utilizzato come ID del documento. Profilo e permessi non sono scrivibili dal browser. Per disabilitare un accesso, disabilitare il profilo e l'account Authentication.

4. Integrare nelle regole Firestore effettive, prima del rilascio, il controllo di accesso al proprio profilo:

```text
match /pms_web_users/{uid} {
  allow get: if request.auth != null && request.auth.uid == uid;
  allow list, create, update, delete: if false;
}
```

Questo frammento non protegge le altre collezioni: ogni lettura e operazione PMS dovrà verificare il profilo abilitato e i permessi. Controllare che non esistano regole più ampie che autorizzano scritture sui profili: le autorizzazioni Firestore si sommano. Il client locale non cambia protocollo di autenticazione.

5. Impostare `VITE_DATA_SOURCE=firebase` e le variabili Firebase. La scelta esplicita funziona anche in sviluppo su localhost, per poter verificare i flussi cloud senza il server LAN. Lasciare `VITE_PMS_API_BASE_URL` vuoto.

## Ordine dei prossimi interventi

1. Verificare dati pubblicati e contratti con mbar-server e client Mood/GeminiPos. Sono già presenti `pms_hotel_reservations`, tariffe, timetable, configurazioni e coda locale Firestore.
2. Portare camere e letture hotel su dati Firestore canonici; gestire intervalli sovrapposti alla finestra e listener, senza API LAN.
3. Backend cloud per prezzi e operazioni prenotazione. Firestore autorevole, revisione verificata, identificativo operazione idempotente e occupazione per camera/notte aggiornata atomicamente.
4. Registrare acconti con stato fiscale separato; mantenere storico, importi e riferimenti fiscali. In caso di esito stampa incerto riconciliare prima di ritentare.
5. Adattare la replica locale: importazione variazioni, checkpoint, conflitti, annullamenti persistenti e prevenzione dei cicli di pubblicazione. Le operazioni locali offline restano da confermare rispetto alla disponibilità cloud.
6. Esporre solo flussi completi nel menu cloud. Collaudare a server spento, con due operatori concorrenti e dopo riavvio del server locale.

## Verifiche richieste prima del rilascio

Accesso valido, password errata, recupero password, refresh della pagina, logout, profilo assente/disabilitato e revoca durante la sessione. Il browser non deve poter leggere altri profili, modificare i propri permessi o usare una sessione LAN salvata per accedere al cloud. Successivamente verificare inserimento/modifica/spostamento/annullamento e acconti senza rete hotel; recupero replica e assenza duplicati alla riapertura.

## Tableau cloud: configurazione e collaudo

Il tableau cloud di questa fase è esplicitamente in consultazione. Non costituisce il rilascio finale del gestionale concordato: creazione, modifica, spostamento, annullamento e inserimento acconti saranno attivati con il backend cloud. Le mutazioni hotel non vengono più accodate con una falsa risposta di successo; restituiscono un errore 501. Il percorso locale resta operativo con le API esistenti.

Prerequisiti di lettura:

- `pms_configs/current`: configurazioni hotel, spiaggia e metodi di pagamento, già pubblicate dal server.
- `pms_hotel_reservations`: documenti con ID locale, `id`, `roomId`, `checkin` e `checkout` in formato `YYYY-MM-DD`, stato, intestatario, importi e acconti. La query usa `checkout >= from` e `checkin <= to`; comprende anche le partenze nel giorno iniziale, mentre il planning disegna solo le notti occupate. Gli annullamenti (`status = -100`) sono esclusi dal planning e dai movimenti.
- `rooms`: piano camere pubblicato nel formato del metodo server `syncRooms`, con documento identificato da `room_code`. Il tableau cloud legge questa collezione, non `api_cache`. Il seed riallinea anche le chiavi obsolete. Per preparare soltanto le letture hotel: `npm run seed:firebase -- --hotel-only`, con il server locale disponibile nella fase iniziale di preparazione dei dati.
- `pms_hotel_reservation_history`: storico già pubblicato dal server. Il bootstrap PMS esaminato non importa tutto lo storico pregresso; la sua migrazione completa è ancora da pianificare.
- `pms_services`, tariffe e timetable nelle collezioni già utilizzate dal server.
- Indice composto sulle prenotazioni: `checkout ASC`, `checkin ASC`, definito in `firestore.indexes.json`. Integrare questo indice con quelli già presenti nel progetto prima del rilascio. Gli emulatori non verificano la disponibilità degli indici di produzione.
- Regole Firestore che autorizzano le letture ai soli operatori abilitati con il permesso hotel. Le regole del progetto reale non sono state modificate o pubblicate.

Il tableau cloud non apre lo stream SSE locale, non richiede l’elenco operatori del login LAN e non ricalcola i prezzi del dettaglio tramite API locali. Mostra gli importi registrati nella prenotazione. Il centro notifiche locale non viene avviato nell’ambiente cloud.

Il cambio periodo sostituisce il listener precedente; lo smontaggio lo rilascia. I callback di periodi superati vengono ignorati. Le modifiche ricevute aggiornano anche popup e dettaglio aperti, salvo la consultazione di uno snapshot storico. Gli errori sono mostrati a video, senza dati dimostrativi o falsi elenchi vuoti. Le letture dalla cache sono indicate come non ancora confermate dal cloud.

### Prova riproducibile con emulatori

Avviare gli emulatori di prova con un runtime Java 21 o superiore:

```sh
npx firebase emulators:start --only auth,firestore --project demo-pmsweb --config tests/firebase/firebase.json
```

In un altro terminale:

```sh
npm run test:cloud-tableau
```

Il test crea un account e prenotazioni fittizi soltanto nel progetto `demo-pmsweb` sugli emulatori localhost. Verifica soggiorni lunghi, confini degli intervalli, dettaglio e acconti, storico, camere e moduli, letture Axios/fetch, aggiornamenti tramite listener e codice della vista arrivi/partenze. Impedisce ogni richiesta HTTP al server LAN e verifica che le scritture hotel non producano falsi salvataggi. Le regole sotto `tests/firebase` servono esclusivamente al collaudo, non al deploy.

Per aprire l’app sugli stessi emulatori:

```sh
VITE_DATA_SOURCE=firebase VITE_PMS_API_BASE_URL= VITE_FIREBASE_PROJECT_ID=demo-pmsweb VITE_FIREBASE_AUTH_DOMAIN=demo-pmsweb.firebaseapp.com VITE_FIREBASE_AUTH_EMULATOR_URL=http://127.0.0.1:9199 VITE_FIRESTORE_EMULATOR_HOST=127.0.0.1:8180 npm run dev
```

Gli emulatori del client sono abilitati solo in sviluppo. Il test stampa solo il risultato delle verifiche; gli account sono fittizi e usano la password di prova `TableauTest123!`. Per il login manuale recuperare l’email dell’account nell’emulatore Authentication.

Verifiche eseguite: build di produzione, controllo del diff, integrazione Firestore/Auth e controllo nel browser di login, planning con soggiorno lungo, aggiornamento del nominativo e dettaglio con prezzo/note/acconto. Non eseguiti deploy o collaudo su Firestore di produzione; navigazione tra periodi, storico e movimenti richiedono ancora il collaudo completo dell’interfaccia oltre ai controlli di integrazione.

## Collegamento ai dati reali

L’indirizzo `127.0.0.1:5178` usato nel primo collaudo era collegato agli emulatori del progetto `demo-pmsweb`, con dati fittizi. Per il normale sviluppo si usa la configurazione `.env` corrente (`VITE_DATA_SOURCE=api`), senza le variabili emulatore del comando di prova. Il login locale è distinto da quello Firebase.

Nella verifica del 12 ottobre 2026 il server `127.0.0.1:8088` ha risposto con 73 camere e nessuna prenotazione per il periodo 2–21 ottobre. Il progetto Firestore reale contiene 1.847 prenotazioni complessive. La query cloud non poteva essere eseguita perché mancava l’indice delle date: la creazione dell’indice è stata avviata tramite la sessione Firebase CLI esistente, conservando gli altri indici. Al controllo successivo risultava ancora `CREATING`: la query resta bloccata finché non passa a `READY`. Il file del repository è stato riallineato agli indici esportati prima dell’aggiunta.

Non risultavano profili in `pms_web_users`: l’uso del cloud reale richiede ancora la configurazione degli account Authentication e dei corrispondenti profili operatore. L’assenza di dati in un periodo deve essere distinta da un problema di connessione, da un indice mancante o dall’apertura dell’ambiente emulato.

## Correzione della sorgente piano camere

La lettura cloud inizialmente cercava `/api/pms/getrooms` in `api_cache`, ma quel documento non era presente. La collezione effettivamente pubblicata dal server è `rooms`; conteneva 65 camere rispetto alle 73 del server. Sono state riallineate le camere e rimosse tre vecchie chiavi per camere rinumerate, dopo backup e verifica delle copie canoniche. Il confronto finale ha confermato 73 documenti cloud, identici ai 73 oggetti restituiti dal server.

La correzione del trasporto dati riguarda il percorso Firebase. I rami di caricamento locale di camere, prenotazioni e movimenti sono stati riportati alla logica precedente e confrontati con Git HEAD: i tre corpi dei rami locali corrispondono al codice originale. Questo controllo non sostituisce il collaudo completo dell’interfaccia locale. Nessuna modifica è stata apportata a API o database locali. Il riallineamento eseguito non implementa il realtime bidirezionale, che rimane un requisito obbligatorio ancora aperto.
