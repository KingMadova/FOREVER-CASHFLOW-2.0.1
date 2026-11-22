import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ESLint } from 'eslint';
import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';
import { buildBootstrappedProfile, buildMergedUserProfile } from '../profileHelpers';
import { createOrderFromCart, buildEditedOrderPayload } from '../orderCalculations';
import { getCustomerSalePrice, getPartnerPurchasePrice, withOfficialProductPrices } from '../pricing';
import {
  clearAllActionLocksForTest,
  formatOperationError,
  runFeedbackAction,
} from '../actionFeedback';
import { Product, Order } from '../../types';

const PULPE_PRODUCT: Product = withOfficialProductPrices({
  id: '15',
  name: 'FOREVER ALOE VERA GEL',
  prixRetail: 20156,
  unitCC: 0.1,
});

function installMockLocalStorage() {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => {
      store.clear();
    },
  };
  return store;
}

// Équivalent TypeScript strict des prédicats de firestore.rules pour vérifier tous les contrats de données
function rulesIsOwner(
  auth: { uid: string; emailVerified: boolean } | null,
  userId: string
): boolean {
  return auth !== null && auth.emailVerified === true && auth.uid === userId;
}

function rulesIsValidUserProfile(data: Record<string, unknown>): boolean {
  return (
    typeof data.name === 'string' &&
    typeof data.grade === 'string' &&
    ['AA', 'A', 'MA', 'M'].includes(data.grade) &&
    (!('createdAt' in data) || data.createdAt === null || typeof data.createdAt === 'string') &&
    (!('updatedAt' in data) || data.updatedAt === null || typeof data.updatedAt === 'string') &&
    (!('monthlyGoalCC' in data) ||
      data.monthlyGoalCC === null ||
      typeof data.monthlyGoalCC === 'number') &&
    (!('monthlyGoalAmount' in data) ||
      data.monthlyGoalAmount === null ||
      typeof data.monthlyGoalAmount === 'number')
  );
}

function rulesIsValidOrder(data: Record<string, unknown>, userId: string): boolean {
  return (
    data.userId === userId &&
    typeof data.customerId === 'string' &&
    typeof data.customerName === 'string' &&
    typeof data.date === 'string' &&
    Array.isArray(data.items) &&
    data.items.length > 0 &&
    typeof data.status === 'string' &&
    typeof data.totalRetail === 'number' &&
    typeof data.totalCost === 'number' &&
    typeof data.totalMargin === 'number' &&
    typeof data.totalCC === 'number' &&
    typeof data.createdAt === 'string'
  );
}

function rulesIsValidCustomer(data: Record<string, unknown>, userId: string): boolean {
  return (
    data.userId === userId &&
    typeof data.name === 'string' &&
    data.name.length > 0 &&
    typeof data.phone === 'string' &&
    typeof data.status === 'string' &&
    typeof data.pipelineStage === 'string' &&
    typeof data.createdAt === 'string' &&
    (!('interactions' in data) ||
      data.interactions === null ||
      (Array.isArray(data.interactions) && data.interactions.length <= 500)) &&
    (!('convertedAt' in data) ||
      data.convertedAt === null ||
      (typeof data.convertedAt === 'string' && data.convertedAt.length <= 32)) &&
    (!('conversionChannel' in data) ||
      data.conversionChannel === null ||
      (typeof data.conversionChannel === 'string' &&
        ['WHATSAPP', 'SMS', 'APPEL', 'PRESENTATION', 'AUTRE', 'INCONNU'].includes(
          data.conversionChannel
        ))) &&
    (!('recordOrigin' in data) ||
      data.recordOrigin === null ||
      (typeof data.recordOrigin === 'string' &&
        ['PROSPECTION', 'DIRECT_CLIENT'].includes(data.recordOrigin))) &&
    (!('convertedFromProspect' in data) ||
      data.convertedFromProspect === null ||
      typeof data.convertedFromProspect === 'boolean')
  );
}

import {
  SIMULATED_OFFLINE_KEY,
  SYNC_QUEUE_KEY,
  SyncTask,
  computeIsOfflineMode,
  persistSyncQueue,
  readInitialSimulatedOffline,
  readInitialSyncQueue,
  upsertEntityTaskInQueue,
  upsertOrderTaskInQueue,
} from '../syncQueueHelpers';

