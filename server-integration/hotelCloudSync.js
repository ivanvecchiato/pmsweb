import { reservationHash, getHotelReservationVersion, commitHotelReservation } from './reservationSync.js';
import fs from 'fs';
import path from 'path';
import { isDeepStrictEqual } from 'node:util';
import { getFireDb } from '../../modules/firestore.js';
import { databaseRoot } from '../../modules/dbPaths.js';
import { enqueueSet, enqueueDelete, hasPendingFirestoreOperation } from '../../modules/firestoreOutbox.js';
import db from '../../hotel/modules/db.js';
import hotelEvents from '../../hotel/modules/events.js';
import configs from '../../modules/configs.js';
import sse from '../../modules/sse.js';
import log from '../../modules/log.js';

const collection = 'pms_hotel_reservations';
const tombstones = 'pms_hotel_reservation_tombstones';
const statePath = path.join(databaseRoot, 'hotel', 'cloud-sync.json');
let state = fs.existsSync(statePath)
   ? JSON.parse(fs.readFileSync(statePath, 'utf8'))
   : { enabled: false, baselines: {}, diagnostics: {} };
if (state.maintenance === true) throw new Error('Riallineamento cloud in corso: completare la migrazione prima di avviare il server');
const hotelCloudSyncEnabled = state.enabled === true;
let subscriptions = [];
let retryTimer = null;
let generation = 0;
let changes = Promise.resolve();
const publishing = new Map();

// AloeDB con batching:false usa lo stesso file temporaneo per ogni save concorrente.
// Mantiene l'await della persistenza anche con scritture provenienti dalle API locali.
if (hotelCloudSyncEnabled) {
   const saveReservations = db.reservationDB.save.bind(db.reservationDB);
   let saves = Promise.resolve();
   db.reservationDB.save = () => {
      const saved = saves.then(() => saveReservations());
      saves = saved.catch(() => {});
      return saved;
   };
   const saveDocuments = db.hotelAccountDocumentDB.save.bind(db.hotelAccountDocumentDB);
   db.hotelAccountDocumentDB.save = async () => {
      await saveDocuments();
      try {
         for (const document of await db.hotelAccountDocumentDB.findMany()) await enqueueSet('pms_hotel_documents', String(document.id), document, false);
      } catch (error) {
         log.e(`Hotel document cloud sync: ${error.message}`);
         sse.broadcast('hotel_log_warning', { message: 'Documento registrato localmente: pubblicazione cloud da verificare' });
      }
   };
   const saveRooms = db.roomDB.save.bind(db.roomDB);
   db.roomDB.save = async () => {
      await saveRooms();
      const rooms = await db.roomDB.findMany();
      const keys = rooms.map(room => String(room.room_code || '').trim());
      if (keys.includes('') || new Set(keys).size !== keys.length) throw new Error('room_code mancante o duplicato');
      for (const room of rooms) await enqueueSet('rooms', String(room.room_code), room, false);
      for (const key of state.roomKeys || []) {
         if (!keys.includes(key)) await enqueueDelete('rooms', key, false);
      }
      state.roomKeys = keys;
      saveState();
   };
}

function saveState() {
   fs.mkdirSync(path.dirname(statePath), { recursive: true });
   fs.writeFileSync(`${statePath}.tmp`, JSON.stringify(state, null, 2));
   fs.renameSync(`${statePath}.tmp`, statePath);
}

function recordSyncWarning(id, local, remote, reason) {
   state.diagnostics[id] = { id, reason, detectedAt: new Date().toISOString(), local, remote };
   saveState();
   log.e(`Hotel cloud sync ${id}: ${reason}`);
   sse.broadcast('hotel_log_warning', { message: `Sincronizzazione prenotazione ${id}: ${reason}` });
}

function getHotelSyncBase(id) {
   const base = state.baselines[String(id)];
   return base ? { ...base } : undefined;
}

