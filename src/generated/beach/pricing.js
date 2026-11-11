function migrateBeachRate(rate, places) {
   if (!Array.isArray(rate.prices)) return rate;
   const prices = new Map();
   for (const entry of rate.prices) {
      const id = Number(entry.id);
      const value = Number(entry.price_per_place);
      if (!Number.isInteger(id) || entry.price_per_place == null || entry.price_per_place === '' ||
          !Number.isFinite(value) || prices.has(id)) {
         throw new Error(`Listino spiaggia ${rate.id}: prezzo legacy non valido`);
      }
      prices.set(id, value);
   }
   const rows = new Map();
   for (const place of places) {
      const key = `${place.zone_id}:${place.row}`;
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key).push(place);
   }
   const rowPrices = [];
   const placeOverrides = [];
   for (const [key, rowPlaces] of rows) {
      const values = rowPlaces.filter(place => prices.has(place.id)).map(place => prices.get(place.id));
      if (!values.length) continue;
      const counts = new Map();
      for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
      const rowPrice = [...counts].sort((a, b) => b[1] - a[1])[0][0];
      const [zoneId, row] = key.split(':').map(Number);
      rowPrices.push({ zoneId, row, price_per_place: rowPrice });
      for (const place of rowPlaces) {
         const value = prices.get(place.id);
         if (value != null && value !== rowPrice) placeOverrides.push({ placeId: place.id, price_per_place: value });
      }
   }
   for (const id of prices.keys()) {
      if (!places.some(place => place.id === id)) throw new Error(`Listino spiaggia ${rate.id}: posto ${id} non configurato`);
   }
   const { prices: legacyPrices, ...canonical } = rate;
   return { ...canonical, rowPrices, placeOverrides };
}

function getBeachPlacePrice(rate, place) {
   const override = rate.placeOverrides.find(item => item.placeId === place.id);
   if (override) return override.price_per_place;
   const row = rate.rowPrices.find(item => item.zoneId === place.zone_id && item.row === place.row);
   return row?.price_per_place ?? null;
}

function expandBeachRate(rate, places) {
   const { rowPrices, placeOverrides, ...publicRate } = rate;
   return {
      ...publicRate,
      prices: places.flatMap(place => {
         const price = getBeachPlacePrice(rate, place);
         return price == null ? [] : [{
            id: place.id,
            fila: place.fila,
            riga: place.riga,
            place_type: place.place_type,
            price_per_place: price
         }];
      })
   };
}

function validateBeachRate(rate, places) {
   if (!Array.isArray(rate.rowPrices) || !Array.isArray(rate.placeOverrides)) {
      throw new Error('Il listino spiaggia richiede rowPrices e placeOverrides');
   }
   const rows = new Set(places.map(place => `${place.zone_id}:${place.row}`));
   const ids = new Set(places.map(place => place.id));
   const savedRows = new Set();
   const savedPlaces = new Set();
   for (const row of rate.rowPrices) {
      const key = `${row.zoneId}:${row.row}`;
      if (!Number.isInteger(row.zoneId) || !Number.isInteger(row.row) || !rows.has(key) || savedRows.has(key) ||
          row.price_per_place == null || row.price_per_place === '' ||
          !Number.isFinite(Number(row.price_per_place)) || Number(row.price_per_place) < 0) {
         throw new Error(`Prezzo di fila non valido: ${key}`);
      }
      savedRows.add(key);
   }
   for (const override of rate.placeOverrides) {
      if (!ids.has(override.placeId) || savedPlaces.has(override.placeId) ||
          override.price_per_place == null || override.price_per_place === '' ||
          !Number.isFinite(Number(override.price_per_place)) || Number(override.price_per_place) < 0) {
         throw new Error(`Override del posto non valido: ${override.placeId}`);
      }
      savedPlaces.add(override.placeId);
   }
   return rate;
}

export { expandBeachRate, getBeachPlacePrice, migrateBeachRate, validateBeachRate };
