import React from 'react';
import { ArrowUpDown } from 'lucide-react';
import { SortOption } from '../../lib/sortHelper';

interface SortSelectProps {
  options: SortOption[];
  value: string;
  onChange: (key: string) => void;
  id?: string;
  className?: string;
}

export const SortSelect: React.FC<SortSelectProps> = ({ options, value, onChange, id, className = '' }) => (
  <label
    className={`flex items-center gap-1.5 bg-white dark:bg-[#1f1f22] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 min-w-0 ${className}`}
  >
    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
    <select
      id={id}
      value={value}
      onChange={e => onChange(e.target.value)}
      className="text-xs font-bold text-slate-700 dark:text-slate-200 bg-transparent focus:outline-none cursor-pointer min-w-0 flex-1"
      aria-label="Trier par"
    >
      {options.map(o => (
        <option key={o.key} value={o.key} className="text-slate-900">{o.label}</option>
      ))}
    </select>
  </label>
);
