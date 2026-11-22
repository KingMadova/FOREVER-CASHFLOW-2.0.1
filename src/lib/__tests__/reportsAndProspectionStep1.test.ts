import test from 'node:test';
import assert from 'node:assert/strict';
import { AgendaItem, Customer, CustomerStatus, Order } from '../../types';
import {
  buildSalesCsvExport,
  computeProductPerformance,
  computeSalesNetSummary,
  inspectOrderNetAmount,
} from '../salesReports';
import {
  classifyCustomerForProspection,
  computeAcquisitionSourceStats,
  computeConversionFunnel,
  computeFollowUpSummary,
  computeProspectionOverviewKpis,
  resolveAgendaItemCustomer,
} from '../prospectionStats';

function makeOrder(overrides: Partial<Order> = {}): Order {
  const hasAmountPaidOverride = 'amountPaid' in overrides;
  return {
    id: overrides.id ?? 'ord_1',
    customerId: overrides.customerId ?? 'cust_1',
    customerName: overrides.customerName ?? 'Aline Mbemba',
    date: overrides.date ?? '2026-11-15',
    validatedAt: overrides.validatedAt,
    items: overrides.items ?? [
      {
        productId: 'p_aloe',
        productName: 'Forever Aloe Vera Gel',
        quantity: 2,
        unitPrice: 20000,
        unitCost: 13000,
        unitCC: 0.1,
        isDiscounted: false,
      },
    ],
    status: overrides.status ?? 'VALIDATED',
    totalRetail: overrides.totalRetail ?? 40000,
    totalCost: overrides.totalCost ?? 26000,
    totalMargin: overrides.totalMargin ?? 14000,
    amountPaid: hasAmountPaidOverride ? overrides.amountPaid : 40000,
    totalCC: overrides.totalCC ?? 0.2,
    totalPV: overrides.totalPV ?? 27,
    totalBV: overrides.totalBV ?? 0.2,
    type: overrides.type ?? 'UNITE',
    canal: overrides.canal ?? 'WHATSAPP',
    paiement: overrides.paiement ?? 'AIRTEL',
    refPaiement: overrides.refPaiement,
    refCommande: overrides.refCommande ?? 'CMD-20261115-001',
    geste: overrides.geste ?? 'AUCUN',
    discountPercent: overrides.discountPercent,
    livraison: overrides.livraison ?? {
      mode: 'DOMICILE',
      frais: 0,
      datePrevue: '2026-11-16',
    },
    recommandation: false,
    distributeurId: 'uid_1',
    tags: [],
    notes: overrides.notes,
  };
}

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: overrides.id ?? 'cust_1',
    name: overrides.name ?? 'Jean Okemba',
    email: overrides.email ?? 'jean@example.com',
    phone: overrides.phone ?? '+242 06 111 2233',
    address: overrides.address ?? 'Quartier Bacongo',
    ville: overrides.ville ?? 'Brazzaville',
    sourceProspection: overrides.sourceProspection ?? 'META_ADS',
    recordOrigin: overrides.recordOrigin,
    convertedFromProspect: overrides.convertedFromProspect,
    status: overrides.status ?? CustomerStatus.PROSPECT,
    pipelineStage: overrides.pipelineStage ?? 'CONTACT_INITIATED',
    lastContactDate: overrides.lastContactDate ?? '2026-11-18',
    createdAt: overrides.createdAt ?? '2026-11-10',
    notes: overrides.notes,
  };
}

