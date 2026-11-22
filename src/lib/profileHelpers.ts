import {
  DEFAULT_GRADE_CODE,
  GradeCode,
  ThemeMode,
  UserProfile,
  getGradeByCode,
} from '../types';

export const DEFAULT_PROFILE: UserProfile = {
  name: '',
  title: getGradeByCode(DEFAULT_GRADE_CODE).label,
  grade: DEFAULT_GRADE_CODE,
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

export function normalizeGradeCode(code?: string | null): GradeCode {
  return getGradeByCode(code).code;
}

export function buildBootstrappedProfile(
  user: {
    displayName?: string | null;
    email?: string | null;
    photoURL?: string | null;
  },
  themeMode: ThemeMode,
  nowIso: string = new Date().toISOString()
): UserProfile {
  const displayName = (user.displayName || '').trim();
  const initials = displayName
    ? displayName
        .split(/\s+/)
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : 'FBO';

  const defaultGrade = getGradeByCode(DEFAULT_GRADE_CODE);

  return {
    ...DEFAULT_PROFILE,
    name: displayName,
    title: defaultGrade.label,
    grade: defaultGrade.code,
    initials,
    photoUrl: user.photoURL || '',
    companyEmail: user.email || '',
    monthlyGoalCC: 0,
    monthlyGoalAmount: 0,
    createdAt: nowIso,
    updatedAt: nowIso,
    themeMode,
  };
}

export function buildMergedUserProfile(
  current: UserProfile,
  updates: Partial<UserProfile>,
  themeMode: ThemeMode,
  nowIso: string = new Date().toISOString()
): UserProfile {
  const resolvedGrade = normalizeGradeCode(
    updates.grade !== undefined ? updates.grade : current.grade
  );
  const gradeInfo = getGradeByCode(resolvedGrade);

  const resolvedName =
    updates.name !== undefined ? updates.name : current.name || '';

  const resolvedMonthlyGoalCC =
    updates.monthlyGoalCC !== undefined
      ? updates.monthlyGoalCC
      : current.monthlyGoalCC ?? 0;

  const resolvedMonthlyGoalAmount =
    updates.monthlyGoalAmount !== undefined
      ? updates.monthlyGoalAmount
      : current.monthlyGoalAmount ?? 0;

  return {
    ...current,
    ...updates,
    name: resolvedName,
    grade: resolvedGrade,
    // Source de vérité unique : le libellé suit toujours le grade officiel sauf titre métier explicite si non lié au changement de grade
    title:
      updates.grade !== undefined || !current.title || current.title === 'Distributeur Indépendant'
        ? gradeInfo.label
        : updates.title ?? gradeInfo.label,
    monthlyGoalCC: resolvedMonthlyGoalCC,
    monthlyGoalAmount: resolvedMonthlyGoalAmount,
    createdAt: current.createdAt || nowIso,
    updatedAt: nowIso,
    themeMode: (updates.themeMode as ThemeMode) || themeMode,
  };
}

export function shouldIgnorePendingSnapshot(
  hasPendingWrites: boolean,
  isSavingProfile: boolean
): boolean {
  // Garde d'atomicité (Règle 3) : tant qu'une sauvegarde de profil/grade est en vol,
  // ne jamais appliquer un snapshot optimiste local Firestore (`hasPendingWrites`).
  // On attend la confirmation serveur (`setDoc` résolu ou snapshot confirmé).
  return isSavingProfile && hasPendingWrites;
}
