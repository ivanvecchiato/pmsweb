import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(new URL('../package.json', import.meta.url));
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8180';
const app = initializeApp({ projectId: 'demo-pmsweb-realignment' }, 'realignment-test');
const db = getFirestore(app);
const directory = fs.mkdtempSync(path.join(tmpdir(), 'pmsweb-realignment-test-'));
fs.mkdirSync(path.join(directory, 'database/hotel'), { recursive: true });
fs.mkdirSync(path.join(directory, 'configs'));
fs.mkdirSync(path.join(directory, 'pms/modules'), { recursive: true });
fs.writeFileSync(path.join(directory, 'pms/modules/hotelCloudSync.js'), '');
const reservation = { id: 'local', roomId: '101', room: '101', checkin: '2026-10-21', checkout: '2026-10-24', price_total: 240, notes: ['test'], deposits: [{ amount: 100, payment_date: '2026-10-20', payment_mode: 'Bonifico', invoice_progressive: 9 }, { amount: 7, payment_date: '2026-10-20', payment_mode: 'Bonifico' }] };
for (const [filename, value] of [
  ['roomDB.json', [{ id: '101', room_code: '101', room_type: { label: 'Doppia' } }]],
  ['reservationDB.json', [reservation, { id: 'past', checkin: '2025-01-01', checkout: '2025-01-02', price_total: 0 }]],
  ['reservationHistoryDB.json', []], ['pricesDB.json', []], ['timeTableDB.json', []], ['servicesDB.json', []]
]) fs.writeFileSync(path.join(directory, 'database/hotel', filename), JSON.stringify(value));
fs.writeFileSync(path.join(directory, 'database/firestore-outbox.json'), '[]');
fs.writeFileSync(path.join(directory, 'configs/configs.json'), JSON.stringify({ hotel: { enabled: true }, beach: { enabled: false } }));
try {
  await db.collection('pms_hotel_reservations').doc('cloud-only').set({ id: 'cloud-only', roomId: 'wrong' });
  await db.collection('pms_hotel_reservations').doc('local').set({ id: 'local', price_total: 1 });
  await db.collection('pms_hotel_reservation_versions').doc('cloud-only').collection('revisions').doc('7').set({ revision: 7 });
  await db.collection('pms_fiscal_jobs').doc('old-job').set({ status: 'pending' });
  const result = spawnSync(process.execPath, ['scripts/realign-hotel-cloud.mjs', '--emulator', '--apply'], {
    env: { ...process.env, MBAR_SERVER_ROOT: directory }, encoding: 'utf8', timeout: 30000
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const local = JSON.parse(fs.readFileSync(path.join(directory, 'database/hotel/reservationDB.json')));
  const cloud = await db.collection('pms_hotel_reservations').get();
  assert.equal(cloud.size, 2);
  for (const row of local) assert.deepEqual((await db.collection('pms_hotel_reservations').doc(row.id).get()).data(), row);
  assert.equal(local[0].price_total, 240);
  assert.deepEqual(local[0].deposits.map(deposit => deposit.amount), [100, 7]);
  assert.deepEqual(local[0].deposits.map(deposit => deposit.fiscal_status), ['external', 'historical']);
  assert(local[0].deposits.every(deposit => deposit.id));
  assert.equal(local[1].roomId, null);
  assert.equal((await db.collection('pms_hotel_reservations').doc('cloud-only').get()).exists, false);
  assert((await db.collection('pms_hotel_reservation_versions').doc('cloud-only').collection('revisions').get()).empty);
  assert((await db.collection('pms_fiscal_jobs').get()).empty);
  const state = JSON.parse(fs.readFileSync(path.join(directory, 'database/hotel/cloud-sync.json')));
  assert.equal(state.enabled, true);
  assert.equal(Object.keys(state.baselines).length, 2);
  assert.equal(state.maintenance, undefined);
  assert(!fs.existsSync(path.join(directory, 'backups')));
  console.log('OK: riallineamento diretto senza backup o archivi, copie locale/cloud identiche, importi conservati, revisione iniziale, acconti identificati senza stampe e attivazione persistente');
} finally {
  await deleteApp(app);
  fs.rmSync(directory, { recursive: true, force: true });
}
