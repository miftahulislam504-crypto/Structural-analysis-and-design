import { create } from 'zustand'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  updateProfile,
} from 'firebase/auth'
import { auth } from '../lib/firebase'

interface AuthStore {
  user: User | null
  isLoading: boolean
  error: string | null
  initialized: boolean

  init: () => () => void
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  logout: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isLoading: false,
  error: null,
  initialized: false,

  init() {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      set({ user, initialized: true, isLoading: false })
    })
    return unsubscribe
  },

  async login(email, password) {
    set({ isLoading: true, error: null })
    try {
      await signInWithEmailAndPassword(auth, email, password)
      set({ isLoading: false })
    } catch (e: any) {
      set({ isLoading: false, error: parseFirebaseError(e.code) })
    }
  },

  async register(email, password, name) {
    set({ isLoading: true, error: null })
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      await updateProfile(cred.user, { displayName: name })
      set({ isLoading: false })
    } catch (e: any) {
      set({ isLoading: false, error: parseFirebaseError(e.code) })
    }
  },

  async logout() {
    await signOut(auth)
    set({ user: null })
  },

  clearError: () => set({ error: null }),
}))

function parseFirebaseError(code: string): string {
  const errors: Record<string, string> = {
    'auth/user-not-found': 'ইমেইল বা পাসওয়ার্ড সঠিক নয়',
    'auth/wrong-password': 'ইমেইল বা পাসওয়ার্ড সঠিক নয়',
    'auth/email-already-in-use': 'এই ইমেইল দিয়ে আগেই অ্যাকাউন্ট আছে',
    'auth/invalid-email': 'সঠিক ইমেইল দিন',
    'auth/weak-password': 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে',
    'auth/network-request-failed': 'ইন্টারনেট সংযোগ পরীক্ষা করুন',
    'auth/too-many-requests': 'অনেকবার চেষ্টা হয়েছে, একটু পরে আবার চেষ্টা করুন',
    'auth/invalid-credential': 'ইমেইল বা পাসওয়ার্ড সঠিক নয়',
  }
  return errors[code] ?? 'একটি সমস্যা হয়েছে, আবার চেষ্টা করুন'
}
