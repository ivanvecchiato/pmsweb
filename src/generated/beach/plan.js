const DEFAULT_COLORS = ['#E3F2FD', '#E8F5E9', '#FFF3E0', '#FCE4EC', '#F3E5F5', '#E0F2F1', '#FFFDE7', '#EFEBE9'];

const rowType = (row) => ({
   id: row,
   description: `FILA ${row}`,
   label: `F${row}`,
   color: DEFAULT_COLORS[(row - 1) % DEFAULT_COLORS.length]
});

function flattenBeachZones(zones) {
   const places = [];
   for (const zone of zones) {
      zone.rows.forEach((row, rowIndex) => {
         row.places.forEach((place, columnIndex) => {
            if (!place) return;
            const rowNumber = rowIndex + 1;
            const column = columnIndex + 1;
            places.push({
               id: place.id,
               zone_id: zone.id,
               zona: zone.code,
               sector: zone.name,
               riga: rowNumber,
               fila: column,
               row: rowNumber,
               column,
               name: place.name || `${zone.code}${rowNumber}-${column}`,
               place_type: place.place_type || row.place_type
            });
         });
      });
   }
   return places;
}

function validateBeachZones(zones) {
   if (!Array.isArray(zones)) throw new Error('Il piano spiaggia deve contenere un array di zone');
   const zoneIds = new Set();
   const codes = new Set();
   const placeIds = new Set();
   for (const zone of zones) {
      if (!Number.isInteger(zone?.id) || zone.id <= 0 || zoneIds.has(zone.id) ||
          typeof zone.name !== 'string' || !zone.name.trim() ||
          typeof zone.code !== 'string' || !zone.code.trim() || codes.has(zone.code) ||
          !Array.isArray(zone.rows) || !zone.rows.length) {
         throw new Error('Zona spiaggia non valida o duplicata');
      }
      zoneIds.add(zone.id);
      codes.add(zone.code);
      const columns = zone.rows[0]?.places?.length;
      if (!Number.isInteger(columns) || columns <= 0) throw new Error(`Matrice non valida nella zona ${zone.code}`);
      for (const row of zone.rows) {
         if (!row?.place_type || !Number.isInteger(row.place_type.id) ||
             !Array.isArray(row.places) || row.places.length !== columns) {
            throw new Error(`Riga non valida nella zona ${zone.code}`);
         }
         for (const place of row.places) {
            if (place == null) continue;
            if (!Number.isInteger(place.id) || place.id <= 0 || placeIds.has(place.id) ||
                place.place_type && !Number.isInteger(place.place_type.id)) {
               throw new Error(`Posto non valido o duplicato nella zona ${zone.code}`);
            }
            placeIds.add(place.id);
         }
      }
   }
   return zones;
}

function migrateFlatBeachPlan(records) {
   if (!records.length) return [];
   if (records.every(zone => Array.isArray(zone.rows))) return validateBeachZones(records);
   if (records.some(zone => Array.isArray(zone.rows))) throw new Error('Piano spiaggia con formati misti');

   const zones = [];
   const byCode = new Map();
   for (const place of records) {
      const code = String(place.zona || place.sector || '').trim();
      const rowNumber = Number(place.riga ?? place.row);
      const column = Number(place.fila ?? place.column);
      if (!code || !Number.isInteger(rowNumber) || rowNumber <= 0 || !Number.isInteger(column) || column <= 0) {
         throw new Error(`Coordinate non valide per il posto ${place.id}`);
      }
      if (!byCode.has(code)) {
         const zone = { id: zones.length + 1, name: String(place.sector || code), code, rows: [] };
         byCode.set(code, zone);
         zones.push(zone);
      }
      const zone = byCode.get(code);
      while (zone.rows.length < rowNumber) zone.rows.push({ place_type: rowType(zone.rows.length + 1), places: [] });
      const row = zone.rows[rowNumber - 1];
      while (row.places.length < column) row.places.push(null);
      if (row.places[column - 1]) throw new Error(`Coordinate duplicate nella zona ${code}`);
      if (row.places.every(item => item == null) && place.place_type) row.place_type = place.place_type;
      const item = { id: Number(place.id) };
      if (place.name) item.name = place.name;
      if (place.place_type && place.place_type.id !== row.place_type.id) item.place_type = place.place_type;
      row.places[column - 1] = item;
   }
   for (const zone of zones) {
      const columns = Math.max(...zone.rows.map(row => row.places.length));
      for (const row of zone.rows) while (row.places.length < columns) row.places.push(null);
   }
   return validateBeachZones(zones);
}

export { flattenBeachZones, migrateFlatBeachPlan, rowType, validateBeachZones };
