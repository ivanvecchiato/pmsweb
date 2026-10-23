# Regole di sviluppo

- Prima di aggiungere una funzione, verificare se nel repository esiste già un metodo che svolge lo stesso compito e riutilizzarlo.
- Preferire implementazioni dirette, semplici e coerenti con lo stile del codice esistente.
- Non introdurre helper, livelli di astrazione, duplicazioni o controlli non richiesti.
- Prima di modificare un'API o il modo in cui viene consumata, verificare il contratto effettivo del server e gli altri client coinvolti.
- Chiedere conferma prima di modificare contratti API o introdurre cambiamenti strutturali che coinvolgono più componenti.
- Quando si modifica un file, mantenerne lo stile per garantire la leggibilità.
- Implementa esclusivamente comportamenti richiesti esplicitamente. La fattibilità tecnica non costituisce autorizzazione. Prima di modificare codice, indica il requisito che autorizza la modifica e le evidenze che la rendono necessaria. Non introdurre nuove funzionalità, code, stati persistenti o percorsi operativi senza approvazione esplicita. Se scopri un’esigenza ulteriore, segnalala senza implementarla. Dalla versione cloud non si emettono documenti fiscali e non si accodano richieste di emissione al server locale.

- Questa installazione è di test: non creare o conservare backup né archivi dei dati.
- Non introdurre retrocompatibilità o fallback: usare il formato canonico e riallineare direttamente i dati di test.
