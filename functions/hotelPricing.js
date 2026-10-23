import utils from './pms-utils.js';

const HOTEL_PRICING_MODES = {
   ROOM: 'room',
   PERSON: 'person'
};
const toNumber = (value) => {
   const n = Number(value);
   return Number.isFinite(n) ? n : null;
};
const normalizeIsoDate = (value) => {
   if (typeof value !== 'string' || !value.trim()) return '';
   return value.slice(0, 10);
};
const isOverbookingRoomType = (value) => String(value || '').trim().toLowerCase() === 'over';
const normalizeHotelPricingMode = (value) => {
   const mode = String(value || '').trim().toLowerCase();
   return mode === HOTEL_PRICING_MODES.PERSON ? HOTEL_PRICING_MODES.PERSON : HOTEL_PRICING_MODES.ROOM;
};
const normalizeAgeBand = (band) => {
   if (!band || typeof band !== 'object') return null;
   const minAge = toNumber(band.minAge);
   const maxAge = toNumber(band.maxAge);
   if (minAge == null || maxAge == null) return null;
   if (maxAge < minAge) return null;

   const pricingTypeRaw = String(band.pricingType || '').trim().toLowerCase();
   const pricingType = pricingTypeRaw === 'fixed' ? 'fixed' : 'discount';

   let discountPct = Number(band.discountPct);
   if (!Number.isFinite(discountPct)) discountPct = 0;
   discountPct = Math.max(0, Math.min(100, discountPct));

   let fixedPrice = Number(band.fixedPrice);
   if (!Number.isFinite(fixedPrice)) fixedPrice = 0;
   fixedPrice = Math.max(0, fixedPrice);

   return {
      label: String(band.label || '').trim(),
      minAge,
      maxAge,
      pricingType,
      discountPct,
      fixedPrice
   };
};
const normalizeAgeBands = (bands) => {
   if (!Array.isArray(bands)) return [];
   return bands
      .map(normalizeAgeBand)
      .filter(Boolean)
      .sort((a, b) => a.minAge - b.minAge);
};
const HOTEL_PRICING_DEFAULTS = {
   mode: HOTEL_PRICING_MODES.ROOM,
   boardChargeMode: 'per_person',
   extraBedDiscountPct: 0,
   thirdBedDiscountPct: 0,
   ageBands: []
};
const normalizeHotelPricingPolicy = (policy) => {
   const source = policy && typeof policy === 'object' ? policy : {};

   let extraBedDiscountPct = Number(source.extraBedDiscountPct);
   if (!Number.isFinite(extraBedDiscountPct)) {
      extraBedDiscountPct = HOTEL_PRICING_DEFAULTS.extraBedDiscountPct;
   }

   let thirdBedDiscountPct = Number(source.thirdBedDiscountPct);
   if (!Number.isFinite(thirdBedDiscountPct)) thirdBedDiscountPct = extraBedDiscountPct;

   return {
      mode: normalizeHotelPricingMode(source.mode),
      boardChargeMode: String(source.boardChargeMode || HOTEL_PRICING_DEFAULTS.boardChargeMode),
      extraBedDiscountPct: Math.max(0, Math.min(100, extraBedDiscountPct)),
      thirdBedDiscountPct: Math.max(0, Math.min(100, thirdBedDiscountPct)),
      ageBands: normalizeAgeBands(source.ageBands)
   };
};
const getKidAgesFromReservation = (reservation) => {
   if (!reservation || typeof reservation !== 'object') return [];
   const kids = Math.max(0, Math.floor(Number(reservation.kids || 0)));
   const raw = reservation.kidsAges ?? [];
   if (!kids) return [];
   if (!Array.isArray(raw) || raw.length !== kids) {
      throw new Error(`L'età è obbligatoria per tutti i ${kids} bambini`);
   }
   return raw.map((age, index) => {
      const normalized = age == null || typeof age === 'boolean' || String(age).trim() === '' ? null : toNumber(age);
      if (normalized == null || normalized < 0 || !Number.isInteger(normalized)) {
         throw new Error(`Età non valida per il bambino ${index + 1}`);
      }
      return normalized;
   });
};
const getOccupancyFromReservation = (reservation) => {
   const adults = Math.max(0, Number(reservation?.adults ?? 0));
   const kids = Math.max(0, Number(reservation?.kids ?? 0));
   const extraBeds = Math.max(0, Number(reservation?.extraBeds ?? 0));
   return {
      adults,
      kids,
      extraBeds,
      kidAges: getKidAgesFromReservation(reservation)
   };
};
const applyDiscount = (fullPrice, discountPct) => {
   const pct = Math.max(0, Math.min(100, Number(discountPct || 0)));
   return Number((Number(fullPrice || 0) * (1 - pct / 100)).toFixed(2));
};
const resolveKidPricingByAge = (age, ageBands, fullPrice) => {
   if (!Number.isFinite(age)) {
      throw new Error('Età bambino obbligatoria');
   }
   const matchedBand = ageBands.find((band) => age >= band.minAge && age <= band.maxAge);
   if (!matchedBand) {
      throw new Error(`Nessuna fascia di prezzo configurata per un bambino di ${age} anni`);
   }

   if (matchedBand.pricingType === 'fixed') {
      return {
         pricingType: 'fixed',
         discountPct: 0,
         fixedPrice: Number(matchedBand.fixedPrice || 0),
         amount: Number(Number(matchedBand.fixedPrice || 0).toFixed(2))
      };
   }

   return {
      pricingType: 'discount',
      discountPct: Number(matchedBand.discountPct || 0),
      fixedPrice: 0,
      amount: applyDiscount(fullPrice, matchedBand.discountPct)
   };
};
const calculateWeightedGuests = (occupancy, policy, fullPrice) => {
   const ageBands = normalizeAgeBands(policy?.ageBands);
   const extraBedDiscountPct = Number(policy?.extraBedDiscountPct ?? HOTEL_PRICING_DEFAULTS.extraBedDiscountPct);
   const kidAges = Array.isArray(occupancy?.kidAges) ? occupancy.kidAges : [];

   let adultsAmount = 0;
   const adultsBreakdown = [];
   for (let i = 0; i < occupancy.adults; i++) {
      const position = i + 1;
      let discountPct = 0;
      if (position >= 3) discountPct = Number(policy?.thirdBedDiscountPct || 0);
      const amount = applyDiscount(fullPrice, discountPct);
      adultsBreakdown.push({ position, discountPct, amount });
      adultsAmount += amount;
   }
   adultsAmount = Number(adultsAmount.toFixed(2));

   let kidsAmount = 0;
   const kidsBreakdown = [];
   for (let i = 0; i < occupancy.kids; i++) {
      const age = i < kidAges.length ? kidAges[i] : null;
      const ageBandPricing = resolveKidPricingByAge(age, ageBands, fullPrice);
      const pricing = occupancy.adults >= 2
         ? ageBandPricing
         : {
            pricingType: 'full',
            discountPct: 0,
            fixedPrice: 0,
            amount: Number(Number(fullPrice || 0).toFixed(2))
         };
      kidsBreakdown.push({
         index: i + 1,
         age,
         pricingType: pricing.pricingType,
         discountPct: pricing.discountPct,
         fixedPrice: pricing.fixedPrice,
         amount: pricing.amount
      });
      kidsAmount += Number(pricing.amount || 0);
   }

   const extraBedUnitPrice = applyDiscount(fullPrice, extraBedDiscountPct);
   const extraBedsAmount = Number((occupancy.extraBeds * extraBedUnitPrice).toFixed(2));
   const totalAmount = Number((adultsAmount + kidsAmount + extraBedsAmount).toFixed(2));
   const effectiveUnits = fullPrice > 0 ? Number((totalAmount / fullPrice).toFixed(4)) : 0;

   return {
      adultsAmount,
      adultsBreakdown,
      kidsAmount: Number(kidsAmount.toFixed(2)),
      extraBedsAmount,
      kidsBreakdown,
      extraBedDiscountPct,
      effectiveUnits,
      totalAmount
   };
};
const toPositiveNumber = (value) => {
   const n = Number(value);
   return Number.isFinite(n) && n > 0 ? n : 0;
};
const sumDailyPrices = (pricePerDay) => {
   if (!Array.isArray(pricePerDay) || !pricePerDay.length) return 0;
   return Number(pricePerDay.reduce((sum, dayItem) => {
      if (typeof dayItem === 'number') return sum + dayItem;
      if (!dayItem || typeof dayItem !== 'object') return sum;
      return sum + Number(dayItem.day_total ?? dayItem.price ?? dayItem.price_per_room ?? dayItem.price_per_place ?? 0);
   }, 0).toFixed(2));
};
const deriveStoredHotelAmount = (reservation) => {
   if (!reservation || typeof reservation !== 'object') return 0;
   const directAmount = toPositiveNumber(
      reservation.price_per_room ??
      reservation.price_total ??
      reservation.total_price ??
      reservation.rateAmount ??
      reservation.fixedPrice ??
      reservation.fixed_price
   );
   if (directAmount > 0) return directAmount;

   const fromDaily = toPositiveNumber(sumDailyPrices(reservation.price_per_day));
   return fromDaily;
};
const getHotelPricingState = (reservation) => ({
   roomId: reservation?.roomId ?? null,
   roomType: reservation?.roomType ?? null,
   checkin: normalizeIsoDate(reservation?.checkin),
   checkout: normalizeIsoDate(reservation?.checkout),
   board: String(reservation?.board || 'BB').toUpperCase(),
   adults: Math.max(0, Math.floor(Number(reservation?.adults || 0))),
   kids: Math.max(0, Math.floor(Number(reservation?.kids || 0))),
   kidsAges: getKidAgesFromReservation(reservation),
   extraBeds: Math.max(0, Math.floor(Number(reservation?.extraBeds || 0))),
   fixedPrice: reservation?.fixedPrice ?? null,
   pricing_mode: reservation?.pricing_mode ?? null,
   rows: Array.isArray(reservation?.person_pricing?.rows)
      ? reservation.person_pricing.rows.map(row => ({
         occupant_id: String(row?.occupant_id || ''),
         guest_customer_id: row?.guest_customer_id ?? null,
         type: row?.type === 'child' ? 'child' : 'adult',
         age: row?.age == null ? null : Number(row.age),
         position: Number(row?.position || 0),
         cells: Array.isArray(row?.cells) ? row.cells.map(cell => ({
            date: normalizeIsoDate(cell?.date),
            override_price: cell?.override_price == null || String(cell.override_price).trim() === ''
               ? null
               : Number(cell.override_price)
         })) : []
      }))
      : []
});

