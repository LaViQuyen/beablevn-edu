import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { ref, onValue, push, update, remove } from 'firebase/database';

// ============================================================
// BAVN CENTER — chỉ nhân sự có cờ BOD (hoặc admin)
// Tab 1: Grant Credits cho nhân sự (bắt buộc lý do, kể cả chính mình)
// Tab 2: Quà học viên   — BOD thiết lập & quản lý
// Tab 3: Quà nhân sự    — BOD thiết lập & quản lý
// Tab 4: Duyệt đổi quà  — đơn channel 'gift' của cả học viên & nhân sự
// ============================================================

const STATUS_META = {
  pending:   { label: 'Chờ duyệt', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  confirmed: { label: 'Đã xác nhận', cls: 'bg-green-50 text-green-700 border-green-200' },
  rejected:  { label: 'Từ chối', cls: 'bg-red-50 text-red-600 border-red-200' },
};

// Link Dropbox dl=0 → raw=1 để hiển thị được ảnh
const normalizeImageUrl = (url) => {
  const u = (url || '').trim();
  if (!u) return '';
  if (u.includes('dropbox.com')) {
    if (/[?&]raw=1/.test(u)) return u;
    if (/[?&]dl=\d/.test(u)) return u.replace(/([?&])dl=\d/, '$1raw=1');
    return u + (u.includes('?') ? '&' : '?') + 'raw=1';
  }
  return u;
};

const BavnCenter = () => {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const [bodAccess, setBodAccess] = useState(currentUser?.bodAccess || isAdmin);

  const [activeTab, setActiveTab] = useState('grant');
  const [users, setUsers] = useState({});
  const [gifts, setGifts] = useState([]);
  const [staffCreditsAll, setStaffCreditsAll] = useState({});
  const [creditPlusAll, setCreditPlusAll] = useState({});
  const [redemptions, setRedemptions] = useState([]);
  const [allScores, setAllScores] = useState({});
  const [classes, setClasses] = useState({});

  const [toastMsg, setToastMsg] = useState('');
  const showToast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 4000); };

  // --- Grant Credits ---
  const [grantSearch, setGrantSearch] = useState('');
  const [grantTarget, setGrantTarget] = useState(null);
  const [grantAmount, setGrantAmount] = useState('');
  const [grantReason, setGrantReason] = useState('');
  const [grantConfirming, setGrantConfirming] = useState(false);

  // --- Quản lý quà ---
  const [giftForm, setGiftForm] = useState({ name: '', price: '' });
  const [editGift, setEditGift] = useState(null);
  const [deleteGift, setDeleteGift] = useState(null);

  // --- Duyệt đơn quà ---
  const [statusFilter, setStatusFilter] = useState('pending');
  const [processing, setProcessing] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  // Cờ BOD realtime
  useEffect(() => {
    if (!currentUser?.id) return;
    if (isAdmin) { setBodAccess(true); return; }
    const unsub = onValue(ref(db, `users/${currentUser.id}/bodAccess`), (snap) => setBodAccess(!!snap.val()));
    return () => unsub();
  }, [currentUser?.id]);

  useEffect(() => {
    const u1 = onValue(ref(db, 'users'), (snap) => setUsers(snap.val() || {}));
    const u2 = onValue(ref(db, 'gifts'), (snap) => {
      const data = snap.val() || {};
      setGifts(Object.entries(data).map(([id, val]) => ({ id, ...val })));
    });
    const u3 = onValue(ref(db, 'staffCredits'), (snap) => setStaffCreditsAll(snap.val() || {}));
    const u4 = onValue(ref(db, 'creditPlus'), (snap) => setCreditPlusAll(snap.val() || {}));
    const u5 = onValue(ref(db, 'redemptions'), (snap) => {
      const data = snap.val() || {};
      setRedemptions(Object.entries(data).map(([id, val]) => ({ id, ...val })).sort((a, b) => new Date(b.date) - new Date(a.date)));
    });
    const u6 = onValue(ref(db, 'scores'), (snap) => setAllScores(snap.val() || {}));
    const u7 = onValue(ref(db, 'classes'), (snap) => setClasses(snap.val() || {}));
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); };
  }, []);

  const itemsText = (items) => (items || []).map(i => `${i.name} ×${i.qty}`).join(', ');
  const getStaffBalance = (id) => Number(staffCreditsAll[id]?.balance) || 0;
  const getPlusBalance = (id) => Number(creditPlusAll[id]?.balance) || 0;

  // Bonus theo lớp của học viên (cho đơn quà ví Credits của HV)
  const getBonusBalances = (studentId) => {
    const stu = users[studentId];
    if (!stu) return [];
    const classIds = Array.isArray(stu.classIds) ? stu.classIds : Object.values(stu.classIds || {});
    return classIds.map(cid => {
      const records = allScores[cid]?.[studentId]?.bonus || {};
      const sum = Object.values(records).reduce((a, r) => a + (Number(r.score) || 0), 0);
      return { classId: cid, className: classes[cid]?.name || cid, bonus: sum };
    }).sort((a, b) => b.bonus - a.bonus);
  };

  // --- GRANT CREDITS cho nhân sự ---
  const grantCandidates = useMemo(() => {
    const kw = grantSearch.trim().toLowerCase();
    if (!kw) return [];
    return Object.entries(users)
      .map(([id, val]) => ({ id, ...val }))
      .filter(u => u.role === 'staff' && (u.name?.toLowerCase().includes(kw) || u.loginId?.toLowerCase().includes(kw)))
      .slice(0, 8);
  }, [users, grantSearch]);

  const handleGrant = async () => {
    const amt = Number(grantAmount);
    if (!grantTarget) return showToast('⚠️ Chọn nhân sự cần grant.');
    if (!amt || amt <= 0 || !Number.isInteger(amt)) return showToast('⚠️ Số credits phải là số nguyên dương.');
    if (!grantReason.trim()) return showToast('⚠️ Nhập lý do cụ thể (VD: thưởng dự án X...).');
    if (!grantConfirming) { setGrantConfirming(true); return; }
    try {
      const cur = getStaffBalance(grantTarget.id);
      const updates = {};
      updates[`staffCredits/${grantTarget.id}/balance`] = cur + amt;
      const key = push(ref(db, `staffCredits/${grantTarget.id}/history`)).key;
      updates[`staffCredits/${grantTarget.id}/history/${key}`] = {
        amount: amt,
        reason: grantReason.trim(), // lý do bắt buộc — minh bạch
        by: currentUser.name,
        date: new Date().toISOString(),
      };
      await update(ref(db), updates);
      showToast(`✅ Đã grant ${amt} Credits cho ${grantTarget.name} (số dư mới: ${cur + amt}).`);
      setGrantAmount(''); setGrantReason(''); setGrantConfirming(false);
    } catch (e) {
      showToast('❌ Lỗi: ' + e.message);
      setGrantConfirming(false);
    }
  };

  // Lịch sử grant/trừ toàn hệ thống
  const grantHistory = useMemo(() => {
    const rows = [];
    Object.entries(staffCreditsAll).forEach(([sid, val]) => {
      Object.entries(val?.history || {}).forEach(([hid, h]) => {
        rows.push({ id: `${sid}_${hid}`, staffName: users[sid]?.name || sid, ...h });
      });
    });
    return rows.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 30);
  }, [staffCreditsAll, users]);

  // --- QUẢN LÝ QUÀ (audience theo tab đang mở) ---
  const audience = activeTab === 'giftsStaff' ? 'staff' : 'student';
  const giftList = gifts.filter(g => g.audience === audience);

  const handleAddGift = async (e) => {
    e.preventDefault();
    if (!giftForm.name.trim() || !giftForm.price) return showToast('⚠️ Nhập tên quà và giá credit.');
    try {
      await push(ref(db, 'gifts'), {
        name: giftForm.name.trim(),
        audience, // 'student' | 'staff' — 2 hệ quà riêng
        price: Number(giftForm.price),
        available: true,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.name,
      });
      setGiftForm({ name: '', price: '' });
      showToast('✅ Đã thêm quà.');
    } catch (e2) { showToast('❌ Lỗi: ' + e2.message); }
  };

  const handleSaveGift = async () => {
    if (!editGift?.name?.trim() || !editGift?.price) return showToast('⚠️ Nhập tên quà và giá credit.');
    try {
      await update(ref(db, `gifts/${editGift.id}`), {
        name: editGift.name.trim(),
        price: Number(editGift.price),
        imageUrl: normalizeImageUrl(editGift.imageUrl) || null,
        description: (editGift.description || '').trim() || null,
      });
      setEditGift(null);
      showToast('✅ Đã cập nhật quà.');
    } catch (e) { showToast('❌ Lỗi: ' + e.message); }
  };

  const toggleGiftAvailable = (g) => update(ref(db, `gifts/${g.id}`), { available: g.available === false });
  const confirmDeleteGift = async () => {
    await remove(ref(db, `gifts/${deleteGift.id}`));
    setDeleteGift(null);
    showToast('Đã xóa quà.');
  };

  // --- DUYỆT ĐƠN QUÀ (channel 'gift', cả học viên & nhân sự) ---
  const giftOrders = redemptions.filter(r => r.channel === 'gift');
  const filteredOrders = giftOrders.filter(r => statusFilter === 'all' || r.status === statusFilter);
  const pendingGiftCount = giftOrders.filter(r => r.status === 'pending').length;

  // Kiểm tra số dư ví của người đổi theo loại tài khoản + ví
  const checkBalance = (r) => {
    const need = Number(r.totalCredits) || 0;
    const wallet = r.wallet || 'bonus';
    if (wallet === 'plus') return { enough: getPlusBalance(r.studentId) >= need, text: `Credits + hiện có: ${getPlusBalance(r.studentId)}` };
    if (r.userType === 'staff') return { enough: getStaffBalance(r.studentId) >= need, text: `Credits (BOD grant) hiện có: ${getStaffBalance(r.studentId)}` };
    const balances = getBonusBalances(r.studentId);
    const total = balances.reduce((a, b) => a + b.bonus, 0);
    return { enough: total >= need * 2, text: `Bonus hiện có: ${total} (cần ${need * 2})` };
  };

  const handleConfirm = async (r) => {
    setProcessing(r.id);
    try {
      const need = Number(r.totalCredits) || 0;
      const wallet = r.wallet || 'bonus';
      const timestamp = new Date().toISOString();
      const updates = {};
      const { enough } = checkBalance(r);
      if (!enough) { showToast('⚠️ Người đổi không đủ số dư — hãy Từ chối.'); setProcessing(null); return; }

      if (wallet === 'plus') {
        const bal = getPlusBalance(r.studentId);
        updates[`creditPlus/${r.studentId}/balance`] = bal - need;
        const k = push(ref(db, `creditPlus/${r.studentId}/history`)).key;
        updates[`creditPlus/${r.studentId}/history/${k}`] = { amount: -need, by: currentUser.name, date: timestamp, note: `Đổi quà: ${itemsText(r.items)}` };
      } else if (r.userType === 'staff') {
        const bal = getStaffBalance(r.studentId);
        updates[`staffCredits/${r.studentId}/balance`] = bal - need;
        const k = push(ref(db, `staffCredits/${r.studentId}/history`)).key;
        updates[`staffCredits/${r.studentId}/history/${k}`] = { amount: -need, reason: `Đổi quà: ${itemsText(r.items)}`, by: currentUser.name, date: timestamp };
      } else {
        // Học viên ví Credits — ghi record bonus ÂM (lớp bonus cao nhất trước)
        const balances = getBonusBalances(r.studentId);
        let remaining = need * 2;
        const today = timestamp.slice(0, 10);
        for (const b of balances) {
          if (remaining <= 0) break;
          const take = Math.min(b.bonus, remaining);
          if (take <= 0) continue;
          const key = push(ref(db, `scores/${b.classId}/${r.studentId}/bonus`)).key;
          updates[`scores/${b.classId}/${r.studentId}/bonus/${key}`] = {
            score: -take, date: today, timestamp,
            content: `Đổi BAVN Credits (quà): ${itemsText(r.items)} (−${need} credits)`,
          };
          remaining -= take;
        }
      }
      updates[`redemptions/${r.id}/status`] = 'confirmed';
      updates[`redemptions/${r.id}/confirmedBy`] = currentUser.name;
      updates[`redemptions/${r.id}/confirmedAt`] = timestamp;
      await update(ref(db), updates);
      showToast(`✅ Đã xác nhận — trừ ${need} credits của ${r.studentName}.`);
    } catch (e) {
      showToast('❌ Lỗi: ' + e.message);
    } finally {
      setProcessing(null);
      setConfirmTarget(null);
    }
  };

  const handleReject = async (r) => {
    if (!rejectReason.trim()) return showToast('⚠️ Nhập lý do từ chối.');
    setProcessing(r.id);
    try {
      await update(ref(db, `redemptions/${r.id}`), {
        status: 'rejected', rejectedBy: currentUser.name,
        rejectedAt: new Date().toISOString(), rejectReason: rejectReason.trim(),
      });
      showToast(`Đã từ chối — credits hoàn lại cho ${r.studentName}.`);
      setRejectReason('');
    } catch (e) {
      showToast('❌ Lỗi: ' + e.message);
    } finally {
      setProcessing(null);
      setConfirmTarget(null);
    }
  };

  if (!bodAccess) {
    return (
      <div className="card-std p-10 text-center">
        <p className="text-4xl mb-3">👑</p>
        <p className="font-bold text-slate-700">BAVN Center</p>
        <p className="text-sm text-slate-400 mt-1">Khu vực dành cho BOD. Liên hệ Admin để được gán quyền.</p>
      </div>
    );
  }

  const tabCls = (t, color) => `flex-1 md:flex-none md:px-5 py-3 rounded-xl text-sm font-semibold transition-all border ${activeTab === t ? `${color} text-white` : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`;

  return (
    <div className="space-y-6 animate-fade-in-up pb-10">

      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white max-w-[90vw]"
          style={{ background: toastMsg.startsWith('✅') ? '#059669' : toastMsg.startsWith('⚠️') ? '#d97706' : toastMsg.startsWith('❌') ? '#dc2626' : '#7c3aed' }}>
          {toastMsg}
        </div>
      )}

      {/* MODAL DUYỆT / TỪ CHỐI ĐƠN QUÀ */}
      {confirmTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full space-y-4 border border-slate-100">
            <p className="text-sm font-medium text-slate-700">
              {confirmTarget.action === 'confirm'
                ? <>Xác nhận đổi <b>{itemsText(confirmTarget.r.items)}</b> — trừ <b className="text-purple-700">{confirmTarget.r.totalCredits} credits</b> của <b>{confirmTarget.r.studentName}</b>?</>
                : <>Từ chối yêu cầu của <b>{confirmTarget.r.studentName}</b>? Credits sẽ được hoàn lại.</>}
            </p>
            {confirmTarget.action === 'reject' && (
              <textarea rows={2} autoFocus maxLength={200}
                className="w-full border border-red-300 p-3 rounded-xl text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition resize-none"
                placeholder="Lý do từ chối (bắt buộc — VD: quà tạm hết hàng...)"
                value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              />
            )}
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmTarget(null)} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Hủy</button>
              <button
                onClick={() => confirmTarget.action === 'confirm' ? handleConfirm(confirmTarget.r) : handleReject(confirmTarget.r)}
                disabled={processing === confirmTarget.r.id || (confirmTarget.action === 'reject' && !rejectReason.trim())}
                className={`px-4 py-2 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${confirmTarget.action === 'confirm' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-red-500 hover:bg-red-600'}`}
              >
                {processing === confirmTarget.r.id ? 'Đang xử lý...' : confirmTarget.action === 'confirm' ? 'Xác nhận trừ credits' : 'Từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SỬA QUÀ */}
      {editGift && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full space-y-3 border border-slate-100 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-purple-700">Sửa quà ({editGift.audience === 'staff' ? 'nhân sự' : 'học viên'})</h3>
            <input className="w-full border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-purple-500 transition"
              value={editGift.name} onChange={e => setEditGift({ ...editGift, name: e.target.value })} placeholder="Tên quà" />
            <input type="number" min="1" className="w-full border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-purple-500 transition"
              value={editGift.price} onChange={e => setEditGift({ ...editGift, price: e.target.value })} placeholder="Giá (⭐)" />
            <input className="w-full border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-purple-500 transition font-mono"
              value={editGift.imageUrl || ''} onChange={e => setEditGift({ ...editGift, imageUrl: e.target.value })} placeholder="Link ảnh (Dropbox dán thẳng được)" />
            {editGift.imageUrl?.trim() && (
              <div className="h-40 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-center overflow-hidden">
                <img src={normalizeImageUrl(editGift.imageUrl)} alt="Xem trước" className="max-w-full max-h-full object-contain" onError={(e) => { e.target.parentElement.style.display = 'none'; }} />
              </div>
            )}
            <textarea rows={3} className="w-full border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-purple-500 transition resize-none"
              value={editGift.description || ''} onChange={e => setEditGift({ ...editGift, description: e.target.value })} placeholder="Mô tả quà" />
            <div className="flex gap-3 justify-end pt-1">
              <button onClick={() => setEditGift(null)} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Hủy</button>
              <button onClick={handleSaveGift} className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 transition-colors">Lưu</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL XÓA QUÀ */}
      {deleteGift && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4 border border-slate-100">
            <p className="text-sm font-medium text-slate-700">Xóa quà "<b>{deleteGift.name}</b>"?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteGift(null)} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Hủy</button>
              <button onClick={confirmDeleteGift} className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition-colors">Xóa</button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
        <div className="p-2 bg-purple-50 rounded-xl text-purple-700 text-xl leading-none">👑</div>
        <div>
          <h2 className="page-title text-purple-700">BAVN Center</h2>
          <p className="page-sub">Grant Credits nhân sự · quản lý 2 hệ quà · duyệt đơn đổi quà.</p>
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setActiveTab('grant')} className={tabCls('grant', 'bg-purple-600 border-purple-600')}>⭐ Grant Credits</button>
        <button onClick={() => setActiveTab('giftsStudent')} className={tabCls('giftsStudent', 'bg-purple-600 border-purple-600')}>🎁 Quà học viên ({gifts.filter(g => g.audience === 'student').length})</button>
        <button onClick={() => setActiveTab('giftsStaff')} className={tabCls('giftsStaff', 'bg-purple-600 border-purple-600')}>🎁 Quà nhân sự ({gifts.filter(g => g.audience === 'staff').length})</button>
        <button onClick={() => setActiveTab('orders')} className={`${tabCls('orders', 'bg-purple-600 border-purple-600')} flex items-center justify-center gap-2`}>
          📥 Duyệt đổi quà
          {pendingGiftCount > 0 && <span className="w-5 h-5 bg-amber-400 text-amber-900 text-[10px] font-bold rounded-full flex items-center justify-center">{pendingGiftCount > 9 ? '9+' : pendingGiftCount}</span>}
        </button>
      </div>

      {activeTab === 'grant' ? (
        <div className="card-std p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-purple-700 uppercase tracking-wide">⭐ Grant BAVN Credits cho nhân sự</h3>
            <p className="text-xs text-slate-400 mt-1">Cấp credits thưởng (1 credit = 1.000đ), bắt buộc nhập lý do — grant được cho cả chính mình.</p>
          </div>

          {!grantTarget ? (
            <div>
              <input type="text"
                className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 text-sm bg-slate-50 focus:bg-white transition-colors"
                placeholder="Tìm nhân sự theo tên hoặc ID đăng nhập (gõ tên mình để tự grant)..."
                value={grantSearch} onChange={e => setGrantSearch(e.target.value)}
              />
              {grantCandidates.length > 0 && (
                <div className="mt-2 border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                  {grantCandidates.map(u => (
                    <button key={u.id} onClick={() => { setGrantTarget(u); setGrantConfirming(false); }}
                      className="w-full flex items-center justify-between p-3 bg-white hover:bg-purple-50 transition-colors text-left">
                      <div>
                        <p className="text-sm font-bold text-slate-700">{u.name}{u.id === currentUser.id && <span className="text-purple-600"> (chính mình)</span>}</p>
                        <p className="text-[11px] text-slate-400">@{u.loginId || (u.email || '').split('@')[0]} · {u.subRole}</p>
                      </div>
                      <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-100">Credits: {getStaffBalance(u.id)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-purple-50 border border-purple-200 rounded-xl">
                <div>
                  <p className="text-sm font-bold text-slate-800">{grantTarget.name}{grantTarget.id === currentUser.id && ' (chính mình)'}</p>
                  <p className="text-[11px] text-slate-500">Credits hiện có: <b className="text-purple-700">{getStaffBalance(grantTarget.id)}</b> · Credits +: <b className="text-sky-700">{getPlusBalance(grantTarget.id)}</b></p>
                </div>
                <button onClick={() => { setGrantTarget(null); setGrantConfirming(false); }} className="text-xs font-bold text-slate-500 hover:text-red-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200 transition-colors">Đổi nhân sự</button>
              </div>
              <div className="flex flex-col md:flex-row gap-2">
                <input type="number" min="1" step="1"
                  className="md:w-44 p-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-purple-500 transition"
                  placeholder="Số credits" value={grantAmount}
                  onChange={e => { setGrantAmount(e.target.value); setGrantConfirming(false); }}
                />
                <input
                  className="flex-1 p-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-purple-500 transition"
                  placeholder="Lý do cụ thể (bắt buộc — VD: thưởng hoàn thành dự án ABC tháng 6)"
                  value={grantReason} maxLength={200}
                  onChange={e => { setGrantReason(e.target.value); setGrantConfirming(false); }}
                />
                <button onClick={handleGrant}
                  className={`px-6 py-3 rounded-xl text-sm font-bold text-white transition-colors ${grantConfirming ? 'bg-amber-500 hover:bg-amber-600' : 'bg-purple-600 hover:bg-purple-700'}`}>
                  {grantConfirming ? `Bấm lần nữa: grant ${grantAmount} ⭐` : 'Grant Credits'}
                </button>
              </div>
            </div>
          )}

          {/* Lịch sử grant toàn hệ thống */}
          <div className="pt-3 border-t border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">📜 Lịch sử Credits nhân sự gần đây</p>
            {grantHistory.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-5 bg-slate-50 rounded-xl border border-dashed border-slate-200">Chưa có giao dịch nào.</p>
            ) : (
              <div className="space-y-1.5 max-h-80 overflow-y-auto">
                {grantHistory.map(h => (
                  <div key={h.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                    <div className="min-w-0 mr-2">
                      <p className="font-bold text-slate-700 truncate">{h.staffName}</p>
                      <p className="text-slate-500 truncate">{h.reason || h.note || '—'} <span className="text-slate-400">· bởi {h.by}</span></p>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <b className={`text-sm ${h.amount >= 0 ? 'text-purple-700' : 'text-red-500'}`}>{h.amount >= 0 ? '+' : ''}{h.amount} ⭐</b>
                      <span className="text-slate-400 font-mono text-[10px]">{new Date(h.date).toLocaleString('vi-VN')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'orders' ? (
        <div className="card-std p-5">
          <div className="flex gap-1.5 flex-wrap mb-4">
            {['pending', 'confirmed', 'rejected', 'all'].map(st => (
              <button key={st} onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${statusFilter === st ? 'bg-purple-600 text-white border-purple-600' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}>
                {st === 'all' ? 'Tất cả' : STATUS_META[st].label}
              </button>
            ))}
          </div>

          {filteredOrders.length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">Không có đơn đổi quà nào.</p>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map(r => {
                const meta = STATUS_META[r.status] || STATUS_META.pending;
                const bal = r.status === 'pending' ? checkBalance(r) : null;
                return (
                  <div key={r.id} className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col gap-2.5">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 text-sm">
                          {r.studentName}
                          <span className={`ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${r.userType === 'staff' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-[#E8F4EC] text-[#2B6830] border-green-200'}`}>
                            {r.userType === 'staff' ? 'Nhân sự' : 'Học viên'}
                          </span>
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">{itemsText(r.items)}</p>
                        {r.note && <p className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mt-1.5 inline-block">📝 {r.note}</p>}
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">{new Date(r.date).toLocaleString('vi-VN')}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${meta.cls}`}>{meta.label}</span>
                        <span className="text-base font-extrabold text-purple-700">{r.totalCredits} ⭐</span>
                      </div>
                    </div>

                    {r.status === 'pending' && (
                      <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-slate-100 flex-wrap">
                        <p className={`text-[11px] font-bold ${bal.enough ? 'text-slate-500' : 'text-red-600'}`}>{bal.text}{!bal.enough && ' — KHÔNG ĐỦ'}</p>
                        <div className="flex gap-2">
                          <button onClick={() => { setRejectReason(''); setConfirmTarget({ r, action: 'reject' }); }}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-colors">Từ chối</button>
                          <button onClick={() => setConfirmTarget({ r, action: 'confirm' })} disabled={!bal.enough}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Xác nhận & trừ credits</button>
                        </div>
                      </div>
                    )}
                    {r.status === 'confirmed' && r.confirmedBy && (
                      <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-100">✓ Xác nhận bởi <b>{r.confirmedBy}</b> · {r.confirmedAt && new Date(r.confirmedAt).toLocaleString('vi-VN')}</p>
                    )}
                    {r.status === 'rejected' && r.rejectedBy && (
                      <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                        ✕ Từ chối bởi <b>{r.rejectedBy}</b>{r.rejectReason && <span className="text-red-500"> · Lý do: <b>{r.rejectReason}</b></span>}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ===== QUẢN LÝ QUÀ (học viên / nhân sự theo tab) ===== */
        <div className="space-y-5">
          <div className="card-std p-5">
            <h3 className="text-sm font-bold text-purple-700 uppercase tracking-wide mb-3">
              Thêm quà cho {audience === 'staff' ? 'nhân sự' : 'học viên'}
            </h3>
            <form onSubmit={handleAddGift} className="flex flex-col md:flex-row gap-2">
              <input className="flex-1 border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-purple-500 transition"
                placeholder="Tên quà (VD: Voucher 100k, Sổ tay BAVN...)" value={giftForm.name} onChange={e => setGiftForm({ ...giftForm, name: e.target.value })} />
              <input type="number" min="1" className="w-full md:w-32 border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-purple-500 transition"
                placeholder="Giá (⭐)" value={giftForm.price} onChange={e => setGiftForm({ ...giftForm, price: e.target.value })} />
              <button type="submit" className="bg-purple-600 text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-purple-700 transition-colors">+ Thêm</button>
            </form>
            <p className="text-[11px] text-slate-400 mt-2">💡 Ảnh và mô tả quà thêm qua nút <b>Sửa</b>. Hệ quà học viên và nhân sự hoàn toàn tách biệt.</p>
          </div>

          <div className="card-std p-5">
            <h3 className="text-sm font-bold text-purple-700 uppercase tracking-wide mb-3">Danh sách quà {audience === 'staff' ? 'nhân sự' : 'học viên'} ({giftList.length})</h3>
            {giftList.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">Chưa có quà nào — thêm quà đầu tiên ở trên.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {giftList.map(g => (
                  <div key={g.id} className={`group rounded-xl border overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-1.5 hover:shadow-xl ${g.available === false ? 'border-slate-200 bg-slate-50 opacity-60' : 'border-slate-200 bg-white hover:border-purple-300'}`}>
                    {g.imageUrl && (
                      <div className="h-40 overflow-hidden bg-slate-50 flex items-center justify-center">
                        <img src={g.imageUrl} alt={g.name} className="max-w-full max-h-full object-contain transition-transform duration-300 ease-out group-hover:scale-110" onError={(e) => { e.target.parentElement.style.display = 'none'; }} />
                      </div>
                    )}
                    <div className="p-4 flex flex-col gap-2 flex-1">
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-800 text-sm leading-snug group-hover:text-purple-700 transition-colors">🎁 {g.name}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">{g.available === false ? 'ĐANG ẨN' : 'Đang mở đổi'}</p>
                        </div>
                        <span className="shrink-0 text-sm font-extrabold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-100">{g.price} ⭐</span>
                      </div>
                      <div className="flex gap-2 pt-1 mt-auto">
                        <button onClick={() => toggleGiftAvailable(g)}
                          className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${g.available === false ? 'text-green-700 bg-green-50 border-green-200 hover:bg-green-100' : 'text-slate-500 bg-slate-50 border-slate-200 hover:bg-slate-100'}`}>
                          {g.available === false ? 'Hiện lại' : 'Tạm ẩn'}
                        </button>
                        <button onClick={() => setEditGift({ ...g })}
                          className="flex-1 py-1.5 rounded-lg text-[11px] font-bold text-purple-700 bg-purple-50 border border-purple-100 hover:bg-purple-100 transition-colors">Sửa</button>
                        <button onClick={() => setDeleteGift(g)}
                          className="flex-1 py-1.5 rounded-lg text-[11px] font-bold text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-colors">Xóa</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BavnCenter;
