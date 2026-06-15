import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

// Vite exposes env vars via import.meta.env
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const env = (import.meta as any).env ?? {}

const firebaseConfig = {
  apiKey:            env.VITE_FIREBASE_API_KEY,
  authDomain:        env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             env.VITE_FIREBASE_APP_ID,
}

// Initialize Firebase (singleton)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()

export const auth    = getAuth(app)
export const db      = getFirestore(app)
export const storage = getStorage(app)
export default app
