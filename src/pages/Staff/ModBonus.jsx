import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { ref, onValue, push, set } from 'firebase/database';

// ============================================================
// THƯỞNG BONUS NHÂN SỰ (MODERATION)
// - Chỉ tài khoản có quyền MOD (hoặc admin) mới vào được.
// - MOD thưởng Bonus + LÝ DO cho nhân sự KHÁC. KHÔNG được tự thưởng cho chính mình.
// - Bonus dùng để: đổi skin + làm cơ sở đánh giá thưởng QUÝ / NĂM.
// - Lưu tại: staffBonus/{staffUid}/{key} = { score, reason, by, byName, date, timestamp }
//   (score > 0: MOD thưởng; score < 0: nhân sự tiêu để đổi skin)
// ============================================================

const FOREST = '#2B6830';

const quarterOf = (d) => Math.floor(d.getMonth() / 3) + 1;

export default function ModBonus() {
  const { currentUser } = useAuth();
  const uid = currentUser?.id;
  const isMod = currentUser?.role === 'admin' || !!currentUser?.modAccess;

  const [users, setUsers] = useState({});
  const [bonus, setBonus] = useState({});   // staffBonus toàn bộ: { staffUid: { key: record } }
  const [loading, setLoading] = useState(true);

  const [targetId, setTargetId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const showToast = (m) => { setToast(m); setTimeout(() => setToast(''), 3500); };

  useEffect(() => {
    const u1 = onValue(ref(db, 'users'), (s) => { setUsers(s.val() || {}); setLoading(false); });
    const u2 = onValue(ref(db, 'staffBonus'), (s) => setBonus(s.val() || {}));
    return () => { u1(); u2(); };
  }, []);

  // Danh sách nhân sự (role staff, bỏ tài khoản DEMO). Mỗi người kèm số dư + thưởng quý/năm.
  const now = new Date();
  const curQ = quarterOf(now);
  const curY = now.getFullYear();

  const staffStats = useMemo(() => {
    return Object.entries(users)
      .filter(([, u]) => u && u.role === 'staff' && !u.isDemo)
      .map(([id, u]) => {
        const recs = Object.values(bonus[id] || {});
        let balance = 0, qEarned = 0, yEarned = 0;
        recs.forEach((r) => {
          const sc = Number(r.score) || 0;
          balance += sc;
          const d = r.date ? new Date(r.date + 'T00:00:00') : (r.timestamp ? new Date(r.timestamp) : null);
          if (sc > 0 && d && d.getFullYear() === curY) {
            yEarned += sc;
            if (quarterOf(d) === curQ) qEarned += sc;
          }
        });
        return { id, name: u.name || id, subRole: u.subRole || 'staff', modAccess: !!u.modAccess, balance, qEarned, yEarned };
      })
      .sort((a, b) => b.yEarned - a.yEarned);
  }, [users, bonus, curQ, curY]);

  // Người được thưởng = mọi nhân sự TRỪ chính mình (không tự thưởng)
  const awardable = staffStats.filter((s) => s.id !== uid);

  // Nhật ký thưởng gần đây (gộp mọi nhân sự, chỉ bản ghi MOD thưởng score>0)
  const recentLog = useMemo(() => {
    const rows = [];
    Object.entries(bonus).forEach(([sid, recs]) => {
      Object.entries(recs || {}).forEach(([key, r]) => {
        if ((Number(r.score) || 0) > 0) rows.push({ key, toId: sid, ...r });
      });
    });
    return rows.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0)).slice(0, 25);
  }, [bonus]);

  const award = async () => {
    const amt = Math.round(Number(amount) || 0);
    if (!targetId) return showToast('⚠️ Chọn nhân sự nhận thưởng.');
    if (targetId === uid) return showToast('⛔ Không thể tự thưởng cho chính mình — nhờ MOD khác.');
    if (amt <= 0) return showToast('⚠️ Nhập số Bonus > 0.');
    if (!reason.trim()) return showToast('⚠️ Nhập lý do thưởng.');
    setBusy(true);
    try {
      const rec = {
        score: amt,
        reason: reason.trim(),
        by: uid,
        byName: currentUser?.name || 'MOD',
        date: new Date().toISOString().slice(0, 10),
        timestamp: new Date().toISOString(),
      };
      await set(push(ref(db, `staffBonus/${targetId}`)), rec);
      const tName = awardable.find((s) => s.id === targetId)?.name || 'nhân sự';
      showToast(`✅ Đã thưởng +${amt} Bonus cho ${tName}.`);
      setAmount(''); setReason('');
    } catch (e) { showToast('❌ Lỗi: ' + e.message); }
    finally { setBusy(false); }
  };

  if (!isMod) {
    return (
      <div className="max-w-md mx-auto mt-10 bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm">
        <div className="text-4xl mb-2">🛡️</div>
        <p className="font-bold text-slate-700">Khu vực Moderation</p>
        <p className="text-sm text-slate-400 mt-1">Bạn chưa được cấp quyền thưởng Bonus. Liên hệ Admin nếu cần.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-xl shadow-lg text-sm font-bold text-white max-w-[90vw]"
          style={{ background: toast.startsWith('✅') ? '#059669' : toast.startsWith('⚠️') || toast.startsWith('⛔') ? '#d97706' : '#dc2626' }}>
          {toast}
        </div>
      )}

      {/* HEADER */}
      <div className="rounded-2xl p-6 text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${FOREST}, #1E5225)` }}>
        <div className="flex items-center gap-3">
          <div className="text-3xl">🛡️</div>
          <div>
            <h1 className="text-xl font-black tracking-wide">Thưởng Bonus Nhân sự</h1>
            <p className="text-green-100/90 text-sm mt-0.5">Ghi nhận đóng góp của đồng nghiệp — minh bạch, có lý do. Không tự thưởng cho mình.</p>
          </div>
        </div>
      </div>

      {/* FORM THƯỞNG */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: FOREST }}>➕ Ghi nhận thưởng</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nhân sự nhận thưởng</label>
            <select value={targetId} onChange={(e) => setTargetId(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#2B6830] bg-white">
              <option value="">— Chọn nhân sự —</option>
              {awardable.map((s) => (
                <option key={s.id} value={s.id}>{s.name} · {s.subRole}{s.modAccess ? ' · MOD' : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Số Bonus</label>
            <input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#2B6830]" placeholder="VD: 50" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Lý do thưởng (bắt buộc)</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
            className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#2B6830] resize-none"
            placeholder="VD: Hỗ trợ phụ huynh ngoài giờ, sáng kiến cải tiến lớp học..." />
        </div>
        <button onClick={award} disabled={busy}
          className="w-full md:w-auto px-6 py-3 rounded-xl text-white font-bold transition active:scale-95 disabled:opacity-50"
          style={{ background: FOREST }}>
          {busy ? 'Đang ghi nhận...' : '✔ Thưởng Bonus'}
        </button>
        <p className="text-[11px] text-slate-400">Mỗi lần thưởng được ghi nhật ký kèm tên người thưởng & lý do. Bonus là cơ sở để đổi skin và đánh giá thưởng quý/năm.</p>
      </div>

      {/* BẢNG ĐÁNH GIÁ QUÝ / NĂM */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: FOREST }}>📊 Đánh giá thưởng · Quý {curQ}/{curY}</h2>
          <span className="text-[11px] text-slate-400">Sắp theo thưởng năm</span>
        </div>
        {loading ? (
          <p className="text-center text-sm text-slate-400 py-8">Đang tải…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold">
                <tr>
                  <th className="p-3 text-left">Nhân sự</th>
                  <th className="p-3 text-right">Số dư</th>
                  <th className="p-3 text-right">Thưởng Quý {curQ}</th>
                  <th className="p-3 text-right">Thưởng Năm {curY}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staffStats.map((s) => (
                  <tr key={s.id} className={s.id === uid ? 'bg-[#E8F4EC]/40' : ''}>
                    <td className="p-3">
                      <span className="font-bold text-slate-700">{s.name}</span>
                      <span className="text-[10px] text-slate-400 ml-1 uppercase">{s.subRole}{s.id === uid ? ' · Bạn' : ''}</span>
                    </td>
                    <td className="p-3 text-right font-bold" style={{ color: FOREST }}>{s.balance}</td>
                    <td className="p-3 text-right font-bold text-amber-600">{s.qEarned}</td>
                    <td className="p-3 text-right font-extrabold text-slate-800">{s.yEarned}</td>
                  </tr>
                ))}
                {staffStats.length === 0 && (
                  <tr><td colSpan="4" className="p-6 text-center text-slate-400 italic">Chưa có dữ liệu.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* NHẬT KÝ THƯỞNG */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide mb-3" style={{ color: FOREST }}>🧾 Nhật ký thưởng gần đây</h2>
        {recentLog.length === 0 ? (
          <p className="text-xs text-slate-400 italic">Chưa có lượt thưởng nào.</p>
        ) : (
          <div className="space-y-2">
            {recentLog.map((r) => (
              <div key={r.key} className="flex items-start justify-between gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                <div className="min-w-0">
                  <p className="text-sm text-slate-700">
                    <span className="font-bold">{r.byName}</span>
                    <span className="text-slate-400"> thưởng </span>
                    <span className="font-bold">{users[r.toId]?.name || 'nhân sự'}</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 italic">“{r.reason}”</p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">{r.timestamp ? new Date(r.timestamp).toLocaleString('vi-VN') : r.date}</p>
                </div>
                <span className="font-extrabold shrink-0" style={{ color: FOREST }}>+{r.score}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
