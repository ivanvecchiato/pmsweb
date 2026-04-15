# Reservation status progress - Possibili stati per una prenotazione e sua evoluzione

## Overview

Questa documentazione descrive l'evoluzione dello stato di una prenotazione in funzione della sua evoluzione, dall'inserimento in piano al checkin/checkout passando per le successive modifiche e il cambio di alcuni parametri.
---

## Architettura della Soluzione

### Stati della prenotazione

- status = 100 Prenotata senza caparra
- status = 200 Confermata (prenotata con caparra - attivo se presente almeno una caparra nella prenotazione)
- status = 300 Prenotata senza caparra da Booking.com
- status = 1 In checkin
- status = 2 In checkout
- status = 10 In checkout in attesa di pagamento
- status = -100 Cancellata

Transizioni di stato possibili:
- 100 -> 200
- 100 -> 1
- 100 -> -100
- 200 -> 1
- 200 -> -100
- 300 -> 1
- 300 -> -100
- 1 -> 2
- 1 -> 10

Stati ibridi PMS (solo tecnici, non visualizzati sul tableau web):
- CHECKING_IN (status = 3): rimane nel dominio "prenotata" e viene classificato in 100/200/300 in base a caparra, conferma e origine Booking.com.
- CHECKING_OUT (status = 4): in presentazione web viene mappato a status 1 (In checkin).

### Contratto backend sorgente prenotazione (Booking.com)

Per riconoscere in modo definitivo le prenotazioni Booking.com, il backend PMS normalizza sempre una sorgente canonica:

- `booking_source` (canonico)
- `bookingSource` (alias)

Valori attuali:

- `booking.com`
- `direct` (fallback di default)

Regole di normalizzazione backend:

1. Se presente un flag esplicito (`isBookingCom`, `bookingCom`, `fromBookingCom` e alias snake_case) la sorgente viene forzata a `booking.com`.
2. In assenza di flag, il backend cerca una sorgente testuale tra alias legacy (`booking_source`, `bookingSource`, `reservation_source`, `source`, `channel`, `origin`, `provider`, `ota` e varianti su `accountholder`).
3. Se il testo contiene `booking.com`, `bookingcom` oppure e' `booking`, la sorgente canonica e' `booking.com`.
4. Se nessun campo e' valorizzato, il backend imposta `direct`.

Nota implementativa:
- la normalizzazione viene applicata sia in creazione/aggiornamento prenotazione, sia in lettura (`getbookingsbyrange`/`getbookings`) per retrocompatibilita' sui dati storici.

### Ulteriori informazioni sulla prenotazione

Tutti gli stati della prenotazione vanno rappresentati con un colore diverso sul tableau, tranne lo stato -100 (cancellata) che non ha rappresentazione perché la prenotazione viene rimossa dal tableau (ma rimane nello storico):

1. Prenotata senza caparra: #EF5350
2. Confermata (prenotata con caparra): #66BB6A
3. Prenotata senza caparra da Booking.com: #FFEB3B
4. In checkin: #29B6F6
5. In checkout: #424242
6. In checkout in attesa di pagamento: #E0E0E0

## API Endpoint

Il backend che risponde alle chiamate su api/pms si trova in /Users/hotelmirafiorijesolo/dev/node/pms

## Flusso Pagamento Checkout (status 10)

Quando una prenotazione e' in checkout con pagamento in sospeso (status 10):

1. Dal planner, l'azione `Paga` apre la vista conto (`/accounts`) selezionando la prenotazione.
2. La vista conto mostra:
	- riepilogo prenotazione (dati ospite/camera/periodo/trattamento)
	- risultato conto (netto hotel + tassa di soggiorno + servizi)
	- caparre/acconti con dettaglio importo, data e modalita'
	- valori a `0` evidenziati anche quando non presenti movimenti
3. Prima della chiusura conto:
	- leggere il contatore progressivo backend
	- riservare un numero progressivo backend
4. In chiusura conto:
	- salvare il documento con il numero progressivo riservato
	- stampare ricevuta A4 lato client
	- inviare comando backend per stampa scontrino fiscale

Endpoint backend introdotti per il flusso:

- `GET /api/pms/hotel/account/counter`
- `POST /api/pms/hotel/account/reserve_progressive`
- `POST /api/pms/hotel/account/close`
