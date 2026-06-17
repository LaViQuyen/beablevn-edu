import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { ref, onValue, push, set } from 'firebase/database';

// ============================================================
// BAVN CREDITS — Cổng học viên
// 2 ví: Credits (quy đổi từ Bonus, 2 Bonus = 1 Credit)
//        Credits + (nạp tiền mặt qua nhân sự FF+, 1.000đ = 1 Credit +)
// Khi đổi quà: nếu có Credits + thì popup hỏi trừ ví nào;
// không có Credits + thì mặc định trừ Credits (không hỏi).
// ============================================================

// 2 loại menu Fresh Fit + Quà tặng (drink/food là loại cũ, giữ để tương thích)
const CATEGORY_META = {
  sothich:   { label: 'Theo sở thích', icon: '🧋' },
  thucduong: { label: 'Thực dưỡng',    icon: '🌿' },
  gift:      { label: 'Quà tặng',      icon: '🎁' },
  drink:     { label: 'Thức uống',     icon: '🥤' },
  food:      { label: 'Đồ ăn',         icon: '🍱' },
};

const STATUS_META = {
  pending:   { label: 'Chờ duyệt', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  confirmed: { label: 'Đã nhận',   cls: 'bg-green-50 text-green-700 border-green-200' },
  rejected:  { label: 'Từ chối',   cls: 'bg-red-50 text-red-600 border-red-200' },
};

const StudentCredits = () => {
  const { currentUser } = useAuth();
  const [classes, setClasses] = useState({});
  const [allScores, setAllScores] = useState({});
  const [menu, setMenu] = useState([]);
  const [gifts, setGifts] = useState([]); // hệ quà học viên — BOD quản lý, BOD duyệt
  const [myRedemptions, setMyRedemptions] = useState([]);
  const [creditPlusBal, setCreditPlusBal] = useState(0); // số dư ví Credits + (nạp tiền)
  const [loading, setLoading] = useState(true);

  // Giỏ đổi quà: { itemId: số lượng }
  const [cart, setCart] = useState({});
  const [orderNote, setOrderNote] = useState(''); // ghi chú cho quầy: ít ngọt, ít đá, không topping...
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchKeyword, setSearchKeyword] = useState(''); // tìm kiếm nhanh món
  const [submitting, setSubmitting] = useState(false);
  const [confirmingSend, setConfirmingSend] = useState(false); // bấm lần 2 mới gửi (khi không có Credits +)
  const [walletModal, setWalletModal] = useState(false);       // popup chọn ví thanh toán
  const [viewItem, setViewItem] = useState(null);              // modal chi tiết món (ảnh + mô tả)
  const [toastMsg, setToastMsg] = useState('');
  const showToast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 3500); };

  const myClassIds = currentUser?.classIds
    ? (Array.isArray(currentUser.classIds) ? currentUser.classIds : Object.values(currentUser.classIds))
    : [];

  useEffect(() => {
    if (!currentUser) return;
    const unsubClasses = onValue(ref(db, 'classes'), (snap) => setClasses(snap.val() || {}));
    const unsubScores = onValue(ref(db, 'scores'), (snap) => { setAllScores(snap.val() || {}); setLoading(false); });
    const unsubMenu = onValue(ref(db, 'ffMenu'), (snap) => {
      const data = snap.val() || {};
      setMenu(Object.entries(data).map(([id, val]) => ({ id, ...val })));
    });
    const unsubGifts = onValue(ref(db, 'gifts'), (snap) => {
      const data = snap.val() || {};
      setGifts(Object.entries(data).map(([id, val]) => ({ id, ...val })));
    });
    const unsubRedeem = onValue(ref(db, 'redemptions'), (snap) => {
      const data = snap.val() || {};
      const mine = Object.entries(data)
        .map(([id, val]) => ({ id, ...val }))
        .filter(r => r.studentId === currentUser.id)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      setMyRedemptions(mine);
    });
    // Ví Credits + của riêng học viên này
    const unsubPlus = onValue(ref(db, `creditPlus/${currentUser.id}/balance`), (snap) => {
      setCreditPlusBal(Number(snap.val()) || 0);
    });
    return () => { unsubClasses(); unsubScores(); unsubMenu(); unsubGifts(); unsubRedeem(); unsubPlus(); };
  }, [currentUser?.id]);

  // --- Tính điểm Bonus theo từng lớp (cấu trúc: scores/classId/studentId/bonus/recordId) ---
  const bonusByClass = useMemo(() => {
    return myClassIds.map(cid => {
      const records = allScores[cid]?.[currentUser?.id]?.bonus || {};
      const sum = Object.values(records).reduce((a, r) => a + (Number(r.score) || 0), 0);
      return { classId: cid, className: classes[cid]?.name || cid, bonus: sum };
    });
  }, [allScores, classes, currentUser?.id, myClassIds.join(',')]);

  const totalBonus = bonusByClass.reduce((a, b) => a + b.bonus, 0);
  const totalCredits = Math.floor(totalBonus / 2); // 2 Bonus = 1 Credit

  // Credit đang bị tạm giữ bởi yêu cầu chờ duyệt — tách theo từng ví
  const pendingBonusHold = myRedemptions
    .filter(r => r.status === 'pending' && (r.wallet || 'bonus') !== 'plus')
    .reduce((a, r) => a + (Number(r.totalCredits) || 0), 0);
  const pendingPlusHold = myRedemptions
    .filter(r => r.status === 'pending' && r.wallet === 'plus')
    .reduce((a, r) => a + (Number(r.totalCredits) || 0), 0);

  const availableCredits = totalCredits - pendingBonusHold;   // ví Credits (từ Bonus)
  const availablePlus = creditPlusBal - pendingPlusHold;      // ví Credits + (nạp tiền)

  // --- Catalog gộp: món Fresh Fit (kênh FF duyệt) + quà học viên (kênh BOD duyệt) ---
  const catalog = useMemo(() => {
    const ffItems = menu
      .filter(m => m.available !== false && m.category !== 'gift')
      .map(m => ({ ...m, src: 'ff' }));
    const giftItems = gifts
      .filter(g => g.available !== false && g.audience === 'student')
      .map(g => ({ ...g, category: 'gift', src: 'gift' }));
    return [...ffItems, ...giftItems];
  }, [menu, gifts]);

  // --- Giỏ hàng ---
  const cartTotal = Object.entries(cart).reduce((sum, [id, qty]) => {
    const item = catalog.find(m => m.id === id);
    return sum + (item ? (Number(item.price) || 0) * qty : 0);
  }, 0);
  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);

  const addToCart = (id) => { setConfirmingSend(false); setCart(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 })); };
  const removeFromCart = (id) => {
    setConfirmingSend(false);
    setCart(prev => {
      const next = { ...prev };
      if (next[id] > 1) next[id] -= 1; else delete next[id];
      return next;
    });
  };

  // --- Gửi yêu cầu đổi với ví đã chọn ---
  const submitRedeem = async (wallet) => {
    const avail = wallet === 'plus' ? availablePlus : availableCredits;
    if (cartTotal > avail) return showToast(`⚠️ Không đủ số dư ví ${wallet === 'plus' ? 'Credits +' : 'Credits'}!`);

    setSubmitting(true);
    try {
      // Tách giỏ thành 2 kênh: món (FF duyệt) và quà (BOD duyệt) — tự gửi tối đa 2 đơn
      const buckets = { ff: [], gift: [] };
      Object.entries(cart).forEach(([id, qty]) => {
        const item = catalog.find(m => m.id === id);
        if (!item) return;
        buckets[item.src].push({ id, name: item.name, price: Number(item.price) || 0, qty });
      });

      const base = {
        studentId: currentUser.id,
        studentName: currentUser.name,
        userType: 'student',
        wallet, // 'bonus' | 'plus' — trừ đúng ví này khi xác nhận
        note: orderNote.trim() || null,
        status: 'pending',
        date: new Date().toISOString(),
      };

      let count = 0;
      for (const channel of ['ff', 'gift']) {
        const items = buckets[channel];
        if (items.length === 0) continue;
        const total = items.reduce((a, i) => a + i.price * i.qty, 0);
        const newRef = push(ref(db, 'redemptions'));
        await set(newRef, { ...base, items, totalCredits: total, channel });
        count++;
      }

      setCart({});
      setOrderNote('');
      setConfirmingSend(false);
      setWalletModal(false);
      showToast(count === 2
        ? '✅ Đã gửi 2 yêu cầu: món (quầy Fresh Fit duyệt) và quà (BOD duyệt).'
        : '✅ Đã gửi yêu cầu! Chờ duyệt nhé.');
    } catch (e) {
      showToast('❌ Lỗi: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Nút "Gửi yêu cầu đổi": có Credits + thì popup hỏi ví; không có thì trừ Credits mặc định
  const handleSubmit = () => {
    if (cartCount === 0) return;
    if (availablePlus > 0) { setWalletModal(true); return; }
    if (cartTotal > availableCredits) return showToast('⚠️ Không đủ credits khả dụng!');
    if (!confirmingSend) { setConfirmingSend(true); return; } // bấm lần đầu: hiện xác nhận
    submitRedeem('bonus');
  };

  const visibleMenu = catalog
    .filter(m => activeCategory === 'all' || m.category === activeCategory)
    .filter(m => !searchKeyword.trim() || m.name?.toLowerCase().includes(searchKeyword.trim().toLowerCase()));

  const itemsText = (items) => (items || []).map(i => `${i.name} ×${i.qty}`).join(', ');

  return (
    <div className="space-y-6 animate-fade-in-up pb-10">

      {/* TOAST */}
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white max-w-[90vw]"
          style={{ background: toastMsg.startsWith('✅') ? '#059669' : toastMsg.startsWith('⚠️') ? '#d97706' : '#dc2626' }}>
          {toastMsg}
        </div>
      )}

      {/* ===== POPUP CHỌN VÍ THANH TOÁN ===== */}
      {walletModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setWalletModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full space-y-4 border border-slate-100" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-[#2B6830] text-base">Chọn ví thanh toán</h3>
            <p className="text-sm text-slate-600">Đơn đổi quà của bạn: <b>{cartTotal} credits</b>. Bạn muốn trừ vào ví nào?</p>
            <div className="space-y-2.5">
              <button
                onClick={() => submitRedeem('bonus')}
                disabled={submitting || cartTotal > availableCredits}
                className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-green-200 bg-[#E8F4EC]/50 hover:border-[#2B6830] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="text-sm font-bold text-[#2B6830]">⭐ Credits <span className="font-medium text-slate-500">(quy đổi từ Bonus)</span></span>
                <span className="text-sm font-extrabold text-[#2B6830]">Còn {availableCredits}</span>
              </button>
              <button
                onClick={() => submitRedeem('plus')}
                disabled={submitting || cartTotal > availablePlus}
                className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-sky-200 bg-sky-50/50 hover:border-sky-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="text-sm font-bold text-sky-700">💳 Credits + <span className="font-medium text-slate-500">(đã nạp)</span></span>
                <span className="text-sm font-extrabold text-sky-700">Còn {availablePlus}</span>
              </button>
            </div>
            <button onClick={() => setWalletModal(false)} className="w-full py-2.5 rounded-xl text-sm font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors">Hủy</button>
          </div>
        </div>
      )}

      {/* ===== MODAL CHI TIẾT MÓN (ảnh + mô tả) ===== */}
      {viewItem && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setViewItem(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-100 overflow-hidden" onClick={e => e.stopPropagation()}>
            {viewItem.imageUrl && (
              <div className="h-64 bg-slate-50 flex items-center justify-center">
                <img src={viewItem.imageUrl} alt={viewItem.name} className="max-w-full max-h-full object-contain" onError={(e) => { e.target.parentElement.style.display = 'none'; }} />
              </div>
            )}
            <div className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-800 text-lg leading-snug">{CATEGORY_META[viewItem.category]?.icon || '🛍️'} {viewItem.name}</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase mt-1">{CATEGORY_META[viewItem.category]?.label || 'Khác'}{viewItem.group && ` · ${viewItem.group}`}</p>
                </div>
                <span className="shrink-0 text-lg font-extrabold text-[#2B6830] bg-[#E8F4EC] px-3 py-1.5 rounded-xl border border-green-100">{viewItem.price} ⭐</span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                {viewItem.description || <span className="italic text-slate-400">Chưa có mô tả cho món này.</span>}
              </p>
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  {(cart[viewItem.id] || 0) > 0 && (
                    <>
                      <button onClick={() => removeFromCart(viewItem.id)} className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 font-bold text-lg hover:border-red-300 hover:text-red-500 transition-colors">−</button>
                      <span className="w-8 text-center font-extrabold text-[#2B6830] text-lg">{cart[viewItem.id]}</span>
                    </>
                  )}
                  <button onClick={() => addToCart(viewItem.id)} className="w-10 h-10 rounded-xl bg-[#2B6830] text-white font-bold text-lg hover:bg-[#1E5225] transition-colors">+</button>
                </div>
                <button onClick={() => setViewItem(null)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Đóng</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== HERO: 2 VÍ CREDITS ===== */}
      <div className="bg-gradient-to-r from-[#2B6830] to-[#3D8B47] rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <p className="text-green-200 text-xs font-bold uppercase tracking-wider">Ví BAVN Credits</p>
          <div className="flex items-end gap-2 mt-1 mb-4">
            <span className="text-5xl font-extrabold leading-none">{loading ? '—' : availableCredits}</span>
            <span className="text-green-200 font-bold mb-1">credits khả dụng</span>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="bg-white/15 rounded-xl px-4 py-2.5">
              <p className="text-[10px] font-bold text-green-200 uppercase tracking-wider">Tổng điểm Bonus</p>
              <p className="text-xl font-extrabold">{loading ? '—' : totalBonus}</p>
            </div>
            <div className="bg-white/15 rounded-xl px-4 py-2.5">
              <p className="text-[10px] font-bold text-green-200 uppercase tracking-wider">Quy đổi</p>
              <p className="text-xl font-extrabold">{loading ? '—' : totalCredits} <span className="text-xs font-bold text-green-200">credits</span></p>
            </div>
            {/* Ví Credits + — nạp tiền mặt tại quầy, hiển thị riêng */}
            <div className="bg-sky-400/25 rounded-xl px-4 py-2.5 border border-sky-200/40">
              <p className="text-[10px] font-bold text-sky-100 uppercase tracking-wider">💳 Credits +</p>
              <p className="text-xl font-extrabold text-sky-50">{loading ? '—' : availablePlus} <span className="text-xs font-bold text-sky-200">credits</span></p>
            </div>
            {(pendingBonusHold + pendingPlusHold) > 0 && (
              <div className="bg-amber-400/20 rounded-xl px-4 py-2.5 border border-amber-200/30">
                <p className="text-[10px] font-bold text-amber-100 uppercase tracking-wider">Đang chờ duyệt</p>
                <p className="text-xl font-extrabold text-amber-100">−{pendingBonusHold + pendingPlusHold}</p>
              </div>
            )}
          </div>
          <p className="text-green-200/80 text-[11px] mt-3">💡 Mỗi 2 điểm Bonus = 1 Credit = 1.000đ. <b>Credits +</b> là phần nạp thêm bằng tiền mặt tại quầy Fresh Fit (gặp nhân sự FF+).</p>
        </div>
        <div className="absolute right-0 top-0 w-40 h-40 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl" />
      </div>

      {/* ===== BONUS THEO TỪNG LỚP ===== */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <h3 className="text-sm font-bold text-[#2B6830] mb-3 uppercase tracking-wide">Điểm Bonus theo lớp</h3>
        {bonusByClass.length === 0 ? (
          <p className="text-xs text-slate-400 italic">Bạn chưa được gán vào lớp nào.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {bonusByClass.map(b => (
              <div key={b.classId} className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                <p className="text-xs font-bold text-slate-500 truncate" title={b.className}>{b.className}</p>
                <p className="text-2xl font-extrabold text-[#2B6830] mt-1">{b.bonus} <span className="text-[10px] font-bold text-slate-400 uppercase">bonus</span></p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== MENU ĐỔI QUÀ FRESH FIT ===== */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-bold text-[#2B6830] uppercase tracking-wide">🌿 Đổi quà Fresh Fit</h3>
          <div className="flex gap-1.5 flex-wrap">
            {['all', 'sothich', 'thucduong', 'gift'].map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${activeCategory === cat ? 'bg-[#2B6830] text-white border-[#2B6830]' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}
              >
                {cat === 'all' ? 'Tất cả' : `${CATEGORY_META[cat].icon} ${CATEGORY_META[cat].label}`}
              </button>
            ))}
          </div>
        </div>

        {/* Ô TÌM KIẾM NHANH MÓN */}
        <div className="relative mb-4">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-slate-400"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
          </div>
          <input
            type="text"
            className="w-full pl-10 p-3 border border-slate-200 rounded-xl outline-none focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10 text-sm text-slate-700 bg-slate-50 focus:bg-white transition-colors"
            placeholder="Tìm nhanh món cần đổi (VD: trà sữa, cơm gà...)..."
            value={searchKeyword}
            onChange={e => setSearchKeyword(e.target.value)}
          />
          {searchKeyword && (
            <button onClick={() => setSearchKeyword('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>

        {visibleMenu.length === 0 ? (
          <p className="text-xs text-slate-400 italic text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            {searchKeyword ? `Không tìm thấy món nào khớp "${searchKeyword}".` : 'Menu đang được cập nhật — quay lại sau nhé!'}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {visibleMenu.map(item => {
              const qty = cart[item.id] || 0;
              return (
                <div
                  key={item.id}
                  onClick={() => setViewItem(item)}
                  className={`group rounded-xl border overflow-hidden flex flex-col cursor-pointer transition-all duration-200 hover:-translate-y-1.5 hover:shadow-xl ${qty > 0 ? 'border-[#2B6830] bg-[#E8F4EC]/40 ring-2 ring-[#2B6830]/20' : 'border-slate-200 bg-white hover:border-green-300'}`}
                >
                  {/* Ảnh món lớn phía trên — hover phóng to để nhìn rõ món */}
                  {item.imageUrl && (
                    <div className="h-40 overflow-hidden bg-slate-50 flex items-center justify-center">
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="max-w-full max-h-full object-contain transition-transform duration-300 ease-out group-hover:scale-110"
                        onError={(e) => { e.target.parentElement.style.display = 'none'; }}
                      />
                    </div>
                  )}
                  <div className="p-4 flex flex-col gap-2 flex-1">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-800 text-sm leading-snug group-hover:text-[#2B6830] transition-colors">{CATEGORY_META[item.category]?.icon || '🛍️'} {item.name}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">{CATEGORY_META[item.category]?.label || 'Khác'}{item.group && ` · ${item.group}`}</p>
                      </div>
                      <span className="shrink-0 text-sm font-extrabold text-[#2B6830] bg-white px-2.5 py-1 rounded-lg border border-green-100">{item.price} ⭐</span>
                    </div>
                    <div className="flex items-center justify-end gap-2 mt-auto pt-2" onClick={e => e.stopPropagation()}>
                      {qty > 0 && (
                        <>
                          <button onClick={() => removeFromCart(item.id)} className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-600 font-bold hover:border-red-300 hover:text-red-500 transition-colors">−</button>
                          <span className="w-6 text-center font-extrabold text-[#2B6830]">{qty}</span>
                        </>
                      )}
                      <button onClick={() => addToCart(item.id)} className="w-8 h-8 rounded-lg bg-[#2B6830] text-white font-bold hover:bg-[#1E5225] transition-colors">+</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* THANH GIỎ + GỬI YÊU CẦU */}
        {cartCount > 0 && (
          <div className="mt-4 p-4 bg-[#E8F4EC] border border-green-200 rounded-xl flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-[#2B6830] uppercase tracking-wide mb-0.5">Giỏ đổi quà ({cartCount} món)</p>
              <p className="text-xs text-slate-600 truncate">
                {Object.entries(cart).map(([id, q]) => `${catalog.find(m => m.id === id)?.name || '?'} ×${q}`).join(', ')}
              </p>
              <p className={`text-sm font-extrabold mt-1 ${cartTotal > Math.max(availableCredits, availablePlus) ? 'text-red-600' : 'text-[#2B6830]'}`}>
                Tổng: {cartTotal} credits {cartTotal > Math.max(availableCredits, availablePlus) && '— vượt số dư cả 2 ví!'}
              </p>
              {/* Ghi chú cho quầy — yêu cầu điều chỉnh món */}
              <input
                type="text"
                className="w-full mt-2 p-2.5 border border-green-200 rounded-xl text-xs outline-none focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10 bg-white transition-colors"
                placeholder="📝 Ghi chú cho quầy (VD: ít ngọt, ít đá, không topping...)"
                value={orderNote}
                maxLength={200}
                onChange={e => { setOrderNote(e.target.value); setConfirmingSend(false); }}
              />
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => { setCart({}); setConfirmingSend(false); }} className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors">Xóa giỏ</button>
              <button
                onClick={handleSubmit}
                disabled={submitting || cartTotal > Math.max(availableCredits, availablePlus)}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${confirmingSend ? 'bg-amber-500 hover:bg-amber-600' : 'bg-[#2B6830] hover:bg-[#1E5225]'}`}
              >
                {submitting ? 'Đang gửi...' : confirmingSend ? `Bấm lần nữa để xác nhận (${cartTotal} ⭐)` : 'Gửi yêu cầu đổi'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ===== LỊCH SỬ ĐỔI QUÀ ===== */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <h3 className="text-sm font-bold text-[#2B6830] mb-3 uppercase tracking-wide">Lịch sử đổi quà</h3>
        {myRedemptions.length === 0 ? (
          <p className="text-xs text-slate-400 italic">Chưa có yêu cầu đổi quà nào.</p>
        ) : (
          <div className="space-y-2.5">
            {myRedemptions.map(r => {
              const meta = STATUS_META[r.status] || STATUS_META.pending;
              return (
                <div key={r.id} className="flex items-start justify-between gap-3 p-3.5 rounded-xl border border-slate-100 bg-slate-50/50">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-700 leading-snug">{itemsText(r.items)}</p>
                    {r.note && <p className="text-[11px] text-amber-700 mt-0.5">📝 {r.note}</p>}
                    <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                      {new Date(r.date).toLocaleString('vi-VN')}
                      {r.status === 'confirmed' && r.confirmedBy && ` · xác nhận bởi ${r.confirmedBy}`}
                    </p>
                    {/* Lý do bị từ chối — để học viên hiểu vì sao và credits đã được hoàn */}
                    {r.status === 'rejected' && r.rejectReason && (
                      <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5 mt-1.5 inline-block">
                        ❌ Lý do từ chối: {r.rejectReason} <span className="font-normal text-red-400">(credits đã được hoàn lại)</span>
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {r.channel === 'gift' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded border uppercase bg-purple-50 text-purple-700 border-purple-200">🎁 Quà (BOD)</span>
                      )}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${r.wallet === 'plus' ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-[#E8F4EC] text-[#2B6830] border-green-200'}`}>
                        {r.wallet === 'plus' ? '💳 Credits +' : '⭐ Credits'}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${meta.cls}`}>{meta.label}</span>
                    </div>
                    <span className="text-sm font-extrabold text-[#2B6830]">−{r.totalCredits} ⭐</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentCredits;
