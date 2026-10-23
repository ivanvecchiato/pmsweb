import { initializeApp } from 'firebase/app'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { connectAuthEmulator, getAuth } from 'firebase/auth'

let firebaseApp = null
let firestoreDb = null
let firebaseAuth = null

export const isFirebaseRemoteMode = () => import.meta.env.VITE_DATA_SOURCE === 'firebase'

export const getFirebaseDb = () => {
  if (!import.meta.env.VITE_FIREBASE_API_KEY || !import.meta.env.VITE_FIREBASE_AUTH_DOMAIN
    || !import.meta.env.VITE_FIREBASE_PROJECT_ID || !import.meta.env.VITE_FIREBASE_APP_ID) {
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
    if (import.meta.env.DEV && import.meta.env.VITE_FIRESTORE_EMULATOR_HOST) {
      const [host, port] = import.meta.env.VITE_FIRESTORE_EMULATOR_HOST.split(':')
      connectFirestoreEmulator(firestoreDb, host, Number(port))
    }
  }

  return firestoreDb
}

export const getFirebaseAuth = () => {
  getFirebaseDb()
  if (!firebaseAuth) {
    firebaseAuth = getAuth(firebaseApp)
    firebaseAuth.languageCode = 'it'
    if (import.meta.env.DEV && import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL) {
      connectAuthEmulator(firebaseAuth, import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL)
    }
  }
  return firebaseAuth
}
