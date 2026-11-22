import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_GRADE_CODE,
  GRADES,
  GradeCode,
  Order,
  Product,
  UserProfile,
  getGradeByCode,
} from '../../types';
import { OFFICIAL_PRICE_LIST } from '../../data/officialPriceList';
import {
  getCustomerSalePrice,
  getPartnerPurchasePrice,
  withOfficialProductPrices,
} from '../pricing';
import {
  DEFAULT_PROFILE,
  buildBootstrappedProfile,
  buildMergedUserProfile,
  normalizeGradeCode,
  shouldIgnorePendingSnapshot,
} from '../profileHelpers';
import {
  allocateLegacyLineCosts,
  buildEditedOrderPayload,
  buildOrderItemsForEdit,
  createOrderFromCart,
  resolveLegacyFrozenUnitCost,
} from '../orderCalculations';

const PULPE_PRODUCT: Product = withOfficialProductPrices({
  id: '15',
  name: 'FOREVER ALOE VERA GEL',
  prixRetail: 20156,
  unitCC: 0.1,
});

const POLLEN_PRODUCT: Product = withOfficialProductPrices({
  id: '26',
  name: 'FOREVER BEE POLLEN',
  prixRetail: 12091,
  unitCC: 0.06,
});

const PROPOLIS_PRODUCT: Product = withOfficialProductPrices({
  id: '27',
  name: 'FOREVER BEE PROPOLIS',
  prixRetail: 26207,
  unitCC: 0.13,
});

test('GRADES utilise la nomenclature officielle (AA, A, MA, M) et mappe M -> MGR sur OFFICIAL_PRICE_LIST', () => {
  assert.equal(GRADES.length, 4);
  assert.deepEqual(getGradeByCode('AA'), {
    code: 'AA',
    label: 'Assistant Animateur',
  });
  assert.deepEqual(getGradeByCode('A'), {
    code: 'A',
    label: 'Animateur',
  });
  assert.deepEqual(getGradeByCode('MA'), {
    code: 'MA',
    label: 'Manager Adjoint',
  });
  assert.deepEqual(getGradeByCode('M'), {
    code: 'M',
    label: 'Manager',
  });
  for (const grade of GRADES) {
    assert.equal('tauxRemise' in grade, false);
  }
  // Aucun code officiel rejeté ; tout code non reconnu (y compris 'MGR' côté profil) retombe sur DEFAULT_GRADE_CODE ('A')
  for (const officialCode of ['AA', 'A', 'MA', 'M'] as const) {
    assert.equal(normalizeGradeCode(officialCode), officialCode);
    assert.equal(getGradeByCode(officialCode).code, officialCode);
  }
  for (const invalidCode of ['MGR', 'MANAGER', 'INCONNU', '', null, undefined]) {
    assert.equal(normalizeGradeCode(invalidCode), DEFAULT_GRADE_CODE);
    assert.equal(getGradeByCode(invalidCode).code, DEFAULT_GRADE_CODE);
  }

  // Vérifie que tous les produits avec tarif partenaire dans OFFICIAL_PRICE_LIST utilisent bien la clé MGR pour M
  for (const [id, table] of Object.entries(OFFICIAL_PRICE_LIST)) {
    const product: Product = { id, name: id, prixRetail: table.PUBLIC ?? 0, prices: table, unitCC: 0.1 };
    assert.equal(getPartnerPurchasePrice(product, 'M'), table.MGR);
    assert.equal(getPartnerPurchasePrice(product, 'MA'), table.MA);
    assert.equal(getPartnerPurchasePrice(product, 'A'), table.A);
    assert.equal(getPartnerPurchasePrice(product, 'AA'), table.AA);
  }
});