export { HOTEL_PRICING_MODES, toNumber, normalizeIsoDate, isOverbookingRoomType, normalizeHotelPricingMode, normalizeAgeBand, normalizeAgeBands, HOTEL_PRICING_DEFAULTS, normalizeHotelPricingPolicy, getKidAgesFromReservation, getOccupancyFromReservation, applyDiscount, resolveKidPricingByAge, calculateWeightedGuests, toPositiveNumber, sumDailyPrices, deriveStoredHotelAmount, getHotelPricingState };

export default {
   async buildHotelPersonPricing(reservation, timeTable = null) {
      if (!reservation || !reservation.checkin || !reservation.checkout) {
         return { personPricing: { version: 1, rows: [], day_totals: [], total: 0 }, pricePerDay: [] };
      }

      const start = new Date(reservation.checkin);
      const end = new Date(reservation.checkout);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
         return { personPricing: { version: 1, rows: [], day_totals: [], total: 0 }, pricePerDay: [] };
      }

      let roomType = reservation.roomType;
      if (!roomType) {
         return { personPricing: { version: 1, rows: [], day_totals: [], total: 0 }, pricePerDay: [] };
      }

      const policy = this.getHotelPricingPolicy();
      const table = Array.isArray(timeTable) ? timeTable : await this.loadTimeTableByType('hotel');
      const board = String(reservation.board || 'BB').toLowerCase();
      const adults = Math.max(0, Math.floor(Number(reservation.adults || 0)));
      const kids = Math.max(0, Math.floor(Number(reservation.kids || 0)));
      const kidAges = getKidAgesFromReservation(reservation);
      const sourceRows = Array.isArray(reservation.person_pricing?.rows) ? reservation.person_pricing.rows : [];
      const adultRows = sourceRows.filter(row => row?.type === 'adult');
      const childRows = sourceRows.filter(row => row?.type === 'child');
      const rows = [];
      const occupantIds = new Set();

      for (let index = 0; index < adults; index++) {
         const source = adultRows[index] || {};
         let occupantId = String(source.occupant_id || utils.uid());
         if (occupantIds.has(occupantId)) occupantId = String(utils.uid());
         occupantIds.add(occupantId);
         rows.push({
            occupant_id: occupantId,
            guest_customer_id: source.guest_customer_id ?? null,
            type: 'adult',
            age: null,
            position: index + 1,
            adult_position: index + 1,
            source_cells: Array.isArray(source.cells) ? source.cells : [],
            cells: []
         });
      }

      for (let index = 0; index < kids; index++) {
         const source = childRows[index] || {};
         let occupantId = String(source.occupant_id || utils.uid());
         if (occupantIds.has(occupantId)) occupantId = String(utils.uid());
         occupantIds.add(occupantId);
         rows.push({
            occupant_id: occupantId,
            guest_customer_id: source.guest_customer_id ?? null,
            type: 'child',
            age: kidAges[index] ?? null,
            position: adults + index + 1,
            source_cells: Array.isArray(source.cells) ? source.cells : [],
            cells: []
         });
      }

      const dayTotals = [];
      const pricePerDay = [];
      for (const cursor = new Date(start); cursor < end; cursor.setDate(cursor.getDate() + 1)) {
         const day = utils.dayOfYear(cursor);
         const dateIso = utils.dateH5S(cursor);
         const timeSlot = this.getTimeTableItem(table, day, dateIso);
         const dailyRates = await this.getRoomPricePerDay(roomType, table, day);
         const listPrice = Number(dailyRates?.[board] ?? dailyRates?.bb ?? 0);
         let dayTotal = 0;

         for (const row of rows) {
            let calculatedPrice = listPrice;
            let rule = { type: 'adult', label: 'Adulto tariffa intera' };

            if (row.type === 'child') {
               const kidPricing = resolveKidPricingByAge(row.age, policy.ageBands, listPrice);
               const band = Number.isFinite(row.age)
                  ? policy.ageBands.find(item => row.age >= item.minAge && row.age <= item.maxAge)
                  : null;
               if (adults >= 2) {
                  calculatedPrice = Number(kidPricing.amount || 0);
                  rule = {
                     type: 'child_age_band',
                     label: band.label
                  };
               } else {
                  rule = {
                     type: 'child_full_rate',
                     label: 'Bambino tariffa intera: meno di 2 adulti'
                  };
               }
            } else if (row.adult_position >= 3) {
               calculatedPrice = applyDiscount(listPrice, policy.thirdBedDiscountPct);
               rule = { type: 'third_adult', label: 'Adulto dal terzo in poi' };
            }

            const sourceCell = row.source_cells.find(cell => normalizeIsoDate(cell?.date) === dateIso);
            let overridePrice = null;
            if (sourceCell && sourceCell.override_price != null && String(sourceCell.override_price).trim() !== '') {
               overridePrice = Number(sourceCell.override_price);
               if (!Number.isFinite(overridePrice) || overridePrice < 0) {
                  throw new Error(`Prezzo override non valido per ${dateIso}`);
               }
               overridePrice = Number(overridePrice.toFixed(2));
            }

            calculatedPrice = Number(Number(calculatedPrice || 0).toFixed(2));
            const finalPrice = overridePrice == null ? calculatedPrice : overridePrice;
            row.cells.push({
               date: dateIso,
               list_price: Number(Number(listPrice || 0).toFixed(2)),
               rule,
               calculated_price: calculatedPrice,
               override_price: overridePrice,
               final_price: finalPrice
            });
            dayTotal += finalPrice;
         }

         dayTotal = Number(dayTotal.toFixed(2));
         dayTotals.push({ date: dateIso, amount: dayTotal });
         pricePerDay.push({
            day,
            date: dateIso,
            pricelist: Number(timeSlot?.pricelist ?? 0),
            board: board.toUpperCase(),
            pricing_mode: HOTEL_PRICING_MODES.PERSON,
            unit_price: Number(Number(listPrice || 0).toFixed(2)),
            units: listPrice > 0 ? Number((dayTotal / listPrice).toFixed(4)) : 0,
            weighted: null,
            day_total: dayTotal,
            price: dayTotal
         });
      }

      for (const row of rows) {
         delete row.source_cells;
         delete row.adult_position;
      }

      const total = Number(dayTotals.reduce((sum, item) => sum + item.amount, 0).toFixed(2));
      return {
         personPricing: { version: 1, rows, day_totals: dayTotals, total },
         pricePerDay
      };
   },

   calculateHotelNightlyBreakdown(reservation, dailyRates, policy = null) {
      const pricingPolicy = policy || this.getHotelPricingPolicy();
      const mode = normalizeHotelPricingMode(pricingPolicy.mode);
      const board = String(reservation?.board || 'BB').toLowerCase();
      const basePerUnit = Number(dailyRates?.[board] ?? dailyRates?.bb ?? 0);

      if (!Number.isFinite(basePerUnit) || basePerUnit <= 0) {
         return {
            mode,
            board,
            basePerUnit: 0,
            units: 0,
            dayTotal: 0,
            weighted: null
         };
      }

      if (mode === HOTEL_PRICING_MODES.ROOM) {
         return {
            mode,
            board,
            basePerUnit,
            units: 1,
            dayTotal: Number(basePerUnit.toFixed(2)),
            weighted: null
         };
      }

      const occupancy = getOccupancyFromReservation(reservation);
      const weighted = calculateWeightedGuests(occupancy, pricingPolicy, basePerUnit);
      const units = Number(weighted.effectiveUnits || 0);
      const dayTotal = Number(weighted.totalAmount || 0);

      return {
         mode,
         board,
         basePerUnit,
         units,
         dayTotal,
         weighted
      };
   },

   async calculateHotelReservationAmountFromRate(reservation, timeTable = null) {
      if (!reservation || !reservation.checkin || !reservation.checkout) return 0;

      let roomType = reservation.roomType;
      if (!roomType) return 0;

      const directAmount = deriveStoredHotelAmount(reservation);
      if (isOverbookingRoomType(roomType) && directAmount > 0) {
         return directAmount;
      }

      const start = new Date(reservation.checkin);
      const end = new Date(reservation.checkout);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return 0;

      const policy = this.getHotelPricingPolicy();
      const table = Array.isArray(timeTable) ? timeTable : await this.loadTimeTableByType('hotel');
      let total = 0;

      for (const cursor = new Date(start); cursor < end; cursor.setDate(cursor.getDate() + 1)) {
         const day = utils.dayOfYear(cursor);
         const dailyRates = await this.getRoomPricePerDay(roomType, table, day);
         const nightly = this.calculateHotelNightlyBreakdown(reservation, dailyRates, policy);
         total += Number(nightly.dayTotal || 0);
      }

      return Number(total.toFixed(2));
   },

   async calculateHotelReservationPricing(reservation) {
      const pricePerDay = await this.buildHotelPricePerDaySnapshot(reservation);
      const totalPrice = Number(pricePerDay.reduce((sum, day) => sum + Number(day?.day_total || 0), 0).toFixed(2));
      return {
         pricing_mode: reservation.pricing_mode === 'fixed' ? 'fixed' : this.getHotelPricingPolicy().mode,
         price_per_day: pricePerDay,
         person_pricing: reservation.person_pricing || null,
         total_price: totalPrice
      };
   },

   async buildHotelPricePerDaySnapshot(reservation, timeTable = null) {
      if (!reservation || !reservation.checkin || !reservation.checkout) return [];

      const start = new Date(reservation.checkin);
      const end = new Date(reservation.checkout);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return [];

      let roomType = reservation.roomType;
      if (!roomType) return [];

      const board = String(reservation.board || 'BB').toLowerCase();
      const policy = this.getHotelPricingPolicy();
      const table = Array.isArray(timeTable) ? timeTable : await this.loadTimeTableByType('hotel');
      const pricePerDay = [];
      const directAmount = deriveStoredHotelAmount(reservation);
      const nights = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));
      const fixedPrice = reservation.fixedPrice ?? reservation.fixed_price;
      const fixedAmount = Number(fixedPrice);
      const hasFixedPrice = reservation.pricing_mode === 'fixed' && fixedPrice != null && Number.isFinite(fixedAmount) && fixedAmount >= 0;

      if (hasFixedPrice || (isOverbookingRoomType(roomType) && directAmount > 0)) {
         delete reservation.person_pricing;
         const normalizedTotal = Number((hasFixedPrice ? fixedAmount : directAmount).toFixed(2));
         const baseNightly = Number((normalizedTotal / nights).toFixed(2));
         let allocated = 0;

         for (let index = 0, cursor = new Date(start); cursor < end; index++, cursor.setDate(cursor.getDate() + 1)) {
            const dateIso = utils.dateH5S(cursor);
            const day = utils.dayOfYear(cursor);
            const dayTotal = index === nights - 1
               ? Number((normalizedTotal - allocated).toFixed(2))
               : baseNightly;
            allocated += dayTotal;

            pricePerDay.push({
               day,
               date: dateIso,
               pricelist: 0,
               board: board.toUpperCase(),
               pricing_mode: 'direct',
               unit_price: Number(dayTotal || 0),
               units: 1,
               weighted: null,
               day_total: Number(dayTotal || 0),
               price: Number(dayTotal || 0),
               source: 'direct'
            });
         }

         return pricePerDay;
      }

      if (policy.mode === HOTEL_PRICING_MODES.PERSON) {
         const pricing = await this.buildHotelPersonPricing(reservation, table);
         reservation.person_pricing = pricing.personPricing;
         return pricing.pricePerDay;
      }

      delete reservation.person_pricing;

      for (const cursor = new Date(start); cursor < end; cursor.setDate(cursor.getDate() + 1)) {
         const day = utils.dayOfYear(cursor);
         const dateIso = utils.dateH5S(cursor);
         const timeSlot = this.getTimeTableItem(table, day, dateIso);
         const dailyRates = await this.getRoomPricePerDay(roomType, table, day);
         const nightly = this.calculateHotelNightlyBreakdown(reservation, dailyRates, policy);

         pricePerDay.push({
            day,
            date: dateIso,
            pricelist: Number(timeSlot?.pricelist ?? 0),
            board: board.toUpperCase(),
            pricing_mode: nightly.mode,
            unit_price: Number(nightly.basePerUnit || 0),
            units: Number(nightly.units || 0),
            weighted: nightly.weighted,
            day_total: Number(nightly.dayTotal || 0),
            price: Number(nightly.dayTotal || 0)
         });
      }

      return pricePerDay;
   },

   async getRoomPricePerDay(roomType, timeTable, day) {
      if (isOverbookingRoomType(roomType)) {
         return { bb: 0, hb: 0, fb: 0 };
      }

      var price = timeTable.find(item => {
         return item.day == day;
      });
      if(price == null || price.pricelist == 0) {
         var rateObj = {};
         rateObj.bb = 0;
         rateObj.hb = 0;
         rateObj.fb = 0;
         return rateObj;
      };

      var listino = (await this.getRates()).find(item => item.id === price.pricelist);
      if(listino == null || !Array.isArray(listino.prices)) {
         var emptyRateObj = {};
         emptyRateObj.bb = 0;
         emptyRateObj.hb = 0;
         emptyRateObj.fb = 0;
         return emptyRateObj;
      }
      var prezzo = listino.prices.find(item => {
         return item.roomType == roomType;
      });
      if(prezzo == undefined) {
         var rateObj = {};
         rateObj.bb = 0;
         rateObj.hb = 0;
         rateObj.fb = 0;
         return rateObj;
      }
      var rateObj = {};
      rateObj.bb = prezzo.tariffa;
      rateObj.hb = prezzo.tariffa + listino.surcharges.hb || 0;
      rateObj.fb = prezzo.tariffa + listino.surcharges.fb || 0;
      return rateObj;
   },

   getTimeTableItem(timeTable, day, dateIso = '') {
      if (!Array.isArray(timeTable)) return null;
      if (dateIso) {
         const byDate = timeTable.find(item => normalizeIsoDate(item?.date) === dateIso);
         if (byDate) return byDate;
      }
      return timeTable.find(item => item.day == day) || null;
   }
};
