import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import assert from 'node:assert/strict';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const server = process.env.MBAR_SERVER_ROOT || resolve(root, '../../node/mbar-server');
const pricing = await import(root + '/src/generated/hotel/hotelPricing.js');
const serverPricing = await import(pathToFileURL(resolve(server, 'pms/modules/hotelPricing.js')));
const rates = [{
  id: 1,
  prices: [{
    roomType: 'Doppia',
    tariffa: 80
  }],
  surcharges: {
    hb: 15,
    fb: 25
  }
}];
const table = Array.from({
  length: 365
}, (_, i) => ({
  day: i + 1,
  pricelist: 1
}));
for (const mode of ['room', 'person']) for (const adults of [1, 2, 3, 4]) for (const board of ['BB', 'HB', 'FB']) {
  const policy = {
    mode,
    minimumStay: { BB: 1, HB: 1, FB: 1 },
    thirdBedDiscountPct: 30,
    ageBands: [{
      label: 'Bambini',
      minAge: 0,
      maxAge: 17,
      pricingType: 'discount',
      discountPct: 50
    }]
  };
  const deployed = {
    ...serverPricing.default,
    getHotelPricingPolicy: () => serverPricing.normalizeHotelPricingPolicy(policy),
    loadTimeTableByType: async () => table,
    getRates: async () => rates
  };
  const current = {
    ...pricing.default,
    getHotelPricingPolicy: () => pricing.normalizeHotelPricingPolicy(policy),
    loadTimeTableByType: async () => table,
    getRates: async () => rates
  };
  const base = {
    checkin: '2026-05-01',
    checkout: '2026-05-04',
    roomType: 'Doppia',
    adults,
    kids: 1,
    kidsAges: [8],
    board,
    person_pricing: {
      rows: [...Array.from({
        length: adults
      }, (_, i) => ({
        type: 'adult',
        occupant_id: 'a' + i,
        cells: [{
          date: '2026-05-02',
          override_price: i === 0 ? 0 : null
        }]
      })), {
        type: 'child',
        occupant_id: 'c1',
        cells: []
      }]
    }
  };
  for (const fixed of [false, true]) {
    const input = {
      ...base,
      ...(fixed ? {
        pricing_mode: 'fixed',
        fixedPrice: 100.01
      } : {})
    };
    const left = await deployed.calculateHotelReservationPricing(structuredClone(input));
    const right = await current.calculateHotelReservationPricing(structuredClone(input));
    assert.deepEqual(JSON.parse(JSON.stringify(left)), JSON.parse(JSON.stringify(right)));
    if (fixed) assert.equal(right.total_price, 100.01);
    policy.minimumStay = { BB: 30, HB: 30, FB: 30 };
    assert.deepEqual(await deployed.calculateHotelReservationPricing(structuredClone(input)), left);
    assert.deepEqual(await current.calculateHotelReservationPricing(structuredClone(input)), right);
    policy.minimumStay = { BB: 1, HB: 1, FB: 1 };
  }
}
console.log('OK: 48 confronti prezzo camera/persona, occupazione, trattamenti, override zero e prezzo fisso tra il motore cloud e quello installato sul server; prezzi invariati con minimum stay di 1 o 30 notti');