test('Tarifs officiels : getPartnerPurchasePrice et getCustomerSalePrice retournent les prix exacts', () => {
  const official15 = OFFICIAL_PRICE_LIST['15'];
  assert.equal(getPartnerPurchasePrice(PULPE_PRODUCT, 'AA'), official15.AA);
  assert.equal(getPartnerPurchasePrice(PULPE_PRODUCT, 'A'), official15.A);
  assert.equal(getPartnerPurchasePrice(PULPE_PRODUCT, 'MA'), official15.MA);
  assert.equal(getPartnerPurchasePrice(PULPE_PRODUCT, 'M'), official15.MGR);
  assert.equal(getCustomerSalePrice(PULPE_PRODUCT, 'PUBLIC'), official15.PUBLIC);
  assert.equal(getCustomerSalePrice(PULPE_PRODUCT, 'CP'), official15.CP);

  const customProduct: Product = {
    id: 'custom_1',
    name: 'Produit Personnalisé',
    prixRetail: 15000,
    unitCC: 0.05,
  };
  assert.equal(getCustomerSalePrice(customProduct, 'PUBLIC'), 15000);
  assert.equal(getCustomerSalePrice(customProduct, 'CP'), null);
  assert.equal(getPartnerPurchasePrice(customProduct, 'A'), null);
});

test('buildBootstrappedProfile inclut tous les champs requis par firestore.rules', () => {
  const now = '2026-04-12T10:00:00.000Z';
  const profile = buildBootstrappedProfile(
    {
      displayName: 'Jean Mbemba',
      email: 'jean@example.com',
      photoURL: null,
    },
    'dark',
    now
  );

  assert.equal(profile.name, 'Jean Mbemba');
  assert.equal(profile.grade, 'A');
  assert.equal(profile.title, 'Animateur');
  assert.equal(profile.initials, 'JM');
  assert.equal(profile.monthlyGoalCC, 0);
  assert.equal(profile.monthlyGoalAmount, 0);
  assert.equal(profile.createdAt, now);
  assert.equal(profile.updatedAt, now);
  assert.equal(profile.themeMode, 'dark');
});

