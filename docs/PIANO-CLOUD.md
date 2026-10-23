# Gestionale PMS cloud

## Architettura concordata

Un solo progetto e una sola codebase, con gli stessi componenti Vue per tableau e piano camere. Il target viene scelto in fase di build/deploy, non dall'indirizzo del browser o dalla disponibilità del server locale.

- `npm run dev` / `npm run build:local`: API LAN, login operatore/PIN e comportamento locale esistenti; output `dist`.
- `npm run dev:cloud` / `npm run build:cloud`: Firebase Authentication e Firestore, senza fallback LAN; output `dist-cloud`.
- `npm run deploy:firebase`: predeploy cloud automatico e pubblicazione di `dist-cloud`.
- `npm run build:deploy:mbar`: build locale e installazione locale. Lo script rifiuta una build marcata cloud prima di modificare la destinazione.

I file attivi nel repository costituiscono l’implementazione corrente. La vecchia patch archiviata e le proposte di patch server già applicate sono state rimosse.

## Obiettivo e perimetro

Gestionale autonomo per operatori remoti, utilizzabile anche ad albergo chiuso e con il server locale spento. Prima versione: tableau hotel, piano camere, elenco e dettaglio prenotazioni, inserimento, modifica, spostamento, annullamento, prezzi, intestatario, storico e acconti.

Gli acconti devono essere gestibili anche durante l'inserimento e contribuire subito al saldo, sia nell'uso locale sia in quello cloud. L'operatore può richiedere esplicitamente il documento da entrambe le versioni, ma la richiesta cloud viene soltanto accodata: l'emissione fiscale avviene esclusivamente sul server locale, collegato alla stampante. Se il server o la stampante non sono disponibili, la richiesta resta in attesa. Pagamento e stato fiscale restano distinti, con riconciliazione degli esiti incerti prima di ritentare una stampa. Il documento di acconto e quello di saldo mantengono il collegamento alla prenotazione e il saldo conserva i riferimenti ai documenti degli acconti.

La sincronizzazione deve essere realtime in entrambe le direzioni mentre server e cloud sono connessi, con recupero delle variazioni alla riconnessione. Una copia iniziale o una sincronizzazione al solo riavvio non soddisfano il requisito.

## Integrazione server attiva

Il 20 ottobre 2026 è stata installata e attivata l'integrazione nel server `mbar-server`, su autorizzazione dell'utente. L'installazione è di test: i dati sono stati riallineati direttamente, senza backup, archivi, retrocompatibilità o fallback. Le copie di backup create durante la preparazione sono state eliminate.

Firestore e server contengono le stesse 2038 prenotazioni, 73 camere, 7 listini hotel, 365 giorni di calendario e 3 servizi. Sono state inizializzate la revisione 1 e le versioni confermate, insieme agli identificativi dei 1224 acconti. I 1217 riferimenti di fattura sono conservati come acconti esterni; i 7 privi di riferimento fiscale restano da verificare e non generano stampe automatiche. Le 19 prenotazioni storiche prive di camera restano non assegnate.

L'attivazione ha una sola configurazione persistente: `database/hotel/cloud-sync.json`, campo `enabled`. Non dipende da variabili d'ambiente o da un secondo processo. Il connettore parte nel normale avvio del server, riceve gli aggiornamenti Firestore e usa SSE per i client locali. I record che coincidono già con il checkpoint non generano migliaia di transazioni di controllo all'avvio.

Sul collegamento reale è stata verificata una prenotazione fittizia: inserimento via API locale ricevuto da Firestore, modifica cloud recepita dal server senza riavvio con evento SSE, successiva modifica locale e cancellazione sincronizzata. Il record di collaudo è stato eliminato.

## Implementazione corrente