test('firestore.rules passe l’audit ESLint @firebase/eslint-plugin-security-rules sans erreur ni warning', async () => {
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: [firebaseRulesPlugin.configs['flat/recommended'] as any],
  });
  const results = await eslint.lintFiles([path.resolve(process.cwd(), 'firestore.rules')]);
  assert.equal(results.length, 1);
  assert.equal(results[0].errorCount, 0);
  assert.equal(results[0].fatalErrorCount, 0);
  assert.equal(results[0].warningCount, 0);
});

test('Contrôle d’accès firestore.rules : vérifie propriétaire, email vérifié, grade valide et filet de sécurité', () => {
  const rulesText = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
  assert.match(rulesText, /match \/\{document=\*\*\}[\s\S]*allow read, write: if false;/);
  assert.match(rulesText, /request\.auth != null && request\.auth\.token\.email_verified == true/);
  assert.match(rulesText, /allow delete: if false;/); // profiles ne peuvent pas être supprimés côté client
  assert.match(rulesText, /conversionChannel in \['WHATSAPP', 'SMS', 'APPEL', 'PRESENTATION', 'AUTRE', 'INCONNU'\]/);
  assert.match(rulesText, /data\.interactions is list && data\.interactions\.size\(\) <= 500/);

  assert.equal(rulesIsOwner(null, 'uid_1'), false);
  assert.equal(rulesIsOwner({ uid: 'uid_1', emailVerified: false }, 'uid_1'), false);
  assert.equal(rulesIsOwner({ uid: 'uid_2', emailVerified: true }, 'uid_1'), false);
  assert.equal(rulesIsOwner({ uid: 'uid_1', emailVerified: true }, 'uid_1'), true);
});

test('Contrats Firestore Customer (rétrocompatibilité historique + champs Étape 2)', () => {
  const legacyCustomer = {
    userId: 'uid_1',
    name: 'Client Historique',
    phone: '0600000000',
    status: 'CLIENT',
    pipelineStage: 'CLOSED_WON',
    createdAt: '2025-10-01T10:00:00.000Z',
  };
  assert.equal(rulesIsValidCustomer(legacyCustomer, 'uid_1'), true);
  assert.equal(rulesIsValidCustomer(legacyCustomer, 'uid_autre'), false);

  const stage2Converted = {
    ...legacyCustomer,
    recordOrigin: 'PROSPECTION',
    convertedFromProspect: true,
    convertedAt: '2026-11-22',
    conversionChannel: 'WHATSAPP',
    interactions: [
      {
        id: 'int_1',
        date: '2026-11-22',
        channel: 'WHATSAPP',
        actionType: 'RELANCE',
        outcome: 'CONVERTI',
        createdAt: '2026-11-22T12:00:00.000Z',
      },
    ],
  };
  assert.equal(rulesIsValidCustomer(stage2Converted, 'uid_1'), true);
  assert.equal(rulesIsValidCustomer({ ...stage2Converted, conversionChannel: 'INCONNU' }, 'uid_1'), true);
  assert.equal(rulesIsValidCustomer({ ...stage2Converted, conversionChannel: 'TIKTOK' }, 'uid_1'), false);
  assert.equal(rulesIsValidCustomer({ ...stage2Converted, recordOrigin: 'AUTRE' }, 'uid_1'), false);
  assert.equal(rulesIsValidCustomer({ ...stage2Converted, interactions: 'invalid' }, 'uid_1'), false);
});

