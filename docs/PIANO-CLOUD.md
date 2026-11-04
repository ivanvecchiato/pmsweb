# Gestionale PMS cloud

Aggiornato il 1 novembre 2026 sulla base del codice presente e delle indicazioni dell’utente. Le verifiche del 20 ottobre sono riportate come storico e non attestano lo stato attuale del progetto remoto.

## Architettura concordata

Un solo progetto e una sola codebase, con gli stessi componenti Vue per tableau e piano camere. Il target viene scelto in fase di build/deploy, non dall'indirizzo del browser o dalla disponibilità del server locale.

- `npm run dev` / `npm run build:local`: API LAN, login operatore/PIN e comportamento locale esistenti; output `dist`.
- `npm run dev:cloud` / `npm run build:cloud`: Firebase Authentication e Firestore, senza fallback LAN; output `dist-cloud`.
- `npm run deploy:firebase`: predeploy cloud automatico e pubblicazione di `dist-cloud`.
- `npm run build:deploy:mbar`: build locale e installazione locale. Lo script rifiuta una build marcata cloud prima di modificare la destinazione.

Il browser cloud legge e scrive direttamente su Firestore, con Firebase Authentication, regole di autorizzazione e transazioni per prenotazioni, revisioni, storico e conflitti. La versione cloud consente l’operatività sulle prenotazioni. Questa è l’architettura confermata; non sono previste Cloud Functions.

I file attivi nel repository costituiscono l’implementazione corrente. La vecchia patch archiviata e le proposte di patch server già applicate sono state rimosse.

## Obiettivo e perimetro

Gestionale autonomo per operatori remoti, utilizzabile anche ad albergo chiuso e con il server locale spento. Prima versione: tableau hotel, piano camere, elenco e dettaglio prenotazioni, inserimento, modifica, spostamento, annullamento, prezzi, intestatario, storico e acconti.

Gli acconti devono essere gestibili anche durante l’inserimento e contribuire subito al saldo, sia nell’uso locale sia in quello cloud. Pagamento e stato fiscale restano distinti. L’emissione fiscale avviene sul server locale collegato alla stampante.

L’impostazione con job fiscali va mantenuta per una possibile attivazione futura. È presente un percorso di richiesta dal cloud per gli acconti, con coda persistente e consumer locale; mantenerlo non equivale ad autorizzarne ora l’attivazione operativa. Potrà essere esteso a tutti i conti fiscali, ma questa estensione non è ancora implementata né richiesta come modifica al codice. Gli esiti incerti devono essere riconciliati prima di ritentare una stampa. Il documento di acconto e quello di saldo mantengono il collegamento alla prenotazione e il saldo conserva i riferimenti ai documenti degli acconti.

La sincronizzazione deve essere realtime in entrambe le direzioni mentre server e cloud sono connessi, con recupero delle variazioni alla riconnessione. Una copia iniziale o una sincronizzazione al solo riavvio non soddisfano il requisito.

## Integrazione server attiva

Il 20 ottobre 2026 è stata installata e attivata l'integrazione nel server `mbar-server`, su autorizzazione dell'utente. L'installazione è di test: i dati sono stati riallineati direttamente, senza backup, archivi, retrocompatibilità o fallback. Le copie di backup create durante la preparazione sono state eliminate.

Al riallineamento del 20 ottobre, Firestore e server contenevano le stesse 2038 prenotazioni, 73 camere, 7 listini hotel, 365 giorni di calendario e 3 servizi. Sono state inizializzate la revisione 1 e le versioni confermate, insieme agli identificativi dei 1224 acconti. I 1217 riferimenti di fattura sono conservati come acconti esterni; i 7 privi di riferimento fiscale restano da verificare e non generano stampe automatiche. Le 19 prenotazioni storiche prive di camera restano non assegnate.

L'attivazione ha una sola configurazione persistente: `database/hotel/cloud-sync.json`, campo `enabled`. Non dipende da variabili d'ambiente o da un secondo processo. Il connettore parte nel normale avvio del server, riceve gli aggiornamenti Firestore e usa SSE per i client locali. I record che coincidono già con il checkpoint non generano migliaia di transazioni di controllo all'avvio.

Sul collegamento reale è stata verificata una prenotazione fittizia: inserimento via API locale ricevuto da Firestore, modifica cloud recepita dal server senza riavvio con evento SSE, successiva modifica locale e cancellazione sincronizzata. Il record di collaudo è stato eliminato.

