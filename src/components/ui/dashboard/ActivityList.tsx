import React from 'react';
import { ChevronRight } from 'lucide-react';

export type ActivityTone = 'gold' | 'emerald' | 'blue' | 'rose' | 'violet' | 'slate';

export interface ActivityItem {
  id: string;
  icon: React.ReactNode;
  iconTone?: ActivityTone;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  onClick?: () => void;
}

export interface ActivityListProps {
  items: ActivityItem[];
  onSeeAll?: () => void;
  seeAllLabel?: string;
  emptyMessage?: string;
}

const TONE_CLASS: Record<ActivityTone, string> = {
  gold: 'activity-icon is-gold',
  emerald: 'activity-icon is-emerald',
  blue: 'activity-icon is-blue',
  rose: 'activity-icon is-rose',
  violet: 'activity-icon is-violet',
  slate: 'activity-icon is-slate',
};

export const ActivityList: React.FC<ActivityListProps> = ({
  items,
  onSeeAll,
  seeAllLabel = 'Tout voir',
  emptyMessage = 'Aucune activité récente',
}) => {
  if (items.length === 0) {
    return <div className="activity-empty">{emptyMessage}</div>;
  }
  return (
    <div className="activity-list">
      {items.map((item) => {
        const Tag = item.onClick ? 'button' : 'div';
        return (
          <Tag
            key={item.id}
            type={item.onClick ? 'button' : undefined}
            onClick={item.onClick}
            className={`activity-row ${item.onClick ? 'is-clickable' : ''}`}
          >
            <div className={TONE_CLASS[item.iconTone || 'gold']}>{item.icon}</div>
            <div className="activity-body">
              <p className="activity-title">{item.title}</p>
              {item.subtitle && <p className="activity-subtitle">{item.subtitle}</p>}
            </div>
            {item.trailing && <div className="activity-trailing">{item.trailing}</div>}
          </Tag>
        );
      })}
      {onSeeAll && (
        <button type="button" onClick={onSeeAll} className="activity-seeall">
          {seeAllLabel}
          <ChevronRight size={14} />
        </button>
      )}
    </div>
  );
};

export default ActivityList;