/**
 * UI Component Library — Be Able VN / 2Sol EDU
 * Dùng utility classes từ index.css (@layer components)
 * Import: import { Button, Input, Card, Badge, Modal, Toast, PageHeader } from '../../components/UI';
 */

import React from 'react';

// ============================================================
// BUTTON
// variant: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline'
// size: 'sm' | 'md' | 'lg'
// ============================================================
export const Button = ({
  children, variant = 'primary', size = 'md',
  loading = false, disabled = false,
  className = '', onClick, type = 'button', ...props
}) => {
  const variantMap = {
    primary:   'bg-[#2B6830] text-white hover:bg-[#1E5225]',
    secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
    danger:    'bg-red-500 text-white hover:bg-red-600',
    ghost:     'text-slate-600 hover:bg-slate-100',
    outline:   'border border-[#2B6830] text-[#2B6830] hover:bg-[#2B6830] hover:text-white',
    success:   'bg-emerald-600 text-white hover:bg-emerald-700',
  };
  const sizeMap = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-8 py-3 text-sm',
  };
  return (
    <button
      type={type} onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 font-bold rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm ${variantMap[variant] || variantMap.primary} ${sizeMap[size] || sizeMap.md} ${className}`}
      {...props}
    >
      {loading && (
        <svg className="animate-spin w-4 h-4 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
      )}
      {children}
    </button>
  );
};

// ============================================================
// INPUT
// ============================================================
export const Input = ({ label, error, className = '', type = 'text', ...props }) => (
  <div className="space-y-1.5">
    {label && <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">{label}</label>}
    <input
      type={type}
      className={`w-full border p-3 rounded-xl text-sm outline-none transition-all placeholder:text-slate-400
        ${error
          ? 'border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100'
          : 'border-slate-200 focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10'
        } ${className}`}
      {...props}
    />
    {error && (
      <p className="text-red-500 text-xs flex items-center gap-1">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3 shrink-0">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        {error}
      </p>
    )}
  </div>
);

// ============================================================
// SELECT
// ============================================================
export const Select = ({ label, children, className = '', ...props }) => (
  <div className="space-y-1.5">
    {label && <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">{label}</label>}
    <select
      className={`w-full border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10 bg-white transition-all ${className}`}
      {...props}
    >
      {children}
    </select>
  </div>
);

// ============================================================
// TEXTAREA
// ============================================================
export const Textarea = ({ label, error, rows = 4, className = '', ...props }) => (
  <div className="space-y-1.5">
    {label && <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">{label}</label>}
    <textarea
      rows={rows}
      className={`w-full border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10 resize-none transition-all ${className}`}
      {...props}
    />
    {error && <p className="text-red-500 text-xs">{error}</p>}
  </div>
);

// ============================================================
// CARD
// ============================================================
export const Card = ({ children, className = '', hover = false, padding = true }) => (
  <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm ${hover ? 'hover:shadow-md hover:border-green-100 transition-all' : ''} ${padding ? 'p-4 md:p-6' : ''} ${className}`}>
    {children}
  </div>
);

// ============================================================
// BADGE
// color: 'blue'|'green'|'amber'|'red'|'purple'|'slate'|'emerald'
// ============================================================
const BADGE_COLORS = {
  blue:    'bg-[#E8F4EC] text-green-700 border-green-200',
  green:   'bg-green-50 text-green-700 border-green-200',
  amber:   'bg-amber-50 text-amber-700 border-amber-200',
  red:     'bg-red-50 text-red-700 border-red-200',
  purple:  'bg-[#E8F4EC] text-green-700 border-green-200',
  slate:   'bg-slate-50 text-slate-600 border-slate-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  primary: 'bg-[#2B6830]/5 text-[#2B6830] border-[#2B6830]/20',
};
export const Badge = ({ children, color = 'slate', className = '' }) => (
  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide ${BADGE_COLORS[color] || BADGE_COLORS.slate} ${className}`}>
    {children}
  </span>
);

// ============================================================
// ALERT — inline message
// ============================================================
const ALERT_COLORS = {
  error:   { bg: 'bg-red-50 border-red-200 text-red-700',     icon: 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z' },
  success: { bg: 'bg-green-50 border-green-200 text-green-700', icon: 'M4.5 12.75l6 6 9-13.5' },
  warning: { bg: 'bg-amber-50 border-amber-200 text-amber-700', icon: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z' },
};
export const Alert = ({ type = 'error', children, className = '' }) => {
  const { bg, icon } = ALERT_COLORS[type] || ALERT_COLORS.error;
  return (
    <div className={`flex items-start gap-2 border px-4 py-3 rounded-xl text-sm ${bg} ${className}`}>
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0 mt-0.5">
        <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
      </svg>
      <span>{children}</span>
    </div>
  );
};

// ============================================================
// TOAST — fixed overlay notification
// ============================================================
export const Toast = ({ message, type = 'success' }) => {
  if (!message) return null;
  const bg = { success: 'bg-emerald-600', error: 'bg-red-500', warning: 'bg-amber-500' }[type] || 'bg-emerald-600';
  const iconPath = type === 'success'
    ? 'M4.5 12.75l6 6 9-13.5'
    : 'M6 18L18 6M6 6l12 12';
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 ${bg} text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 animate-fade-in-up`}>
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0">
        <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
      </svg>
      {message}
    </div>
  );
};