async function publishHotelReservation(operation) {
   const id = String(operation.documentId);
   const payload = operation.type === 'delete' ? null : operation.payload;
   const local = await db.reservationDB.findOne(item => String(item.id) === id);
   const base = getHotelSyncBase(id);
   // Una vecchia operazione già sostituita dal downlink non può tornare corrente.
   if (reservationHash(local) !== reservationHash(payload) && reservationHash(local) === base?.hash) return { status: 'superseded' };
   publishing.set(id, { operationId: `${operation.baseRevision}-${reservationHash(payload) || 'deleted'}` });
   try {
      const result = await commitHotelReservation(getFireDb(), { ...operation, validateInventory: true });
      await receiveHotelReservation(id);
      if (result.status === 'conflict') {
         sse.broadcast('hotel_log_warning', { message: `Conflitto prenotazione ${id}: revisione ${result.revision} definitiva; proposta conservata nello storico` });
      }
      return result;
   } finally {
      publishing.delete(id);
   }
}

async function resolveHotelReservationConflict({ id, proposalId, expectedRevision, choice, operator }) {
   const result = await commitHotelReservation(getFireDb(), { documentId: id, type: 'resolve', proposalId, baseRevision: expectedRevision, choice, operator });
   await receiveHotelReservation(String(id));
   return result;
}

function receiveHotelReservation(id) {
   const activeGeneration = generation;
   const received = changes.then(() => activeGeneration === generation && applyHotelReservation(id));
   changes = received.catch(() => {});
   return received;
}

async function applyHotelReservation(id) {
   let canonical;
   const local = await db.reservationDB.findOne(item => String(item.id) === id);
   try {
      canonical = await getFireDb().runTransaction(transaction => getHotelReservationVersion(getFireDb(), id, transaction));
   } catch (error) {
      recordSyncWarning(id, local, null, error.message);
      return;
   }
   let { current: remote, revision, version } = canonical;
   const localHash = reservationHash(local);
   const base = getHotelSyncBase(id);
   if (local && base?.revision === revision && local.revision === revision && base.hash === localHash && localHash === reservationHash(remote)) return;
   if (remote && (String(remote.id) !== id || remote.roomId == null || !remote.checkin || !remote.checkout)) {
      recordSyncWarning(id, local, remote, 'documento hotel cloud non valido');
      return;
   }
   if (base && revision < base.revision) return;
   if (base && revision === base.revision && reservationHash(remote) !== base.hash) {
      recordSyncWarning(id, local, remote, 'contenuto modificato senza nuova revisione');
      return;
   }
   if (base && revision === base.revision && reservationHash(remote) !== localHash) return;
   if (reservationHash(remote) !== localHash && localHash !== base?.hash && !(base === undefined && !local)) {
      // L'ack di un upload locale può precedere il completamento di un altro salvataggio locale.
      if (version?.operation_id === publishing.get(id)?.operationId) {
         state.baselines[id] = { hash: reservationHash(remote), revision };
         saveState();
         return;
      }
      canonical = await commitHotelReservation(getFireDb(), { documentId: id, type: local ? 'set' : 'delete', payload: local, baseRevision: base?.revision ?? 0, source: 'local', validateInventory: true });
      remote = canonical.current;
      revision = canonical.revision;
   }
   if (remote) {
      const room = await db.roomDB.findOne(item => String(item.id) === String(remote.roomId));
      if (!room || String(room.room_code) !== String(remote.room)) {
         recordSyncWarning(id, local, remote, 'camera cloud non corrispondente al piano locale');
         return;
      }
   }
   if (localHash === reservationHash(remote) && local?.revision === remote?.revision) {
      state.baselines[id] = { hash: localHash, revision };
      saveState();
      return;
   }
   if (local) {
      if (remote) {
         const updated = await db.reservationDB.updateOne(item => String(item.id) === id && reservationHash(item) === localHash, () => remote);
         if (!updated) return applyHotelReservation(id);
      } else {
         const deleted = await db.reservationDB.deleteOne(item => String(item.id) === id && reservationHash(item) === localHash);
         if (!deleted) return applyHotelReservation(id);
      }
   } else if (remote) {
      if (db.reservationDB.documents.some(item => String(item.id) === id)) return applyHotelReservation(id);
      await db.reservationDB.insertOne(remote);
   }
   if (version?.source === 'cloud' && localHash !== reservationHash(remote)) {
      const reservation = remote || local;
      if (!local || !remote) {
         hotelEvents.addLogEntry({
            type: remote ? 'reservation.created' : 'reservation.deleted',
            explanation: remote ? 'Creata prenotazione' : 'Eliminata prenotazione',
            operator: version.operator, source: 'client', reservation_id: id, roomId: reservation.roomId,
            data: { checkin: reservation.checkin, checkout: reservation.checkout, ...(remote ? { amount: remote.amount, pax: remote.pax } : {}) }
         });
      } else if (remote.status === -100 && (local.status !== remote.status || local.cancellation_reason !== remote.cancellation_reason)) {
         hotelEvents.addLogEntry({
            type: 'reservation.cancelled', explanation: 'Annullata prenotazione',
            operator: version.operator, source: 'client', reservation_id: id, roomId: remote.roomId,
            data: { reason: remote.cancellation_reason }
         });
      } else {
         hotelEvents.addLogEntry({
            type: 'reservation.updated', operator: version.operator, source: 'client',
            reservation_id: id, roomId: remote.roomId, data: { before: local, after: remote }
         });
      }
   }
   state.baselines[id] = { hash: reservationHash(remote), revision };
   delete state.diagnostics[id];
   saveState();
   if (remote || local) sse.broadcastReservation(remote ? (local ? 'updated' : 'created') : 'deleted', remote || local);
}

