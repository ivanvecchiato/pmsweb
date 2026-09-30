import { collection, getDocs, query, where } from 'firebase/firestore'
import { getFirebaseDb } from './firebaseClient'

export const getBeachReservationsForDate = async (date) => {
  const snapshot = await getDocs(query(
    collection(getFirebaseDb(), 'pms_beach_reservations'),
    where('checkout', '>', date)
  ))
  return new Map(snapshot.docs.map(doc => doc.data())
    .filter(booking => booking.checkin <= date)
    .map(booking => [Number(booking.placeId), booking]))
}