## Implementazione corrente

- Target locale/cloud espliciti e directory di build distinte; nessun progetto o tableau duplicato.
- Login cloud email/password, recupero password, ripristino sessione e profilo operatore osservato in tempo reale. La sessione locale salvata non autorizza l'accesso cloud.
- Profilo `pms_web_users/{uid}` con `operatorId`, `name`, `role`, `enabled` e `permissions`. Il collegamento all'operatore locale non migra PIN o credenziali.
- Letture hotel da collezioni canoniche: `rooms`, `pms_hotel_reservations`, `pms_hotel_reservation_history`, `pms_configs`, servizi, tariffe e timetable.
- Query prenotazioni per sovrapposizione `checkout >= from` e `checkin <= to`: comprende soggiorni iniziati prima della finestra e partenze nel giorno iniziale. Gli annullamenti con stato `-100` sono esclusi dal planning e dai movimenti.
- Aggiornamenti di camere, prenotazioni, listini, calendario tariffario e policy tramite listener Firestore direttamente nel tableau, usando i metodi di caricamento già presenti. Il preventivo aperto viene aggiornato senza riaprire la pagina; prezzi manuali e visualizzazioni storiche rimangono protetti. I listener vengono chiusi allo smontaggio. Nessuna conversione in stream SSE e nessuna connessione al server locale nel target cloud.
- Operazioni cloud eseguite dal browser: preventivo prezzo, inserimento con acconti, modifica, cambio camera, annullamento e risoluzione dei conflitti. Il trasporto mantiene le chiamate applicative esistenti e le gestisce tramite servizi client e transazioni Firestore. L’operatore deriva dalla sessione Firebase e dal profilo autorizzato; le regole Firestore controllano le scritture.
- Motore prezzi generato dal codice del server. Il test supera 48 confronti tra motore cloud e server e verifica che i prezzi restino identici passando da 1 a 30 notti di soggiorno minimo. Il minimum stay riguarda la fattibilità della prenotazione e non modifica il prezzo. Disponibilità camera verificata nel commit transazionale, anche per due inserimenti concorrenti con identificativi diversi.
- Acconti con identificativo stabile e stato fiscale separato. Percorso con job fiscali e consumer locale conservato per una possibile attivazione futura; esiti incerti conservati senza ristampa automatica. Il proforma PDF cloud è generato nel browser con jsPDF.
- Confronto fra proposta e versione confermata nel tableau. Una risoluzione accettata produce una nuova revisione definitiva. Lo stesso dialogo prenotazione è utilizzabile dall'elenco cloud.
- La replica cloud riguarda le prenotazioni canoniche di `reservations.json`, indipendentemente dalla loro origine: conversione H5S o inserimento da Mood. L’importazione e la conversione H5S restano locali; il client cloud legge e modifica le prenotazioni Firestore e non richiama la sincronizzazione H5S. Non occorre un endpoint H5S sul cloud.
- La navigazione cloud comprende tableau, movimenti ed elenco prenotazioni; per gli amministratori comprende anche listino hotel, regole prezzi, statistiche e report. Questo ampliamento è richiesto e confermato. Le regole Firestore consentono agli amministratori le modifiche previste a tariffe, calendario e policy. Check-in/out, consegna servizi con stampa e annulli fiscali non fanno parte dell'operatività remota ad albergo chiuso; gli extra esistenti restano consultabili. L'annullo di un documento fiscale emesso richiede la stampante locale.

## Requisito OLAP cloud

Gli utenti amministratori devono poter consultare dal cloud le statistiche OLAP sia del bar sia dell'hotel usando query SQL, anche quando il server locale è spento. Firestore rimane il database condiviso e la fonte dei dati sincronizzati; il client cloud non deve dipendere da un endpoint SQL locale o da un backend aggiuntivo.

