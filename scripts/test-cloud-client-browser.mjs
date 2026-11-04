import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const {
  chromium
} = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const require = createRequire(new URL('../package.json', import.meta.url));
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8180';
const {
  initializeApp,
  deleteApp
} = require('firebase-admin/app');
const {
  getFirestore
} = require('firebase-admin/firestore');
const app = initializeApp({
  projectId: 'demo-pmsweb'
}, 'browser-test');
const db = getFirestore(app);
const email = `browser-${Date.now()}@example.test`;
const a = await fetch('http://127.0.0.1:9199/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email,
    password: 'TestCloud123!',
    returnSecureToken: true
  })
});
const account = await a.json();
assert(a.ok);
for (const name of ['pms_hotel_reservations', 'pms_hotel_reservation_versions', 'pms_hotel_reservation_tombstones', 'pms_hotel_reservation_conflicts', 'pms_hotel_reservation_history', 'pms_room_inventory', 'pms_fiscal_jobs']) await db.recursiveDelete(db.collection(name));
const batch = db.batch();
batch.set(db.collection('pms_web_users').doc(account.localId), {
  operatorId: 2,
  name: 'Ivan test',
  role: 'admin',
  enabled: true,
  permissions: {}
});
batch.set(db.collection('pms_configs').doc('current'), {
  hotel: {
    enabled: true,
    providerType: 'local',
    pricing: {
      mode: 'room',
      ageBands: []
    }
  },
  beach: {
    enabled: false
  },
  payments: {
    hotel: [{
      id: 1,
      name: 'Bonifico',
      electronic: true
    }]
  }
});
for (const id of ['101', '102']) batch.set(db.collection('rooms').doc(id), {
  id,
  room_code: id,
  description: `Camera ${id}`,
  room_type: {
    label: 'Doppia'
  }
});
batch.set(db.collection('pms_hotel_rates').doc('1'), {
  id: 1,
  prices: [{
    roomType: 'Doppia',
    tariffa: 80
  }],
  surcharges: {
    hb: 15,
    fb: 25
  }
});
for (let day = 1; day <= 365; day++) batch.set(db.collection('pms_hotel_timetable').doc(String(day)), {
  day,
  pricelist: 1
});
await batch.commit();
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true
});
const context = await browser.newContext({
  viewport: {
    width: 1440,
    height: 1000
  }
});
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [];
const dialogs = [];
page.on('pageerror', e => errors.push(e.message));
page.on('dialog', async d => {
  dialogs.push(d.message());
  await d.accept();
});
await context.route('**/*', route => {
  const u = new URL(route.request().url());
  return ['127.0.0.1', 'localhost'].includes(u.hostname) || ['data:', 'blob:'].includes(u.protocol) ? route.continue() : route.abort();
});
const apiRequests = [];
await context.route('**/api/**', route => { apiRequests.push(route.request().url()); return route.abort(); });
try {
  await page.goto('http://127.0.0.1:5178/');
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill('TestCloud123!');
  await page.getByRole('button', {
    name: 'Accedi',
    exact: true
  }).click();
  await page.getByRole('button', {
    name: '+ Nuova Prenotazione',
    exact: true
  }).click();
  const form = page.locator('.booking-form');
  await form.locator('select').first().selectOption('101');
  await form.getByPlaceholder('es. Mario').fill('Mario');
  await form.getByPlaceholder('es. Rossi').fill('Browser');
  await form.locator('input[type=date]').nth(0).fill('2026-10-21');
  await form.locator('input[type=date]').nth(1).fill('2026-10-24');
  await form.locator('.form-section').filter({ has: page.locator('label', { hasText: /^Adulti$/ }) }).locator('input').fill('2');
  await page.waitForFunction(() => document.querySelector('.booking-form .final-price-display')?.textContent.replace(/\s+/g, '') === 'TOTALE:€240');
  await db.collection('pms_hotel_rates').doc('1').update({ prices: [{ roomType: 'Doppia', tariffa: 100 }] });
  await page.waitForFunction(() => document.querySelector('.booking-form .final-price-display')?.textContent.replace(/\s+/g, '') === 'TOTALE:€300');
  await db.collection('pms_hotel_rates').doc('2').set({ id: 2, prices: [{ roomType: 'Doppia', tariffa: 200 }], surcharges: { hb: 15, fb: 25 } });
  const calendar = db.batch();
  for (let day = 1; day <= 365; day++) calendar.update(db.collection('pms_hotel_timetable').doc(String(day)), { pricelist: 2 });
  await calendar.commit();
  await page.waitForFunction(() => document.querySelector('.booking-form .final-price-display')?.textContent.replace(/\s+/g, '') === 'TOTALE:€600');
  await db.collection('pms_configs').doc('current').update({ 'hotel.pricing': { mode: 'person', thirdBedDiscountPct: 0, ageBands: [] } });
  await page.waitForFunction(() => document.querySelector('.booking-form .final-price-display')?.textContent.replace(/\s+/g, '') === 'TOTALE:€1200');
  await form.locator('.form-section').filter({ has: page.locator('label', { hasText: /^Adulti$/ }) }).locator('input').fill('3');
  await page.waitForFunction(() => document.querySelector('.booking-form .final-price-display')?.textContent.replace(/\s+/g, '') === 'TOTALE:€1800');
  await db.collection('pms_configs').doc('current').update({ 'hotel.pricing.thirdBedDiscountPct': 50 });
  await page.waitForFunction(() => document.querySelector('.booking-form .final-price-display')?.textContent.replace(/\s+/g, '') === 'TOTALE:€1500');
  await form.locator('.price-management-row input[type=checkbox]').check();
  await form.locator('.price-management-row input[type=number]').fill('777');
  await db.collection('pms_hotel_rates').doc('2').update({ prices: [{ roomType: 'Doppia', tariffa: 250 }] });
  await page.waitForTimeout(400);
  assert.equal(await form.locator('.price-management-row input[type=number]').inputValue(), '777');
  console.log('OK browser realtime listino, calendario, policy e sconto senza riaprire il tableau; prezzo manuale conservato');
  const restore = db.batch();
  restore.update(db.collection('pms_hotel_rates').doc('1'), { prices: [{ roomType: 'Doppia', tariffa: 80 }] });
  restore.update(db.collection('pms_configs').doc('current'), { 'hotel.pricing': { mode: 'room', ageBands: [] } });
  for (let day = 1; day <= 365; day++) restore.update(db.collection('pms_hotel_timetable').doc(String(day)), { pricelist: 1 });
  await restore.commit();
  await form.locator('.form-section').filter({ has: page.locator('label', { hasText: /^Adulti$/ }) }).locator('input').fill('2');
  await form.locator('.price-management-row input[type=checkbox]').uncheck();
  await page.waitForFunction(() => document.querySelector('.booking-form .final-price-display')?.textContent.replace(/\s+/g, '') === 'TOTALE:€240');
  await form.getByPlaceholder('es. 100').fill('100');
  await form.locator('.deposit-entry-grid select').selectOption('1');
  await form.getByRole('button', {
    name: '+ Aggiungi Deposit',
    exact: true
  }).click();
  await form.getByRole('button', {
    name: 'Conferma Prenotazione',
    exact: true
  }).click();
  await form.waitFor({
    state: 'hidden'
  });
  let snap = await db.collection('pms_hotel_reservations').get();
  assert.equal(snap.size, 1);
  let booking = snap.docs[0].data();
  assert.equal(booking.revision, 1);
  assert.equal(booking.deposits, undefined);
  const deposits = await db.collection('pms_hotel_reservations').doc(booking.id).collection('deposits').get();
  assert.equal(deposits.size, 1);
  assert.equal(deposits.docs[0].data().amount, 100);
  assert.equal(deposits.docs[0].data().fiscal_requested, false);
  assert.equal((await db.collection('pms_fiscal_jobs').get()).size, 0);
  console.log('OK browser creazione con acconto', booking.price_total);
  await page.locator('.booking').filter({
    hasText: 'Browser'
  }).first().click();
  await page.getByRole('button', {
    name: 'Modifica',
    exact: true
  }).click();
  await form.getByPlaceholder('es. Mario').fill('Modificato');
  await form.locator('select').first().selectOption('102');
  await form.getByRole('button', {
    name: 'Salva',
    exact: true
  }).click();
  await form.waitFor({
    state: 'hidden'
  });
  booking = (await db.collection('pms_hotel_reservations').doc(booking.id).get()).data();
  assert.equal(booking.roomId, '102');
  assert.equal(booking.accountholder.firstname, 'Modificato');
  assert.equal(booking.revision, 2);
  console.log('OK browser modifica e spostamento');
  assert.deepEqual(apiRequests, []);
  await page.locator('.booking').filter({
    hasText: 'Browser'
  }).first().click();
  await page.getByRole('button', {
    name: 'Modifica',
    exact: true
  }).click();
  const remote = await page.evaluate(async booking => {
    const { executeHotelOperation } = await import('/src/services/cloudHotelReservations.js');
    const { getFirebaseDb, getFirebaseAuth } = await import('/src/services/firebaseClient.js');
    return executeHotelOperation(getFirebaseDb(), getFirebaseAuth().currentUser, '/update_reservation', { id: booking.id, baseRevision: 2, notes: ['Aggiornamento concorrente'] });
  }, booking);
  assert.equal(remote.success, true);
  await form.getByPlaceholder('es. Mario').fill('Proposta');
  const conflictDialog = page.waitForEvent('dialog', { predicate: dialog => dialog.message().includes('altro operatore') });
  await form.getByRole('button', {
    name: 'Salva',
    exact: true
  }).click();
  await conflictDialog;
  assert(dialogs.some(x => x.includes('altro operatore')));
  await form.getByRole('button', {
    name: 'Annulla',
    exact: true
  }).click();
  await page.getByRole('button', {
    name: 'Conflitti',
    exact: true
  }).click();
  await page.getByRole('button', {
    name: 'Conserva la versione confermata',
    exact: true
  }).click();
  await page.getByText('Nessun conflitto da risolvere.').waitFor();
  await page.locator('.modal-overlay').getByRole('button', {
    name: 'Chiudi',
    exact: true
  }).click();
  booking = (await db.collection('pms_hotel_reservations').doc(booking.id).get()).data();
  assert.equal(booking.revision, 4);
  assert.equal(booking.accountholder.firstname, 'Modificato');
  assert.deepEqual(booking.notes, ['Aggiornamento concorrente']);
  console.log('OK browser conflitto, confronto versioni e risoluzione definitiva');
  await page.goto('http://127.0.0.1:5178/bookings');
  await page.getByRole('button', {
    name: 'Pulisci',
    exact: true
  }).click();
  await page.getByLabel('Data arrivo a').fill('2026-10-30');
  await page.getByRole('button', {
    name: 'Aggiorna',
    exact: true
  }).click();
  await page.getByRole('button', {
    name: 'Browser Modificato',
    exact: true
  }).click();
  await form.getByRole('button', {
    name: 'Cancella prenotazione',
    exact: true
  }).click();
  await page.getByPlaceholder('Indica il motivo della cancellazione (obbligatorio)').fill('Test browser');
  await page.locator('.cancel-dialog-body').locator('..').getByRole('button', {
    name: 'Conferma Cancellazione',
    exact: true
  }).click();
  await form.waitFor({
    state: 'hidden'
  });
  booking = (await db.collection('pms_hotel_reservations').doc(booking.id).get()).data();
  assert.equal(booking.status, -100);
  assert.deepEqual(errors, []);
  console.log('OK browser annullamento, acconto conservato; nessuna connessione LAN o internet');
} catch (e) {
  console.error('DIALOGS', dialogs);
  console.error('PAGE ERRORS', errors);
  console.error((await page.locator('body').innerText()).slice(-5000));
  await page.screenshot({
    path: '/tmp/pmsweb-browser-failure.png'
  });
  throw e;
} finally {
  await browser.close();
  await deleteApp(app);
}