test('Contrats Firestore : mise à jour de grade, profil bootstrap, création et édition de commande satisfont les règles', () => {
  const bootstrapped = buildBootstrappedProfile(
    { displayName: 'Test FBO', email: 'test@example.com', photoURL: null },
    'light',
    '2026-11-20T12:00:00.000Z'
  );
  assert.equal(rulesIsValidUserProfile(bootstrapped as unknown as Record<string, unknown>), true);

  const upgraded = buildMergedUserProfile(bootstrapped, { grade: 'MA' }, 'dark');
  assert.equal(rulesIsValidUserProfile(upgraded as unknown as Record<string, unknown>), true);

  // Un grade invalide (ex. 'MGR') serait rejeté par firestore.rules
  assert.equal(rulesIsValidUserProfile({ ...upgraded, grade: 'MGR' }), false);

  const unitPrice = getCustomerSalePrice(PULPE_PRODUCT, 'PUBLIC')!;
  const unitCost = getPartnerPurchasePrice(PULPE_PRODUCT, 'AA')!;
  const created = createOrderFromCart({
    customerId: 'cust_1',
    customerName: 'Client Demo',
    items: [
      {
        productId: PULPE_PRODUCT.id,
        productName: PULPE_PRODUCT.name,
        quantity: 2,
        unitPrice,
        unitCost,
        priceCategory: 'PUBLIC',
        unitCC: PULPE_PRODUCT.unitCC,
        isDiscounted: false,
      },
    ],
    type: 'UNITE',
    canal: 'WHATSAPP',
    paiement: 'ESPECES',
    geste: 'AUCUN',
    livraisonMode: 'DOMICILE',
    datePrevueLivraison: '2026-11-20',
    catalogTotal: unitPrice * 2,
    profileGrade: 'AA',
    customerPriceType: 'PUBLIC',
  });

  const firestoreOrderDoc: Order & { userId: string; createdAt: string } = {
    id: 'ord_1',
    ...created,
    userId: 'uid_1',
    createdAt: '2026-11-20T12:05:00.000Z',
  };
  assert.equal(rulesIsValidOrder(firestoreOrderDoc as unknown as Record<string, unknown>, 'uid_1'), true);
  assert.equal(rulesIsValidOrder(firestoreOrderDoc as unknown as Record<string, unknown>, 'uid_autre'), false);

  const edited = buildEditedOrderPayload({
    existing: firestoreOrderDoc,
    customerId: 'cust_1',
    customerName: 'Client Demo',
    items: firestoreOrderDoc.items,
    type: 'UNITE',
    canal: 'AIRTEL' as any,
    paiement: 'AIRTEL',
    geste: 'AUCUN',
    livraisonMode: 'MAIN_PROPRE',
    datePrevueLivraison: '2026-11-21',
  });
  assert.equal(rulesIsValidOrder(edited as unknown as Record<string, unknown>, 'uid_1'), true);
});

test('Gestion des erreurs de permissions Firestore : formatOperationError traduit les JSON de handleFirestoreError', () => {
  const rawJsonPermissionError = new Error(
    JSON.stringify({
      error: 'Missing or insufficient permissions.',
      operationType: 'update',
      path: 'users/uid_1',
      authInfo: { userId: 'uid_1', email: 'test@example.com', emailVerified: false },
    })
  );
  const formatted = formatOperationError(rawJsonPermissionError, 'Échec de l’enregistrement du grade');
  assert.match(formatted, /Échec de l’enregistrement du grade\./);
  assert.match(formatted, /permissions insuffisantes/i);

  const offlineError = new Error(
    JSON.stringify({
      error: 'Failed to get document because the client is offline.',
      operationType: 'get',
      path: 'users/uid_1',
    })
  );
  const formattedOffline = formatOperationError(offlineError, 'Erreur de chargement');
  assert.match(formattedOffline, /Impossible de contacter le serveur/);
});

