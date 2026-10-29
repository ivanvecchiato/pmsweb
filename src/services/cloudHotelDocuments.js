import { collection, doc, getDocFromServer, getDocsFromServer, query, where } from 'firebase/firestore'
import { prepareHotelReservation } from './hotelReservation.js'

export async function calculateHotelQuote(db, data, canOverridePricingPolicy) {
  const [config, rooms, rates, timetable] = await Promise.all([
    getDocFromServer(doc(db, 'pms_configs', 'current')),
    getDocsFromServer(query(collection(db, 'rooms'), where('id', '==', String(data.roomId)))),
    getDocsFromServer(collection(db, 'pms_hotel_rates')),
    getDocsFromServer(collection(db, 'pms_hotel_timetable'))
  ])
  const reservation = await prepareHotelReservation({
    canOverridePricingPolicy, config: config.data(), rooms: rooms.docs.map(entry => entry.data()),
    rates: rates.docs.map(entry => entry.data()), timeTable: timetable.docs.map(entry => entry.data()), fiscalJobs: new Map()
  }, { documentId: 'quote', action: 'quote', payload: JSON.parse(JSON.stringify({ ...data, deposits: undefined })) })
  return { minimumStay: reservation.minimumStay, pricing_mode: reservation.pricing_mode, price_per_day: reservation.price_per_day, person_pricing: reservation.person_pricing || null, total_price: reservation.price_total }
}

export async function createHotelDepositProforma(db, data) {
  const amount = Number(data.deposit?.amount)
  if (!Number.isFinite(amount) || amount <= 0) throw Error('Importo deposito non valido')
  const snapshot = data.reservationId ? await getDocFromServer(doc(db, 'pms_hotel_reservations', data.reservationId)) : null
  if (snapshot && !snapshot.exists()) throw Error('Prenotazione non trovata')
  const reservation = snapshot?.data()
  const customerName = data.customerName || `${reservation?.accountholder?.firstname || ''} ${reservation?.accountholder?.lastname || ''}`.trim() || 'Ospite'
  const room = data.room || reservation?.room || '-'
  const checkin = data.checkin || reservation?.checkin || '-'
  const checkout = data.checkout || reservation?.checkout || '-'
  const [{ jsPDF }, { default: logo }] = await Promise.all([import('jspdf'), import('../generated/hotel/logo-source.png?url')])
  const image = await fetch(logo)
  if (!image.ok) throw Error('Logo proforma non disponibile')
  const document = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const png = new Uint8Array(await image.arrayBuffer())
  document.setProperties({ title: `Acconto prenotazione ${customerName}` })
  for (const left of [32, 437]) {
    const dimensions = document.getImageProperties(png)
    document.addImage(png, 'PNG', left, 30, 150, 150 * dimensions.height / dimensions.width)
    document.setTextColor('#1e293b').setFont('helvetica', 'bold').setFontSize(12)
    document.text(document.splitTextToSize(`Acconto prenotazione Sig./ra ${customerName}`, 373), left, 114)
    document.setTextColor('#475569').setFont('helvetica', 'normal').setFontSize(10)
    document.text(`camera ${room} da ${checkin} a ${checkout}`, left, 136)
    document.setTextColor('#1e293b').setFont('helvetica', 'bold').setFontSize(11)
    document.text('Acconto', left, 178)
    document.text(`${amount.toFixed(2)} EUR`, left + 373, 178, { align: 'right' })
    document.setDrawColor('#cbd5e1').line(left, 188, left + 373, 188)
    document.setTextColor('#475569').setFont('helvetica', 'normal').setFontSize(10)
    document.text(`Pagamento ${data.deposit.payment_mode || '-'}`, left, 216)
  }
  document.setDrawColor('#cbd5e1').setLineDashPattern([4, 4], 0).line(420.5, 24, 420.5, 571)
  return document.output('blob')
}
