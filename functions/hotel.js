import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import Reservation from './data/hotel/Reservation.js';
import hotelPricing, { normalizeHotelPricingPolicy, getKidAgesFromReservation, getHotelPricingState } from './hotelPricing.js';

// Stesso formato prenotazione e stessi metodi prezzo del server locale.
export async function prepareHotelReservation(firedb, transaction, operation, previous = null) {
   const data = operation.payload;
   const reservation = previous ? structuredClone(previous) : { ...new Reservation(), id: operation.documentId, datetime_timestamp: Date.now() };
   const configSnapshot = await transaction.get(firedb.collection('pms_configs').doc('current'));
   if (!configSnapshot.exists || configSnapshot.data().hotel?.enabled !== true) throw new Error('Modulo hotel non abilitato');
   const config = configSnapshot.data();
   if (operation.action === 'cancel') {
      if (!previous || !String(data.cancellation_reason || '').trim()) throw new Error('Prenotazione e motivo di annullamento obbligatori');
      reservation.status = -100;
      reservation.cancelled_timestamp = previous.cancelled_timestamp || Date.now();
      reservation.cancellation_reason = String(data.cancellation_reason).trim();
      return reservation;
   }
   if (previous?.status === -100) throw new Error('Prenotazione annullata: modifica non consentita');
   for (const name of ['roomId', 'checkin', 'checkout', 'board', 'adults', 'kids', 'kidsAges', 'extraBeds', 'fixedPrice', 'person_pricing', 'notes', 'guests']) {
      if (data[name] !== undefined) reservation[name] = data[name];
   }
   if (data.duration !== undefined && data.checkout === undefined) {
      if (!Number.isInteger(Number(data.duration)) || Number(data.duration) < 1) throw new Error('Durata non valida');
      reservation.checkout = new Date(Date.parse(reservation.checkin) + Number(data.duration) * 86400000).toISOString().slice(0, 10);
   }
   for (const date of [reservation.checkin, reservation.checkout]) {
      if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new Error('Data soggiorno non valida');
   }
   if (reservation.checkout <= reservation.checkin) throw new Error('Il checkout deve essere successivo al checkin');
   reservation.duration = Math.round((Date.parse(reservation.checkout) - Date.parse(reservation.checkin)) / 86400000);
   reservation.checkin_timestamp = Date.parse(reservation.checkin);
   reservation.checkout_timestamp = Date.parse(reservation.checkout);
   for (const name of ['adults', 'kids', 'extraBeds']) {
      const number = Number(reservation[name] ?? 0);
      if (!Number.isInteger(number) || number < 0) throw new Error(`Occupazione non valida: ${name}`);
      reservation[name] = number;
   }
   if (reservation.adults + reservation.kids < 1) throw new Error('Inserire almeno un ospite');
   reservation.kidsAges = getKidAgesFromReservation(reservation);
   reservation.pax = reservation.adults + reservation.kids;
   reservation.board = String(reservation.board || 'BB').toUpperCase();
   if (!['BB', 'HB', 'FB'].includes(reservation.board)) throw new Error('Trattamento non valido');
   const roomSnapshot = await transaction.get(firedb.collection('rooms').where('id', '==', String(reservation.roomId)));
   if (roomSnapshot.size !== 1) throw new Error(`Camera non valida: ${reservation.roomId}`);
   const room = roomSnapshot.docs[0].data();
   reservation.roomId = String(room.id);
   reservation.room = room.room_code;
   reservation.roomType = room.room_type.label;
   reservation.accountholder = { ...reservation.accountholder };
   if (data.firstname !== undefined || data.accountholder?.firstname !== undefined) reservation.accountholder.firstname = String(data.firstname ?? data.accountholder.firstname).trim();
   if (data.lastname !== undefined || data.accountholder?.lastname !== undefined) reservation.accountholder.lastname = String(data.lastname ?? data.accountholder.lastname).trim();
   if (!String(reservation.accountholder.lastname || '').trim() && operation.action !== 'quote') throw new Error('Cognome intestatario obbligatorio');
   if (data.notes !== undefined) {
      if (!Array.isArray(data.notes) || data.notes.some(note => typeof note !== 'string')) throw new Error('Le note devono essere un elenco di testi');
      reservation.notes = data.notes.map(note => note.trim()).filter(Boolean);
   }
   reservation.channel = previous?.channel || 'direct';
   const policy = normalizeHotelPricingPolicy(config.hotel.pricing);
   if (data.isManualPrice !== undefined) reservation.pricing_mode = data.isManualPrice ? 'fixed' : policy.mode;
   else if (data.fixedPrice !== undefined || !previous) reservation.pricing_mode = data.fixedPrice != null ? 'fixed' : policy.mode;
   if (reservation.pricing_mode === 'fixed' && (!Number.isFinite(Number(reservation.fixedPrice)) || Number(reservation.fixedPrice) < 0)) throw new Error('Prezzo fisso non valido');
   const [timeTable, rates] = await Promise.all([transaction.get(firedb.collection('pms_hotel_timetable')), transaction.get(firedb.collection('pms_hotel_rates'))]);
   const pricing = {
      ...hotelPricing,
      getHotelPricingPolicy() { return policy; },
      async loadTimeTableByType() { return timeTable.docs.map(entry => entry.data()); },
      async getRates() { return rates.docs.map(entry => entry.data()); }
   };
   if (!previous || !isDeepStrictEqual(getHotelPricingState(previous), getHotelPricingState(reservation)) || data.recalculatePricing === true) {
      const result = await pricing.calculateHotelReservationPricing(reservation);
      reservation.price_per_day = result.price_per_day;
      reservation.price_per_room = result.total_price;
      reservation.price_total = result.total_price;
      reservation.amount = result.total_price;
      reservation.pricing_mode = result.pricing_mode;
   }
   if (data.deposits !== undefined) {
      if (!Array.isArray(data.deposits)) throw new Error('Acconti non validi');
      const methods = config.payments?.hotel;
      if (!Array.isArray(methods)) throw new Error('Metodi di pagamento hotel non configurati');
      const deposits = [];
      const ids = new Set();
      for (const incoming of data.deposits) {
         if (typeof incoming.id !== 'string' || !incoming.id || incoming.id.includes('/') || ids.has(incoming.id)) throw new Error('Identificativo acconto mancante o duplicato');
         ids.add(incoming.id);
         const old = previous?.deposits?.find(item => item.id === incoming.id);
         if (old?.document_id || Number(old?.invoice_progressive) > 0 || ['external', 'historical'].includes(old?.fiscal_status)) {
            if (Number(old.amount) !== Number(incoming.amount) || old.payment_date !== incoming.payment_date
               || String(old.payment_method_id ?? '') !== String(incoming.payment_method_id ?? '')
               || Boolean(old.annulled) !== Boolean(incoming.annulled)) throw new Error('Acconto fiscale già emesso o importato: usare lo storno fiscale');
            deposits.push(old);
            continue;
         }
         const method = methods.find(item => Number(item.id) === Number(incoming.payment_method_id));
         const amount = Number(incoming.amount);
         if (!method || !Number.isFinite(amount) || amount <= 0 || Math.abs(Math.round(amount * 100) - amount * 100) > 0.0000001) throw new Error('Importo o metodo di pagamento acconto non valido');
         if (!/^\d{4}-\d{2}-\d{2}$/.test(incoming.payment_date || '')) throw new Error('Data acconto non valida');
         const job = await transaction.get(firedb.collection('pms_fiscal_jobs').doc(`${operation.documentId}_${incoming.id}`));
         if (['processing', 'uncertain'].includes(job.data()?.status)) {
            if (Number(old.amount) !== amount || old.payment_date !== incoming.payment_date || Number(old.payment_method_id) !== Number(method.id) || Boolean(old.annulled) !== Boolean(incoming.annulled)) throw new Error('Acconto fiscale già emesso o in lavorazione: usare lo storno fiscale');
            deposits.push(old);
            continue;
         }
         deposits.push({
            ...(old || {}), id: incoming.id, amount: Number(amount.toFixed(2)), payment_date: incoming.payment_date,
            payment_mode: method.name, payment_method_id: Number(method.id), electronic: Boolean(method.electronic),
            type: 'acconto', operator: operation.operator, annulled: incoming.annulled === true,
            fiscal_status: incoming.annulled === true ? 'cancelled' : 'pending',
            progressivo: 0, chiusura: 0, fiscal_timestamp: 0, document_id: '',
            ...(incoming.annulled === true ? { annulled_at: old?.annulled_at || new Date().toISOString() } : {})
         });
      }
      for (const old of previous?.deposits || []) {
         if (!ids.has(old.id)) throw new Error('Gli acconti registrati devono essere stornati, non rimossi');
      }
      reservation.deposits = deposits;
   }
   delete reservation.room_id;
   return reservation;
}