test('Comportement hors-ligne et retour en ligne : file de synchronisation persistée et fusion des mises à jour', () => {
  const storage = installMockLocalStorage();

  // État initial en ligne vs hors-ligne réel/simulé
  assert.equal(computeIsOfflineMode(true, false), false);
  assert.equal(computeIsOfflineMode(false, false), true);
  assert.equal(computeIsOfflineMode(true, true), true);

  let queue: SyncTask[] = [];
  queue = upsertOrderTaskInQueue(queue, {
    id: 'sync_1',
    type: 'ORDER',
    entityId: 'ord_offline_1',
    name: 'Client Offline',
    actionType: 'ADD',
    payload: { customerName: 'Client Offline', totalRetail: 20156, status: 'PENDING' },
    createdAt: '2026-11-20T12:00:00.000Z',
  });

  // L'édition d'une commande créée hors-ligne fusionne dans la tâche ADD existante
  queue = upsertOrderTaskInQueue(queue, {
    id: 'sync_2',
    type: 'ORDER',
    entityId: 'ord_offline_1',
    name: 'Client Offline',
    actionType: 'UPDATE',
    payload: { status: 'VALIDATED', notes: 'Edité hors-ligne' },
    createdAt: '2026-11-20T12:01:00.000Z',
  });

  assert.equal(queue.length, 1);
  assert.equal(queue[0].actionType, 'ADD');
  assert.equal(queue[0].payload.status, 'VALIDATED');
  assert.equal(queue[0].payload.notes, 'Edité hors-ligne');

  // Persistance dans localStorage et rechargement après actualisation
  persistSyncQueue(queue);
  const reloadedQueue = readInitialSyncQueue();
  assert.equal(reloadedQueue.length, 1);
  assert.equal(reloadedQueue[0].entityId, 'ord_offline_1');
  assert.equal(JSON.parse(storage.get(SYNC_QUEUE_KEY) || '[]').length, 1);

  // Édition d'une commande déjà synchronisée -> crée une tâche UPDATE dédiée (dédupliquée par entityId)
  queue = upsertOrderTaskInQueue(reloadedQueue, {
    id: 'sync_3',
    type: 'ORDER',
    entityId: 'ord_existing_1',
    name: 'Client Existant',
    actionType: 'UPDATE',
    payload: { notes: 'Note v1' },
    createdAt: '2026-11-20T12:02:00.000Z',
  });
  queue = upsertOrderTaskInQueue(queue, {
    id: 'sync_4',
    type: 'ORDER',
    entityId: 'ord_existing_1',
    name: 'Client Existant',
    actionType: 'UPDATE',
    payload: { notes: 'Note v2' },
    createdAt: '2026-11-20T12:03:00.000Z',
  });
  assert.equal(queue.length, 2);
  assert.equal(queue[1].actionType, 'UPDATE');
  assert.equal(queue[1].payload.notes, 'Note v2');

  persistSyncQueue([]);
  assert.equal(readInitialSyncQueue().length, 0);
});

