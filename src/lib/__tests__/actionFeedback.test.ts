import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ActionNotifier,
  acquireActionLock,
  clearAllActionLocksForTest,
  formatOperationError,
  isActionLockHeld,
  releaseActionLock,
  runFeedbackAction,
  shouldRedirectToDashboard,
} from '../actionFeedback';
import { useFeedbackStore } from '../../store/slices/feedbackSlice';

function createMockNotifier() {
  const calls: Array<{ kind: 'success' | 'warning' | 'error'; message: string }> = [];
  const pendingHistory: Array<{ key: string; pending: boolean }> = [];

  const notifier: ActionNotifier = {
    notifySuccess: (message) => calls.push({ kind: 'success', message }),
    notifyWarning: (message) => calls.push({ kind: 'warning', message }),
    notifyError: (message) => calls.push({ kind: 'error', message }),
    setPending: (key, pending) => pendingHistory.push({ key, pending }),
  };

  return { notifier, calls, pendingHistory };
}

test('shouldRedirectToDashboard redirige vers / uniquement si la route courante est différente de /', () => {
  assert.equal(shouldRedirectToDashboard('/orders', true), true);
  assert.equal(shouldRedirectToDashboard('/profile', true), true);
  assert.equal(shouldRedirectToDashboard('/', true), false);
  assert.equal(shouldRedirectToDashboard('/orders', false), false);
});

test('runFeedbackAction affiche le succès et redirige vers / uniquement après résolution réussie', async () => {
  clearAllActionLocksForTest();
  const { notifier, calls, pendingHistory } = createMockNotifier();
  const navigatedTo: string[] = [];
  let onSuccessCalled = false;

  const outcome = await runFeedbackAction(notifier, {
    actionKey: 'test-order-create',
    operation: async () => 'saved' as const,
    successMessage: 'Commande créée avec succès !',
    errorContext: 'Échec de la création de commande',
    currentPath: '/orders',
    redirectToDashboard: true,
    navigate: (to) => navigatedTo.push(to),
    onSuccess: () => {
      onSuccessCalled = true;
    },
  });

  assert.equal(outcome.ok, true);
  assert.equal(outcome.queued, false);
  assert.equal(onSuccessCalled, true);
  assert.deepEqual(navigatedTo, ['/']);
  assert.deepEqual(calls, [{ kind: 'success', message: 'Commande créée avec succès !' }]);
  assert.deepEqual(pendingHistory, [
    { key: 'test-order-create', pending: true },
    { key: 'test-order-create', pending: false },
  ]);
  assert.equal(isActionLockHeld('test-order-create'), false);
});

test('runFeedbackAction en mode hors-ligne (queued) affiche un avertissement et redirige', async () => {
  clearAllActionLocksForTest();
  const { notifier, calls } = createMockNotifier();
  const navigatedTo: string[] = [];

  const outcome = await runFeedbackAction(notifier, {
    actionKey: 'test-client-offline',
    operation: async () => 'queued' as const,
    successMessage: 'Client enregistré avec succès !',
    queuedMessage: 'Client mis en file hors-ligne.',
    errorContext: "Échec de l'enregistrement du client",
    currentPath: '/clients',
    redirectToDashboard: true,
    navigate: (to) => navigatedTo.push(to),
  });

  assert.equal(outcome.ok, true);
  assert.equal(outcome.queued, true);
  assert.deepEqual(calls, [{ kind: 'warning', message: 'Client mis en file hors-ligne.' }]);
  assert.deepEqual(navigatedTo, ['/']);
});

