import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const isFirebaseConfigured = () => {
  return Boolean(
    import.meta.env.VITE_FIREBASE_API_KEY &&
      import.meta.env.VITE_FIREBASE_AUTH_DOMAIN &&
      import.meta.env.VITE_FIREBASE_PROJECT_ID &&
      import.meta.env.VITE_FIREBASE_APP_ID
  )
}

let firebaseApp = null
let firestoreDb = null

export const isFirebaseRemoteMode = () => {
  const configuredSource = String(import.meta.env.VITE_DATA_SOURCE || '').trim().toLowerCase()
  if (configuredSource === 'firebase') return true
  if (configuredSource === 'api') return false

  if (import.meta.env.DEV) return false
  if (typeof window === 'undefined') return false

  const host = String(window.location.hostname || '').toLowerCase()
  const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host === '::1'
  return !isLocalHost
}

export const getFirebaseDb = () => {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase non configurato: valorizza le variabili VITE_FIREBASE_*')
  }

  if (!firebaseApp) {
    firebaseApp = initializeApp({
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
    })
  }

  if (!firestoreDb) {
    firestoreDb = getFirestore(firebaseApp)
  }

  return firestoreDb
}