function stopHotelCloudSync() {
   generation++;
   subscriptions.splice(0).forEach(unsubscribe => unsubscribe());
   if (retryTimer) clearTimeout(retryTimer);
   retryTimer = null;
}

function startHotelCloudSync() {
   if (!hotelCloudSyncEnabled || subscriptions.length) return;
   const activeGeneration = ++generation;
   const restart = error => {
      if (activeGeneration !== generation) return;
      log.e(`Hotel cloud sync listener: ${error.message}`);
      stopHotelCloudSync();
      retryTimer = setTimeout(startHotelCloudSync, 5000);
      retryTimer.unref();
   };
   const schedule = (id, remote) => {
      const base = getHotelSyncBase(id);
      const local = db.reservationDB.documents.find(item => String(item.id) === id);
      if (remote && base && base.revision === remote.revision && base.hash === reservationHash({ ...remote, deposits: local?.deposits || [] })) {
         if (local?.revision === base.revision && reservationHash(local) === base.hash) return;
      }
      receiveHotelReservation(id).catch(restart);
   };
   // La stessa coda persistente serve anche a riprendere le modifiche al piano camere.
   db.roomDB.save().catch(restart);
   db.hotelAccountDocumentDB.findMany().then(async documents => {
      for (const document of documents) await enqueueSet('pms_hotel_documents', String(document.id), document, false);
   }).catch(restart);
   subscriptions.push(getFireDb().collection(collection).onSnapshot(snapshot => {
      for (const change of snapshot.docChanges()) schedule(change.doc.id, change.type === 'removed' ? null : change.doc.data());
      const ids = new Set(snapshot.docs.map(document => document.id));
      for (const [id, baseline] of Object.entries(state.baselines)) {
         if (baseline.hash !== null && !ids.has(id)) schedule(id);
      }
      changes = changes.then(async () => {
         if (activeGeneration !== generation) return;
         const local = await db.reservationDB.findMany();
         for (const reservation of local) {
            const id = String(reservation.id);
            if (!state.diagnostics[id] && reservationHash(reservation) !== getHotelSyncBase(id)?.hash) {
               await enqueueSet(collection, id, reservation, false);
            }
         }
      }).catch(restart);
   }, restart));
   subscriptions.push(getFireDb().collection(tombstones).onSnapshot(snapshot => {
      for (const change of snapshot.docChanges()) {
         if (change.type !== 'removed') schedule(change.doc.id);
      }
   }, restart));
   subscriptions.push(getFireDb().collection('pms_hotel_reservation_history').onSnapshot(snapshot => {
      for (const change of snapshot.docChanges()) {
         if (change.type === 'removed') continue;
         changes = changes.then(async () => {
            if (activeGeneration !== generation) return;
            const entry = change.doc.data();
            if (String(entry.id) !== change.doc.id) {
               recordSyncWarning(`history/${change.doc.id}`, null, entry, 'identificativo storico non valido');
               return;
            }
            const existing = await db.reservationHistoryDB.findOne(item => String(item.id) === change.doc.id);
            if (!existing) await db.reservationHistoryDB.insertOne(entry);
            else if (reservationHash(existing) !== reservationHash(entry)) recordSyncWarning(`history/${entry.id}`, existing, entry, 'storico immutabile divergente');
         }).catch(restart);
      }
   }, restart));
   subscriptions.push(getFireDb().collection('pms_hotel_rates').onSnapshot(snapshot => {
      for (const change of snapshot.docChanges()) {
         changes = changes.then(async () => {
            if (activeGeneration !== generation) return;
            const id = change.doc.id;
            if (hasPendingFirestoreOperation('pms_hotel_rates', id)) return;
            const local = await db.hotelPricesdb.findOne(item => String(item.id) === id);
            if (change.type === 'removed') {
               if (local) await db.hotelPricesdb.deleteOne({ id: local.id });
               sse.broadcast('hotel_rates_updated', { id, deleted: true });
               return;
            }
            const remote = change.doc.data();
            if (String(remote.id) !== id) throw new Error(`Identificativo listino cloud non valido: ${id}`);
            if (isDeepStrictEqual(local, remote)) return;
            if (local) await db.hotelPricesdb.updateOne(item => String(item.id) === id && isDeepStrictEqual(item, local), () => remote);
            else await db.hotelPricesdb.insertOne(remote);
            sse.broadcast('hotel_rates_updated', { id });
         }).catch(error => {
            log.e(`Hotel rates cloud sync ${change.doc.id}: ${error.message}`);
            sse.broadcast('hotel_log_warning', { message: 'Aggiornamento cloud listino non applicato al server locale' });
         });
      }
   }, restart));
   subscriptions.push(getFireDb().collection('pms_hotel_timetable').onSnapshot(snapshot => {
      for (const change of snapshot.docChanges()) {
         if (change.type === 'removed') continue;
         changes = changes.then(async () => {
            if (activeGeneration !== generation) return;
            const remote = change.doc.data();
            const id = change.doc.id;
            if (remote.date !== id) throw new Error(`Identificativo calendario cloud non valido: ${id}`);
            if (hasPendingFirestoreOperation('pms_hotel_timetable', id)) return;
            const local = await db.hotelTimeTableDB.findOne(item => item.date === id);
            if (isDeepStrictEqual(local, remote)) return;
            if (local) await db.hotelTimeTableDB.updateOne(item => item.date === id && isDeepStrictEqual(item, local), () => remote);
            else await db.hotelTimeTableDB.insertOne(remote);
            sse.broadcast('hotel_timetable_updated', { date: id });
         }).catch(error => {
            log.e(`Hotel timetable cloud sync ${change.doc.id}: ${error.message}`);
            sse.broadcast('hotel_log_warning', { message: 'Aggiornamento cloud calendario tariffe non applicato al server locale' });
         });
      }
   }, restart));
   subscriptions.push(getFireDb().collection('pms_configs').doc('current').onSnapshot(snapshot => {
      if (!snapshot.exists) return;
      changes = changes.then(() => {
         if (activeGeneration !== generation) return;
         const remote = snapshot.data().hotel?.pricing;
         if (!remote || hasPendingFirestoreOperation('pms_configs', 'current')) return;
         const hotelConfig = configs.getConfigs('hotel');
         if (isDeepStrictEqual(hotelConfig.pricing, remote)) return;
         configs.writeConfigs('hotel', { ...hotelConfig, pricing: remote });
         sse.broadcast('hotel_pricing_policy_updated', {});
      }).catch(error => {
         log.e(`Hotel pricing policy cloud sync: ${error.message}`);
         sse.broadcast('hotel_log_warning', { message: 'Aggiornamento cloud policy prezzi non applicato al server locale' });
      });
   }, restart));
   log.d('Hotel cloud sync realtime started');
}

export { hotelCloudSyncEnabled, getHotelSyncBase, publishHotelReservation, resolveHotelReservationConflict, startHotelCloudSync, stopHotelCloudSync };
