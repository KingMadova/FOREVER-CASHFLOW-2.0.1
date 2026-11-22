export type FeedbackType = 'success' | 'error' | 'warning';

export interface ActionFeedbackItem {
  id: string;
  type: FeedbackType;
  title?: string;
  message: string;
  durationMs: number;
}

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'warning';
}

export type MutationPersistenceResult = 'saved' | 'queued' | void;

export interface ExecuteActionOptions<T extends MutationPersistenceResult = MutationPersistenceResult> {
  actionKey: string;
  operation: () => Promise<T>;
  successMessage: string;
  queuedMessage?: string;
  errorContext: string;
  currentPath?: string;
  redirectToDashboard?: boolean;
  navigate?: (to: string) => void;
  onSuccess?: (result: T) => void | Promise<void>;
  getPartialWarning?: (result: T) => string | undefined;
  onError?: (formattedMessage: string, rawError: unknown) => void;
}

export interface ExecuteActionOutcome<T = unknown> {
  ok: boolean;
  blocked?: boolean;
  queued?: boolean;
  result?: T;
  errorMessage?: string;
}

const inFlightActionKeys = new Set<string>();

export function acquireActionLock(actionKey: string): boolean {
  if (inFlightActionKeys.has(actionKey)) {
    return false;
  }
  inFlightActionKeys.add(actionKey);
  return true;
}

export function releaseActionLock(actionKey: string): void {
  inFlightActionKeys.delete(actionKey);
}

export function isActionLockHeld(actionKey: string): boolean {
  return inFlightActionKeys.has(actionKey);
}

export function clearAllActionLocksForTest(): void {
  inFlightActionKeys.clear();
}

export function shouldRedirectToDashboard(currentPath?: string, redirectToDashboard = true): boolean {
  if (!redirectToDashboard) return false;
  return currentPath !== '/';
}

export function extractRawErrorMessage(error: unknown): string {
  if (!error) return '';
  const raw = error instanceof Error ? error.message : String(error);
  const trimmed = raw.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed) as { error?: string; message?: string };
      if (parsed.error) return String(parsed.error);
      if (parsed.message) return String(parsed.message);
    } catch {
      // ignore invalid JSON
    }
  }
  return raw;
}

export function formatOperationError(error: unknown, errorContext: string): string {
  const raw = extractRawErrorMessage(error);
  const lower = raw.toLowerCase();

  let reason = 'Une erreur inattendue est survenue. Veuillez réessayer.';
  if (
    lower.includes('permission-denied') ||
    lower.includes('missing or insufficient permissions') ||
    lower.includes('permission')
  ) {
    reason = 'Accès refusé par le serveur (permissions insuffisantes). Vérifiez votre connexion compte et réessayez.';
  } else if (
    lower.includes('unavailable') ||
    lower.includes('offline') ||
    lower.includes('network') ||
    lower.includes('failed to fetch') ||
    lower.includes('client is offline') ||
    lower.includes('timeout')
  ) {
    reason = 'Impossible de contacter le serveur. Vérifiez votre connexion et réessayez.';
  } else if (
    lower.includes('unauthenticated') ||
    lower.includes('non connecté') ||
    lower.includes('utilisateur non authentifié') ||
    lower.includes('auth')
  ) {
    reason = 'Session utilisateur inactive ou expirée. Veuillez vous reconnecter.';
  } else if (lower.includes('invalid-argument') || lower.includes('unsupported field value')) {
    reason = 'Certaines données saisies sont invalides pour l’enregistrement.';
  } else if (lower.includes('not-found') || lower.includes('no document to update')) {
    reason = 'La donnée ciblée est introuvable sur le serveur.';
  } else if (raw && raw.length <= 160 && !raw.startsWith('{')) {
    reason = raw;
  }

  const normalizedContext = errorContext.trim().replace(/[.!?]+$/, '');
  return `${normalizedContext}. ${reason}`;
}

export interface ActionNotifier {
  notifySuccess: (message: string, title?: string) => void;
  notifyWarning: (message: string, title?: string) => void;
  notifyError: (message: string, title?: string) => void;
  setPending: (actionKey: string, pending: boolean) => void;
}

export async function runFeedbackAction<T extends MutationPersistenceResult = MutationPersistenceResult>(
  notifier: ActionNotifier,
  options: ExecuteActionOptions<T>
): Promise<ExecuteActionOutcome<T>> {
  const {
    actionKey,
    operation,
    successMessage,
    queuedMessage,
    errorContext,
    currentPath,
    redirectToDashboard = true,
    navigate,
    onSuccess,
    getPartialWarning,
    onError,
  } = options;

  if (!acquireActionLock(actionKey)) {
    return { ok: false, blocked: true };
  }

  notifier.setPending(actionKey, true);

  try {
    const result = await operation();
    const isQueued = result === 'queued';

    await onSuccess?.(result);

    const partialWarning = getPartialWarning?.(result);
    if (partialWarning) {
      notifier.notifyWarning(partialWarning);
    } else if (isQueued) {
      notifier.notifyWarning(
        queuedMessage || `${successMessage} (en attente de synchronisation hors-ligne)`
      );
    } else {
      notifier.notifySuccess(successMessage);
    }

    if (shouldRedirectToDashboard(currentPath, redirectToDashboard) && navigate) {
      navigate('/');
    }

    return { ok: true, queued: isQueued, result };
  } catch (err) {
    const formattedMessage = formatOperationError(err, errorContext);
    notifier.notifyError(formattedMessage);
    onError?.(formattedMessage, err);
    return { ok: false, errorMessage: formattedMessage };
  } finally {
    notifier.setPending(actionKey, false);
    releaseActionLock(actionKey);
  }
}
