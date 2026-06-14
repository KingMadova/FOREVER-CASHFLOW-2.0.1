import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Target, Users, ShoppingBag, TrendingUp } from 'lucide-react';

export const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    {
      path: '/',
      label: 'Tableau',
      icon: <LayoutDashboard className="w-5 h-5" />,
      id: 'nav_dashboard'
    },
    {
      path: '/prospects',
      label: 'Prospects',
      icon: <Target className="w-5 h-5" />,
      id: 'nav_prospects'
    },
    {
      path: '/clients',
      label: 'Clients',
      icon: <Users className="w-5 h-5" />,
      id: 'nav_clients'
    },
    {
      path: '/orders',
      label: 'Commandes',
      icon: <ShoppingBag className="w-5 h-5" />,
      id: 'nav_orders'
    },
    {
      path: '/projection',
      label: 'Projection',
      icon: <TrendingUp className="w-5 h-5" />,
      id: 'nav_projection'
    }
  ];

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-[#1f1f22] border-t border-slate-200 dark:border-slate-800 transition-colors duration-200 shadow-[0_-4px_10px_rgba(0,0,0,0.03)] pb-[calc(10px+env(safe-area-inset-bottom))] pt-1 px-4 h-18 lg:left-0 lg:right-0 lg:mx-auto max-w-md md:max-w-xl xl:max-w-7xl xl:rounded-t-3xl xl:border-x xl:shadow-lg"
      id="bottom_nav_bar"
    >
      <div className="flex items-stretch justify-around max-w-7xl mx-auto h-full">
        {navItems.map((item) => {
          const active = isActive(item.path);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center gap-1 flex-1 select-none active:scale-95 transition-all outline-none cursor-pointer h-full min-h-[48px] py-1 ${
                active 
                  ? 'text-amber-500 font-semibold' 
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
              id={item.id}
            >
              <div className={`p-1.5 rounded-xl transition-all duration-300 ${
                active 
                  ? 'bg-amber-500/10' 
                  : 'bg-transparent'
              }`}>
                {item.icon}
              </div>
              <span className="text-[10px] md:text-xs tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