Soluzione proposta: includere **DuckDB-Wasm** nel target cloud e avviarlo nel browser, preferibilmente in un Web Worker. Dopo l'autenticazione e il controllo del ruolo amministratore, il client legge da Firestore i fatti necessari al periodo richiesto, li carica in tabelle DuckDB temporanee in memoria ed esegue le query OLAP SQL. Per il bar la fonte è `order_facts`, da allineare alla sorgente SQL con ID canonico `insert_id`, prezzo unitario `price` e quantità `quantity`. Per l’hotel servono prenotazioni, storico delle prenotazioni, presenze, documenti hotel, documenti bar e camere: documenti e presenze da soli non coprono tutti i report locali. Gli aggiornamenti dei dati continuano a passare dalla sync server–Firestore esistente. DuckDB serve soltanto all'elaborazione analitica nel browser: non sostituisce Firestore, non scrive i dati canonici e non richiede Cloud Functions, Cloud Run, BigQuery o un passaggio a Blaze.

In fase di implementazione occorre adattare al dialetto DuckDB le query SQL OLAP esistenti, definire il caricamento dei campi canonici e applicare alle letture Firestore le autorizzazioni amministrative già previste. I dati vanno filtrati per intervallo prima di caricarli, così da contenere letture Firestore e memoria del browser. DuckDB-Wasm può essere distribuito come asset statico insieme a `dist-cloud` su Firebase Hosting; il motore è eseguito sul dispositivo dell'operatore e ha i limiti di memoria del browser. La disponibilità delle pagine statistiche in cloud è già nel perimetro; il motore SQL client-side e l'esecuzione delle query OLAP costituiscono lavoro ancora da implementare e collaudare.

### Dati futuri e regole temporali — 1 novembre 2026

Questa installazione è di test. Lo storico non è un requisito: non occorrono recuperi, migrazioni, backup, archivi o compatibilità con vecchi formati per introdurre OLAP.

I documenti bar ricevono già `id` in `saveDoc`, prima della persistenza. Le nuove righe ordine prive di `insert_id` valido vengono rifiutate prima del salvataggio del documento e prima dell’inserimento OLAP. L’esportazione dei fatti usa `insert_id` come ID Firestore e la sorgente SQLite per i valori e le dimensioni: aggiornamenti, cancellazioni e ricostruzioni aggiornano gli stessi fatti tramite l’outbox esistente. Il formato consumato dalle statistiche mantiene `price` e `quantity`. Il codice non esegue un riallineamento storico all’avvio e non ripubblica i vecchi documenti bar privi di ID.

Gli eventi H5S non devono essere sincronizzati nel cloud, ora o in futuro. La collezione `pms_hotel_events` creata durante la precedente analisi è stata svuotata: eliminati e verificati 3632 eventi. Sono stati rimossi lo script di allineamento e le proposte di replica degli eventi. Gli eventi locali restano locali. Le prenotazioni canoniche continuano a essere replicate indipendentemente dall’origine H5S o Mood.

I report cloud applicano le regole temporali prima del download:

- Occupazione: `checkin < to` e `checkout > from`. Il calcolo viene generato dal metodo del server e riutilizzato nel browser; non viene mantenuta una seconda implementazione manuale. Un soggiorno dall’8 al 12 contribuisce con due notti al periodo 10–15.
- Presenze: `checkin < to` e `checkout >= from`, conservando anche le partenze del primo giorno. Il conteggio delle notti resta limitato al periodo.
- Vendite hotel: timestamp del documento nell’intervallo italiano `[from, to)`, indipendentemente dalle date del soggiorno.
- Documenti e fatti bar: timestamp nel periodo richiesto; il giorno finale scelto dalle pagine bar è incluso per intero, fino all’ultimo millisecondo. Per i fatti il timestamp mantiene il significato del campo `insert_time` OLAP locale, senza sostituirlo con la data del documento.

Le conversioni temporali usano `Europe/Rome`, indipendentemente dal fuso del dispositivo, e gestiscono il cambio dell’ora legale. È stato eliminato il fallback che scaricava tutti i fatti dopo un errore di query. L’indice per le presenze è definito in `firestore.indexes.json`; lo stato degli indici pubblicati resta da verificare. Il motore SQL DuckDB e gli altri report hotel previsti restano attività successive; questi interventi non ne dichiarano il completamento.

