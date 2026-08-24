import { create } from 'zustand';
import { User } from 'firebase/auth';
import { UserProfile, ThemeMode, GradeCode, GRADES } from '../../types';
import { auth, db } from '../../lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { getPaths, handleFirestoreError, OperationType } from '../../lib/firestoreService';

const DEFAULT_PROFILE: UserProfile = {
  name: '',
  title: '',
  grade: 'A',
  initials: '',
  companyName: '',
  companyAddress: '',
  companyPhone: '',
  companyEmail: '',
  fboId: '',
  airtelMoney: '',
  mtnMoney: '',
  bankRIB: '',
  tvaApplicable: false,
  monthlyGoalCC: 0,
  monthlyGoalAmount: 0,
};

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isAuthReady: boolean;
  profile: UserProfile;
  themeMode: ThemeMode;
  // Actions
  setUser: (user: User | null) => void;
  setProfile: (profile: UserProfile) => void;
  updateProfile: (profile: Partial<UserProfile>) => Promise<void>;
  setThemeMode: (mode: ThemeMode) => void;
  login: () => void;
  logout: () => Promise<void>;
  initializeAuth: () => () => void;
  getCurrentGrade: () => { code: GradeCode; label: string; tauxRemise: number };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isAuthReady: false,
  profile: DEFAULT_PROFILE,
  themeMode: 'system',

  setUser: (user) => set({ user, isAuthenticated: !!user, isAuthReady: true }),

  setProfile: (profile) => set({ profile }),

  updateProfile: async (updates) => {
    const { user, profile, themeMode } = get();
    if (!user) return;

    const path = getPaths(user.uid).user;
    const newProfile = {
      ...profile,
      ...updates,
      name: updates.name || profile.name || '',
      grade: (updates.grade as GradeCode) || profile.grade || 'A',
      createdAt: profile.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      themeMode,
    };

    try {
      await setDoc(doc(db, path), newProfile, { merge: true });
      set({ profile: newProfile });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  },

  setThemeMode: (mode) => {
    try {
      localStorage.setItem('fcf-theme', mode);
    } catch (e) {
      console.error(e);
    }
    set({ themeMode: mode });
    // Sync to Firestore if user exists
    const { user } = get();
    if (user) {
      const path = getPaths(user.uid).user;
      setDoc(doc(db, path), { themeMode: mode }, { merge: true })
        .catch(err => handleFirestoreError(err, OperationType.UPDATE, path));
    }
  },

  login: () => {
    // onAuthStateChanged handles the actual auth state
  },

  logout: async () => {
    try {
      await signOut(auth);
      set({ isAuthenticated: false, user: null, profile: DEFAULT_PROFILE });
    } catch (e) {
      console.error(e);
    }
  },

  initializeAuth: () => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        set({ user: firebaseUser, isAuthenticated: true, isAuthReady: true });
        
        // Load profile from Firestore
        const path = getPaths(firebaseUser.uid).user;
        const unsubProfile = onSnapshot(doc(db, path), (docSnap) => {
          if (docSnap.exists()) {
            const profileData = docSnap.data() as UserProfile;
            set({ profile: profileData });
            if (profileData.themeMode) {
              set({ themeMode: profileData.themeMode as ThemeMode });
            }
          } else {
            const initials = firebaseUser.displayName
              ? firebaseUser.displayName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
              : 'FBO';
            const bootstrappedProfile: UserProfile = {
              name: firebaseUser.displayName || '',
              title: 'Distributeur Indépendant',
              grade: 'A',
              initials,
              photoUrl: firebaseUser.photoURL || '',
              companyEmail: firebaseUser.email || '',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              themeMode: get().themeMode,
            };
            setDoc(doc(db, path), bootstrappedProfile, { merge: true })
              .catch(err => handleFirestoreError(err, OperationType.CREATE, path));
            set({ profile: bootstrappedProfile });
          }
        }, (err) => handleFirestoreError(err, OperationType.GET, path));

        return () => unsubProfile();
      } else {
        set({ user: null, isAuthenticated: false, isAuthReady: true, profile: DEFAULT_PROFILE });
      }
    });

    return unsubscribe;
  },

  getCurrentGrade: () => {
    const { profile } = get();
    return GRADES.find(g => g.code === profile.grade) || GRADES[1];
  },
}));