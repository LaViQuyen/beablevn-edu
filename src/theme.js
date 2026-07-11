// ============================================================
// THEME CONSTANTS, Be Able VN / 2Sol EDU
// Dùng file này thay vì hardcode màu/class trực tiếp trong JSX.
// Import: import { colors, btn, input, card } from '../../theme';
// ============================================================

// --- MÀU SẮC THƯƠNG HIỆU ---
export const colors = {
  primary:       '#003366',
  primaryHover:  '#002244',
  primaryLight:  '#EEF3FA',
  primaryAlpha:  'rgba(0,51,102,0.05)',

  success:       '#059669',
  successLight:  '#ECFDF5',
  warning:       '#D97706',
  warningLight:  '#FFFBEB',
  danger:        '#DC2626',
  dangerLight:   '#FEF2F2',

  textPrimary:   '#1E293B',  // slate-800
  textSecondary: '#64748B',  // slate-500
  textMuted:     '#94A3B8',  // slate-400
  border:        '#E2E8F0',  // slate-200
  borderStrong:  '#CBD5E1',  // slate-300
  bgPage:        '#F8FAFC',  // slate-50
  bgCard:        '#FFFFFF',
  bgSubtle:      '#F1F5F9',  // slate-100
};

// --- BUTTON VARIANTS ---
export const btn = {
  // Nút chính, xanh đậm
  primary: `bg-[#003366] text-white font-bold hover:bg-[#002244] active:scale-[0.98] transition-all rounded-xl shadow-sm disabled:opacity-50 disabled:cursor-not-allowed`,

  // Nút phụ, outline
  secondary: `bg-white text-slate-700 font-bold border border-slate-200 hover:bg-slate-50 active:scale-[0.98] transition-all rounded-xl`,

  // Nút nguy hiểm, đỏ
  danger: `bg-red-500 text-white font-bold hover:bg-red-600 active:scale-[0.98] transition-all rounded-xl`,

  // Nút thành công, xanh lá
  success: `bg-emerald-600 text-white font-bold hover:bg-emerald-700 active:scale-[0.98] transition-all rounded-xl`,

  // Nút ghost, không border
  ghost: `text-slate-600 font-medium hover:bg-slate-100 active:scale-[0.98] transition-all rounded-xl`,

  // Size padding
  sm:  `px-3 py-1.5 text-xs`,
  md:  `px-5 py-2.5 text-sm`,
  lg:  `px-8 py-3 text-sm`,
  full: `w-full py-3 text-sm`,
};

// --- INPUT ---
export const input = {
  base: `w-full border border-slate-200 rounded-xl text-sm outline-none focus:border-[#003366] focus:ring-2 focus:ring-[#003366]/10 transition-all bg-white`,
  sm:   `px-3 py-2`,
  md:   `px-3 py-2.5`,
  lg:   `px-4 py-3`,

  // Input có lỗi
  error: `border-red-300 focus:border-red-400 focus:ring-red-100`,

  // Textarea
  textarea: `w-full border border-slate-200 rounded-xl text-sm outline-none focus:border-[#003366] focus:ring-2 focus:ring-[#003366]/10 transition-all resize-none`,

  // Select
  select: `w-full border border-slate-200 rounded-xl text-sm outline-none focus:border-[#003366] bg-white transition-all`,
};

// --- CARD ---
export const card = {
  base:    `bg-white rounded-2xl border border-slate-100 shadow-sm`,
  padded:  `bg-white rounded-2xl border border-slate-100 shadow-sm p-5`,
  padMd:   `bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-6`,
  subtle:  `bg-slate-50 rounded-2xl border border-slate-100`,
  hover:   `bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all`,
};

// --- BADGE ---
export const badge = {
  blue:    `bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold px-2 py-0.5 rounded`,
  green:   `bg-green-50 text-green-700 border border-green-200 text-[10px] font-bold px-2 py-0.5 rounded`,
  amber:   `bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded`,
  red:     `bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold px-2 py-0.5 rounded`,
  purple:  `bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold px-2 py-0.5 rounded`,
  slate:   `bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold px-2 py-0.5 rounded`,
};

// --- TYPOGRAPHY ---
export const text = {
  pageTitle:    `text-xl font-bold text-[#003366]`,
  sectionTitle: `text-base font-bold text-[#003366]`,
  label:        `text-xs font-bold text-slate-400 uppercase tracking-wider`,
  body:         `text-sm text-slate-700`,
  muted:        `text-xs text-slate-400`,
  error:        `text-xs text-red-500`,
};

// --- SECTION HEADER (icon + title + subtitle) ---
// Dùng: <SectionHeader icon={...} title="..." subtitle="..." />
export const SectionHeader = ({ icon, title, subtitle, className = '' }) => (
  <div className={`flex items-center gap-3 pb-4 border-b border-slate-100 ${className}`}>
    <div className="p-2 bg-[#003366]/5 rounded-xl text-[#003366]">{icon}</div>
    <div>
      <h2 className="text-xl font-bold text-[#003366]">{title}</h2>
      {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
  </div>
);

// --- EMPTY STATE ---
export const EmptyState = ({ icon, title, subtitle, action }) => (
  <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-10 text-center">
    {icon && <div className="w-12 h-12 mx-auto mb-3 text-slate-300">{icon}</div>}
    <p className="text-slate-400 text-sm font-medium">{title}</p>
    {subtitle && <p className="text-slate-300 text-xs mt-1">{subtitle}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

// --- SKELETON ROW (dùng trong table) ---
export const SkeletonRows = ({ cols = 5, rows = 3 }) => (
  <>
    {Array.from({ length: rows }).map((_, i) => (
      <tr key={i} className="animate-pulse">
        {Array.from({ length: cols }).map((_, j) => (
          <td key={j} className="p-4">
            <div className="h-4 bg-slate-100 rounded w-full" />
          </td>
        ))}
      </tr>
    ))}
  </>
);

// --- TOAST (helper tạo toast DOM trực tiếp không cần state) ---
export const showToastDom = (message, type = 'success') => {
  const colors = {
    success: '#059669',
    error:   '#DC2626',
    warning: '#D97706',
  };
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = `
    position:fixed; top:16px; left:50%; transform:translateX(-50%);
    background:${colors[type] || colors.success}; color:white;
    padding:10px 20px; border-radius:12px; font-size:14px;
    font-weight:600; z-index:9999;
    box-shadow:0 4px 12px rgba(0,0,0,0.15);
    animation: fadeIn 0.2s ease;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
};

export default { colors, btn, input, card, badge, text };
