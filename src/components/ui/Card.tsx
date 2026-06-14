import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({ 
  children, 
  className = '', 
  onClick, 
  hoverable = false,
  ...props 
}) => {
  return (
    <div
      onClick={onClick}
      className={`
        bg-white dark:bg-[#1f1f22] 
        rounded-2xl border border-slate-200/80 dark:border-slate-800 
        shadow-sm dark:shadow-none 
        transition-all duration-200 
        p-4 md:p-5
        ${onClick ? 'cursor-pointer select-none active:scale-[0.98]' : ''}
        ${hoverable ? 'hover:bg-slate-50 dark:hover:bg-[#2a2a2e] hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
};