test('Transitions de grade AA -> A -> MA -> M mettent à jour grade et title de façon cohérente', () => {
  const transitions: Array<{ code: GradeCode; expectedLabel: string }> = [
    { code: 'AA', expectedLabel: 'Assistant Animateur' },
    { code: 'A', expectedLabel: 'Animateur' },
    { code: 'MA', expectedLabel: 'Manager Adjoint' },
    { code: 'M', expectedLabel: 'Manager' },
  ];

  let current: UserProfile = {
    ...DEFAULT_PROFILE,
    name: 'Alice Ndinga',
    title: 'Distributeur Indépendant',
    grade: 'AA',
    monthlyGoalCC: 4,
    monthlyGoalAmount: 500000,
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  for (const t of transitions) {
    current = buildMergedUserProfile(current, { grade: t.code }, 'light', '2026-04-12T12:00:00.000Z');
    assert.equal(current.grade, t.code);
    assert.equal(current.title, t.expectedLabel);
    assert.equal(current.monthlyGoalCC, 4);
    assert.equal(current.monthlyGoalAmount, 500000);
    assert.equal(current.name, 'Alice Ndinga');
  }
});

test('Règle métier #1 (Application immédiate) : toute nouvelle commande utilise immédiatement les tarifs officiels du nouveau grade', () => {
  const publicPrice15 = getCustomerSalePrice(PULPE_PRODUCT, 'PUBLIC')!;
  const costAA = getPartnerPurchasePrice(PULPE_PRODUCT, 'AA')!;
  const costM = getPartnerPurchasePrice(PULPE_PRODUCT, 'M')!;

  const orderAA = createOrderFromCart({
    customerId: 'c1',
    customerName: 'Client Test',
    items: [
      {
        productId: PULPE_PRODUCT.id,
        productName: PULPE_PRODUCT.name,
        quantity: 2,
        unitPrice: publicPrice15,
        unitCost: costAA,
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
    datePrevueLivraison: '2026-04-12',
    catalogTotal: publicPrice15 * 2,
    profileGrade: 'AA',
    customerPriceType: 'PUBLIC',
  });

  assert.equal(orderAA.partnerGrade, 'AA');
  assert.equal(orderAA.customerPriceType, 'PUBLIC');
  assert.equal(orderAA.totalCost, costAA * 2);
  assert.equal(orderAA.totalMargin, publicPrice15 * 2 - costAA * 2);

  // Passage au grade Manager (M) : la nouvelle commande applique immédiatement le coût MGR
  const orderM = createOrderFromCart({
    customerId: 'c1',
    customerName: 'Client Test',
    items: [
      {
        productId: PULPE_PRODUCT.id,
        productName: PULPE_PRODUCT.name,
        quantity: 2,
        unitPrice: publicPrice15,
        unitCost: costM,
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
    datePrevueLivraison: '2026-04-12',
    catalogTotal: publicPrice15 * 2,
    profileGrade: 'M',
    customerPriceType: 'PUBLIC',
  });

  assert.equal(orderM.partnerGrade, 'M');
  assert.equal(orderM.totalCost, costM * 2);
  assert.equal(orderM.totalMargin, publicPrice15 * 2 - costM * 2);
  assert.ok(orderM.totalCost < orderAA.totalCost);
  assert.ok(orderM.totalMargin > orderAA.totalMargin);

  // Tarification Client Privilégié (CP)
  const cpPrice15 = getCustomerSalePrice(PULPE_PRODUCT, 'CP')!;
  const orderCP = createOrderFromCart({
    customerId: 'c_cp',
    customerName: 'Client CP',
    items: [
      {
        productId: PULPE_PRODUCT.id,
        productName: PULPE_PRODUCT.name,
        quantity: 1,
        unitPrice: cpPrice15,
        unitCost: costM,
        priceCategory: 'CP',
        unitCC: PULPE_PRODUCT.unitCC,
        isDiscounted: false,
      },
    ],
    type: 'UNITE',
    canal: 'WHATSAPP',
    paiement: 'ESPECES',
    geste: 'AUCUN',
    livraisonMode: 'DOMICILE',
    datePrevueLivraison: '2026-04-12',
    catalogTotal: cpPrice15,
    profileGrade: 'M',
    customerPriceType: 'CP',
  });
  assert.equal(orderCP.customerPriceType, 'CP');
  assert.equal(orderCP.totalRetail, cpPrice15);
  assert.equal(orderCP.totalMargin, cpPrice15 - costM);

  // Refuse toute création si unitCost officiel est absent
  assert.throws(() => {
    createOrderFromCart({
      customerId: 'c1',
      customerName: 'Client Invalide',
      items: [
        {
          productId: PULPE_PRODUCT.id,
          productName: PULPE_PRODUCT.name,
          quantity: 1,
          unitPrice: publicPrice15,
          unitCC: PULPE_PRODUCT.unitCC,
          isDiscounted: false,
        },
      ],
      type: 'UNITE',
      canal: 'WHATSAPP',
      paiement: 'ESPECES',
      geste: 'AUCUN',
      livraisonMode: 'DOMICILE',
      datePrevueLivraison: '2026-04-12',
      catalogTotal: publicPrice15,
      profileGrade: 'M',
      customerPriceType: 'PUBLIC',
    });
  }, /coût d’achat officiel manquant/);
});

test('Règle métier #2 (Édition complète) : 2 produits AA + passage grade A + ajout 3e produit + suppression + quantités', () => {
  const pub15 = getCustomerSalePrice(PULPE_PRODUCT, 'PUBLIC')!;
  const costAA15 = getPartnerPurchasePrice(PULPE_PRODUCT, 'AA')!;
  const pub26 = getCustomerSalePrice(POLLEN_PRODUCT, 'PUBLIC')!;
  const costAA26 = getPartnerPurchasePrice(POLLEN_PRODUCT, 'AA')!;

  // 1) Création au grade AA avec 2 produits
  const baseOrder: Order = {
    id: 'ord_edit_1',
    ...createOrderFromCart({
      customerId: 'c1',
      customerName: 'Client Fidèle',
      items: [
        {
          productId: PULPE_PRODUCT.id,
          productName: PULPE_PRODUCT.name,
          quantity: 1,
          unitPrice: pub15,
          unitCost: costAA15,
          priceCategory: 'PUBLIC',
          unitCC: PULPE_PRODUCT.unitCC,
          isDiscounted: false,
        },
        {
          productId: POLLEN_PRODUCT.id,
          productName: POLLEN_PRODUCT.name,
          quantity: 2,
          unitPrice: pub26,
          unitCost: costAA26,
          priceCategory: 'PUBLIC',
          unitCC: POLLEN_PRODUCT.unitCC,
          isDiscounted: false,
        },
      ],
      type: 'UNITE',
      canal: 'WHATSAPP',
      paiement: 'ESPECES',
      geste: 'AUCUN',
      livraisonMode: 'DOMICILE',
      datePrevueLivraison: '2026-04-01',
      catalogTotal: pub15 + pub26 * 2,
      profileGrade: 'AA',
      customerPriceType: 'PUBLIC',
    }),
    date: '2026-04-01',
    refCommande: 'CMD-20260401-007',
  };

  // 2) Le partenaire passe au grade A
  const upgradedProfile = buildMergedUserProfile(
    { ...DEFAULT_PROFILE, grade: 'AA' },
    { grade: 'A' },
    'light'
  );
  assert.equal(upgradedProfile.grade, 'A');

  // 3) Réouverture en édition et ajout d'un 3e produit (27) alors que le partenaire est au grade A
  const pub27 = getCustomerSalePrice(PROPOLIS_PRODUCT, 'PUBLIC')!;
  const costA27 = getPartnerPurchasePrice(PROPOLIS_PRODUCT, 'A')!;
  const costAA27 = getPartnerPurchasePrice(PROPOLIS_PRODUCT, 'AA')!;
  assert.notEqual(costA27, costAA27); // vérifie que A et AA diffèrent réellement

  const itemsWithThird = buildOrderItemsForEdit({
    existing: baseOrder,
    cartItems: [
      { product: PULPE_PRODUCT, quantity: 1 },
      { product: POLLEN_PRODUCT, quantity: 2 },
      { product: PROPOLIS_PRODUCT, quantity: 1 },
    ],
    currentPartnerGrade: upgradedProfile.grade, // 'A'
    currentCustomerPriceType: 'PUBLIC',
    applyDiscount: false,
    getSalePrice: getCustomerSalePrice,
    getPurchasePrice: getPartnerPurchasePrice,
  });

  const editedWithThird = buildEditedOrderPayload({
    existing: baseOrder,
    customerId: 'c1',
    customerName: 'Client Fidèle',
    items: itemsWithThird,
    type: 'UNITE',
    canal: 'WHATSAPP',
    paiement: 'ESPECES',
    geste: 'AUCUN',
    livraisonMode: 'DOMICILE',
    datePrevueLivraison: '2026-04-01',
  });

  // Les 2 anciennes lignes conservent exactement anciens prix, coûts AA et marges unitaires/ligne
  assert.equal(editedWithThird.items[0].unitPrice, pub15);
  assert.equal(editedWithThird.items[0].unitCost, costAA15);
  assert.equal(editedWithThird.items[0].unitPrice - editedWithThird.items[0].unitCost!, pub15 - costAA15);

  assert.equal(editedWithThird.items[1].unitPrice, pub26);
  assert.equal(editedWithThird.items[1].unitCost, costAA26);
  assert.equal(
    (editedWithThird.items[1].unitPrice - editedWithThird.items[1].unitCost!) * 2,
    (pub26 - costAA26) * 2
  );

  // La 3e nouvelle ligne utilise les tarifs applicables au moment de son ajout (grade A)
  assert.equal(editedWithThird.items[2].unitPrice, pub27);
  assert.equal(editedWithThird.items[2].unitCost, costA27);
  assert.equal(editedWithThird.items[2].priceCategory, 'PUBLIC');

  // Le grade historique et les métadonnées de la commande ne sont pas écrasés
  assert.equal(editedWithThird.partnerGrade, 'AA');
  assert.equal(editedWithThird.customerPriceType, 'PUBLIC');
  assert.equal(editedWithThird.date, '2026-04-01');
  assert.equal(editedWithThird.refCommande, 'CMD-20260401-007');
  assert.equal(editedWithThird.totalCost, costAA15 + costAA26 * 2 + costA27);
  assert.equal(editedWithThird.totalRetail, pub15 + pub26 * 2 + pub27);
  assert.equal(
    editedWithThird.totalMargin,
    pub15 + pub26 * 2 + pub27 - (costAA15 + costAA26 * 2 + costA27)
  );

  // 4) Modification de quantités sur l'ancienne ligne (15 : qty 1 -> 3) tout en gardant le grade historique AA
  const itemsQtyChanged = buildOrderItemsForEdit({
    existing: baseOrder,
    cartItems: [
      { product: PULPE_PRODUCT, quantity: 3 },
      { product: POLLEN_PRODUCT, quantity: 2 },
    ],
    currentPartnerGrade: 'A',
    currentCustomerPriceType: 'PUBLIC',
    applyDiscount: false,
    getSalePrice: getCustomerSalePrice,
    getPurchasePrice: getPartnerPurchasePrice,
  });
  const editedQty = buildEditedOrderPayload({
    existing: baseOrder,
    customerId: 'c1',
    customerName: 'Client Fidèle',
    items: itemsQtyChanged,
    type: 'UNITE',
    canal: 'WHATSAPP',
    paiement: 'ESPECES',
    geste: 'AUCUN',
    livraisonMode: 'DOMICILE',
    datePrevueLivraison: '2026-04-01',
  });
  assert.equal(editedQty.items[0].unitPrice, pub15);
  assert.equal(editedQty.items[0].unitCost, costAA15);
  assert.equal(editedQty.totalRetail, pub15 * 3 + pub26 * 2);
  assert.equal(editedQty.totalCost, costAA15 * 3 + costAA26 * 2);
  assert.equal(editedQty.totalMargin, pub15 * 3 + pub26 * 2 - (costAA15 * 3 + costAA26 * 2));

  // 5) Suppression d'une ancienne ligne (26 supprimé, 15 conservé)
  const itemsAfterDelete = buildOrderItemsForEdit({
    existing: baseOrder,
    cartItems: [{ product: PULPE_PRODUCT, quantity: 1 }],
    currentPartnerGrade: 'A',
    currentCustomerPriceType: 'PUBLIC',
    applyDiscount: false,
    getSalePrice: getCustomerSalePrice,
    getPurchasePrice: getPartnerPurchasePrice,
  });
  const editedAfterDelete = buildEditedOrderPayload({
    existing: baseOrder,
    customerId: 'c1',
    customerName: 'Client Fidèle',
    items: itemsAfterDelete,
    type: 'UNITE',
    canal: 'WHATSAPP',
    paiement: 'ESPECES',
    geste: 'AUCUN',
    livraisonMode: 'DOMICILE',
    datePrevueLivraison: '2026-04-01',
  });
  assert.equal(editedAfterDelete.items.length, 1);
  assert.equal(editedAfterDelete.items[0].unitPrice, pub15);
  assert.equal(editedAfterDelete.items[0].unitCost, costAA15);
  assert.equal(editedAfterDelete.totalRetail, pub15);
  assert.equal(editedAfterDelete.totalCost, costAA15);
  assert.equal(editedAfterDelete.totalMargin, pub15 - costAA15);
  assert.equal(editedAfterDelete.partnerGrade, 'AA');
});

test('Exactitude mathématique des commandes héritées (7 scénarios : mono-ligne indivisible, multi-lignes avec arrondis, suppressions successives, quantités, ajout nouvelle ligne)', () => {
  const makeLegacy = (items: Order['items'], totalCost: number): Order => ({
    id: 'ord_legacy_math',
    customerId: 'c_old',
    customerName: 'Client Legacy',
    date: '2026-01-10',
    refCommande: 'CMD-20260110-009',
    status: 'PENDING',
    items,
    totalRetail: items.reduce((s, i) => s + i.unitPrice * i.quantity, 0),
    totalCost,
    totalMargin: items.reduce((s, i) => s + i.unitPrice * i.quantity, 0) - totalCost,
    totalCC: items.reduce((s, i) => s + i.unitCC * i.quantity, 0),
    totalPV: 22,
    totalBV: 0.16,
    partnerGrade: 'AA',
    type: 'UNITE',
    canal: 'WHATSAPP',
    paiement: 'ESPECES',
    geste: 'AUCUN',
    livraison: { mode: 'DOMICILE', frais: 0, datePrevue: '2026-01-10' },
    recommandation: false,
    distributeurId: '',
    tags: [],
  });

  // Cas 1 : Mono-ligne héritée avec quantité 3 et coût total indivisible par 3 (20 000 F / 3)
  const singleLegacy = makeLegacy(
    [{ productId: PULPE_PRODUCT.id, productName: PULPE_PRODUCT.name, quantity: 3, unitPrice: 10000, unitCC: 0.1, isDiscounted: false }],
    20000
  );
  const singleAllocated = allocateLegacyLineCosts(singleLegacy);
  assert.equal(singleAllocated.get(PULPE_PRODUCT.id), 20000);
  const singleUnit = resolveLegacyFrozenUnitCost(singleLegacy, singleLegacy.items[0])!;
  const editedSingleUnchanged = buildEditedOrderPayload({
    existing: singleLegacy,
    customerId: 'c_old',
    customerName: 'Client Legacy',
    items: buildOrderItemsForEdit({
      existing: singleLegacy,
      cartItems: [{ product: PULPE_PRODUCT, quantity: 3 }],
      currentPartnerGrade: 'M',
      currentCustomerPriceType: 'PUBLIC',
      applyDiscount: false,
      getSalePrice: getCustomerSalePrice,
      getPurchasePrice: getPartnerPurchasePrice,
    }),
    type: 'UNITE',
    canal: 'WHATSAPP',
    paiement: 'ESPECES',
    geste: 'AUCUN',
    livraisonMode: 'DOMICILE',
    datePrevueLivraison: '2026-01-10',
  });
  assert.equal(editedSingleUnchanged.totalCost, 20000); // Aucune dérive (20000/3)*3 === 20000
  assert.ok(Math.abs(singleUnit - 20000 / 3) < 1e-9);

  // Cas 2, 3 & 4 : Multi-lignes de prix et quantités différents produisant des restes fractionnaires
  const multiLegacy = makeLegacy(
    [
      { productId: PULPE_PRODUCT.id, productName: PULPE_PRODUCT.name, quantity: 2, unitPrice: 15000, unitCC: 0.1, isDiscounted: false }, // poids 30000
      { productId: POLLEN_PRODUCT.id, productName: POLLEN_PRODUCT.name, quantity: 3, unitPrice: 11000, unitCC: 0.06, isDiscounted: false }, // poids 33000
      { productId: PROPOLIS_PRODUCT.id, productName: PROPOLIS_PRODUCT.name, quantity: 1, unitPrice: 7000, unitCC: 0.13, isDiscounted: false }, // poids 7000
    ],
    25001 // 70 000 retail -> quotas exacts fractionnaires avec plus forts restes
  );
  const allocMulti = allocateLegacyLineCosts(multiLegacy);
  const sumMulti =
    (allocMulti.get(PULPE_PRODUCT.id) ?? 0) +
    (allocMulti.get(POLLEN_PRODUCT.id) ?? 0) +
    (allocMulti.get(PROPOLIS_PRODUCT.id) ?? 0);
  assert.equal(sumMulti, 25001); // Conservation stricte au franc près

  const items3Kept = buildOrderItemsForEdit({
    existing: multiLegacy,
    cartItems: [
      { product: PULPE_PRODUCT, quantity: 2 },
      { product: POLLEN_PRODUCT, quantity: 3 },
      { product: PROPOLIS_PRODUCT, quantity: 1 },
    ],
    currentPartnerGrade: 'M',
    currentCustomerPriceType: 'PUBLIC',
    applyDiscount: false,
    getSalePrice: getCustomerSalePrice,
    getPurchasePrice: getPartnerPurchasePrice,
  });
  const editedMultiAllKept = buildEditedOrderPayload({
    existing: multiLegacy,
    customerId: 'c_old',
    customerName: 'Client Legacy',
    items: items3Kept,
    type: 'UNITE',
    canal: 'WHATSAPP',
    paiement: 'ESPECES',
    geste: 'AUCUN',
    livraisonMode: 'DOMICILE',
    datePrevueLivraison: '2026-01-10',
  });
  assert.equal(editedMultiAllKept.totalCost, 25001);

  // Cas 5 : Suppressions successives (suppression ligne 3, puis ligne 2)
  const expectedL1 = allocMulti.get(PULPE_PRODUCT.id)!;
  const expectedL2 = allocMulti.get(POLLEN_PRODUCT.id)!;
  const afterDelete3 = buildEditedOrderPayload({
    existing: multiLegacy,
    customerId: 'c_old',
    customerName: 'Client Legacy',
    items: buildOrderItemsForEdit({
      existing: multiLegacy,
      cartItems: [
        { product: PULPE_PRODUCT, quantity: 2 },
        { product: POLLEN_PRODUCT, quantity: 3 },
      ],
      currentPartnerGrade: 'M',
      currentCustomerPriceType: 'PUBLIC',
      applyDiscount: false,
      getSalePrice: getCustomerSalePrice,
      getPurchasePrice: getPartnerPurchasePrice,
    }),
    type: 'UNITE',
    canal: 'WHATSAPP',
    paiement: 'ESPECES',
    geste: 'AUCUN',
    livraisonMode: 'DOMICILE',
    datePrevueLivraison: '2026-01-10',
  });
  assert.equal(afterDelete3.totalCost, expectedL1 + expectedL2);

  // Suppression suivante (ligne 2 supprimée à partir de `afterDelete3`) -> reste uniquement L1 exact !
  const afterDelete2And3 = buildEditedOrderPayload({
    existing: afterDelete3,
    customerId: 'c_old',
    customerName: 'Client Legacy',
    items: buildOrderItemsForEdit({
      existing: afterDelete3,
      cartItems: [{ product: PULPE_PRODUCT, quantity: 2 }],
      currentPartnerGrade: 'M',
      currentCustomerPriceType: 'PUBLIC',
      applyDiscount: false,
      getSalePrice: getCustomerSalePrice,
      getPurchasePrice: getPartnerPurchasePrice,
    }),
    type: 'UNITE',
    canal: 'WHATSAPP',
    paiement: 'ESPECES',
    geste: 'AUCUN',
    livraisonMode: 'DOMICILE',
    datePrevueLivraison: '2026-01-10',
  });
  assert.equal(afterDelete2And3.totalCost, expectedL1);

  // Cas 6 : Modification de quantité après changement de grade (qty 2 -> 4 sur L1 sans recalcul au grade M)
  const qtyDoubled = buildEditedOrderPayload({
    existing: afterDelete2And3,
    customerId: 'c_old',
    customerName: 'Client Legacy',
    items: buildOrderItemsForEdit({
      existing: afterDelete2And3,
      cartItems: [{ product: PULPE_PRODUCT, quantity: 4 }],
      currentPartnerGrade: 'M',
      currentCustomerPriceType: 'PUBLIC',
      applyDiscount: false,
      getSalePrice: getCustomerSalePrice,
      getPurchasePrice: getPartnerPurchasePrice,
    }),
    type: 'UNITE',
    canal: 'WHATSAPP',
    paiement: 'ESPECES',
    geste: 'AUCUN',
    livraisonMode: 'DOMICILE',
    datePrevueLivraison: '2026-01-10',
  });
  assert.equal(qtyDoubled.totalCost, expectedL1 * 2);
  assert.equal(qtyDoubled.items[0].unitCost, expectedL1 / 2);

  // Cas 7 : Ajout d'une nouvelle ligne au grade M sur commande héritée + déjà dotée d'un unitCost connu
  // Vérifie que la nouvelle ligne ne contamine jamais l'allocation historique et que unitCost déjà connu n'est jamais modifié
  const mixedLegacy = makeLegacy(
    [
      { productId: PULPE_PRODUCT.id, productName: PULPE_PRODUCT.name, quantity: 1, unitPrice: 20000, unitCost: 13500, unitCC: 0.1, isDiscounted: false },
      { productId: POLLEN_PRODUCT.id, productName: POLLEN_PRODUCT.name, quantity: 1, unitPrice: 10000, unitCC: 0.06, isDiscounted: false },
    ],
    20500 // 13500 connu + 7000 restant pour POLLEN
  );
  assert.equal(resolveLegacyFrozenUnitCost(mixedLegacy, mixedLegacy.items[0]), 13500);
  assert.equal(resolveLegacyFrozenUnitCost(mixedLegacy, mixedLegacy.items[1]), 7000);

  const costM27 = getPartnerPurchasePrice(PROPOLIS_PRODUCT, 'M')!;
  const editedMixedWithNewLine = buildEditedOrderPayload({
    existing: mixedLegacy,
    customerId: 'c_old',
    customerName: 'Client Legacy',
    items: buildOrderItemsForEdit({
      existing: mixedLegacy,
      cartItems: [
        { product: PULPE_PRODUCT, quantity: 1 },
        { product: POLLEN_PRODUCT, quantity: 1 },
        { product: PROPOLIS_PRODUCT, quantity: 2 },
      ],
      currentPartnerGrade: 'M',
      currentCustomerPriceType: 'PUBLIC',
      applyDiscount: false,
      getSalePrice: getCustomerSalePrice,
      getPurchasePrice: getPartnerPurchasePrice,
    }),
    type: 'UNITE',
    canal: 'WHATSAPP',
    paiement: 'ESPECES',
    geste: 'AUCUN',
    livraisonMode: 'DOMICILE',
    datePrevueLivraison: '2026-01-10',
  });
  assert.equal(editedMixedWithNewLine.items[0].unitCost, 13500);
  assert.equal(editedMixedWithNewLine.items[1].unitCost, 7000);
  assert.equal(editedMixedWithNewLine.items[2].unitCost, costM27);
  assert.equal(editedMixedWithNewLine.totalCost, 20500 + costM27 * 2);
});

test('Règle métier #3 (Cohérence & Atomicité) : snapshot local pendant sauvegarde est ignoré', () => {
  assert.equal(shouldIgnorePendingSnapshot(true, true), true);
  assert.equal(shouldIgnorePendingSnapshot(false, true), false);
  assert.equal(shouldIgnorePendingSnapshot(true, false), false);
  assert.equal(shouldIgnorePendingSnapshot(false, false), false);
});

test('firestore.rules vérifie de manière sûre les champs optionnels et les codes de grade officiels', () => {
  const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
  const rulesContent = fs.readFileSync(rulesPath, 'utf8');

  assert.match(rulesContent, /function isValidUserProfile\(data\)/);
  assert.match(rulesContent, /data\.grade in \['AA', 'A', 'MA', 'M'\]/);
  assert.match(rulesContent, /\!\('monthlyGoalCC' in data\)\s*\|\|\s*(?:data\.monthlyGoalCC == null\s*\|\|\s*)?data\.monthlyGoalCC is number/);
  assert.match(rulesContent, /\!\('monthlyGoalAmount' in data\)\s*\|\|\s*(?:data\.monthlyGoalAmount == null\s*\|\|\s*)?data\.monthlyGoalAmount is number/);
  assert.match(rulesContent, /\!\('createdAt' in data\)\s*\|\|\s*(?:data\.createdAt == null\s*\|\|\s*)?data\.createdAt is string/);
  assert.match(rulesContent, /\!\('updatedAt' in data\)\s*\|\|\s*(?:data\.updatedAt == null\s*\|\|\s*)?data\.updatedAt is string/);
});