test('computeProductPerformance exclut CANCELLED/RETOUR/PENDING/REMPLACEMENT, ignore quantités <= 0 et distingue valeur catalogue des lignes vs net enregistré sur bon', () => {
  const orders: Order[] = [
    makeOrder({
      id: 'ord_valid_1',
      status: 'VALIDATED',
      totalRetail: 60000,
      amountPaid: 50000, // montant net inférieur au catalogue (non ventilé dans les lignes)
      discountPercent: 17,
      geste: 'REMISE_5',
      items: [
        { productId: 'p_aloe', productName: 'Aloe Gel', quantity: 2, unitPrice: 20000, unitCC: 0.1, isDiscounted: false },
        { productId: 'p_aloe', productName: 'Aloe Gel', quantity: 1, unitPrice: 20000, unitCC: 0.1, isDiscounted: false },
      ],
    }),
    makeOrder({
      id: 'ord_paye_2',
      status: 'PAYE',
      totalRetail: 55000,
      amountPaid: 55000,
      items: [
        { productId: 'p_c9', productName: 'Clean 9', quantity: 1, unitPrice: 55000, unitCC: 0.3, isDiscounted: false },
        { productId: 'p_bad', productName: 'Ligne annulée négative', quantity: -2, unitPrice: 10000, unitCC: 0.05, isDiscounted: false },
      ],
    }),
    makeOrder({
      id: 'ord_cancelled',
      status: 'CANCELLED',
      totalRetail: 200000,
      items: [
        { productId: 'p_aloe', productName: 'Aloe Gel', quantity: 10, unitPrice: 20000, unitCC: 0.1, isDiscounted: false },
      ],
    }),
    makeOrder({
      id: 'ord_retour',
      status: 'RETOUR',
      totalRetail: 55000,
      items: [
        { productId: 'p_c9', productName: 'Clean 9', quantity: 1, unitPrice: 55000, unitCC: 0.3, isDiscounted: false },
      ],
    }),
    makeOrder({
      id: 'ord_remplacement',
      status: 'REMPLACEMENT',
      totalRetail: 20000,
      items: [
        { productId: 'p_aloe', productName: 'Aloe Gel', quantity: 1, unitPrice: 20000, unitCC: 0.1, isDiscounted: false },
      ],
    }),
    makeOrder({
      id: 'ord_pending',
      status: 'PENDING',
      totalRetail: 20000,
      items: [
        { productId: 'p_aloe', productName: 'Aloe Gel', quantity: 1, unitPrice: 20000, unitCC: 0.1, isDiscounted: false },
      ],
    }),
  ];

  // Tri par CA catalogue décroissant
  const byRevenue = computeProductPerformance(orders, { sortBy: 'revenue', sortDir: 'desc' });
  assert.equal(byRevenue.distinctOrdersCount, 2);
  assert.equal(byRevenue.totalLinesRevenue, 115000);
  assert.equal(byRevenue.totalOrdersRevenue, 115000);
  assert.equal(byRevenue.totalOrdersNetRecorded, 105000);
  assert.equal(byRevenue.validAmountOrdersCount, 2);
  assert.equal(byRevenue.missingAmountOrdersCount, 0);
  assert.equal(byRevenue.invalidAmountOrdersCount, 0);
  assert.equal(byRevenue.coveredCatalogRevenue, 115000);
  assert.equal(byRevenue.totalOrderLevelGap, 10000);
  assert.equal(byRevenue.hasUnallocatedDiscountOrGeste, true);
  assert.equal(byRevenue.totalUnitsSold, 4);
  assert.equal(byRevenue.rows.length, 2);

  // Aloe Gel : 3 unités, 1 seule commande distincte, 60 000 F catalogue (remise globale non répartie arbitrairement)
  assert.equal(byRevenue.rows[0].productId, 'p_aloe');
  assert.equal(byRevenue.rows[0].totalQuantity, 3);
  assert.equal(byRevenue.rows[0].ordersCount, 1);
  assert.equal(byRevenue.rows[0].revenue, 60000);
  assert.equal(byRevenue.rows[0].rank, 1);
  assert.equal(byRevenue.rows[0].isBestseller, true);

  // Clean 9 : 1 unité, 1 commande, 55 000 F
  assert.equal(byRevenue.rows[1].productId, 'p_c9');
  assert.equal(byRevenue.rows[1].revenue, 55000);
  assert.equal(byRevenue.rows[1].rank, 2);
  assert.equal(byRevenue.rows[1].isBestseller, false);

  const shareSum = byRevenue.rows.reduce((sum, r) => sum + (r.sharePct ?? 0), 0);
  assert.ok(Math.abs(shareSum - 100) < 1e-6);

  // Tri par quantité croissante
  const byQtyAsc = computeProductPerformance(orders, { sortBy: 'quantity', sortDir: 'asc' });
  assert.equal(byQtyAsc.rows[0].productId, 'p_c9');
  assert.equal(byQtyAsc.rows[1].productId, 'p_aloe');
});