test('runFeedbackAction en cas d’échec affiche l’erreur, ne montre jamais de succès et ne redirige jamais', async () => {
  clearAllActionLocksForTest();
  const { notifier, calls } = createMockNotifier();
  const navigatedTo: string[] = [];
  let onSuccessCalled = false;
  let capturedError = '';

  const firestoreJsonError = new Error(
    JSON.stringify({
      error: 'permission-denied: Missing or insufficient permissions',
      operationType: 'update',
      path: 'users/u1',
    })
  );

  const outcome = await runFeedbackAction(notifier, {
    actionKey: 'test-profile-fail',
    operation: async () => {
      throw firestoreJsonError;
    },
    successMessage: 'Profil enregistré avec succès !',
    errorContext: 'Échec de la mise à jour du profil',
    currentPath: '/profile',
    redirectToDashboard: true,
    navigate: (to) => navigatedTo.push(to),
    onSuccess: () => {
      onSuccessCalled = true;
    },
    onError: (msg) => {
      capturedError = msg;
    },
  });

  assert.equal(outcome.ok, false);
  assert.equal(onSuccessCalled, false);
  assert.deepEqual(navigatedTo, []);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].kind, 'error');
  assert.match(calls[0].message, /Échec de la mise à jour du profil/);
  assert.match(calls[0].message, /permissions insuffisantes/i);
  assert.equal(capturedError, calls[0].message);
  assert.equal(isActionLockHeld('test-profile-fail'), false);
});

test('Protection anti double-soumission bloque les appels simultanés et libère le verrou après erreur', async () => {
  clearAllActionLocksForTest();
  assert.equal(acquireActionLock('dup-key'), true);
  assert.equal(acquireActionLock('dup-key'), false);
  releaseActionLock('dup-key');
  assert.equal(acquireActionLock('dup-key'), true);
  releaseActionLock('dup-key');

  const { notifier } = createMockNotifier();
  let releaseOp!: () => void;
  const barrier = new Promise<void>((resolve) => {
    releaseOp = resolve;
  });

  const firstPromise = runFeedbackAction(notifier, {
    actionKey: 'concurrent-save',
    operation: async () => {
      await barrier;
      throw new Error('network error');
    },
    successMessage: 'OK',
    errorContext: 'Erreur',
  });

  const secondOutcome = await runFeedbackAction(notifier, {
    actionKey: 'concurrent-save',
    operation: async () => undefined,
    successMessage: 'OK 2',
    errorContext: 'Erreur 2',
  });

  assert.equal(secondOutcome.ok, false);
  assert.equal(secondOutcome.blocked, true);

  releaseOp();
  const firstOutcome = await firstPromise;
  assert.equal(firstOutcome.ok, false);
  assert.equal(isActionLockHeld('concurrent-save'), false);

  // Nouvel essai après libération du verrou doit passer
  const retryOutcome = await runFeedbackAction(notifier, {
    actionKey: 'concurrent-save',
    operation: async () => undefined,
    successMessage: 'Enregistré !',
    errorContext: 'Erreur',
  });
  assert.equal(retryOutcome.ok, true);
});

test('formatOperationError traduit proprement les erreurs réseau, auth et permissions', () => {
  assert.match(
    formatOperationError(new Error('Client is offline'), 'Échec commande'),
    /Échec commande\. Impossible de contacter le serveur/
  );
  assert.match(
    formatOperationError(new Error('Utilisateur non authentifié'), 'Échec budget'),
    /Échec budget\. Session utilisateur inactive/
  );
});

test('useFeedbackStore gère notifications et confirmation pré-action de manière déterministe', async () => {
  const store = useFeedbackStore.getState();

  const id = store.notifySuccess('Test notification');
  assert.equal(useFeedbackStore.getState().notifications.some((n) => n.id === id), true);
  store.dismissNotification(id);
  assert.equal(useFeedbackStore.getState().notifications.some((n) => n.id === id), false);

  const confirmPromiseTrue = store.confirmAction({
    title: 'Confirmer suppression',
    message: 'Supprimer cet élément ?',
  });
  assert.equal(useFeedbackStore.getState().confirmRequest?.options.title, 'Confirmer suppression');
  store.resolveConfirm(true);
  assert.equal(await confirmPromiseTrue, true);
  assert.equal(useFeedbackStore.getState().confirmRequest, null);

  const confirmPromiseFalse = store.confirmAction({
    title: 'Annuler suppression',
    message: 'Annuler ?',
  });
  store.resolveConfirm(false);
  assert.equal(await confirmPromiseFalse, false);
});
