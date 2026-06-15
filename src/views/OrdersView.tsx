import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Card } from '../components/ui/Card';
import { Drawer } from '../components/ui/Drawer';
import { Order, OrderStatus, Product, GRADES, CustomerStatus, OrderItem } from '../types';
import { 
  ShoppingBag, 
  Plus, 
  Trash2, 
  Printer, 
  UserCheck, 
  FileText, 
  Layers, 
  CheckCircle,
  Clock,
  XCircle,
  Percent,
  Search,
  ShoppingCart,
  ChevronRight,
  Download
} from 'lucide-react';

export const OrdersView: React.FC = () => {
  const { orders, customers, products, addOrder, updateOrder, deleteOrder, profile } = useStore();

  // Dialog / State controllers
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Filter lists
  const [statusFilter, setStatusFilter] = useState<'ALL' | OrderStatus>('ALL');

  // NEW ORDER DRAFT STATE
  const [orderCustomer, setOrderCustomer] = useState('');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [isCustomerSuggestionsOpen, setIsCustomerSuggestionsOpen] = useState(false);

  const [applyDiscount, setApplyDiscount] = useState(false);
  const [discountPercent, setDiscountPercent] = useState(5);

  const [orderFormError, setOrderFormError] = useState<string | null>(null);
  const [productSearchError, setProductSearchError] = useState<string | null>(null);

  // Cart elements for new FLP Order
  const [invoiceItems, setInvoiceItems] = useState<{ product: Product; quantity: number }[]>([]);

  // Top Product autocomplete search Bar state
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [isProductSuggestionsOpen, setIsProductSuggestionsOpen] = useState(false);

  const filteredOrders = orders.filter(o => {
    if (statusFilter === 'ALL') return true;
    return o.status === statusFilter;
  });

  // Calculate prices based on FBO profile grade & discount logic
  const currentGrade = GRADES.find(g => g.code === profile.grade) || GRADES[1]; // default Animateur (38%)

  // Helper to add or increment item in order
  const handleAddProductToOrder = (prod: Product) => {
    const existsIndex = invoiceItems.findIndex(item => item.product.id === prod.id);
    if (existsIndex >= 0) {
      const updated = [...invoiceItems];
      updated[existsIndex].quantity += 1;
      setInvoiceItems(updated);
    } else {
      setInvoiceItems([{ product: prod, quantity: 1 }, ...invoiceItems]);
    }
    setProductSearchQuery('');
    setIsProductSuggestionsOpen(false);
  };

  const handleRemoveItemSlot = (index: number) => {
    const updated = [...invoiceItems];
    updated.splice(index, 1);
    setInvoiceItems(updated);
  };

  const handleItemQtyChange = (index: number, qty: number) => {
    const updated = [...invoiceItems];
    updated[index].quantity = Math.max(1, qty);
    setInvoiceItems(updated);
  };

  // Submit Draft
  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderCustomer) {
      setOrderFormError('Veuillez sélectionner un client.');
      return;
    }

    if (invoiceItems.length === 0) {
      setOrderFormError('Veuillez ajouter au moins un produit à la commande.');
      return;
    }

    setOrderFormError(null);

    const selectedCust = customers.find(c => c.id === orderCustomer);
    if (!selectedCust) return;

    // Build the list of order items
    const parsedItems: OrderItem[] = invoiceItems.map(item => {
      // Recalculate based on custom discount from 5% to 15% (which reduces Retail price, or margin accordingly)
      const retailPrice = item.product.prixRetail;
      const appliedPrice = applyDiscount ? retailPrice * (1 - discountPercent / 100) : retailPrice;

      return {
        productId: item.product.id,
        productName: item.product.name,
        quantity: item.quantity,
        unitPrice: Math.round(appliedPrice),
        unitCC: item.product.unitCC,
        isDiscounted: applyDiscount
      };
    });

    const totalRetail = parsedItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    const totalCC = parsedItems.reduce((sum, item) => sum + (item.unitCC * item.quantity), 0);

    // Marge FLP is calculated based on FBO Grade Discount on true retail price.
    // Cost = total True Retail * (1 - grade discount rate). The buy cost is fixed regardless of discounts granted.
    const totalTrueRetail = invoiceItems.reduce((sum, item) => sum + (item.product.prixRetail * item.quantity), 0);
    const totalCost = totalTrueRetail * (1 - currentGrade.tauxRemise);
    const totalMargin = totalRetail - totalCost;

    addOrder({
      customerId: selectedCust.id,
      customerName: selectedCust.name,
      date: new Date().toISOString().split('T')[0],
      items: parsedItems,
      status: OrderStatus.PENDING,
      totalRetail,
      totalCost: Math.round(totalCost),
      totalMargin: Math.round(totalMargin),
      totalCC,
      discountPercent: applyDiscount ? discountPercent : undefined
    });

    // Reset Form
    setOrderCustomer('');
    setCustomerSearchQuery('');
    setApplyDiscount(false);
    setDiscountPercent(5);
    setInvoiceItems([]);
    setOrderFormError(null);
    setIsNewOrderOpen(false);
  };

  const handleUpdateStatus = (ord: Order, nextStatus: OrderStatus) => {
    const updatedOrd = { ...ord, status: nextStatus };
    updateOrder(updatedOrd);
    
    if (selectedOrder && selectedOrder.id === ord.id) {
      setSelectedOrder(updatedOrd);
    }
  };

  // Printable Invoice controller
  const handlePrint = () => {
    // Masquer temporairement le contenu de la page principale pour eviter la duplication a l impression
    // Le canvas de facture est dans le Drawer, le reste de la page doit etre invisible
    const mainContainer = document.getElementById('orders_view_container');
    const drawerPanel = document.getElementById('app_drawer_panel');
    
    if (mainContainer) mainContainer.style.visibility = 'hidden';
    // S assurer que le Drawer et son contenu restent visibles via le CSS print
    
    const afterPrint = () => {
      if (mainContainer) mainContainer.style.visibility = '';
      window.removeEventListener('afterprint', afterPrint);
    };
    window.addEventListener('afterprint', afterPrint);
    window.print();
  };

  const handleExportOrdersCSV = () => {
    // Columns headers
    const headers = ['Ref Commande', 'Date', 'Nom Client', 'Statut', 'Articles', 'Sous-Total Brut (FCFA)', 'Marge Directe (FCFA)', 'Volume (CC)'];
    
    // Rows
    const rows = [...orders]
      .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map(o => {
        const itemsStr = o.items.map(it => `${it.quantity}x ${it.productName}`).join(' | ');
        const statusLabel = o.status === OrderStatus.VALIDATED ? 'VALIDÉE' : o.status === OrderStatus.PENDING ? 'EN ATTENTE' : 'ANNULÉE';
        return [
          o.id,
          o.date,
          o.customerName,
          statusLabel,
          itemsStr,
          o.totalRetail,
          o.totalMargin,
          o.totalCC
        ];
      });
      
    // Build CSV Content
    // Excel-friendly UTF-8 BOM + semicolon-separated values
    const csvContent = "\uFEFF" + 
      [headers, ...rows]
        .map(row => row.map(val => {
          const str = String(val ?? '').replace(/"/g, '""');
          return `"${str}"`;
        }).join(';'))
        .join('\n');
        
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `commandes_fbo_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6" id="orders_view_container">
      
      {/* 1. Header with Add Command Action */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Commandes & Facturation</h2>
          <p className="text-xs text-slate-500">Création instantanée de bons d’achat pour votre réseau.</p>
        </div>
        <button
          onClick={() => setIsNewOrderOpen(true)}
          className="py-3 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-2xl active:scale-95 transition-all flex items-center gap-2 shrink-0 h-12"
          id="order_add_btn"
        >
          <Plus className="w-4 h-4" />
          CRÉER UN BON DE VENTE
        </button>
      </div>

      {/* 2. Filter tabs for orders */}
      <div className="flex gap-2 bg-white dark:bg-[#1f1f22] p-1 border border-slate-200 dark:border-slate-800 rounded-2xl" id="orders_filter_group">
        {(['ALL', OrderStatus.PENDING, OrderStatus.VALIDATED, OrderStatus.CANCELLED] as const).map(f => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`flex-1 py-2 text-center text-xs font-bold rounded-xl transition-all h-9 cursor-pointer ${
              statusFilter === f
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
            }`}
          >
            {f === 'ALL' ? 'Tout' : f === OrderStatus.PENDING ? 'En Attente' : f === OrderStatus.VALIDATED ? 'Validée' : 'Annulée'}
          </button>
        ))}
      </div>

      {/* Export Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-2">
        <span className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-left">
          Registre des Commandes ({filteredOrders.length})
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportOrdersCSV}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            title="Exporter tout l'historique en CSV (Excel)"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Exporter Excel
          </button>
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            title="Imprimer le Registre de Ventes PDF"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            Rapport PDF
          </button>
        </div>
      </div>

      {/* 3. Cards representing orders */}
      <div className="space-y-3" id="orders_mapping_area">
        {filteredOrders.length === 0 ? (
          <Card className="text-center py-10">
            <p className="text-sm text-slate-400">Aucune commande enregistrée dans cette catégorie.</p>
          </Card>
        ) : (
          filteredOrders.map(ord => (
            <Card
              key={ord.id}
              className="hoverable active:scale-98 flex items-center justify-between gap-3 text-left p-4 rounded-3xl"
              onClick={() => {
                setSelectedOrder(ord);
                setIsDetailOpen(true);
              }}
              id={`order_card_${ord.id}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] text-slate-400 font-bold">{ord.date}</span>
                  <span className={`text-[8px] font-extrabold uppercase px-2 py-0.5 rounded ${
                    ord.status === OrderStatus.VALIDATED 
                      ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400' 
                      : ord.status === OrderStatus.PENDING 
                        ? 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400' 
                        : 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400'
                  }`}>
                    {ord.status === 'VALIDATED' ? 'Facturé' : ord.status === 'PENDING' ? 'Brouillon' : 'Annulé'}
                  </span>
                  {ord.synced === false && (
                    <span className="text-[8px] font-black uppercase py-0.5 px-1.5 rounded bg-red-100 text-red-600 dark:bg-red-950/70 dark:text-red-400 border border-red-200/30 tracking-wider flex items-center gap-1 select-none animate-pulse" title="Créé hors-ligne. En attente de synchronisation.">
                      <span className="w-1 h-1 bg-red-500 rounded-full" />
                      Hors-ligne
                    </span>
                  )}
                </div>

                <h3 className="font-bold text-slate-950 dark:text-slate-100 text-base mt-1 truncate">
                  {ord.customerName}
                </h3>

                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {ord.items.length} produit(s) • <span className="font-bold text-blue-500">{ord.totalCC.toFixed(3)} CC</span>
                </p>

                <div className="flex items-center gap-2 mt-1">
                  <p className="text-sm font-black text-amber-600 dark:text-amber-400">
                    {ord.totalRetail.toLocaleString()} F
                  </p>
                  {ord.status === 'VALIDATED' && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 px-1.5 py-0.5 rounded font-bold whitespace-nowrap">
                      +{ord.totalMargin.toLocaleString()} F marge
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <ChevronRight className="w-5 h-5 text-slate-300" />
              </div>
            </Card>
          ))
        )}
      </div>

      {/* 4. DRAWER: ADD ORDER BON DE VENTE */}
      <Drawer
        isOpen={isNewOrderOpen}
        onClose={() => {
          setIsNewOrderOpen(false);
          setOrderFormError(null);
        }}
        title="Créer un Bon de Vente FLP"
      >
        <form onSubmit={handleCreateOrder} className="space-y-4">
          
          {orderFormError && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 font-bold text-xs p-3.5 rounded-2xl">
              {orderFormError}
            </div>
          )}

          {/* Client Selection with Auto-Suggestion Search Bar */}
          <div className="relative">
            <label className="text-xs font-bold text-slate-500 block mb-1">Destinataire (Client) *</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Tapez le nom ou le téléphone du client..."
                value={customerSearchQuery}
                onFocus={() => setIsCustomerSuggestionsOpen(true)}
                onChange={(e) => {
                  setCustomerSearchQuery(e.target.value);
                  setIsCustomerSuggestionsOpen(true);
                  const match = customers.find(c => c.name.toLowerCase() === e.target.value.toLowerCase());
                  if (match) {
                    setOrderCustomer(match.id);
                  } else {
                    setOrderCustomer('');
                  }
                }}
                className="w-full bg-slate-50 dark:bg-[#2a2a2e] border border-slate-200 dark:border-slate-800 rounded-2xl pl-10 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 h-12 text-[#101010] dark:text-white"
                required
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-4" />
              {orderCustomer ? (
                <CheckCircle className="w-4 h-4 text-emerald-500 absolute right-3.5 top-4" />
              ) : (
                customerSearchQuery && (
                  <span className="text-[9px] text-rose-500 font-bold absolute right-3.5 top-4.5 bg-rose-50 dark:bg-rose-950 px-1 rounded">Non lié</span>
                )
              )}
            </div>

            {/* Suggestions list dropdown overlay */}
            {isCustomerSuggestionsOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setIsCustomerSuggestionsOpen(false)} 
                />
                <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white dark:bg-[#2a2a2e] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 divide-y divide-slate-100 dark:divide-slate-800 animate-in fade-in slide-in-from-top-1 duration-150">
                  {customers
                    .filter(c => 
                      c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) || 
                      c.phone.includes(customerSearchQuery)
                    )
                    .map(cust => (
                      <button
                        key={cust.id}
                        type="button"
                        onClick={() => {
                          setOrderCustomer(cust.id);
                          setCustomerSearchQuery(cust.name);
                          setIsCustomerSuggestionsOpen(false);
                        }}
                        className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex flex-col cursor-pointer"
                      >
                        <span className="font-bold text-xs text-slate-900 dark:text-slate-100">{cust.name}</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">{cust.phone} • {cust.status}</span>
                      </button>
                    ))}
                  {customers.filter(c => 
                      c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) || 
                      c.phone.includes(customerSearchQuery)
                    ).length === 0 && (
                      <div className="p-3 text-xs text-slate-400 text-center font-mono">
                        Aucun client trouvé
                      </div>
                    )}
                </div>
              </>
            )}
          </div>

          {/* Custom Discount Selection (bounded strictly to 5% - 15%) */}
          <div className="bg-slate-50 dark:bg-slate-800/30 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-850 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Percent className="w-4 h-4 text-amber-500" />
                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100">Appliquer une remise client</p>
                  <p className="text-[10px] text-slate-400">Autorisé : de 5% à 15% seulement</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={applyDiscount}
                onChange={(e) => {
                  setApplyDiscount(e.target.checked);
                  if (e.target.checked) {
                    setDiscountPercent(5); // Default to minimum 5%
                  }
                }}
                className="w-5 h-5 rounded accent-amber-500 cursor-pointer"
              />
            </div>

            {applyDiscount && (
              <div className="space-y-2 pt-2 border-t border-slate-200/40 dark:border-slate-800/60 animate-in fade-in duration-200">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 font-medium">Pourcentage de remise</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="5"
                      max="15"
                      value={discountPercent}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 5;
                        setDiscountPercent(Math.min(15, Math.max(5, val)));
                      }}
                      className="w-12 bg-white dark:bg-[#1f1f22] border border-slate-200 dark:border-slate-800 rounded-lg py-1 px-1.5 text-xs font-bold text-center text-amber-600 dark:text-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    <span className="text-xs font-bold text-slate-500">%</span>
                  </div>
                </div>

                {/* Range Bar strictly limited between 5% and 15% */}
                <input
                  type="range"
                  min="5"
                  max="15"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(parseInt(e.target.value))}
                  className="w-full accent-amber-500 h-1.5 bg-slate-200 dark:bg-slate-750 rounded-lg appearance-none cursor-pointer"
                />

                <div className="flex justify-between text-[9px] text-slate-400 font-bold px-1 font-mono">
                  <span>Remise min: 5%</span>
                  <span>Remise max: 15%</span>
                </div>
              </div>
            )}
          </div>

          {/* Unified Product Search Bar with a "+" / "Ajouter" Button next to it */}
          <div className="space-y-2">
            <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block">Ajouter des Produits</label>
            
            {productSearchError && (
              <div className="text-rose-500 text-[11px] font-bold px-1 py-1 bg-rose-500/10 border border-rose-500/20 rounded-lg animate-in fade-in duration-100">
                ⚠ {productSearchError}
              </div>
            )}

            <div className="flex gap-2 items-center relative">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Rechercher par nom ou code de produit..."
                  value={productSearchQuery}
                  onFocus={() => setIsProductSuggestionsOpen(true)}
                  onChange={(e) => {
                    setProductSearchQuery(e.target.value);
                    setIsProductSuggestionsOpen(true);
                    setProductSearchError(null);
                  }}
                  className="w-full bg-slate-50 dark:bg-[#2a2a2e] border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-800 dark:text-white h-10 font-sans"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                {productSearchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setProductSearchQuery('');
                      setProductSearchError(null);
                    }}
                    className="absolute right-3 top-3 text-[10px] text-slate-400 font-bold hover:text-slate-600 cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Add button (+) right next to the search bar */}
              <button
                type="button"
                onClick={() => {
                  const query = productSearchQuery.toLowerCase().trim();
                  const matched = products.filter(p => 
                    p.name.toLowerCase().includes(query) ||
                    p.id.includes(query)
                  );
                  if (matched.length > 0) {
                    handleAddProductToOrder(matched[0]);
                    setProductSearchError(null);
                  } else if (products.length > 0 && !query) {
                    setProductSearchError("Veuillez d'abord taper le nom ou le code du produit à chercher.");
                  } else {
                    setProductSearchError("Aucun produit ne correspond à cette recherche.");
                  }
                }}
                className="h-10 px-4 bg-amber-500 hover:bg-amber-600 transition-colors text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shrink-0 active:scale-95 cursor-pointer shadow-md shadow-amber-500/10"
                title="Ajouter le produit correspondant"
              >
                <Plus className="w-4 h-4 text-white" />
                <span>Ajouter</span>
              </button>

              {/* Autocomplete Suggestions Popover */}
              {isProductSuggestionsOpen && productSearchQuery && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsProductSuggestionsOpen(false)} 
                  />
                  <div className="absolute left-0 right-0 top-11 max-h-56 overflow-y-auto bg-white dark:bg-[#202023] border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 divide-y divide-slate-100 dark:divide-slate-800 animate-in fade-in duration-100">
                    {products
                       .filter(p => 
                         p.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
                         p.id.includes(productSearchQuery)
                       )
                       .map(p => (
                         <button
                           key={p.id}
                           type="button"
                           onClick={() => handleAddProductToOrder(p)}
                           className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-center justify-between gap-2 cursor-pointer"
                         >
                           <div className="flex flex-col min-w-0">
                             <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">{p.name}</span>
                             <span className="text-[10px] text-slate-500 font-medium">Code: {p.id} • {p.unitCC.toFixed(3)} CC</span>
                           </div>
                           <span className="text-xs font-black text-amber-600 shrink-0">{p.prixRetail.toLocaleString()} F</span>
                         </button>
                       ))}
                     {products.filter(p => 
                       p.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
                       p.id.includes(productSearchQuery)
                     ).length === 0 && (
                       <div className="p-3 text-xs text-slate-400 text-center font-mono">
                         Aucun produit correspondant
                       </div>
                     )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Selected Products List */}
          <div className="space-y-2 mt-3">
            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Produits ajoutés à la facture ({invoiceItems.length})</h4>
            
            {invoiceItems.length === 0 ? (
              <div className="p-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center space-y-2 bg-slate-50/50 dark:bg-slate-900/10">
                <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800/60 rounded-full flex items-center justify-center mx-auto text-slate-400">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-extrabold text-slate-500">Panier vide</p>
                  <p className="text-[10px] text-slate-400">Utilisez la barre ci-dessus pour chercher et ajouter des produits.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {invoiceItems.map((slot, index) => {
                  const itemPrice = applyDiscount ? slot.product.prixRetail * (1 - discountPercent / 100) : slot.product.prixRetail;

                  return (
                    <div 
                      key={index} 
                      className="p-3 rounded-2xl border border-slate-105 dark:border-slate-800 bg-white dark:bg-[#1a1a1d] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm hover:shadow-md"
                    >
                      <div className="min-w-0 w-full sm:flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[9px] font-bold text-amber-500 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded font-mono">
                            Code {slot.product.id}
                          </span>
                          <span className="text-[9px] font-bold text-blue-500 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.2 rounded font-mono">
                            {(slot.product.unitCC * slot.quantity).toFixed(3)} CC
                          </span>
                        </div>
                        <h4 className="font-extrabold text-[12px] text-slate-800 dark:text-slate-100 leading-tight mt-1 truncate" title={slot.product.name}>
                          {slot.product.name}
                        </h4>
                        <div className="text-[10px] text-slate-400 mt-0.5 font-sans">
                          <span>{Math.round(itemPrice).toLocaleString()} F Unit.</span>
                          {applyDiscount && (
                            <span className="text-emerald-500 font-bold ml-1">
                              (-{discountPercent}%) <span className="line-through text-slate-300 dark:text-slate-600 font-normal">{slot.product.prixRetail.toLocaleString()} F</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Quantity editors & Delete Button on same flex row */}
                      <div className="flex items-center justify-end gap-2 shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
                        {/* Minus/Plus Counters */}
                        <div className="flex items-center bg-amber-100 dark:bg-amber-900/40 p-1 rounded-xl">
                          <button
                            type="button"
                            onClick={() => {
                              if (slot.quantity > 1) {
                                handleItemQtyChange(index, slot.quantity - 1);
                              } else {
                                handleRemoveItemSlot(index);
                              }
                            }}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-amber-950 text-amber-600 dark:text-amber-400 font-extrabold hover:bg-amber-50 dark:hover:bg-amber-900 transition-colors text-lg cursor-pointer shadow-sm active:scale-90"
                          >
                            -
                          </button>
                          
                          <span className="w-8 text-center text-xs font-black text-amber-900 dark:text-amber-100 font-mono">
                            {slot.quantity}
                          </span>

                          <button
                            type="button"
                            onClick={() => {
                              handleItemQtyChange(index, slot.quantity + 1);
                            }}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-amber-950 text-amber-600 dark:text-amber-400 font-extrabold hover:bg-amber-50 dark:hover:bg-amber-900 transition-colors text-lg cursor-pointer shadow-sm active:scale-90"
                          >
                            +
                          </button>
                        </div>

                        {/* Trash Button */}
                        <button
                          type="button"
                          onClick={() => handleRemoveItemSlot(index)}
                          className="min-w-[48px] min-h-[48px] flex items-center justify-center rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 text-rose-500 hover:text-rose-600 transition-colors cursor-pointer shrink-0 border border-transparent hover:border-rose-200 dark:hover:border-rose-900/40"
                          title="Supprimer ce produit"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Live Preview stats */}
          <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30 rounded-2xl text-xs space-y-1 font-sans">
            <div className="flex justify-between">
              <span className="text-slate-400 font-bold">Total Brut Retail:</span>
              <span className="text-slate-800 dark:text-slate-200 font-bold">
                {invoiceItems.reduce((acc, slot) => acc + (slot.product.prixRetail * slot.quantity), 0).toLocaleString()} F
              </span>
            </div>
            {applyDiscount && (
              <div className="flex justify-between text-emerald-600 font-bold">
                <span>Remise Appliquée ({discountPercent}%):</span>
                <span>
                  -{Math.round(invoiceItems.reduce((acc, slot) => acc + (slot.product.prixRetail * slot.quantity), 0) * (discountPercent / 100)).toLocaleString()} F
                </span>
              </div>
            )}
            <div className="flex justify-between border-t border-amber-200/50 dark:border-amber-800/20 pt-2 mt-1">
              <span className="text-slate-400 font-bold">Total CC Accumulé:</span>
              <span className="text-blue-500 font-black">
                {invoiceItems.reduce((acc, slot) => acc + (slot.product.unitCC * slot.quantity), 0).toFixed(3)} CC
              </span>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-2xl shadow-lg active:scale-95 transition-all text-sm mt-4"
          >
            CONFIRMER LE BON DE COMMANDE
          </button>
        </form>
      </Drawer>

      {/* 5. DRAWER: DETAILED ORDER BON DE VENTE & PRINTABLE INVOICE SHEET */}
      <Drawer
        isOpen={isDetailOpen && selectedOrder !== null}
        onClose={() => {
          setIsDetailOpen(false);
          setShowDeleteConfirm(false);
        }}
        title="Facturation et Suivi de Vente"
      >
        {selectedOrder && (
          <div className="space-y-6">
            
            {/* 5.1 Status stepper bar */}
            <div className="space-y-2">
              <h4 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-left">
                Statut de Livraison
              </h4>
              <div className="flex items-center gap-2">
                {/* 1. Draft */}
                <div className="flex-1 text-center">
                  <div className={`p-1.5 rounded-xl mx-auto flex items-center justify-center font-bold text-xs ${
                    selectedOrder.status === 'PENDING' || selectedOrder.status === 'VALIDATED'
                      ? 'bg-amber-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                  }`}>
                    <Clock className="w-4 h-4" />
                  </div>
                  <span className="text-[9px] font-bold text-slate-400 block mt-1">En attente</span>
                </div>

                {/* Arrow */}
                <div className="w-4 h-0.5 bg-slate-200 dark:bg-slate-800" />

                {/* 2. Validated / Billed */}
                <div className="flex-1 text-center">
                  <div className={`p-1.5 rounded-xl mx-auto flex items-center justify-center font-bold text-xs ${
                    selectedOrder.status === 'VALIDATED'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                  }`}>
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <span className="text-[9px] font-bold text-slate-400 block mt-1">Livré & Marge</span>
                </div>
              </div>
            </div>

            {/* Change Status Switchers */}
            <div className="flex gap-2">
              {selectedOrder.status === 'PENDING' && (
                <button
                  onClick={() => handleUpdateStatus(selectedOrder, OrderStatus.VALIDATED)}
                  className="flex-1 py-3 px-2 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold rounded-2xl text-xs active:scale-95 transition-all"
                >
                  Valider la Livraison & percevoir la Marge
                </button>
              )}
              {selectedOrder.status !== 'CANCELLED' && (
                <button
                  onClick={() => handleUpdateStatus(selectedOrder, OrderStatus.CANCELLED)}
                  className="py-3 px-3 bg-red-100 text-red-600 hover:bg-red-200 font-extrabold rounded-2xl text-xs active:scale-95 transition-all"
                  title="Annuler Commande"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Printable Frame Area (Professionally Styled for PDF/Print) */}
            <div 
              className="border border-slate-200 rounded-lg p-10 bg-white text-slate-900 shadow-sm print:shadow-none print:border-none print:p-0 print:m-0 mx-auto" 
              id="invoice_printable_canvas"
              style={{ width: '100%', maxWidth: '600px' }}
            >
              
              {/* Header: Brand & Title */}
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-8">
                <div className="space-y-1">
                  <h1 className="text-3xl font-black tracking-tighter text-slate-900">FACTURE</h1>
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Référence : #{selectedOrder.id.split('_')[1]?.toUpperCase() || selectedOrder.id}</p>
                </div>
                <div className="text-right">
                  <div className="w-12 h-12 bg-amber-500 rounded-lg flex items-center justify-center ml-auto mb-2 print:bg-amber-500">
                    <ShoppingBag className="w-6 h-6 text-white" />
                  </div>
                  <h2 className="text-lg font-bold leading-none">{profile.companyName || profile.name}</h2>
                  <p className="text-[10px] font-bold text-amber-600 mt-1 uppercase tracking-wider italic">Partenaire Indépendant FLP</p>
                </div>
              </div>

              {/* Info Grid: From / To */}
              <div className="grid grid-cols-2 gap-12 mb-10 text-[11px]">
                <div>
                  <h4 className="font-extrabold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1 mb-2">Émetteur</h4>
                  <div className="space-y-0.5 text-slate-700">
                    <p className="font-bold text-slate-900">{profile.name}</p>
                    <p>{profile.companyAddress}</p>
                    <p>{profile.companyPhone}</p>
                    {profile.fboId && <p className="font-mono text-[10px] mt-1 text-slate-500">ID FBO: {profile.fboId}</p>}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-extrabold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1 mb-2">Facturé à</h4>
                  <div className="space-y-0.5 text-slate-700">
                    <p className="font-bold text-slate-900">{selectedOrder.customerName}</p>
                    <p className="italic text-slate-500">Achat validé le {selectedOrder.date}</p>
                  </div>
                </div>
              </div>

              {/* Table of items */}
              <div className="mb-10">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white text-[10px] uppercase tracking-widest">
                      <th className="py-3 px-4 rounded-tl-lg">Description du Produit</th>
                      <th className="py-3 px-2 text-center">Qté</th>
                      <th className="py-3 px-2 text-right">Prix Unit.</th>
                      <th className="py-3 px-4 text-right rounded-tr-lg">Total</th>
                    </tr>
                  </thead>
                  <tbody className="text-[11px] divide-y divide-slate-100">
                    {selectedOrder.items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-900">{it.productName}</p>
                          <p className="text-[9px] text-slate-400 font-mono">Code: {it.productId}</p>
                        </td>
                        <td className="py-3 px-2 text-center font-medium">{it.quantity}</td>
                        <td className="py-3 px-2 text-right text-slate-600">{it.unitPrice.toLocaleString()} F</td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900">{(it.unitPrice * it.quantity).toLocaleString()} F</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Calculations Block */}
              <div className="flex justify-end mb-12">
                <div className="w-64 space-y-3">
                  <div className="flex justify-between text-[11px] px-1">
                    <span className="text-slate-400 font-bold uppercase">Total Brut :</span>
                    <span className="text-slate-900 font-bold">{selectedOrder.items.reduce((sum, i) => sum + (i.unitPrice * i.quantity), 0).toLocaleString()} F</span>
                  </div>
                  
                  {selectedOrder.discountPercent && (
                    <div className="flex justify-between text-[11px] px-1 text-emerald-600">
                      <span className="font-bold uppercase tracking-tight">Remise Client ({selectedOrder.discountPercent}%) :</span>
                      <span className="font-bold italic">Inclus</span>
                    </div>
                  )}

                  <div className="flex justify-between text-[11px] px-1 border-b border-slate-100 pb-2">
                    <span className="text-slate-400 font-bold uppercase">Taxe (TVA) :</span>
                    <span className="text-slate-900 font-bold">{profile.tvaApplicable ? `${profile.tvaRate}%` : '0%'}</span>
                  </div>

                  <div className="flex justify-between items-center bg-slate-900 text-white p-4 rounded-xl">
                    <span className="text-[10px] font-black uppercase tracking-widest">NET À PAYER</span>
                    <span className="text-xl font-black">{selectedOrder.totalRetail.toLocaleString()} F</span>
                  </div>
                </div>
              </div>

              {/* Lower Section: Payment & Legal */}
              <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-200">
                {/* Bank / Mobile Payment */}
                <div className="space-y-3">
                  <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Modalités de Règlement</h5>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-[10px] space-y-2">
                    {profile.waveMoney && (
                      <div className="flex justify-between border-b border-slate-200/50 pb-1 gap-2">
                        <span className="font-bold text-slate-500">Wave Money</span>
                        <span className="text-slate-900 font-black">{profile.waveMoney}</span>
                      </div>
                    )}
                    {profile.orangeMoney && (
                      <div className="flex justify-between border-b border-slate-200/50 pb-1 gap-2">
                        <span className="font-bold text-slate-500">Orange Money</span>
                        <span className="text-slate-900 font-black">{profile.orangeMoney}</span>
                      </div>
                    )}
                    {profile.bankRIB && (
                      <div className="space-y-0.5">
                        <span className="font-bold text-slate-500 block">Coordonnées Bancaires</span>
                        <span className="text-slate-900 font-mono text-[9px] break-all">{profile.bankRIB}</span>
                      </div>
                    )}
                    {!profile.waveMoney && !profile.orangeMoney && !profile.bankRIB && (
                      <p className="italic text-slate-400 italic">Paiement au comptant (Espèces)</p>
                    )}
                  </div>
                </div>

                {/* Legal notes */}
                <div className="text-[9px] text-slate-400 space-y-2 text-right">
                  <p className="leading-relaxed">
                    Cette facture a été générée par <strong className="text-slate-600">Focus FBO</strong>. 
                    Les produits vendus sont destinés à une consommation personnelle ou revente autorisée conformément au règlement intérieur de Forever Living Products.
                  </p>
                  <p className="font-bold text-slate-500">Merci de votre confiance !</p>
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <p className="text-[8px] italic">Signé électroniquement.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* FBO Internal Data (Not Printed on Customer Invoice) */}
            {selectedOrder.status === 'VALIDATED' && (
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900/40 rounded-3xl p-4 flex items-center justify-between text-emerald-800 dark:text-emerald-400 mt-2 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Marge Nette (Bénéfice FBO)</span>
                <span className="text-sm font-black">+{selectedOrder.totalMargin.toLocaleString()} F</span>
              </div>
            )}

            {/* Print and Delete controllers */}
            <div className="flex flex-col gap-2">
              {!showDeleteConfirm ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrint}
                    className="flex-1 py-3 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-2xl text-xs flex items-center justify-center gap-2"
                  >
                    <Printer className="w-4 h-4" />
                    Imprimer / PDF
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="p-3 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-900/30 text-red-500 rounded-2xl border border-red-200 dark:border-red-900/40 cursor-pointer active:scale-95 transition-all"
                    title="Supprimer définitivement"
                    id="btn_delete_order"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 p-3 rounded-2xl flex flex-col gap-2">
                  <p className="text-[10px] font-bold text-red-600 dark:text-red-400 text-left">
                    Êtes-vous sûr de vouloir supprimer définitivement ce bon de commande ? Cette action est irréversible.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        deleteOrder(selectedOrder.id);
                        setIsDetailOpen(false);
                        setShowDeleteConfirm(false);
                      }}
                      className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
                      id="btn_delete_confirm_yes"
                    >
                      Oui, Supprimer
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="py-2 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-350 font-bold text-xs rounded-xl transition-all cursor-pointer"
                    >
                      Non
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}
      </Drawer>

      {/* 5. Hidden during normal browser session, displays purely when user executes standard PDF printable action on orders list */}
      {!isDetailOpen && (
        <div id="report_printable_canvas" className="hidden print:block p-8 bg-white text-slate-900 space-y-6 font-sans">
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-6">
            <div>
              <h1 className="text-2xl font-black tracking-tight uppercase">Registre des Commandes & Ventes</h1>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Généré le {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR')}</p>
            </div>
            <div className="text-right">
              <h2 className="text-base font-bold leading-none">{profile.companyName || profile.name}</h2>
              <p className="text-[10px] font-bold text-amber-600 mt-1 uppercase tracking-wider italic">Partenaire Indépendant FLP</p>
            </div>
          </div>

          {/* FBO Details */}
          <div className="text-xs text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-100 flex justify-between gap-4">
            <div>
              <p className="font-extrabold text-slate-900 uppercase tracking-widest text-[9px] mb-1">Coordonnées du FBO</p>
              <p className="font-bold">{profile.name}</p>
              <p className="text-slate-500">{profile.companyAddress || 'Adresse non spécifiée'}</p>
              <p className="text-slate-500">{profile.companyPhone || 'Téléphone non spécifié'}</p>
            </div>
            {profile.fboId && (
              <div className="text-right">
                <span className="font-extrabold text-slate-400 uppercase tracking-widest text-[9px] block">Identifiant Forever</span>
                <p className="font-mono font-bold text-slate-900 text-sm mt-1">{profile.fboId}</p>
              </div>
            )}
          </div>

          {/* Totals Summary */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-3 border border-slate-200 rounded-xl">
              <span className="text-[9px] font-black text-slate-400 uppercase block tracking-wider">Total de Ventes Brut</span>
              <p className="text-base font-bold text-slate-900 mt-1 font-mono">
                {orders.reduce((sum, o) => sum + (o.status === OrderStatus.CANCELLED ? 0 : o.totalRetail), 0).toLocaleString()} F
              </p>
            </div>
            <div className="p-3 border border-slate-200 rounded-xl">
              <span className="text-[9px] font-black text-slate-400 uppercase block tracking-wider">Marge Directe Estimée</span>
              <p className="text-base font-bold text-emerald-600 mt-1 font-mono">
                +{orders.reduce((sum, o) => sum + (o.status === OrderStatus.CANCELLED ? 0 : o.totalMargin), 0).toLocaleString()} F
              </p>
            </div>
            <div className="p-3 border border-slate-200 rounded-xl bg-slate-50">
              <span className="text-[9px] font-black text-slate-500 uppercase block tracking-wider">Volume d'Activité</span>
              <p className="text-base font-bold text-blue-600 mt-1 font-mono">
                {orders.reduce((sum, o) => sum + (o.status === OrderStatus.CANCELLED ? 0 : o.totalCC), 0).toFixed(3)} CC
              </p>
            </div>
          </div>

          {/* Table */}
          <div>
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider mb-2">
              Registre chronologique des transactions de vente
            </h3>
            <table className="w-full text-left text-xs border border-slate-200">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 uppercase text-[9px] font-black text-slate-500">
                  <th className="p-2.5 font-sans">Réf</th>
                  <th className="p-2.5 font-sans">Date</th>
                  <th className="p-2.5 font-sans">Client</th>
                  <th className="p-2.5 font-sans">Statut</th>
                  <th className="p-2.5 text-right font-sans">Marge (FCFA)</th>
                  <th className="p-2.5 text-right font-sans">Volume (CC)</th>
                  <th className="p-2.5 text-right font-sans">Montant Public</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {orders.length > 0 ? (
                  [...orders]
                    .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((o, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="p-2.5 font-bold uppercase">#{o.id.split('_')[1]?.toUpperCase() || o.id}</td>
                        <td className="p-2.5 font-sans whitespace-nowrap">{o.date}</td>
                        <td className="p-2.5 font-sans font-bold">{o.customerName}</td>
                        <td className="p-2.5 font-sans">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            o.status === OrderStatus.VALIDATED ? 'text-emerald-600 bg-emerald-50' :
                            o.status === OrderStatus.PENDING ? 'text-amber-600 bg-amber-50' : 'text-red-650 bg-red-50'
                          }`}>
                            {o.status === OrderStatus.VALIDATED ? 'VALIDÉE' : o.status === OrderStatus.PENDING ? 'EN ATTENTE' : 'ANNULÉE'}
                          </span>
                        </td>
                        <td className="p-2.5 text-right font-bold text-emerald-600">
                          {o.status === OrderStatus.CANCELLED ? '0' : `+${o.totalMargin.toLocaleString()}`} F
                        </td>
                        <td className="p-2.5 text-right font-bold text-blue-600">
                          {o.status === OrderStatus.CANCELLED ? '0.000' : o.totalCC.toFixed(3)} CC
                        </td>
                        <td className="p-2.5 text-right font-bold text-slate-900">
                          {o.status === OrderStatus.CANCELLED ? '0' : o.totalRetail.toLocaleString()} F
                        </td>
                      </tr>
                    ))
                ) : (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-slate-400 italic font-sans">Aucun bon de commande enregistré.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="text-[10px] text-slate-400 text-center pt-8 border-t border-slate-100 font-sans">
            Rapport produit électroniquement par le module de vente de votre application FBO Partner.
          </div>
        </div>
      )}

    </div>
  );
};