test('computeSalesNetSummary et inspectOrderNetAmount gèrent sans biais les 8 cas de amountPaid', () => {
  // 1. amountPaid absent -> MISSING, jamais remplacé par totalRetail
  const missingOrder = makeOrder({ id: 'o_missing', totalRetail: 40000, amountPaid: undefined });
  assert.deepEqual(inspectOrderNetAmount(missingOrder), { status: 'MISSING', amount: null });

  // 2. amountPaid === 0 -> VALID (0 conservé tel quel)
  const zeroOrder = makeOrder({ id: 'o_zero', totalRetail: 25000, amountPaid: 0 });
  assert.deepEqual(inspectOrderNetAmount(zeroOrder), { status: 'VALID', amount: 0 });

  // 3. amountPaid < totalRetail -> VALID (exact)
  const lowerOrder = makeOrder({ id: 'o_lower', totalRetail: 40000, amountPaid: 32000 });
  assert.deepEqual(inspectOrderNetAmount(lowerOrder), { status: 'VALID', amount: 32000 });

  // 4. amountPaid > totalRetail (ex. frais de livraison inclus) -> VALID, aucun plafonnement à totalRetail
  const higherOrder = makeOrder({ id: 'o_higher', totalRetail: 10000, amountPaid: 15000 });
  assert.deepEqual(inspectOrderNetAmount(higherOrder), { status: 'VALID', amount: 15000 });

  // 5. amountPaid négatif -> INVALID, jamais converti silencieusement en 0
  const negativeOrder = makeOrder({ id: 'o_neg', totalRetail: 20000, amountPaid: -5000 });
  assert.deepEqual(inspectOrderNetAmount(negativeOrder), { status: 'INVALID', amount: null });

  // 6. amountPaid non numérique ou non fini -> INVALID
  const nanOrder = makeOrder({ id: 'o_nan', totalRetail: 20000, amountPaid: Number.NaN });
  const infOrder = makeOrder({ id: 'o_inf', totalRetail: 20000, amountPaid: Number.POSITIVE_INFINITY });
  const strOrder = makeOrder({ id: 'o_str', totalRetail: 20000, amountPaid: '15000' as unknown as number });
  assert.deepEqual(inspectOrderNetAmount(nanOrder), { status: 'INVALID', amount: null });
  assert.deepEqual(inspectOrderNetAmount(infOrder), { status: 'INVALID', amount: null });
  assert.deepEqual(inspectOrderNetAmount(strOrder), { status: 'INVALID', amount: null });

  // 7. Plusieurs commandes avec données manquantes, invalides et valides (<, =0, > totalRetail)
  const mixedSummary = computeSalesNetSummary([
    missingOrder, // cat 40000 (hors périmètre valide)
    zeroOrder,    // cat 25000, net 0
    lowerOrder,   // cat 40000, net 32000
    higherOrder,  // cat 10000, net 15000 (non plafonné)
    negativeOrder, // cat 20000 (invalide, hors somme)
    nanOrder,      // cat 20000 (invalide, hors somme)
    strOrder,      // cat 20000 (invalide, hors somme)
  ]);
  assert.equal(mixedSummary.totalOrdersCount, 7);
  assert.equal(mixedSummary.totalCatalogRevenue, 175000);
  assert.equal(mixedSummary.validAmountOrdersCount, 3);
  assert.equal(mixedSummary.missingAmountOrdersCount, 1);
  assert.equal(mixedSummary.invalidAmountOrdersCount, 3);
  assert.equal(mixedSummary.netRecordedTotal, 47000); // 0 + 32000 + 15000
  assert.equal(mixedSummary.coveredCatalogRevenue, 75000); // 25000 + 40000 + 10000 uniquement
  assert.equal(mixedSummary.orderLevelGap, 28000); // 75000 - 47000

  // Cas particulier : supplément uniquement -> écart négatif exact sur le même périmètre
  const supplementOnly = computeSalesNetSummary([higherOrder, missingOrder]);
  assert.equal(supplementOnly.validAmountOrdersCount, 1);
  assert.equal(supplementOnly.coveredCatalogRevenue, 10000);
  assert.equal(supplementOnly.netRecordedTotal, 15000);
  assert.equal(supplementOnly.orderLevelGap, -5000);

  // 8. Absence totale de montant valide -> null ("Données insuffisantes"), jamais 0 supposé
  const noValidSummary = computeSalesNetSummary([missingOrder, negativeOrder, infOrder]);
  assert.equal(noValidSummary.totalOrdersCount, 3);
  assert.equal(noValidSummary.totalCatalogRevenue, 80000);
  assert.equal(noValidSummary.validAmountOrdersCount, 0);
  assert.equal(noValidSummary.missingAmountOrdersCount, 1);
  assert.equal(noValidSummary.invalidAmountOrdersCount, 2);
  assert.equal(noValidSummary.coveredCatalogRevenue, 0);
  assert.equal(noValidSummary.netRecordedTotal, null);
  assert.equal(noValidSummary.orderLevelGap, null);
});