- Target locale/cloud espliciti e directory di build distinte; nessun progetto o tableau duplicato.
- Login cloud email/password, recupero password, ripristino sessione e profilo operatore osservato in tempo reale. La sessione locale salvata non autorizza l'accesso cloud.
- Profilo `pms_web_users/{uid}` con `operatorId`, `name`, `role`, `enabled` e `permissions`. Il collegamento all'operatore locale non migra PIN o credenziali.
- Letture hotel da collezioni canoniche: `rooms`, `pms_hotel_reservations`, `pms_hotel_reservation_history`, `pms_configs`, servizi, tariffe e timetable.
- Query prenotazioni per sovrapposizione `checkout >= from` e `checkin <= to`: comprende soggiorni iniziati prima della finestra e partenze nel giorno iniziale. Gli annullamenti con stato `-100` sono esclusi dal planning e dai movimenti.
- Aggiornamenti di camere, prenotazioni, listini, calendario tariffario e policy tramite listener Firestore direttamente nel tableau, usando i metodi di caricamento già presenti. Il preventivo aperto viene aggiornato senza riaprire la pagina; prezzi manuali e visualizzazioni storiche rimangono protetti. I listener vengono chiusi allo smontaggio. Nessuna conversione in stream SSE e nessuna connessione al server locale nel target cloud.
- Backend HTTP Firebase Functions autenticato: preventivo prezzo, inserimento con acconti, modifica, cambio camera, annullamento e risoluzione dei conflitti. Gli endpoint cloud usano il medesimo contratto delle prenotazioni locali; l'operatore viene verificato dal token e dal profilo, non dal payload.
- Motore prezzi condiviso con il server, con 48 confronti sul codice originale. Disponibilità camera verificata nel commit transazionale, anche per due inserimenti concorrenti con identificativi diversi.
- Acconti con identificativo stabile e stato fiscale separato. Coda persistente elaborata in locale quando la stampante è disponibile; esiti incerti conservati senza ristampa automatica. Il proforma PDF usa il renderer del server, generato per il deploy cloud.
- Confronto fra proposta e versione confermata nel tableau. Una risoluzione accettata produce una nuova revisione definitiva. Lo stesso dialogo prenotazione è utilizzabile dall'elenco cloud.
- Importazione H5S nel backend cloud, con mapping generato dal gateway esistente e credenziali private in Secret Manager (`PMS_H5S_CONFIG`). I depositi già importati dal provider non generano una nuova emissione fiscale.
- La navigazione cloud espone il perimetro di questa prima versione: tableau, movimenti ed elenco prenotazioni. Le altre aree del gestionale restano fuori da questo rilascio. Check-in/out, consegna servizi con stampa e annulli fiscali non fanno parte dell'operatività remota ad albergo chiuso; gli extra esistenti restano consultabili. L'annullo di un documento fiscale emesso richiede la stampante locale.

Il perimetro prenotazioni è implementato e collaudato con emulatori e browser isolato. Il connettore server e il riallineamento sono stati eseguiti sull’installazione di test reale; restano configurazione e pubblicazione del backend Firebase e della webapp.

## Accesso reale

Primo amministratore creato in Firebase Authentication: `ivan.vecchiato@gmail.com`, associato a `Ivan`, identificativo locale `2`, verificato nella collezione utenti locale in sola lettura. Il profilo `pms_web_users/66jcRn9TzwWBsYpgbRJuXVZPuim2` è abilitato con ruolo `admin`. Account locale e PIN non sono stati modificati. Nessuna password iniziale è stata impostata o inviata.

L'accesso richiede Email/Password abilitato, dominio autorizzato, account Authentication e profilo abilitato. La password viene impostata tramite il recupero password Firebase, senza password iniziale condivisa.

Prima del rilascio verificare le regole effettive del progetto: il browser può leggere il proprio profilo, ma non elencare utenti o modificare ruoli/permessi. Ogni collezione PMS deve richiedere un profilo abilitato con i permessi previsti. Il file `firestore.rules` conserva le regole di produzione lette il 20 ottobre e aggiunge soltanto le letture PMS per operatori abilitati. Profili, prenotazioni ed esiti fiscali non sono scrivibili dal browser. Gli emulatori usano lo stesso file. Le nuove regole non sono state pubblicate.

## Dati di test e piano camere

Il tableau legge `rooms` con documenti identificati da `room_code`. Le prenotazioni hanno `roomId` riferito a `roomDB.id`, `room` uguale a `room_code` e una revisione confermata. Il riallineamento diretto è eseguibile con `node scripts/realign-hotel-cloud.mjs --apply`, esclusivamente a server fermo. Il comando sostituisce i dati PMS cloud e inizializza il checkpoint senza backup o archivi.

## Stato pubblicazione — 20 ottobre 2026

