import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Plus, Package, Receipt, X, UserPlus, ClipboardList, ArrowUpRight } from 'lucide-react';

export const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [actionsOpen, setActionsOpen] = useState(false);

  const openClient = () => {
    sessionStorage.setItem('fcf-open-new-client', '1');
    window.dispatchEvent(new Event('fcf-open-new-client'));
    setActionsOpen(false);
    navigate('/clients');
  };
  const openOrder = () => {
    sessionStorage.setItem('fcf-open-new-order', '1');
    window.dispatchEvent(new Event('fcf-open-new-order'));
    setActionsOpen(false);
    navigate('/orders');
  };

  const navItems = [
    { path: '/', label: 'Accueil', icon: <LayoutDashboard size={19} />, id: 'nav_dashboard' },
    { path: '/clients', label: 'Clients', icon: <Users size={19} />, id: 'nav_clients' },
    { path: '/orders', label: 'Commandes', icon: <Package size={19} />, id: 'nav_orders' },
    { path: '/sales', label: 'Ventes', icon: <Receipt size={19} />, id: 'nav_sales' }
  ];
  const isActive = (path: string) => path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  return (
    <>
      {actionsOpen && (
        <div className="fcf-mobile-action-backdrop" onClick={() => setActionsOpen(false)}>
          <section className="fcf-mobile-action-sheet" role="dialog" aria-modal="true" aria-label="Actions rapides" onClick={event => event.stopPropagation()}>
            <div className="fcf-mobile-sheet-handle" />
            <div className="fcf-mobile-sheet-heading"><div><strong>Créer rapidement</strong><span>Accès direct aux opérations</span></div><button type="button" onClick={() => setActionsOpen(false)} aria-label="Fermer"><X size={18} /></button></div>
            <button type="button" className="fcf-mobile-action" onClick={openClient}><span><UserPlus size={18} /></span><span><strong>Nouveau client</strong><small>Ajouter une fiche au portefeuille</small></span><ArrowUpRight size={16} /></button>
            <button type="button" className="fcf-mobile-action" onClick={openOrder}><span><Package size={18} /></span><span><strong>Nouvelle commande</strong><small>Créer une commande client</small></span><ArrowUpRight size={16} /></button>
            <button type="button" className="fcf-mobile-action" onClick={() => { setActionsOpen(false); navigate('/sales'); }}><span><Receipt size={18} /></span><span><strong>Suivre les ventes</strong><small>Voir le CA et les montants encaissés déclarés</small></span><ArrowUpRight size={16} /></button>
            <button type="button" className="fcf-mobile-action" onClick={() => { setActionsOpen(false); navigate('/orders'); }}><span><ClipboardList size={18} /></span><span><strong>Suivre les règlements</strong><small>Consulter les commandes et leur état</small></span><ArrowUpRight size={16} /></button>
          </section>
        </div>
      )}
      <nav className="fcf-bottom-nav" id="bottom_nav_bar" aria-label="Navigation principale">
        {navItems.slice(0, 2).map(item => (
          <button key={item.path} type="button" onClick={() => navigate(item.path)} className={isActive(item.path) ? 'is-active' : ''} id={item.id} aria-current={isActive(item.path) ? 'page' : undefined}>
            {item.icon}<span>{item.label}</span>
          </button>
        ))}
        <button type="button" className="fcf-bottom-fab" onClick={() => setActionsOpen(true)} aria-label="Ouvrir les actions rapides" aria-expanded={actionsOpen}><Plus size={23} /></button>
        {navItems.slice(2).map(item => (
          <button key={item.path} type="button" onClick={() => navigate(item.path)} className={isActive(item.path) ? 'is-active' : ''} id={item.id} aria-current={isActive(item.path) ? 'page' : undefined}>
            {item.icon}<span>{item.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
};
