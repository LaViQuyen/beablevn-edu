import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { ref, onValue, push, set } from 'firebase/database';

// ============================================================
// BAVN CREDITS — Cổng nhân sự
// 2 ví: Credits (BOD grant, có lý do) + Credits + (nạp tiền qua FF+)
// Menu: món Fresh Fit (FF duyệt) + Quà nhân sự (BOD duyệt)
// Giỏ trộn được — khi gửi tự tách thành 2 đơn theo kênh duyệt.
// ============================================================

const CATEGORY_META = {
  sothich:   { label: 'Theo sở thích', icon: '🧋' },
  thucduong: { label: 'Thực dưỡng',    icon: '🌿' },
  gift:      { label: 'Quà nhân sự',   icon: '🎁' },
  drink:     { label: 'Thức uống',     icon: '🥤' },
  food:      { label: 'Đồ ăn',         icon: '🍱' },
};

const STATUS_META = {
  pending:   { label: 'Chờ duyệt', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  confirmed: { label: 'Đã nhận',   cls: 'bg-green-50 text-green-700 border-green-200' },
  rejected:  { label: 'Từ chối',   cls: 'bg-red-50 text-red-600 border-red-200' },
};

const StaffCredits = () => {
  const { currentUser } = useAuth();
  const [menu, setMenu] = useState([]);
  const [gifts, setGifts] = useState([]);
  const [myRedemptions, setMyRedemptions] = useState([]);
  const [staffWallet, setStaffWallet] = useState({ balance: 0, history: {} }); // ví Credits do BOD grant
  const [creditPlusBal, setCreditPlusBal] = useState(0);                       // ví Credits + (nạp tiền)
  const [loading, setLoading] = useState(true);

  const [cart, setCart] = useState({});
  const [orderNote, setOrderNote] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmingSend, setConfirmingSend] = useState(false);
  const [walletModal, setWalletModal] = useState(false);
  const [viewItem, setViewItem] = useState(null);
  const [toastMsg, setToastMsg] = useState('');
  const showToast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 3500); };

  useEffect(() => {
    if (!currentUser?.id) return;
    const u1 = onValue(ref(db, 'ffMenu'), (snap) => {
      const data = snap.val() || {};
      setMenu(Object.entries(data).map(([id, val]) => ({ id, ...val })));
      setLoading(false);
    });
    const u2 = onValue(ref(db, 'gifts'), (snap) => {
      const data = snap.val() || {};
      setGifts(Object.entries(data).map(([id, val]) => ({ id, ...val })));
    });
    const u3 = onValue(ref(db, 'redemptions'), (snap) => {
      const data = snap.val() || {};
      const mine = Object.entries(data)
        .map(([id, val]) => ({ id, ...val }))
        .filter(r => r.studentId === currentUser.id)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      setMyRedemptions(mine);
    });
    const u4 = onValue(ref(db, `staffCredits/${currentUser.id}`), (snap) => {
      const v = snap.val() || {};
      setStaffWallet({ balance: Number(v.balance) || 0, history: v.history || {} });
    });
    const u5 = onValue(ref(db, `creditPlus/${currentUser.id}/balance`), (snap) => setCreditPlusBal(Number(snap.val()) || 0));
    return () => { u1(); u2(); u3(); u4(); u5(); };
  }, [currentUser?.id]);

  // --- Catalog gộp: món Fresh Fit (kênh FF) + quà nhân sự (kênh gift) ---
  const catalog = useMemo(() => {
    const ffItems = menu
      .filter(m => m.available !== false && m.category !== 'gift')
      .map(m => ({ ...m, src: 'ff' }));
    const giftItems = gifts
      .filter(g => g.available !== false && g.audience === 'staff')
      .map(g => ({ ...g, category: 'gift', src: 'gift' }));
    return [...ffItems, ...giftItems];
  }, [menu, gifts]);

  // --- Tạm giữ credits theo ví khi chờ duyệt ---
  const pendingStaffHold = myRedemptions
    .filter(r => r.status === 'pending' && (r.wallet || 'staff') !== 'plus')
    .reduce((a, r) => a + (Number(r.totalCredits) || 0), 0);
  const pendingPlusHold = myRedemptions
    .filter(r => r.status === 'pending' && r.wallet === 'plus')
    .reduce((a, r) => a + (Number(r.totalCredits) || 0), 0);

  const availableCredits = staffWallet.balance - pendingStaffHold; // ví Credits (BOD grant)
  const availablePlus = creditPlusBal - pendingPlusHold;           // ví Credits +

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

  const itemsText = (items) => (items || []).map(i => `${i.name} ×${i.qty}`).join(', ');

  // --- Gửi yêu cầu: TỰ TÁCH thành đơn món (FF duyệt) + đơn quà (BOD duyệt) ---
  const submitRedeem = async (wallet) => {
    const avail = wallet === 'plus' ? availablePlus : availableCredits;
    if (cartTotal > avail) return showToast(`⚠️ Không đủ số dư ví ${wallet === 'plus' ? 'Credits +' : 'Credits'}!`);

    setSubmitting(true);
    try {
      const buckets = { ff: [], gift: [] };
      Object.entries(cart).forEach(([id, qty]) => {
        const item = catalog.find(m => m.id === id);
        if (!item) return;
        buckets[item.src].push({ id, name: item.name, price: Number(item.price) || 0, qty });
      });

      const base = {
        studentId: currentUser.id,
        studentName: currentUser.name,
        userType: 'staff', // để FF/BOD trừ đúng loại ví
        wallet,            // 'staff' | 'plus'
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

  const handleSubmit = () => {
    if (cartCount === 0) return;
    if (availablePlus > 0 && availableCredits > 0) { setWalletModal(true); return; }
    const wallet = availablePlus > 0 ? 'plus' : 'staff';
    if (cartTotal > (wallet === 'plus' ? availablePlus : availableCredits)) return showToast('⚠️ Không đủ credits khả dụng!');
    if (!confirmingSend) { setConfirmingSend(true); return; }
    submitRedeem(wallet);
  };

  const visibleMenu = catalog
    .filter(m => activeCategory === 'all' || m.category === activeCategory)
    .filter(m => !searchKeyword.trim() || m.name?.toLowerCase().includes(searchKeyword.trim().toLowerCase()));

  // Lịch sử grant (lý do BOD cấp credits)
  const myGrantHistory = useMemo(() =>
    Object.entries(staffWallet.history)
      .map(([id, h]) => ({ id, ...h }))
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 15)
  , [staffWallet.history]);

  return (
    <div className="space-y-6 animate-fade-in-up pb-10">

      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white max-w-[90vw]"
          style={{ background: toastMsg.startsWith('✅') ? '#059669' : toastMsg.startsWith('⚠️') ? '#d97706' : '#dc2626' }}>
          {toastMsg}
        </div>
      )}

      {/* POPUP CHỌN VÍ */}
      {walletModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setWalletModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full space-y-4 border border-slate-100" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-[#2B6830] text-base">Chọn ví thanh toán</h3>
            <p className="text-sm text-slate-600">Đơn của bạn: <b>{cartTotal} credits</b>. Trừ vào ví nào?</p>
            <div className="space-y-2.5">
              <button onClick={() => submitRedeem('staff')} disabled={submitting || cartTotal > availableCredits}
                className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-purple-200 bg-purple-50/50 hover:border-purple-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                <span className="text-sm font-bold text-purple-700">⭐ Credits <span className="font-medium text-slate-500">(BOD cấp)</span></span>
                <span className="text-sm font-extrabold text-purple-700">Còn {availableCredits}</span>
              </button>
              <button onClick={() => submitRedeem('plus')} disabled={submitting || cartTotal > availablePlus}
                className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-sky-200 bg-sky-50/50 hover:border-sky-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                <span className="text-sm font-bold text-sky-700">💳 Credits + <span className="font-medium text-slate-500">(đã nạp)</span></span>
                <span className="text-sm font-extrabold text-sky-700">Còn {availablePlus}</span>
              </button>
            </div>
            <button onClick={() => setWalletModal(false)} className="w-full py-2.5 rounded-xl text-sm font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors">Hủy</button>
          </div>
        </div>
      )}

      {/* MODAL CHI TIẾT MÓN/QUÀ */}
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
                {viewItem.description || <span className="italic text-slate-400">Chưa có mô tả.</span>}
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

      {/* ===== HERO: 2 VÍ ===== */}
      <div className="bg-gradient-to-r from-purple-700 to-purple-500 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <p className="text-purple-200 text-xs font-bold uppercase tracking-wider">Ví BAVN Credits — Nhân sự</p>
          <div className="flex items-end gap-2 mt-1 mb-4">
            <span className="text-5xl font-extrabold leading-none">{loading ? '—' : availableCredits}</span>
            <span className="text-purple-200 font-bold mb-1">credits khả dụng</span>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="bg-white/15 rounded-xl px-4 py-2.5">
              <p className="text-[10px] font-bold text-purple-200 uppercase tracking-wider">⭐ Credits (BOD cấp)</p>
              <p className="text-xl font-extrabold">{loading ? '—' : staffWallet.balance}</p>
            </div>
            <div className="bg-sky-400/25 rounded-xl px-4 py-2.5 border border-sky-200/40">
              <p className="text-[10px] font-bold text-sky-100 uppercase tracking-wider">💳 Credits +</p>
              <p className="text-xl font-extrabold text-sky-50">{loading ? '—' : availablePlus}</p>
            </div>
            {(pendingStaffHold + pendingPlusHold) > 0 && (
              <div className="bg-amber-400/20 rounded-xl px-4 py-2.5 border border-amber-200/30">
                <p className="text-[10px] font-bold text-amber-100 uppercase tracking-wider">Đang chờ duyệt</p>
                <p className="text-xl font-extrabold text-amber-100">−{pendingStaffHold + pendingPlusHold}</p>
              </div>
            )}
          </div>
          <p className="text-purple-200/80 text-[11px] mt-3">💡 1 credit = 1.000đ. <b>Credits</b> do BOD cấp thưởng · <b>Credits +</b> nạp tiền mặt qua nhân sự FF+. Đơn món do quầy Fresh Fit duyệt, đơn quà do BOD duyệt.</p>
        </div>
        <div className="absolute right-0 top-0 w-40 h-40 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl" />
      </div>

      {/* ===== LỊCH SỬ ĐƯỢC CẤP CREDITS (có lý do) ===== */}
      {myGrantHistory.length > 0 && (
        <div className="card-std p-5">
          <h3 className="text-sm font-bold text-purple-700 mb-3 uppercase tracking-wide">⭐ Lịch sử Credits của bạn</h3>
          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            {myGrantHistory.map(h => (
              <div key={h.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                <span className="text-slate-600 truncate mr-2">{h.reason || h.note || '—'} <span className="text-slate-400">· {h.by}</span></span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-slate-400 font-mono">{new Date(h.date).toLocaleDateString('vi-VN')}</span>
                  <b className={h.amount >= 0 ? 'text-purple-700' : 'text-red-500'}>{h.amount >= 0 ? '+' : ''}{h.amount}</b>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== MENU ĐỔI: MÓN FRESH FIT + QUÀ NHÂN SỰ ===== */}
      <div className="card-std p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-bold text-[#2B6830] uppercase tracking-wide">🌿 Đổi món Fresh Fit & 🎁 quà nhân sự</h3>
          <div className="flex gap-1.5 flex-wrap">
            {['all', 'sothich', 'thucduong', 'gift'].map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${activeCategory === cat ? 'bg-[#2B6830] text-white border-[#2B6830]' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}>
                {cat === 'all' ? 'Tất cả' : `${CATEGORY_META[cat].icon} ${CATEGORY_META[cat].label}`}
              </button>
            ))}
          </div>
        </div>

        <div className="relative mb-4">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-slate-400"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
          </div>
          <input type="text"
            className="input-base pl-10"
            placeholder="Tìm nhanh món hoặc quà..."
            value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)}
          />
        </div>

        {visibleMenu.length === 0 ? (
          <p className="text-xs text-slate-400 italic text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            {searchKeyword ? `Không tìm thấy "${searchKeyword}".` : 'Chưa có món/quà nào.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {visibleMenu.map(item => {
              const qty = cart[item.id] || 0;
              return (
                <div key={item.id} onClick={() => setViewItem(item)}
                  className={`group rounded-xl border overflow-hidden flex flex-col cursor-pointer transition-all duration-200 hover:-translate-y-1.5 hover:shadow-xl ${qty > 0 ? 'border-[#2B6830] bg-[#E8F4EC]/40 ring-2 ring-[#2B6830]/20' : 'border-slate-200 bg-white hover:border-green-300'}`}>
                  {item.imageUrl && (
                    <div className="h-40 overflow-hidden bg-slate-50 flex items-center justify-center">
                      <img src={item.imageUrl} alt={item.name} className="max-w-full max-h-full object-contain transition-transform duration-300 ease-out group-hover:scale-110" onError={(e) => { e.target.parentElement.style.display = 'none'; }} />
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

        {/* THANH GIỎ */}
        {cartCount > 0 && (
          <div className="mt-4 p-4 bg-[#E8F4EC] border border-green-200 rounded-xl flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-[#2B6830] uppercase tracking-wide mb-0.5">Giỏ đổi ({cartCount})</p>
              <p className="text-xs text-slate-600 truncate">
                {Object.entries(cart).map(([id, q]) => `${catalog.find(m => m.id === id)?.name || '?'} ×${q}`).join(', ')}
              </p>
              <p className={`text-sm font-extrabold mt-1 ${cartTotal > Math.max(availableCredits, availablePlus) ? 'text-red-600' : 'text-[#2B6830]'}`}>
                Tổng: {cartTotal} credits {cartTotal > Math.max(availableCredits, availablePlus) && '— vượt số dư cả 2 ví!'}
              </p>
              <input type="text" maxLength={200}
                className="w-full mt-2 p-2.5 border border-green-200 rounded-xl text-xs outline-none focus:border-[#2B6830] bg-white transition-colors"
                placeholder="📝 Ghi chú cho quầy (VD: ít ngọt, ít đá...)"
                value={orderNote} onChange={e => { setOrderNote(e.target.value); setConfirmingSend(false); }}
              />
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => { setCart({}); setConfirmingSend(false); }} className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors">Xóa giỏ</button>
              <button onClick={handleSubmit}
                disabled={submitting || cartTotal > Math.max(availableCredits, availablePlus)}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${confirmingSend ? 'bg-amber-500 hover:bg-amber-600' : 'bg-[#2B6830] hover:bg-[#1E5225]'}`}>
                {submitting ? 'Đang gửi...' : confirmingSend ? `Bấm lần nữa (${cartTotal} ⭐)` : 'Gửi yêu cầu đổi'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ===== LỊCH SỬ ĐỔI ===== */}
      <div className="card-std p-5">
        <h3 className="text-sm font-bold text-[#2B6830] mb-3 uppercase tracking-wide">Lịch sử đổi của bạn</h3>
        {myRedemptions.length === 0 ? (
          <p className="text-xs text-slate-400 italic">Chưa có yêu cầu nào.</p>
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
                    {r.status === 'rejected' && r.rejectReason && (
                      <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5 mt-1.5 inline-block">
                        ❌ Lý do từ chối: {r.rejectReason} <span className="font-normal text-red-400">(credits đã hoàn lại)</span>
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${r.channel === 'gift' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-[#E8F4EC] text-[#2B6830] border-green-200'}`}>
                        {r.channel === 'gift' ? '🎁 Quà (BOD)' : '🌿 Món (FF)'}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${meta.cls}`}>{meta.label}</span>
                    </div>
                    <span className="text-sm font-extrabold text-[#2B6830]">−{r.totalCredits} ⭐ <span className="text-[10px] text-slate-400">({r.wallet === 'plus' ? 'Credits +' : 'Credits'})</span></span>
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

export default StaffCredits;