Il tentativo reale di deploy del backend è stato bloccato da Firebase: `mpos-dbce8` è sul piano Spark e Cloud Build / Artifact Registry richiedono Blaze. Il comando non ha pubblicato Functions, regole o indici; Hosting non è stato avviato per evitare una webapp priva delle operazioni sulle prenotazioni. Serve attivare Blaze da https://console.firebase.google.com/project/mpos-dbce8/usage/details, poi configurare il segreto e completare i passi seguenti. Il sito Hosting preesistente `mpos-dbce8.web.app` contiene già MBAR PMS; non rappresenta la nuova versione cloud verificata.

L'importazione H5S usa lo stesso `pms_reservation_id` delle prenotazioni locali, senza prefissi o identificativi alternativi. Il metodo `mapDeposits` è condiviso fra il produttore nativo, il gateway e il mapping generato per le Functions: identificativi stabili e stato fiscale `external`. Gli aggiornamenti del provider sostituiscono i suoi acconti e preservano quelli locali. Il test verifica anche il primo aggiornamento dei depositi storici riallineati, l'assenza di duplicazioni e il rifiuto di movimenti senza ID canonico. La configurazione di test è stata normalizzata a `hotel.providerType: h5s` mediante l'API esistente.

## Prima della pubblicazione

1. Pubblicare Functions, regole PMS e indici con `npm run deploy:firebase:backend`; la configurazione conserva gli indici degli altri client. Configurare il segreto H5S senza esporre credenziali al browser.
2. Verificare Email/Password e recupero password per l'amministratore già associato a Ivan.
3. Pubblicare Hosting e ripetere il collaudo dalla webapp pubblicata, anche con il server spento e alla riconnessione.
4. Verificare la stampante fisica prima dell'uso fiscale. Le prove fiscali eseguite usano una stampante simulata; sul server di test la stampante attualmente non risponde.

## Collaudo riproducibile

Con Java 21 disponibile:

```sh
npx firebase emulators:start --only auth,firestore,functions --project demo-pmsweb --config tests/firebase/firebase.json
npm run test:cloud-tableau
npm run test:local-transport
npm run test:cloud-pricing
npm run test:cloud-reservations
npm run test:cloud-sync
npm run test:cloud-fiscal
npm run test:cloud-h5s
npm run build:local
npm run build:cloud
```

I test usano esclusivamente emulatori su localhost (Auth 9199, Firestore 8180, Functions 5001), dati fittizi e copie temporanee del server. Non avviano il server reale o le periferiche. `npm run prepare:cloud-functions` genera modelli, utilità, mapping H5S e renderer proforma dal codice server prima del collaudo e del deploy.

Verificati: letture e listener del tableau, autenticazione e revoca profilo, divieto di scritture dirette e autoassegnazione permessi, prezzi camera/persona, CRUD HTTP, acconti in inserimento, proforma PDF, disponibilità concorrente, conflitti e risoluzione, replica nei due versi con checkpoint e riavvio, modifiche realtime delle camere, consumer fiscale e recupero degli esiti incerti, importazione H5S con risposta fittizia. Sei test locali mantengono il trasporto LAN e verificano le quattro combinazioni target/provider. Build locale e cloud riuscite.

Nel browser Chrome isolato, con tutte le connessioni esterne bloccate, sono stati verificati login, inserimento con acconto, modifica e cambio camera, conflitto fra due operatori, confronto delle versioni e risoluzione definitiva, apertura dall'elenco e annullamento con conservazione dell'acconto. Con la finestra prenotazione aperta sono verificati anche variazione realtime del listino, cambio del calendario tariffario, passaggio camera/persona e modifica dello sconto sul terzo letto, con ricalcolo visibile e conservazione del prezzo manuale. Nessun server LAN è stato usato. Il test riproducibile è `scripts/test-cloud-browser.mjs` (Playwright disponibile tramite `PLAYWRIGHT_MODULE_PATH`).

Il collegamento server–Firestore è stato verificato anche sul progetto reale dell’installazione di test. Restano da verificare le stesse operazioni dalla webapp pubblicata. Non sono stati eseguiti deploy di Hosting/Functions o prove su stampante fisica.

Il provider hotel (`local` o `h5s`) e il target del deploy (`locale` o `cloud`) sono indipendenti. `refreshPlanner` richiede la sincronizzazione H5S in base al solo provider; il target determina quale backend esegue la richiesta. Il backend cloud non contatta il server LAN.
