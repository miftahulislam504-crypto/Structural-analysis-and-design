// ============================================================
// CivilOS Structural — Auth Store
// Zustand store for Firebase Authentication
// ============================================================

import { create } from 'zustand'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  User,
} from 'firebase/auth'
import { auth } from '../lib/firebase'

interface AuthState {
  user:        User | null
  initialized: boolean
  isLoading:   boolean
  error:       string | null

  init:     () => () => void    // returns unsubscribe fn
  login:    (email: string, password: string) => Promise<void>
  register: (email: string, password: string, displayName: string) => Promise<void>
  logout:   () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user:        null,
  initialized: false,
  isLoading:   false,
  error:       null,

  init: () => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      set({ user, initialized: true })
    })
    return unsubscribe
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null })
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (e: any) {
      const msg =
        e.code === 'auth/user-not-found'    ? 'ব্যবহারকারী পাওয়া যায়নি' :
        e.code === 'auth/wrong-password'    ? 'পাসওয়ার্ড ভুল' :
        e.code === 'auth/invalid-email'     ? 'ইমেইল ঠিকানা সঠিক নয়' :
        e.code === 'auth/too-many-requests' ? 'অনেকবার চেষ্টা হয়েছে, কিছুক্ষণ পর আবার চেষ্টা করুন' :
        'Login ব্যর্থ হয়েছে'
      set({ error: msg })
    } finally {
      set({ isLoading: false })
    }
  },

  register: async (email, password, displayName) => {
    set({ isLoading: true, error: null })
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password)
      await updateProfile(user, { displayName })
    } catch (e: any) {
      const msg =
        e.code === 'auth/email-already-in-use' ? 'এই ইমেইল ইতিমধ্যে ব্যবহৃত' :
        e.code === 'auth/weak-password'         ? 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে' :
        'নিবন্ধন ব্যর্থ হয়েছে'
      set({ error: msg })
    } finally {
      set({ isLoading: false })
    }
  },

  logout: async () => {
    await signOut(auth)
    set({ user: null })
  },

  clearError: () => set({ error: null }),
}))
