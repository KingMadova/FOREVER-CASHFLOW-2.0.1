import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Menu } from 'lucide-react';
import { NotificationCenter } from './NotificationCenter';

interface PageHeaderProps {
  title: string;
  showBack?: boolean;
  onMenuClick?: () => void;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  showBack = false,
  onMenuClick,
}) => {
  const navigate = useNavigate();

  return (
    <header id="fcf-page-header" role="banner">
      <div id="fcf-page-header-inner">
        <div className="header-left">
          {showBack ? (
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="header-icon-btn"
              aria-label="Retour"
              id="header_back_btn"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onMenuClick}
              className="header-icon-btn header-menu-btn xl:hidden"
              aria-label="Ouvrir le menu"
              aria-haspopup="dialog"
              id="header_menu_btn"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
        </div>

        <h1 className="header-title" title={title}>{title}</h1>

        <div className="header-right">
          <NotificationCenter />
        </div>
      </div>
    </header>
  );
};