test('File hors-ligne généralisée (CUSTOMER, BUDGET, AGENDA, DAILY_LOG) : fusion ADD/UPDATE/DELETE, reprise après rechargement et feedback warning', async () => {
  const storage = installMockLocalStorage();
  storage.set(SIMULATED_OFFLINE_KEY, 'true');
  assert.equal(readInitialSimulatedOffline(), true);

  let queue: SyncTask[] = [];

  // 1) CUSTOMER : ADD puis UPDATE puis DELETE -> s'annule proprement (0 requête)
  queue = upsertEntityTaskInQueue(queue, {
    id: 't1',
    type: 'CUSTOMER',
    entityId: 'cust_tmp',
    name: 'Client Temp',
    actionType: 'ADD',
    payload: { name: 'Client Temp', phone: '060000000' },
    createdAt: '2026-11-20T12:00:00.000Z',
  });
  queue = upsertEntityTaskInQueue(queue, {
    id: 't2',
    type: 'CUSTOMER',
    entityId: 'cust_tmp',
    name: 'Client Temp Modifié',
    actionType: 'UPDATE',
    payload: { name: 'Client Temp Modifié' },
    createdAt: '2026-11-20T12:01:00.000Z',
  });
  assert.equal(queue.length, 1);
  assert.equal(queue[0].actionType, 'ADD');
  assert.equal(queue[0].payload.name, 'Client Temp Modifié');

  queue = upsertEntityTaskInQueue(queue, {
    id: 't3',
    type: 'CUSTOMER',
    entityId: 'cust_tmp',
    name: 'Client Temp Modifié',
    actionType: 'DELETE',
    payload: {},
    createdAt: '2026-11-20T12:02:00.000Z',
  });
  assert.equal(queue.length, 0);

  // 2) AGENDA déjà existant : UPDATE titre puis toggle completed partiel -> fusionne les 2 champs
  queue = upsertEntityTaskInQueue(queue, {
    id: 't4',
    type: 'AGENDA',
    entityId: 'ag_existing',
    name: 'Suivi Alice',
    actionType: 'UPDATE',
    payload: { title: 'Suivi Alice Urgent', completed: false },
    createdAt: '2026-11-20T12:03:00.000Z',
  });
  queue = upsertEntityTaskInQueue(queue, {
    id: 't5',
    type: 'AGENDA',
    entityId: 'ag_existing',
    name: 'Suivi Alice Urgent',
    actionType: 'UPDATE',
    payload: { completed: true },
    createdAt: '2026-11-20T12:04:00.000Z',
  });
  assert.equal(queue.length, 1);
  assert.equal(queue[0].payload.title, 'Suivi Alice Urgent');
  assert.equal(queue[0].payload.completed, true);

  // 3) BUDGET existant : UPDATE suivi de DELETE -> conserve uniquement DELETE
  queue = upsertEntityTaskInQueue(queue, {
    id: 't6',
    type: 'BUDGET',
    entityId: 'bud_existing',
    name: 'Transport',
    actionType: 'UPDATE',
    payload: { amount: 5000 },
    createdAt: '2026-11-20T12:05:00.000Z',
  });
  queue = upsertEntityTaskInQueue(queue, {
    id: 't7',
    type: 'BUDGET',
    entityId: 'bud_existing',
    name: 'Transport',
    actionType: 'DELETE',
    payload: {},
    createdAt: '2026-11-20T12:06:00.000Z',
  });
  const budgetTasks = queue.filter((q) => q.type === 'BUDGET');
  assert.equal(budgetTasks.length, 1);
  assert.equal(budgetTasks[0].actionType, 'DELETE');

  // 4) DAILY_LOG : identifiant déterministe par date (ADD répétés fusionnés en 1 tâche)
  queue = upsertEntityTaskInQueue(queue, {
    id: 't8',
    type: 'DAILY_LOG',
    entityId: '2026-11-20',
    name: 'Journal G4',
    actionType: 'ADD',
    payload: { date: '2026-11-20', contactsAdded: 2 },
    createdAt: '2026-11-20T12:07:00.000Z',
  });
  queue = upsertEntityTaskInQueue(queue, {
    id: 't9',
    type: 'DAILY_LOG',
    entityId: '2026-11-20',
    name: 'Journal G4',
    actionType: 'ADD',
    payload: { date: '2026-11-20', contactsAdded: 5 },
    createdAt: '2026-11-20T12:08:00.000Z',
  });
  const logTasks = queue.filter((q) => q.type === 'DAILY_LOG');
  assert.equal(logTasks.length, 1);
  assert.equal(logTasks[0].payload.contactsAdded, 5);

  // 5) Actualisation de page : la file et le mode simulé survivent via localStorage
  persistSyncQueue(queue);
  const restored = readInitialSyncQueue();
  assert.equal(restored.length, 3);
  storage.set(SIMULATED_OFFLINE_KEY, 'false');
  assert.equal(readInitialSimulatedOffline(), false);

  // 6) Une opération retournant 'queued' affiche un avertissement (jamais 'success')
  clearAllActionLocksForTest();
  const events: Array<{ level: string; message: string }> = [];
  const outcome = await runFeedbackAction(
    {
      notifySuccess: (message) => events.push({ level: 'success', message }),
      notifyWarning: (message) => events.push({ level: 'warning', message }),
      notifyError: (message) => events.push({ level: 'error', message }),
      setPending: () => {},
    },
    {
      actionKey: 'offline-test',
      operation: async () => 'queued',
      successMessage: 'Client modifié avec succès !',
      errorContext: 'Échec modification client',
      redirectToDashboard: false,
    }
  );
  assert.equal(outcome.ok, true);
  assert.equal(outcome.queued, true);
  assert.equal(events.length, 1);
  assert.equal(events[0].level, 'warning');
  assert.match(events[0].message, /hors-ligne/i);
});

test('Contrats slices : authSlice refuse les modifications hors-ligne et tous les slices métier retournent saved/queued', () => {
  const authSliceSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/store/slices/authSlice.ts'), 'utf8');
  assert.match(authSliceSrc, /if \(useSyncStore\.getState\(\)\.isOfflineMode\)/);
  assert.match(authSliceSrc, /Connexion Internet requise pour enregistrer les modifications du profil et du grade/);

  for (const sliceFile of [
    'src/store/slices/customersSlice.ts',
    'src/store/slices/budgetSlice.ts',
    'src/store/slices/agendaSlice.ts',
    'src/store/slices/dailyLogsSlice.ts',
    'src/store/slices/ordersSlice.ts',
  ]) {
    const content = fs.readFileSync(path.resolve(process.cwd(), sliceFile), 'utf8');
    assert.match(content, /isOfflineMode/);
    assert.match(content, /return 'queued'/);
    assert.match(content, /return 'saved'/);
  }
});
