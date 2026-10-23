import { prepareHotelReservation as prepare } from './hotelReservation.js';

export async function prepareHotelReservation(firedb, transaction, operation, previous = null) {
   const [config, rooms, rates, timeTable] = await Promise.all([
      transaction.get(firedb.collection('pms_configs').doc('current')),
      transaction.get(firedb.collection('rooms')),
      transaction.get(firedb.collection('pms_hotel_rates')),
      transaction.get(firedb.collection('pms_hotel_timetable'))
   ]);
   const fiscalJobs = new Map();
   for (const deposit of operation.payload?.deposits || []) {
      const job = await transaction.get(firedb.collection('pms_fiscal_jobs').doc(`${operation.documentId}_${deposit.id}`));
      fiscalJobs.set(deposit.id, job.data());
   }
   return prepare({
      config: config.data(), rooms: rooms.docs.map(entry => entry.data()),
      rates: rates.docs.map(entry => entry.data()), timeTable: timeTable.docs.map(entry => entry.data()), fiscalJobs
   }, operation, previous);
}