// ============================================================
// CONFIRM MODAL
// ============================================================
export const ConfirmModal = ({
  title, message,
  confirmLabel = 'Xác nhận', cancelLabel = 'Hủy',
  variant = 'danger',
  onConfirm, onCancel,
}) => (
  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4 border border-slate-100 animate-fade-in-up">
      {title && <p className="font-bold text-slate-800">{title}</p>}
      {message && <p className="text-sm text-slate-500">{message}</p>}
      <div className="flex gap-3 justify-end">
        <Button variant="secondary" size="sm" onClick={onCancel}>{cancelLabel}</Button>
        <Button variant={variant} size="sm" onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </div>
  </div>
);

// ============================================================
// PAGE HEADER — tiêu đề trang chuẩn
// ============================================================
export const PageHeader = ({ icon, iconBg = 'bg-[#E8F4EC]', iconColor = 'text-[#2B6830]', title, subtitle, children }) => (
  <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-0">
    <div className="flex items-center gap-3">
      {icon && (
        <div className={`p-2 rounded-lg shrink-0 ${iconBg} ${iconColor}`}>{icon}</div>
      )}
      <div>
        <h2 className="text-xl font-bold text-[#2B6830]">{title}</h2>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5 hidden md:block">{subtitle}</p>}
      </div>
    </div>
    {children && <div className="flex items-center gap-2">{children}</div>}
  </div>
);

// ============================================================
// SKELETON
// ============================================================
export const Skeleton = ({ className = '' }) => (
  <div className={`bg-slate-100 rounded-xl animate-pulse ${className}`} />
);

export const SkeletonCard = ({ rows = 3 }) => (
  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 animate-pulse space-y-3">
    <Skeleton className="h-5 w-32" />
    {Array.from({ length: rows }).map((_, i) => (
      <Skeleton key={i} className={`h-3 ${i === rows - 1 ? 'w-2/3' : 'w-full'}`} />
    ))}
  </div>
);

// ============================================================
// EMPTY STATE
// ============================================================
export const EmptyState = ({ icon, title, subtitle, action }) => (
  <div className="bg-white rounded-xl border border-dashed border-slate-200 p-10 text-center">
    {icon && <div className="text-slate-300 w-12 h-12 mx-auto mb-3">{icon}</div>}
    <p className="text-slate-500 text-sm font-medium">{title}</p>
    {subtitle && <p className="text-slate-400 text-xs mt-1">{subtitle}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

// ============================================================
// FILTER GROUP — pill buttons
// ============================================================
export const FilterGroup = ({ options, value, onChange }) => (
  <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
    {options.map(opt => (
      <button
        key={opt.id}
        onClick={() => onChange(opt.id)}
        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
          value === opt.id ? 'bg-white text-[#2B6830] shadow-sm' : 'text-slate-500 hover:text-slate-700'
        }`}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

// ============================================================
// SEARCH INPUT
// ============================================================
export const SearchInput = ({ placeholder = 'Tìm kiếm...', value, onChange, className = '' }) => (
  <div className={`relative ${className}`}>
    <input
      className="w-full border border-slate-200 pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10 transition-all bg-white placeholder:text-slate-400"
      placeholder={placeholder}
      value={value}
      onChange={onChange}
    />
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#94a3b8" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  </div>
);

// ============================================================
// STAT CARD — dùng cho Dashboard
// ============================================================
export const StatCard = ({ title, value, sub, icon, iconBg = 'bg-[#E8F4EC]', iconColor = 'text-[#2B6830]' }) => (
  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${iconBg} ${iconColor}`}>
      {icon}
    </div>
    <div className="min-w-0">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{title}</p>
      <p className="text-3xl font-extrabold text-slate-800 leading-tight">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5 truncate">{sub}</p>}
    </div>
  </div>
);
