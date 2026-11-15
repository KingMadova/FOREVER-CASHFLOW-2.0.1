import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpDown, Check, X } from 'lucide-react';
import { SortOption } from '../../lib/sortHelper';
import './SortSelect.css';

interface SortSelectProps {
  options: SortOption[];
  value: string;
  onChange: (key: string) => void;
  id?: string;
  className?: string;
}

export const SortSelect: React.FC<SortSelectProps> = ({
  options,
  value,
  onChange,
  id,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const active = options.find((o) => o.key === value);
  const activeLabel = active?.label ?? 'Trier';

  // Mobile detection — réagit à l'orientation
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    const apply = () => setIsMobile(mql.matches);
    apply();
    mql.addEventListener('change', apply);
    return () => mql.removeEventListener('change', apply);
  }, []);

  // Close on outside click + Escape
  useEffect(() => {
    if (!isOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      if (triggerRef.current?.contains(e.target as Node)) return;
      setIsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  // Compute popover coords (desktop only)
  useEffect(() => {
    if (!isOpen || isMobile || !triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const width = Math.min(280, window.innerWidth - 16);
    const left = Math.min(
      Math.max(8, r.right - width),
      window.innerWidth - width - 8,
    );
    setCoords({ top: r.bottom + 6, left, width });
  }, [isOpen, isMobile]);

  // Focus the active option on open (keyboard users land inside the menu)
  useEffect(() => {
    if (!isOpen) return;
    const node = menuRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    node?.focus();
  }, [isOpen]);

  const handleSelect = (key: string) => {
    onChange(key);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        onClick={() => setIsOpen((v) => !v)}
        className={`fcf-sort-trigger ${className}`.trim()}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Trier par : ${activeLabel}`}
        title={activeLabel}
      >
        <ArrowUpDown size={14} aria-hidden="true" />
        <span className="fcf-sort-trigger-label">{activeLabel}</span>
      </button>

      {isOpen &&
        createPortal(
          isMobile ? (
            <div
              className="fcf-sort-backdrop"
              onClick={() => setIsOpen(false)}
              role="presentation"
            >
              <section
                ref={menuRef}
                className="fcf-sort-sheet"
                role="listbox"
                aria-label="Trier par"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="fcf-sort-sheet-handle" />
                <header className="fcf-sort-sheet-header">
                  <strong>Trier par</strong>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    aria-label="Fermer"
                  >
                    <X size={16} />
                  </button>
                </header>
                <div className="fcf-sort-sheet-list">
                  {options.map((opt) => {
                    const selected = opt.key === value;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        data-active={selected ? 'true' : 'false'}
                        onClick={() => handleSelect(opt.key)}
                        className={`fcf-sort-option ${selected ? 'is-active' : ''}`}
                      >
                        <span>{opt.label}</span>
                        {selected && <Check size={14} aria-hidden="true" />}
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>
          ) : (
            <>
              <div
                className="fcf-sort-popover-backdrop"
                onClick={() => setIsOpen(false)}
                role="presentation"
              />
              {coords && (
                <div
                  ref={menuRef}
                  className="fcf-sort-popover"
                  role="listbox"
                  aria-label="Trier par"
                  style={{ top: coords.top, left: coords.left, width: coords.width }}
                >
                  {options.map((opt) => {
                    const selected = opt.key === value;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        data-active={selected ? 'true' : 'false'}
                        onClick={() => handleSelect(opt.key)}
                        className={`fcf-sort-option ${selected ? 'is-active' : ''}`}
                      >
                        <span>{opt.label}</span>
                        {selected && <Check size={14} aria-hidden="true" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ),
          document.body,
        )}
    </>
  );
};

export default SortSelect;