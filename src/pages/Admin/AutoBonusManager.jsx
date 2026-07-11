import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { ref, onValue, update } from 'firebase/database';
import { DEFAULT_BONUS_RULES, normalizeBonusRules } from '../../utils/autoBonus';

// ============================================================
// ADMIN, CẤU HÌNH TỰ ĐỘNG CỘNG BONUS
// Chỉnh luật ở node `bonusRules`; ScoreInput đọc luật này khi GV nhập điểm.
// Số liệu do Bak quyết, trang này chỉ phản ánh, mặc định theo đề xuất.
// ============================================================

const AutoBonusManager = () => {
  const [rules, setRules] = useState(DEFAULT_BONUS_RULES);
  const [saving, setSaving] = useState(false);
  // Toast phân loại: màu lấy TỪ type, không suy từ emoji
  const [toast, setToast] = useState({ msg: '', type: 'success' });
  const show = (m, type = 'success') => { setToast({ msg: m, type }); setTimeout(() => setToast((t) => ({ ...t, msg: '' })), 3000); };

  useEffect(() => {
    const unsub = onValue(ref(db, 'bonusRules'), (snap) => setRules(normalizeBonusRules(snap.val())));
    return () => unsub();
  }, []);

  const setN = (k, v) => setRules(r => ({ ...r, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await update(ref(db, 'bonusRules'), normalizeBonusRules(rules));
      show('Đã lưu cấu hình auto-bonus!', 'success');
    } catch (e) { show('Lỗi: ' + e.message, 'error'); }
    finally { setSaving(false); }
  };

  const NumField = ({ label, k, suffix }) => (
    <div>
      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input type="number" min="0" step="0.5" value={rules[k]} onChange={e => setN(k, e.target.value)}
          className="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" />
        {suffix && <span className="text-xs font-bold text-slate-400 shrink-0">{suffix}</span>}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-20">
      {toast.msg && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[80] px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white animate-fade-in-up ${toast.type === 'error' ? 'bg-red-500' : toast.type === 'warning' ? 'bg-amber-500' : 'bg-emerald-600'}`}>{toast.msg}</div>
      )}

      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
        <div className="p-2 bg-primary-light rounded-xl text-primary-medium">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
          </svg>
        </div>
        <div>
          <h2 className="page-title">Tự động cộng Bonus</h2>
          <p className="page-sub">Cấu hình luật thưởng Bonus tự động khi giáo viên nhập điểm.</p>
        </div>
      </div>

      {/* Bật/tắt tổng */}
      <label className={`flex items-center justify-between gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-colors ${rules.enabled ? 'border-primary bg-primary-light/50' : 'border-slate-200 bg-slate-50'}`}>
        <div>
          <p className="font-bold text-slate-800">Bật tự động cộng Bonus</p>
          <p className="text-xs text-slate-500 mt-0.5">Khi tắt, không có Bonus nào được cộng tự động (mọi Bonus do GV chấm tay).</p>
        </div>
        <input type="checkbox" checked={rules.enabled} onChange={e => setN('enabled', e.target.checked)} className="w-5 h-5 accent-primary" />
      </label>

      <div className={rules.enabled ? '' : 'opacity-50 pointer-events-none'}>
        {/* Assignment */}
        <div className="card-std p-5 mb-4">
          <h3 className="text-sm font-bold text-primary uppercase tracking-wide mb-1">📝 Nộp đủ bài tập (Assignment)</h3>
          <p className="text-xs text-slate-400 mb-3">Mỗi cột điểm Assignment giáo viên nhập (xem như học viên đã nộp/hoàn thành) sẽ tự cộng Bonus.</p>
          <div className="max-w-xs"><NumField label="Bonus mỗi cột Assignment" k="assignmentBonus" suffix="Bonus" /></div>
        </div>

        {/* Kiểm tra đạt ngưỡng */}
        <div className="card-std p-5 mb-4">
          <h3 className="text-sm font-bold text-primary uppercase tracking-wide mb-1">🎯 Kiểm tra đạt ngưỡng</h3>
          <p className="text-xs text-slate-400 mb-3">Khi điểm kiểm tra đạt ngưỡng, tự cộng Bonus. Đạt ngưỡng cao thì áp mức cao.</p>
          <div className="grid grid-cols-2 gap-4">
            <NumField label="Ngưỡng 1 (điểm ≥)" k="examTier1Score" suffix="/10" />
            <NumField label="Bonus ngưỡng 1" k="examTier1Bonus" suffix="Bonus" />
            <NumField label="Ngưỡng 2 (điểm ≥)" k="examTier2Score" suffix="/10" />
            <NumField label="Bonus ngưỡng 2" k="examTier2Bonus" suffix="Bonus" />
          </div>
          <label className="flex items-center gap-2 mt-4 cursor-pointer">
            <input type="checkbox" checked={rules.formativeCounts} onChange={e => setN('formativeCounts', e.target.checked)} className="w-4 h-4 accent-primary" />
            <span className="text-sm font-medium text-slate-600">Áp ngưỡng cho cả <b>Formative</b> (kiểm tra trên lớp), không chỉ Summative (thi giữa/cuối khóa)</span>
          </label>
        </div>

        {/* Ghi chú các hành vi khác */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-800 space-y-1.5">
          <p><b>🔥 Đi học chuyên cần:</b> thưởng theo streak buổi đi học, phần này gắn vào lúc điểm danh, sẽ bổ sung sau.</p>
          <p><b>💬 Tích cực xây dựng bài:</b> giữ chấm tay (nhập trực tiếp ở tab "Điểm Bonus") vì khó đánh giá tự động khách quan.</p>
        </div>
      </div>

      <button onClick={save} disabled={saving}
        className="btn-primary w-full disabled:opacity-50">
        {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
      </button>
    </div>
  );
};

export default AutoBonusManager;