test('buildSalesCsvExport propose nominatif complet, anonymisé sans PII, et signale montants manquants/invalides sans plafonner', () => {
  const customers = new Map<string, Customer>([
    [
      'cust_secret_1',
      makeCustomer({
        id: 'cust_secret_1',
        name: 'Marie-Claire Nzaba',
        phone: '+242 06 999 8877',
        email: 'marie.nzaba@secret.cg',
        address: '14 Rue Moungali',
        ville: 'Brazzaville',
      }),
    ],
  ]);

  const orders: Order[] = [
    makeOrder({
      id: 'ord_1',
      customerId: 'cust_secret_1',
      customerName: 'Marie-Claire Nzaba',
      status: 'PAYE',
      totalRetail: 40000,
      amountPaid: 45000, // > totalRetail : conservé sans plafonnement
      refCommande: 'CMD-001',
      refPaiement: 'TX-AIRTEL-069998877',
      notes: 'Livrer chez Marie-Claire au 069998877',
      items: [
        { productId: 'p1', productName: 'Aloe Vera Gel', quantity: 2, unitPrice: 20000, unitCC: 0.1, isDiscounted: false },
      ],
    }),
    makeOrder({
      id: 'ord_2',
      customerId: 'cust_secret_1',
      customerName: 'Marie-Claire Nzaba',
      status: 'VALIDATED',
      totalRetail: 40000,
      amountPaid: undefined, // manquant : "Non renseigné"
      refCommande: 'CMD-002',
    }),
    makeOrder({
      id: 'ord_3',
      customerId: 'cust_secret_1',
      customerName: 'Marie-Claire Nzaba',
      status: 'VALIDATED',
      totalRetail: 40000,
      amountPaid: -100, // invalide : "Invalide"
      refCommande: 'CMD-003',
    }),
    makeOrder({
      id: 'ord_cancelled',
      customerId: 'cust_secret_1',
      customerName: 'Marie-Claire Nzaba',
      status: 'CANCELLED',
      refCommande: 'CMD-CANCELLED',
    }),
  ];

  const nom = buildSalesCsvExport(orders, { mode: 'nominatif', customersById: customers });
  assert.equal(nom.orderCount, 3);
  assert.match(nom.csv, /Montant net enregistré \(FCFA\)/);
  assert.doesNotMatch(nom.csv, /Encaissé commande/);
  assert.match(nom.csv, /"45000"/);
  assert.match(nom.csv, /"Non renseigné"/);
  assert.match(nom.csv, /"Invalide"/);
  assert.match(nom.csv, /Marie-Claire Nzaba/);
  assert.match(nom.csv, /\+242 06 999 8877/);
  assert.match(nom.csv, /marie\.nzaba@secret\.cg/);
  assert.match(nom.csv, /Brazzaville/);
  assert.doesNotMatch(nom.csv, /CMD-CANCELLED/);

  const anon = buildSalesCsvExport(orders, { mode: 'anonymise', customersById: customers });
  assert.equal(anon.orderCount, 3);
  assert.equal(anon.clientCount, 1);
  assert.match(anon.csv, /Client #001/);
  assert.match(anon.csv, /Aloe Vera Gel/);
  assert.match(anon.csv, /CMD-001/);
  assert.match(anon.csv, /Montant net enregistré \(FCFA\)/);
  for (const pii of [
    'Marie-Claire Nzaba',
    '06 999 8877',
    '069998877',
    'marie.nzaba@secret.cg',
    'Brazzaville',
    'Moungali',
    'TX-AIRTEL',
    'cust_secret_1',
  ]) {
    assert.equal(anon.csv.includes(pii), false, `PII détectée en export anonymisé : ${pii}`);
  }
});

test('Clients directs et conversions historiques ambiguës exclus de la cohorte ; conversions traçables et taux par cohorte exacts', () => {
  const today = '2026-11-20';
  const customers: Customer[] = [
    // 1. Conversion réelle traçable depuis ProspectsView
    makeCustomer({
      id: 'c_converted_traceable',
      status: CustomerStatus.CLIENT,
      pipelineStage: 'CLOSED_WON',
      recordOrigin: 'PROSPECTION',
      convertedFromProspect: true,
      sourceProspection: 'META_ADS',
      createdAt: '2026-11-05',
      lastContactDate: '2026-11-10',
    }),
    // 2. Client créé directement dans ClientsView -> NE DOIT PAS compter comme prospect converti
    makeCustomer({
      id: 'c_direct_client',
      status: CustomerStatus.CLIENT,
      pipelineStage: 'CLOSED_WON',
      recordOrigin: 'DIRECT_CLIENT',
      sourceProspection: 'RECOMMANDATION',
      createdAt: '2026-11-12',
      lastContactDate: '2026-11-12',
    }),
    // 3. Ancien CLIENT historique sans traçabilité -> non attribuable, jamais inventé
    makeCustomer({
      id: 'c_historical_ambiguous',
      status: CustomerStatus.CLIENT,
      pipelineStage: 'CLOSED_WON',
      sourceProspection: 'META_ADS',
      createdAt: '2026-11-02',
      lastContactDate: '2026-11-02',
    }),
    // 4. Prospect actif
    makeCustomer({
      id: 'c_active_meta',
      status: CustomerStatus.PROSPECT,
      pipelineStage: 'PRESENTATION_DONE',
      recordOrigin: 'PROSPECTION',
      sourceProspection: 'META_ADS',
      createdAt: '2026-11-18',
      lastContactDate: '2026-11-19',
    }),
    // 5. Prospect actif stagnant (sans recordOrigin explicite, car ancien prospect encore PROSPECT)
    makeCustomer({
      id: 'c_stagnant_reco',
      status: CustomerStatus.PROSPECT,
      pipelineStage: 'FOLLOW_UP_REQUIRED',
      sourceProspection: 'RECOMMANDATION',
      createdAt: '2026-11-01',
      lastContactDate: '2026-11-05', // 15 jours -> stagnant (>= 7j)
    }),
    // 6. Prospect perdu hors fenêtre 30 jours (cohorte antérieure)
    makeCustomer({
      id: 'c_lost_old',
      status: CustomerStatus.PROSPECT,
      pipelineStage: 'CLOSED_LOST',
      sourceProspection: 'EVENEMENT',
      createdAt: '2026-10-01',
      lastContactDate: '2026-10-05',
    }),
  ];

  assert.equal(classifyCustomerForProspection(customers[0]), 'CONVERTED_PROSPECT');
  assert.equal(classifyCustomerForProspection(customers[1]), 'DIRECT_CLIENT');
  assert.equal(classifyCustomerForProspection(customers[2]), 'HISTORICAL_UNATTRIBUTED_CLIENT');

  // Sur toute la base ('all') : 4 membres de cohorte (c_converted_traceable, c_active_meta, c_stagnant_reco, c_lost_old)
  // Ni c_direct_client ni c_historical_ambiguous ne gonflent le taux de conversion.
  const kpisAll = computeProspectionOverviewKpis(customers, [], 'all', today);
  assert.equal(kpisAll.totalProspects, 4);
  assert.equal(kpisAll.convertedCount, 1);
  assert.equal(kpisAll.conversionRatePct, 25);
  assert.equal(kpisAll.unattributedHistoricalClientsCount, 1);
  assert.equal(kpisAll.respondedCount, null);
  assert.equal(kpisAll.responseRatePct, null);

  // Sur la cohorte des 30 derniers jours ('30') : 3 membres inscrits entre 2026-10-22 et 2026-11-20
  const kpis30 = computeProspectionOverviewKpis(customers, [], '30', today);
  assert.equal(kpis30.totalProspects, 3);
  assert.equal(kpis30.convertedCount, 1);
  assert.ok(Math.abs((kpis30.conversionRatePct ?? 0) - 33.3333333) < 1e-4);
  assert.equal(kpis30.newRegistrationsHint, 'inscrits sur la période');

  // Si la base ne contient que des clients directs ou historiques ambigus -> Données insuffisantes (null)
  const kpisOnlyDirectAndLegacy = computeProspectionOverviewKpis(
    [customers[1], customers[2]],
    [],
    'all',
    today,
  );
  assert.equal(kpisOnlyDirectAndLegacy.totalProspects, 0);
  assert.equal(kpisOnlyDirectAndLegacy.convertedCount, 0);
  assert.equal(kpisOnlyDirectAndLegacy.conversionRatePct, null);
  assert.equal(kpisOnlyDirectAndLegacy.unattributedHistoricalClientsCount, 1);

  // Sources d'acquisition sur la cohorte 30 jours :
  // RECOMMANDATION a 1 prospect actif (c_stagnant_reco) et 0 converti (c_direct_client exclu !)
  const sources30 = computeAcquisitionSourceStats(customers, '30', today);
  const meta = sources30.find((s) => s.source === 'META_ADS')!;
  const reco = sources30.find((s) => s.source === 'RECOMMANDATION')!;
  const bouche = sources30.find((s) => s.source === 'BOUCHE_OREILLE')!;

  assert.equal(meta.totalCount, 2);
  assert.equal(meta.convertedCount, 1);
  assert.equal(meta.conversionRatePct, 50);
  assert.equal(meta.rank, 1);
  assert.equal(reco.totalCount, 1);
  assert.equal(reco.convertedCount, 0);
  assert.equal(reco.conversionRatePct, 0);
  assert.equal(bouche.totalCount, 0);
  assert.equal(bouche.conversionRatePct, null);
  assert.equal(bouche.rank, null);

  const funnelAll = computeConversionFunnel(customers, 'all', today, 7);
  assert.equal(funnelAll.totalInScope, 4);
  assert.equal(funnelAll.convertedCount, 1);
  assert.equal(funnelAll.lostCount, 1);
  assert.equal(funnelAll.stagnatingProspects.length, 1);
  assert.equal(funnelAll.stagnatingProspects[0].customer.id, 'c_stagnant_reco');
  assert.equal(funnelAll.stagnatingProspects[0].daysSinceLastContact, 15);
});

test('Rapprochement Agenda : priorité customerId, anciens items téléphone/nom unique, et aucune confusion entre homonymes', () => {
  const today = '2026-11-20';
  const customers: Customer[] = [
    // Deux homonymes "Jean Mbemba" avec des numéros différents
    makeCustomer({ id: 'p_jean_1', name: 'Jean Mbemba', phone: '+242 06 111 0001', status: CustomerStatus.PROSPECT, pipelineStage: 'CONTACT_INITIATED' }),
    makeCustomer({ id: 'p_jean_2', name: 'Jean Mbemba', phone: '+242 06 222 0002', status: CustomerStatus.PROSPECT, pipelineStage: 'FOLLOW_UP_REQUIRED' }),
    // Prospect unique sans doublon de nom
    makeCustomer({ id: 'p_carine', name: 'Carine L', phone: '+242 06 333 0003', status: CustomerStatus.PROSPECT, pipelineStage: 'PRESENTATION_DONE' }),
    // Prospect dont la seule relance est déjà terminée
    makeCustomer({ id: 'p_boris', name: 'Boris M', phone: '+242 06 444 0004', status: CustomerStatus.PROSPECT, pipelineStage: 'FOLLOW_UP_REQUIRED' }),
  ];

  const agenda: AgendaItem[] = [
    // 1. Tâche récente liée explicitement par customerId à p_jean_1
    {
      id: 'ag_by_id',
      title: 'Relance ciblée Jean 1',
      date: '2026-11-22',
      time: '09:00',
      type: 'FOLLOW_UP',
      customerId: 'p_jean_1',
      contactName: 'Jean Mbemba',
      contactPhone: '+242 06 111 0001',
      completed: false,
    },
    // 2. Ancienne tâche sans customerId, mais avec le téléphone unique de p_jean_1 (ne doit JAMAIS matcher p_jean_2)
    {
      id: 'ag_legacy_phone',
      title: 'Ancienne relance Jean 1 par tel',
      date: '2026-11-18',
      time: '10:00',
      type: 'FOLLOW_UP',
      contactName: 'Jean Mbemba',
      contactPhone: '+242 06 111 0001',
      completed: false,
    },
    // 3. Ancienne tâche ambiguë sans customerId ni téléphone, sur un nom porté par 2 clients -> aucune association auto
    {
      id: 'ag_ambiguous_homonym',
      title: 'Relance Jean Mbemba sans tél',
      date: '2026-11-21',
      time: '14:00',
      type: 'FOLLOW_UP',
      contactName: 'Jean Mbemba',
      completed: false,
    },
    // 4. Ancienne tâche sans customerId ni téléphone, mais nom unique -> Carine L reste utilisable
    {
      id: 'ag_legacy_unique_name',
      title: 'Relancer Carine L',
      date: '2026-11-20',
      time: '15:00',
      type: 'FOLLOW_UP',
      contactName: 'Carine L',
      completed: false,
    },
    // 5. Ancienne tâche terminée dans le passé -> ne doit jamais être comptée en retard
    {
      id: 'ag_completed_past',
      title: 'Ancienne relance terminée',
      date: '2026-11-10',
      time: '10:00',
      type: 'FOLLOW_UP',
      contactName: 'Boris M',
      contactPhone: '+242 06 444 0004',
      completed: true,
    },
  ];

  // Résolutions directes
  assert.equal(resolveAgendaItemCustomer(agenda[0], customers)?.id, 'p_jean_1');
  assert.equal(resolveAgendaItemCustomer(agenda[1], customers)?.id, 'p_jean_1');
  assert.equal(resolveAgendaItemCustomer(agenda[2], customers), null); // Homonyme sans téléphone -> pas d'association
  assert.equal(resolveAgendaItemCustomer(agenda[3], customers)?.id, 'p_carine');

  const summary = computeFollowUpSummary(customers, agenda, today);
  assert.equal(summary.overdueCount, 1);
  assert.equal(summary.overdueItems[0].item.id, 'ag_legacy_phone');
  assert.equal(summary.overdueItems[0].matchedCustomer?.id, 'p_jean_1');
  assert.equal(summary.todayCount, 1);
  assert.equal(summary.todayItems[0].matchedCustomer?.id, 'p_carine');
  assert.equal(summary.scheduledCount, 2);
  assert.equal(summary.completedCount, 1); // ag_completed_past jamais en retard

  // p_jean_2 (homonyme avec téléphone différent) et p_boris (tâche déjà terminée)
  // doivent tous deux figurer dans "Sans prochaine action" !
  const missingIds = summary.prospectsWithoutNextAction.map((p) => p.id).sort();
  assert.deepEqual(missingIds, ['p_boris', 'p_jean_2']);
});

