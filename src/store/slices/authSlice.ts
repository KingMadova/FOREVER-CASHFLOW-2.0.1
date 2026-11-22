import { create } from 'zustand';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import {
  UserProfile,
  ThemeMode,
  Grade,
  getGradeByCode,
} from '../../types';
import { auth, db } from '../../lib/firebase';
import { getPaths, handleFirestoreError, OperationType } from '../../lib/firestoreService';
import {
  DEFAULT_PROFILE,
  buildBootstrappedProfile,
  buildMergedUserProfile,
  shouldIgnorePendingSnapshot,
} from '../../lib/profileHelpers';
import { useThemeStore } from './themeSlice';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isAuthReady: boolean;
  isProfileLoaded: boolean;
  isSavingProfile: boolean;
  profile: UserProfile;
  themeMode: ThemeMode;
  // Actions
  setUser: (user: User | null) => void;
  setProfile: (profile: UserProfile) => void;
  updateProfile: (profile: Partial<UserProfile>) => Promise<UserProfile>;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  login: () => void;
  logout: () => Promise<void>;
  initializeAuth: () => () => void;
  getCurrentGrade: () => Grade;
}

let activeProfileUnsub: (() => void) | null = null;

function cleanupActiveProfileListener() {
  if (activeProfileUnsub) {
    activeProfileUnsub();
    activeProfileUnsub = null;
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isAuthReady: false,
  isProfileLoaded: false,
  isSavingProfile: false,
  profile: DEFAULT_PROFILE,
  themeMode: 'system',

  setUser: (user) => set({ user, isAuthenticated: !!user, isAuthReady: true }),

  setProfile: (profile) =>
    set({
      profile: {
        ...DEFAULT_PROFILE,
        ...profile,
        grade: getGradeByCode(profile.grade).code,
        title: getGradeByCode(profile.grade).label,
      },
      isProfileLoaded: true,
    }),

  updateProfile: async (updates) => {
    const { user, profile, themeMode } = get();
    if (!user) {
      throw new Error('Utilisateur non authentifié. Veuillez vous reconnecter.');
    }

    const { useSyncStore } = await import('./syncSlice');
    if (useSyncStore.getState().isOfflineMode) {
      throw new Error(
        'Connexion Internet requise pour enregistrer les modifications du profil et du grade dans Firestore.'
      );
    }

    const path = getPaths(user.uid).user;
    const newProfile = buildMergedUserProfile(profile, updates, themeMode);

    // Règle métier #3 (Cohérence & Atomicité) :
    // On n'applique PAS le nouveau grade dans le store avant la confirmation Firestore.
    set({ isSavingProfile: true });
    try {
      await setDoc(doc(db, path), newProfile, { merge: true });
      set({
        profile: newProfile,
        isProfileLoaded: true,
        isSavingProfile: false,
      });
      return newProfile;
    } catch (err) {
      set({ isSavingProfile: false });
      handleFirestoreError(err, OperationType.UPDATE, path);
      throw err;
    }
  },

  setThemeMode: async (mode) => {
    const prevMode = get().themeMode;
    const { user, profile } = get();

    if (user) {
      const { useSyncStore } = await import('./syncSlice');
      if (useSyncStore.getState().isOfflineMode) {
        throw new Error(
          'Connexion Internet requise pour synchroniser le thème sur votre profil Firestore.'
        );
      }
    }

    try {
      localStorage.setItem('fcf-theme', mode);
    } catch (e) {
      console.error(e);
    }
    useThemeStore.getState().setThemeMode(mode);
    set({ themeMode: mode });

    if (user) {
      const path = getPaths(user.uid).user;
      const merged = buildMergedUserProfile(profile, { themeMode: mode }, mode);
      try {
        await setDoc(doc(db, path), merged, { merge: true });
        set({ profile: merged });
      } catch (err) {
        try {
          localStorage.setItem('fcf-theme', prevMode);
        } catch {
          // ignore
        }
        useThemeStore.getState().setThemeMode(prevMode);
        set({ themeMode: prevMode });
        handleFirestoreError(err, OperationType.UPDATE, path);
        throw err;
      }
    }
  },

  login: () => {
    // onAuthStateChanged handles the actual auth state
  },

  logout: async () => {
    cleanupActiveProfileListener();
    try {
      await signOut(auth);
    } finally {
      set({
        isAuthenticated: false,
        user: null,
        profile: DEFAULT_PROFILE,
        isProfileLoaded: false,
        isSavingProfile: false,
      });
    }
  },

  initializeAuth: () => {
    let activeUid: string | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      cleanupActiveProfileListener();

      if (firebaseUser) {
        activeUid = firebaseUser.uid;
        set({
          user: firebaseUser,
          isAuthenticated: true,
          isAuthReady: true,
          isProfileLoaded: false,
        });

        const path = getPaths(firebaseUser.uid).user;
        activeProfileUnsub = onSnapshot(
          doc(db, path),
          (docSnap) => {
            if (activeUid !== firebaseUser.uid) return;
            if (shouldIgnorePendingSnapshot(docSnap.metadata.hasPendingWrites, get().isSavingProfile)) {
              return;
            }

            if (docSnap.exists()) {
              const raw = docSnap.data() as UserProfile;
              const gradeInfo = getGradeByCode(raw.grade);
              const normalizedProfile: UserProfile = {
                ...DEFAULT_PROFILE,
                ...raw,
                grade: gradeInfo.code,
                title: gradeInfo.label,
              };
              set({ profile: normalizedProfile, isProfileLoaded: true });
              if (raw.themeMode) {
                const mode = raw.themeMode as ThemeMode;
                set({ themeMode: mode });
                useThemeStore.getState().setThemeMode(mode);
              }
            } else {
              const bootstrappedProfile = buildBootstrappedProfile(
                firebaseUser,
                get().themeMode
              );
              set({ profile: bootstrappedProfile, isProfileLoaded: true });
              setDoc(doc(db, path), bootstrappedProfile, { merge: true }).catch((err) => {
                console.error('[initializeAuth] Bootstrap profile write failed:', err);
              });
            }
          },
          (err) => handleFirestoreError(err, OperationType.GET, path)
        );
      } else {
        activeUid = null;
        set({
          user: null,
          isAuthenticated: false,
          isAuthReady: true,
          isProfileLoaded: false,
          isSavingProfile: false,
          profile: DEFAULT_PROFILE,
        });
      }
    });

    return () => {
      activeUid = null;
      cleanupActiveProfileListener();
      unsubscribeAuth();
    };
  },

  getCurrentGrade: () => {
    const { profile } = get();
    return getGradeByCode(profile.grade);
  },
}));