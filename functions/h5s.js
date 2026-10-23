import { mapMovement, normalizeRoomCode } from './h5sMapping.js';
import { prepareHotelReservation } from './hotel.js';
import { commitHotelReservation, getHotelReservationVersion, reservationHash } from './reservationSync.js';

export async function syncHotelH5S(db, credentials, operator, uid, dateFrom, dateTo, request = fetch) {
   const config = (await db.collection('pms_configs').doc('current').get()).data();
   if (config?.hotel?.providerType !== 'h5s') throw Error('Il provider hotel non è H5S');
   if (credentials?.enabled === false || !credentials?.apiUrl || !credentials?.clientToken || !credentials?.hotelCode) throw Error('H5S cloud non configurato');
   const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
   const from = dateFrom || today;
   const to = dateTo || new Date(Date.parse(from) + (Number(credentials.syncWindowDays) || 30) * 86400000).toISOString().slice(0, 10);
   if (![from, to].every(date => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date) || to < from) throw Error('Finestra H5S non valida');
   const rooms = (await db.collection('rooms').get()).docs.map(doc => doc.data());
   const roomsByCode = new Map(rooms.map(room => [normalizeRoomCode(room.room_code), room]));
   if (roomsByCode.size !== rooms.length || roomsByCode.has('')) throw Error('Codici camera mancanti o duplicati');
   const response = await request(credentials.apiUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(45000),
      body: JSON.stringify({ clientToken: credentials.clientToken, hotelCode: credentials.hotelCode, get_movements: { date_from: from, date_to: to, active_checkins_only: false, add_extra: true } })
   });
   if (!response.ok) throw Error(`H5S: risposta HTTP ${response.status}`);
   const result = await response.json();
   if (!Array.isArray(result.movements)) throw Error('Risposta H5S priva di movements');
   const report = { success: true, window: { from, to }, movements_received: result.movements.length, imported: 0, updated: 0, deleted: 0, skipped: 0, errors: [] };
   for (const movement of result.movements) {
      let id = '';
      try {
         if (!String(movement.pms_reservation_id ?? '').trim()) throw Error('Identificativo H5S mancante');
         const mapped = mapMovement(movement, roomsByCode, config.hotel.pricing?.mode || 'room');
         if (!mapped) { report.skipped++; continue; }
         id = mapped.id;
         const version = await db.runTransaction(transaction => getHotelReservationVersion(db, id, transaction));
         if (version.revision && !version.current) throw Error('Prenotazione eliminata: importazione da verificare');
         const previous = version.current;
         if (previous) {
            mapped.guests.push(...(previous.guests || []).filter(guest => guest.source !== 'h5s'));
            mapped.extra.services.push(...(previous.extra?.services || []).filter(service => service.serviceId != null || service.addedAt));
            mapped.extra.bar = previous.extra?.bar || [];
            mapped.deposits.push(...(previous.deposits || []).filter(deposit => !['external', 'historical'].includes(deposit.fiscal_status)));
            if (previous.pricing_mode === 'person' && previous.person_pricing) {
               for (const name of ['adults', 'kids', 'kidsAges', 'person_pricing']) mapped[name] = previous[name];
               mapped.fixedPrice = null;
               mapped.pricing_mode = 'person';
            }
         }
         // Prezzi calcolati dagli stessi metodi del server; il commit verifica ancora revisione e camera.
         const priced = mapped.status === -100 ? {} : await db.runTransaction(transaction => prepareHotelReservation(db, transaction, {
            documentId: id, action: 'quote', operator, payload: { ...mapped, deposits: undefined }
         }, previous ? { ...previous, status: 0 } : null));
         const payload = JSON.parse(JSON.stringify({ ...previous, ...mapped, price_per_day: priced.price_per_day || [], price_total: priced.price_total ?? previous?.price_total ?? 0, ...(priced.person_pricing ? { person_pricing: priced.person_pricing } : {}) }));
         if (previous && reservationHash({ ...payload, revision: previous.revision }) === reservationHash(previous)) { report.skipped++; continue; }
         const committed = await commitHotelReservation(db, { type: 'set', documentId: id, payload, baseRevision: version.revision, source: 'h5s', operator, uid, validateInventory: true });
         if (committed.status === 'conflict') throw Error('Conflitto conservato: verificare la versione definitiva');
         if (previous) report.updated++; else report.imported++;
      } catch (error) { report.errors.push({ id, error: error.message }); }
   }
   report.success = report.errors.length === 0;
   return report;
}
