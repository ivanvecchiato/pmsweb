# Tassa di soggiorno

## Overview

Questa documentazione descrive il requisito relativo all'applicazione della tassa di soggiorno, che va applicata al modulo hotel secondo regole variabili in funzione delle policy locali

---

## Principi della Soluzione

### Applicazione

La regola va applicata al modulo hotel e non beach.

La tassa non deve essere inclusa nel preventivo: il preventivo rappresenta solo il costo hotel netto.
La tassa viene invece mostrata nel conto, in una vista separata dedicata ai conti hotel.

## API Endpoint - Comportamento Nuovo

### Contratto dati esplicito (MVP)

Per rendere la tassa esplicita nel flusso dati, la prenotazione hotel deve includere i campi:
- `overnight_tax`: oggetto tassa di soggiorno (campo principale consigliato)
- `taxes.overnight`: replica strutturata nella sezione tasse
- `taxes_json`: serializzazione JSON della sezione tasse

Nel recupero conti/prenotazioni, il backend deve esporre almeno `overnight_tax`.
`taxes.overnight` e `taxes_json` restano compatibili come fallback.

### Modalità

La tassa ha un range temporale di applicabilità, che può essere tutto l'anno oppure da una data di inizio ad una di fine all'interno dell'anno solare.
Quando applicabile va applicata per ogni persona prenotata, con le seguenti eccezioni
- bambini al di sotto di una certa età (da configurare)
- portatori di handicap, persone non autosufficienti e loro accompagnatori
- membri di gruppi organizzati di almeno 20 persone 

Il valore unitario dipende dalla località e dalla categoria della struttura, pertanto va configurato in modo statico in base alle indicazioni degli enti preposti.

Si applica per una durata massima, ovvero un numero massimo di giorni consegutivi di permanenza (es. 10 giorni).

Dovrà essere aggiunta all'emissione del conto con la spiegazione dettagliata, applicando alla tassa un'aliquota iva esente.

### Configurazione

La configurazione può essere inserita in una sezione della vista **Policy prezzi**.

Per il MVP la configurazione include:
- abilitazione tassa
- applicazione tutto l'anno oppure intervallo data inizio/fine
- importo per persona/notte
- età di esenzione bambini
- massimo giorni tassabili consecutivi

Le esenzioni complesse (handicap/accompagnatori/gruppi organizzati) sono pianificate in fase successiva.

## Implementazione

L'implementazione della funzione coinvolge la UI web e il backend pm (/Users/hotelmirafiorijesolo/dev/node/pms)