I test mirati verificano soggiorni iniziati prima del periodo, checkout escluso dall’occupazione, partenze nel primo giorno, annullamenti, incassi indipendenti dal soggiorno, estremi temporali, cambio ora e assenza di fallback. Il test dei produttori usa SQLite reale e outbox simulata per ID stabili, aggiornamenti, ricostruzioni, cancellazioni e rifiuto delle nuove righe senza ID. Nessun test richiede la replica di eventi H5S. Comandi riproducibili: `npm run test:cloud-reports` e `npm run test:cloud-analytics`. Passano anche i sei test del trasporto locale, i controlli server di sintassi, SQLite ed eventi hotel con periferiche simulate, e le build locale/cloud. Il codice server è stato applicato e il processo di test riavviato. Il 1 novembre sono stati pubblicati Hosting, regole Firestore e indici. La verifica HTTP restituisce 200, l’HTML remoto coincide con `dist-cloud/index.html` e il marker pubblico indica `cloud`. Il collaudo autenticato completo della webapp pubblicata resta da eseguire.

Il codice del perimetro prenotazioni è presente. I collaudi con emulatori e browser isolato descritti sotto sono storici e vanno ripetuti sul codice attuale. Il connettore server e il riallineamento sono stati eseguiti sull’installazione di test reale. La verifica del 31 ottobre conferma gli avvii del connettore e del consumer nel codice server e `enabled: true` nella configurazione; non verifica una sincronizzazione live. La copia installata di `hotelCloudSync.js` contiene aggiunte rispetto a `server-integration/hotelCloudSync.js`.

## Accesso reale

Primo amministratore creato in Firebase Authentication: `ivan.vecchiato@gmail.com`, associato a `Ivan`, identificativo locale `2`, verificato nella collezione utenti locale in sola lettura. Il profilo `pms_web_users/66jcRn9TzwWBsYpgbRJuXVZPuim2` è abilitato con ruolo `admin`. Account locale e PIN non sono stati modificati. Nessuna password iniziale è stata impostata o inviata.

L'accesso richiede Email/Password abilitato, dominio autorizzato, account Authentication e profilo abilitato. La password viene impostata tramite il recupero password Firebase, senza password iniziale condivisa.

Prima del rilascio verificare le regole effettivamente pubblicate. Il browser può leggere il proprio profilo, ma non elencare i profili PMS o modificare ruoli e permessi. Le regole locali autorizzano le scritture operative sulle prenotazioni e sui documenti collegati, comprese revisioni, storico, conflitti e richieste fiscali previste dal codice. Le modifiche a tariffe, calendario e policy richiedono il ruolo amministratore. Gli esiti fiscali restano di competenza del server locale. Le scritture dal browser sono parte dell’architettura richiesta. Lo stato delle regole pubblicate non è stato verificato il 31 ottobre.

## Dati di test e piano camere

Il tableau legge `rooms` con documenti identificati da `room_code`. Le prenotazioni hanno `roomId` riferito a `roomDB.id`, `room` uguale a `room_code` e una revisione confermata. Il riallineamento diretto è eseguibile con `node scripts/realign-hotel-cloud.mjs --apply`, esclusivamente a server fermo. Il comando sostituisce i dati PMS cloud e inizializza il checkpoint senza backup o archivi.

## Stato pubblicazione

Il 20 ottobre è stato riportato un tentativo di deploy Functions bloccato dal piano Spark. Quel tentativo appartiene alla precedente impostazione e non costituisce un requisito per l’architettura attuale. Non sono previste Cloud Functions; il precedente passaggio a Blaze per distribuirle non è un’attività del piano corrente.

La configurazione attuale pubblica `dist-cloud` su Hosting e contiene regole e indici Firestore. Il 31 ottobre non sono stati verificati la versione effettivamente pubblicata, le regole remote, gli account o il piano Firebase attivo.

L'importazione H5S usa lo stesso `pms_reservation_id` delle prenotazioni locali, senza prefissi o identificativi alternativi. Il metodo `mapDeposits` è condiviso fra il produttore nativo, il gateway e il mapping generato presente nel repository: identificativi stabili e stato fiscale `external`. Gli aggiornamenti del provider sostituiscono i suoi acconti e preservano quelli locali. Il test verifica anche il primo aggiornamento dei depositi storici riallineati, l'assenza di duplicazioni e il rifiuto di movimenti senza ID canonico. La configurazione di test è stata normalizzata a `hotel.providerType: h5s` mediante l'API esistente.

## Prima della pubblicazione

