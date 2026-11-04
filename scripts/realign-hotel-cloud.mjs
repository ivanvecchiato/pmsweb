import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { reservationHash } from '../functions/reservationSync.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const server = path.resolve(process.env.MBAR_SERVER_ROOT || path.resolve(root, '../../node/mbar-server'));
const apply = process.argv.includes('--apply');
const emulator = process.argv.includes('--emulator');
if (emulator !== Boolean(process.env.FIRESTORE_EMULATOR_HOST)) throw Error('Ambiente Firebase non coerente');
if (emulator && process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8180') throw Error('Emulatore non valido');
const require = createRequire(path.resolve(root, 'functions/package.json'));
const { initializeApp, cert, deleteApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const credentials = emulator ? null : JSON.parse(fs.readFileSync(path.join(server, 'configs/mpos.json')));
if (!emulator && credentials.project_id !== 'mpos-dbce8') throw Error('Progetto non valido');
const app = initializeApp(emulator ? { projectId: 'demo-pmsweb-realignment' } : { credential: cert(credentials) }, 'hotel-cloud-realignment');
const db = getFirestore(app);
const stateFile = path.join(server, 'database/hotel/cloud-sync.json');
const digest = value => createHash('sha256').update(value).digest('hex');
const definitions = [
   ['rooms', 'database/hotel/roomDB.json', 'room_code'],
   ['pms_hotel_reservations', 'database/hotel/reservationDB.json', 'id'],
   ['pms_hotel_reservation_history', 'database/hotel/reservationHistoryDB.json', 'id'],
   ['pms_hotel_rates', 'database/hotel/pricesDB.json', 'id'],
   ['pms_hotel_timetable', 'database/hotel/timeTableDB.json', 'date'],
   ['pms_services', 'database/hotel/servicesDB.json', 'id'],
   ['pms_configs', 'configs/configs.json', null]
];
try {
   if (!emulator) {
      const running = await new Promise(resolve => {
         const socket = net.connect({ host: '127.0.0.1', port: 8088 });
         socket.once('connect', () => { socket.destroy(); resolve(true); });
         socket.once('error', () => resolve(false));
         socket.setTimeout(1000, () => { socket.destroy(); resolve(false); });
      });
      if (running) throw Error('Fermare il server prima del riallineamento');
   }
   const sources = new Map();
   const datasets = new Map();
   for (const [collection, filename, key] of definitions) {
      const text = fs.readFileSync(path.join(server, filename), 'utf8');
      sources.set(filename, digest(text));
      const parsed = JSON.parse(text);
      const rows = key === null ? [{ id: 'current', data: parsed }] : parsed.map(data => ({ id: String(data[key]), data }));
      if (new Set(rows.map(row => row.id)).size !== rows.length || rows.some(row => !row.id || row.id === 'undefined' || row.id.includes('/'))) throw Error(`Chiavi non valide: ${collection}`);
      datasets.set(collection, rows);
   }
   const queueFile = path.join(server, 'database/firestore-outbox.json');
   if (JSON.parse(fs.readFileSync(queueFile)).length) throw Error('La coda Firestore deve essere vuota prima del riallineamento');
   let depositsAssigned = 0;
   for (const { id, data } of datasets.get('pms_hotel_reservations')) {
      if (typeof data.id !== 'string' || !data.checkin || !data.checkout) throw Error(`Prenotazione locale non valida: ${id}`);
      data.revision = 1;
      if (!Object.hasOwn(data, 'roomId')) data.roomId = null;
      data.deposits = (data.deposits || []).map((deposit, index) => {
         depositsAssigned++;
         return { ...deposit, id: `deposit-${digest(JSON.stringify([id, index, deposit.amount, deposit.payment_date])).slice(0, 32)}`, fiscal_status: deposit.annulled ? 'cancelled' : deposit.document_id ? 'issued' : Number(deposit.invoice_progressive) > 0 ? 'external' : 'pending' };
      });
   }
   const counts = Object.fromEntries([...datasets].map(([collection, rows]) => [collection, rows.length]));
   if (!apply) console.log(JSON.stringify({ apply: false, project: emulator ? 'demo-pmsweb-realignment' : credentials.project_id, counts, depositsAssigned }, null, 2));
   else {
      if (!fs.existsSync(path.join(server, 'pms/modules/hotelCloudSync.js'))) throw Error('Installare prima il connettore');
      fs.writeFileSync(stateFile, JSON.stringify({ maintenance: true, enabled: false, baselines: {}, diagnostics: {} }));
      // Installazione di test: reset diretto, senza backup, archivi o conservazione delle versioni precedenti.
      for (const collection of [...datasets.keys(), 'pms_hotel_reservation_versions', 'pms_hotel_reservation_tombstones', 'pms_hotel_reservation_conflicts', 'pms_fiscal_jobs', 'pms_room_inventory']) {
         await db.recursiveDelete(db.collection(collection));
      }
      for (const [collection, rows] of datasets) {
         for (let offset = 0; offset < rows.length; offset += 100) {
            const batch = db.batch();
            for (const { id, data } of rows.slice(offset, offset + 100)) {
               const ref = db.collection(collection).doc(id);
               if (collection === 'pms_hotel_reservations') {
                  const { deposits, ...booking } = data;
                  batch.set(ref, booking);
                  for (const [position, deposit] of deposits.entries()) batch.create(ref.collection('deposits').doc(deposit.id), {
                     ...deposit, position, reservation_revision: data.revision, fiscal_requested: false
                  });
               } else batch.set(ref, data);
               if (collection === 'pms_hotel_reservations') batch.create(db.collection('pms_hotel_reservation_versions').doc(id).collection('revisions').doc('1'), {
                  revision: 1, snapshot: data, operation_id: 'initial-alignment', source: 'server', operator: null, committed_at: FieldValue.serverTimestamp()
               });
            }
            await batch.commit();
         }
         console.log(`Riallineata ${collection}: ${rows.length}`);
      }
      for (const [collection, rows] of datasets) {
         const snapshot = await db.collection(collection).get();
         const expected = new Map(rows.map(row => [row.id, row.data]));
         if (snapshot.size !== rows.length) throw Error(`Conteggio finale fallito: ${collection}`);
         for (const entry of snapshot.docs) {
            const actual = entry.data();
            if (collection === 'pms_hotel_reservations') actual.deposits = (await entry.ref.collection('deposits').orderBy('position').get()).docs.map(item => {
               const { fiscal_requested, position, reservation_revision, ...deposit } = item.data();
               return deposit;
            });
            if (reservationHash(actual) !== reservationHash(expected.get(entry.id))) throw Error(`Confronto finale fallito: ${collection}/${entry.id}`);
         }
      }
      for (const [filename, expected] of sources) if (digest(fs.readFileSync(path.join(server, filename))) !== expected) throw Error(`File locale cambiato durante il riallineamento: ${filename}`);
      const reservationsFile = path.join(server, 'database/hotel/reservationDB.json');
      const reservations = datasets.get('pms_hotel_reservations').map(row => row.data);
      fs.writeFileSync(`${reservationsFile}.tmp`, JSON.stringify(reservations));
      fs.renameSync(`${reservationsFile}.tmp`, reservationsFile);
      fs.writeFileSync(`${stateFile}.tmp`, JSON.stringify({
         enabled: true,
         baselines: Object.fromEntries(reservations.map(row => [row.id, { hash: reservationHash(row), revision: 1 }])),
         diagnostics: {}, roomKeys: datasets.get('rooms').map(row => row.id)
      }, null, 2));
      fs.renameSync(`${stateFile}.tmp`, stateFile);
      console.log(JSON.stringify({ completed: true, counts, depositsAssigned, enabled: true }, null, 2));
   }
} finally { await deleteApp(app); }
