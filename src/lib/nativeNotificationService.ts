/**
 * Service de notifications natives (OS) pour la PWA Forever CashFlow.
 * - Demande de permission élégante, une seule fois
 * - Envoi via le Service Worker (Android/Chrome exige SW.showNotification)
 * - Anti-spam : 1 notification max par prospect/jour
 */

const PERM_KEY = 'fcf-native-notif-perm';       // 'granted' | 'denied' | 'dismissed'
const DEDUP_KEY = 'fcf-native-notif-dedup';     // { [prospectId]: 'YYYY-MM-DD' }

export type NativePermState = 'granted' | 'default' | 'denied' | 'unsupported';

export function getNativePermission(): NativePermState {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission as NativePermState;
}

/** L'utilisateur a-t-il déjà répondu à notre demande in-app ? */
export function wasPromptDismissed(): boolean {
  try {
    return localStorage.getItem(PERM_KEY) === 'denied' || localStorage.getItem(PERM_KEY) === 'dismissed';
  } catch {
    return false;
  }
}

export function markPromptAnswered(answer: 'granted' | 'denied' | 'dismissed') {
  try {
    localStorage.setItem(PERM_KEY, answer);
  } catch { /* noop */ }
}

/** Peut-on notifier nativement maintenant ? */
export function canNotifyNatively(): boolean {
  return getNativePermission() === 'granted';
}

/**
 * Affiche une notification OS. Retourne true si envoyée.
 * Passe par le Service Worker quand disponible (requis sur Android).
 */
export async function showNativeNotification(title: string, options: NotificationOptions & { tag?: string } = {}): Promise<boolean> {
  if (!canNotifyNatively()) return false;
  const swReg = await navigator.serviceWorker?.getRegistration?.().catch(() => undefined);

  try {
    if (swReg) {
      await swReg.showNotification(title, {
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        ...options,
      });
      return true;
    }
    // Fallback page-level (desktop)
    new Notification(title, { icon: '/icon-192.png', ...options });
    return true;
  } catch (err) {
    console.warn('[nativeNotif] envoi impossible:', err);
    return false;
  }
}

const todayKey = (): string => new Date().toISOString().split('T')[0];

function readDedup(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(DEDUP_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeDedup(map: Record<string, string>) {
  try {
    localStorage.setItem(DEDUP_KEY, JSON.stringify(map));
  } catch { /* noop */ }
}

/** Une notif native a-t-elle déjà été envoyée aujourd'hui pour cette clé ? */
export function alreadyNotifiedToday(key: string): boolean {
  return readDedup()[key] === todayKey();
}

export function markNotifiedToday(key: string) {
  const map = readDedup();
  map[key] = todayKey();
  // Purge des entrées > 7 jours pour ne pas gonfler le localStorage
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  for (const k of Object.keys(map)) {
    if (map[k] < cutoffStr) delete map[k];
  }
  writeDedup(map);
}