1. Verificare e pubblicare regole PMS e indici con `npm run deploy:firebase:rules`, preservando gli indici degli altri client. Non distribuire Cloud Functions.
2. Verificare Email/Password e recupero password per l’amministratore già associato a Ivan.
3. Ripetere i test sul codice attuale, quindi pubblicare Hosting con `npm run deploy:firebase` e collaudare la webapp pubblicata, anche con server spento e alla riconnessione.
4. Verificare la replica delle prenotazioni canoniche nei due versi, sia per quelle prodotte dalla conversione H5S sia per quelle inserite da Mood. La replica non deve dipendere dal produttore.
5. Prima di un’eventuale attivazione dei job fiscali, verificarne esplicitamente l’operatività e provare la stampante fisica. Le prove storiche usavano una stampante simulata; lo stato attuale della stampante non è stato verificato.

## Collaudo riproducibile

Con Java 21 disponibile:

```sh
npx firebase emulators:start --only auth,firestore --project demo-pmsweb --config tests/firebase/firebase.json
npm run test:cloud-tableau
npm run test:local-transport
npm run test:cloud-pricing
npm run test:cloud-reservations
npm run test:cloud-sync
npm run test:cloud-fiscal
npm run build:local
npm run build:cloud
```

I test cloud usano emulatori su localhost (Auth 9199 e Firestore 8180), dati fittizi e, quando previsto, copie temporanee del server. `node scripts/prepare-cloud-client.mjs`, eseguito anche dagli script di build, genera modelli e motore prezzi dal server e copia il logo per il browser. Non occorre un emulatore Functions.

La sequenza sopra elenca i comandi disponibili e non attesta che tutti passino sul codice attuale. Dopo le correzioni del 31 ottobre, `npm run test:local-transport` supera sei test, comprese le quattro combinazioni target/provider: soltanto il target locale con provider H5S richiama l’importazione. `npm run test:cloud-pricing` supera i 48 confronti tra motore cloud e server e, per ogni caso, verifica che cambiare il minimum stay da 1 a 30 notti non alteri il risultato. Il test fornisce il parametro richiesto dalla normalizzazione della configurazione, senza usarlo per autorizzare o rifiutare una prenotazione. La fattibilità viene verificata separatamente dai test dedicati al minimum stay. Il resto della suite e le build non sono stati rieseguiti in questa verifica.

I precedenti collaudi riportavano letture e listener del tableau, autenticazione e revoca profilo, protezione dei permessi, prezzi camera/persona, CRUD, acconti, proforma, disponibilità concorrente, conflitti, replica e consumer fiscale simulato. Questi risultati storici non sostituiscono un nuovo collaudo. I vecchi test delle prenotazioni e del browser basati su Functions sono stati rimossi perché sostituiti dai test client Firestore. È stato rimosso anche il comando H5S che puntava a uno script non più presente.
Nel browser Chrome isolato, con tutte le connessioni esterne bloccate, il collaudo storico ha verificato login, inserimento con acconto, modifica e cambio camera, conflitto fra due operatori, confronto delle versioni e risoluzione definitiva, apertura dall'elenco e annullamento con conservazione dell'acconto. Con la finestra prenotazione aperta sono verificati anche variazione realtime del listino, cambio del calendario tariffario, passaggio camera/persona e modifica dello sconto sul terzo letto, con ricalcolo visibile e conservazione del prezzo manuale. Nessun server LAN è stato usato. Il comando attuale è `npm run test:cloud-browser`, che usa `scripts/test-cloud-client-browser.mjs` (Playwright disponibile tramite `PLAYWRIGHT_MODULE_PATH`).

Il collegamento server–Firestore è stato verificato anche sul progetto reale dell’installazione di test. Restano da verificare le stesse operazioni dalla webapp pubblicata. Nella verifica del 31 ottobre non sono stati eseguiti deploy o prove su stampante fisica.

Il provider hotel (`local` o `h5s`) e il target del deploy (`locale` o `cloud`) sono indipendenti. `refreshPlanner` richiede l’importazione H5S soltanto nel target locale con provider H5S. Nel cloud aggiorna le letture delle prenotazioni canoniche senza richiamare il provider o il server LAN. La replica server–Firestore opera sulle prenotazioni indipendentemente dalla loro origine.


Diversi script di preparazione e collaudo risultavano non tracciati da Git alla verifica del 31 ottobre. Per riprodurre l’installazione da un checkout occorre includere i file necessari nel repository.
