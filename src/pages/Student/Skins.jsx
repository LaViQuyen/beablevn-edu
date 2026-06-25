import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { ref, onValue, push, update } from 'firebase/database';
import StudentAvatar from '../../components/StudentAvatar';
import {
  DEFAULT_SKINS, RARITY_META, sortSkins, normalizeSkin, DEFAULT_SKIN_ID, getSkin,
} from '../../data/skins';

// ============================================================
// CỬA HÀNG SKIN — Học viên CHỦ ĐỘNG dùng Credits đổi skin + nhận skin theo MỐC.
// Catalog đọc từ DB `skins/` (Admin quản lý); DB trống → dùng bộ mặc định.
// - Skin 'purchase': trừ thẳng Bonus (ghi record âm vào scores) — 1 nguồn chân lý.
// - Skin 'milestone': MIỄN PHÍ khi Bonus TÍCH LŨY (tổng điểm dương kiếm được) ≥ mốc.
// DB: studentSkins/{sid}/owned/{skinId}, /equipped, /purchases
// ============================================================

const StudentSkins = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  // Nhân sự (staff/admin) cũng dùng trang này: mở khóa TOÀN BỘ skin, điều hướng theo cổng /staff.
  const isStaff = ['staff', 'admin'].includes(currentUser?.role);
  const base = isStaff ? '/staff' : '/student';
  const [classes, setClasses] = useState({});
  const [allScores, setAllScores] = useState({});
  const [myRedemptions, setMyRedemptions] = useState([]);
  const [dbSkins, setDbSkins] = useState(null);    // null = chưa tải xong
  const [owned, setOwned] = useState({});
  const [equipped, setEquipped] = useState(DEFAULT_SKIN_ID);
  const [purchases, setPurchases] = useState([]);
  const [staffBonusRecs, setStaffBonusRecs] = useState({}); // bonus nội bộ nhân sự (MOD thưởng) — nguồn mua skin của staff
  const [loading, setLoading] = useState(true);

  const [busy, setBusy] = useState(false);
  const [confirmSkin, setConfirmSkin] = useState(null);
  const [toastMsg, setToastMsg] = useState('');
  const showToast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 3500); };

  const myClassIds = currentUser?.classIds
    ? (Array.isArray(currentUser.classIds) ? currentUser.classIds : Object.values(currentUser.classIds))
    : [];

  useEffect(() => {
    if (!currentUser) return;
    const unsubClasses = onValue(ref(db, 'classes'), (snap) => setClasses(snap.val() || {}));
    const unsubScores = onValue(ref(db, 'scores'), (snap) => { setAllScores(snap.val() || {}); setLoading(false); });
    const unsubRedeem = onValue(ref(db, 'redemptions'), (snap) => {
      const data = snap.val() || {};
      setMyRedemptions(Object.values(data).filter(r => r.studentId === currentUser.id));
    });
    const unsubSkinsDb = onValue(ref(db, 'skins'), (snap) => setDbSkins(snap.val() || {}));
    const unsubMine = onValue(ref(db, `studentSkins/${currentUser.id}`), (snap) => {
      const data = snap.val() || {};
      setOwned(data.owned || {});
      setEquipped(data.equipped || DEFAULT_SKIN_ID);
      const p = data.purchases || {};
      setPurchases(Object.values(p).sort((a, b) => new Date(b.date) - new Date(a.date)));
    });
    // Bonus nội bộ nhân sự (do MOD thưởng) — staff dùng để đổi skin
    const unsubSB = onValue(ref(db, `staffBonus/${currentUser.id}`), (snap) => setStaffBonusRecs(snap.val() || {}));
    return () => { unsubClasses(); unsubScores(); unsubRedeem(); unsubSkinsDb(); unsubMine(); unsubSB(); };
  }, [currentUser?.id]);

  // Số dư Bonus nhân sự = tổng các bản ghi staffBonus (thưởng dương, đổi skin âm)
  const staffBonusBalance = useMemo(
    () => Object.values(staffBonusRecs).reduce((a, r) => a + (Number(r.score) || 0), 0),
    [staffBonusRecs]
  );

  // --- Catalog hiệu lực: DB nếu có skin, ngược lại bộ mặc định ---
  const catalog = useMemo(() => {
    let arr;
    if (dbSkins && Object.keys(dbSkins).length > 0) {
      arr = Object.entries(dbSkins).map(([id, val]) => normalizeSkin(val, id)).filter(s => s.available);
    } else {
      arr = DEFAULT_SKINS.map(s => normalizeSkin(s));
    }
    // Luôn đảm bảo có skin mặc định để trang bị
    if (!arr.find(s => s.id === DEFAULT_SKIN_ID)) arr.unshift(getSkin(DEFAULT_SKIN_ID));
    return sortSkins(arr);
  }, [dbSkins]);

  const skinMap = useMemo(() => Object.fromEntries(catalog.map(s => [s.id, s])), [catalog]);
  const resolve = (id) => skinMap[id] || getSkin(id); // skin object để render avatar

  // --- Bonus theo lớp (giảm dần) + Bonus TÍCH LŨY (chỉ cộng điểm dương) ---
  const bonusBalances = useMemo(() => {
    return myClassIds.map(cid => {
      const records = Object.values(allScores[cid]?.[currentUser?.id]?.bonus || {});
      const net = records.reduce((a, r) => a + (Number(r.score) || 0), 0);
      const earned = records.reduce((a, r) => a + Math.max(0, Number(r.score) || 0), 0);
      return { classId: cid, className: classes[cid]?.name || cid, bonus: net, earned };
    }).sort((a, b) => b.bonus - a.bonus);
  }, [allScores, classes, currentUser?.id, myClassIds.join(',')]);

  const totalBonus = bonusBalances.reduce((a, b) => a + b.bonus, 0);
  const lifetimeBonus = bonusBalances.reduce((a, b) => a + b.earned, 0); // dùng cho mốc
  const totalCredits = Math.floor(totalBonus / 2);

  const pendingBonusHold = myRedemptions
    .filter(r => r.status === 'pending' && (r.wallet || 'bonus') !== 'plus')
    .reduce((a, r) => a + (Number(r.totalCredits) || 0), 0);
  const availableCredits = totalCredits - pendingBonusHold;

  // Sở hữu = skin mặc định + skin đã MUA (owned). Học viên mua bằng Credit; nhân sự mua bằng Bonus nhân sự.
  const isOwned = (id) => id === DEFAULT_SKIN_ID || !!owned[id];
  // Skin được Admin cấp cho nhân sự (chỉ những skin này mới xuất hiện ở cửa hàng của staff)
  const staffShopSkins = catalog.filter(s => s.staffAllowed);
  const ownedSkins = catalog.filter(s => isOwned(s.id));

  // --- TRANG BỊ ---
  const equipSkin = async (skinId) => {
    if (!isOwned(skinId)) return;
    try {
      await update(ref(db, `studentSkins/${currentUser.id}`), { equipped: skinId });
      showToast('✅ Đã trang bị skin mới!');
    } catch (e) { showToast('❌ Lỗi: ' + e.message); }
  };

  // --- NHẬN skin mốc (miễn phí) ---
  const claimMilestone = async (skin) => {
    if (lifetimeBonus < skin.threshold) return;
    setBusy(true);
    try {
      const updates = {};
      updates[`studentSkins/${currentUser.id}/owned/${skin.id}`] = true;
      updates[`studentSkins/${currentUser.id}/equipped`] = skin.id;
      const pKey = push(ref(db, `studentSkins/${currentUser.id}/purchases`)).key;
      updates[`studentSkins/${currentUser.id}/purchases/${pKey}`] = {
        skinId: skin.id, name: skin.name, credits: 0, kind: 'milestone', date: new Date().toISOString(),
      };
      await update(ref(db), updates);
      showToast(`🎉 Mở khóa "${skin.name}" — phần thưởng cho sự kiên trì!`);
    } catch (e) { showToast('❌ Lỗi: ' + e.message); }
    finally { setBusy(false); }
  };

  // --- MUA skin (trừ Bonus tức thì) ---
  const buySkin = async (skin) => {
    if (isOwned(skin.id)) return equipSkin(skin.id);
    const need = Number(skin.cost) || 0;
    if (confirmSkin !== skin.id) { setConfirmSkin(skin.id); return; }
    if (need > availableCredits) { setConfirmSkin(null); return showToast('⚠️ Không đủ credits khả dụng!'); }

    setBusy(true);
    try {
      const needBonus = need * 2;
      const totalAvail = bonusBalances.reduce((a, b) => a + b.bonus, 0);
      if (totalAvail < needBonus) { setBusy(false); setConfirmSkin(null); return showToast('⚠️ Không đủ điểm Bonus!'); }

      const timestamp = new Date().toISOString();
      const today = timestamp.slice(0, 10);
      const updates = {};
      let remaining = needBonus;
      for (const b of bonusBalances) {
        if (remaining <= 0) break;
        const take = Math.min(b.bonus, remaining);
        if (take <= 0) continue;
        const key = push(ref(db, `scores/${b.classId}/${currentUser.id}/bonus`)).key;
        updates[`scores/${b.classId}/${currentUser.id}/bonus/${key}`] = {
          score: -take, date: today,
          content: `Mua skin "${skin.name}" (−${need} credits)`, timestamp,
        };
        remaining -= take;
      }
      updates[`studentSkins/${currentUser.id}/owned/${skin.id}`] = true;
      updates[`studentSkins/${currentUser.id}/equipped`] = skin.id;
      const pKey = push(ref(db, `studentSkins/${currentUser.id}/purchases`)).key;
      updates[`studentSkins/${currentUser.id}/purchases/${pKey}`] = {
        skinId: skin.id, name: skin.name, credits: need, kind: 'purchase', date: timestamp,
      };
      await update(ref(db), updates);
      setConfirmSkin(null);
      showToast(`✅ Đã mua & trang bị "${skin.name}"! (−${need} credits)`);
    } catch (e) {
      showToast('❌ Lỗi: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  // --- NHÂN SỰ mua skin bằng Bonus nhân sự (trừ thẳng staffBonus, ghi bản ghi âm) ---
  const buyStaffSkin = async (skin) => {
    if (isOwned(skin.id)) return equipSkin(skin.id);
    const need = Number(skin.cost) || 0;
    if (confirmSkin !== skin.id) { setConfirmSkin(skin.id); return; }
    if (need > staffBonusBalance) { setConfirmSkin(null); return showToast('⚠️ Không đủ Bonus nhân sự!'); }
    setBusy(true);
    try {
      const timestamp = new Date().toISOString();
      const updates = {};
      const bKey = push(ref(db, `staffBonus/${currentUser.id}`)).key;
      updates[`staffBonus/${currentUser.id}/${bKey}`] = {
        score: -need, reason: `Đổi skin "${skin.name}"`, by: currentUser.id, byName: currentUser?.name || '',
        date: timestamp.slice(0, 10), timestamp,
      };
      updates[`studentSkins/${currentUser.id}/owned/${skin.id}`] = true;
      updates[`studentSkins/${currentUser.id}/equipped`] = skin.id;
      const pKey = push(ref(db, `studentSkins/${currentUser.id}/purchases`)).key;
      updates[`studentSkins/${currentUser.id}/purchases/${pKey}`] = {
        skinId: skin.id, name: skin.name, credits: need, kind: 'staff', date: timestamp,
      };
      await update(ref(db), updates);
      setConfirmSkin(null);
      showToast(`✅ Đã đổi "${skin.name}"! (−${need} Bonus)`);
    } catch (e) { showToast('❌ Lỗi: ' + e.message); }
    finally { setBusy(false); }
  };

  const purchaseSkins = catalog.filter(s => s.unlock === 'purchase');
  const milestoneSkins = catalog.filter(s => s.unlock === 'milestone');

  return (
    <div className="space-y-6 animate-fade-in-up pb-10">
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white max-w-[90vw]"
          style={{ background: toastMsg.startsWith('✅') || toastMsg.startsWith('🎉') ? '#059669' : toastMsg.startsWith('⚠️') ? '#d97706' : '#dc2626' }}>
          {toastMsg}
        </div>
      )}

      {/* ===== HERO ===== */}
      <div className="bg-gradient-to-r from-[#2B6830] to-[#3D8B47] rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex items-center gap-5 flex-wrap">
          <StudentAvatar skin={resolve(equipped)} name={currentUser?.name} size={80} />
          <div className="min-w-0">
            <p className="text-green-200 text-xs font-bold uppercase tracking-wider">Avatar của bạn</p>
            <p className="text-2xl font-extrabold leading-tight truncate">{currentUser?.name}</p>
            <div className="flex items-end gap-2 mt-2">
              {isStaff
                ? <><span className="text-3xl font-extrabold leading-none">{loading ? '—' : staffBonusBalance}</span>
                  <span className="text-green-200 font-bold mb-0.5 text-sm">Bonus nhân sự</span></>
                : <><span className="text-3xl font-extrabold leading-none">{loading ? '—' : availableCredits}</span>
                  <span className="text-green-200 font-bold mb-0.5 text-sm">credits khả dụng</span></>}
            </div>
          </div>
        </div>
        <p className="text-green-200/80 text-[11px] mt-4 relative z-10">{isStaff ? '💡 Bonus do cấp quản lý (MOD) thưởng — dùng để đổi skin & làm cơ sở xét thưởng quý/năm. Chơi game không giới hạn lượt.' : '💡 Mỗi 2 Bonus = 1 Credit. Đổi skin bằng Credit, hoặc nhận miễn phí khi đạt mốc học tập. Không hộp ngẫu nhiên.'}</p>
        <div className="absolute right-0 top-0 w-40 h-40 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl" />
      </div>

      {/* ===== GAME HÀNH TRÌNH TRƯỞNG THÀNH (khu thi đua) ===== */}
      <button
        onClick={() => navigate(`${base}/games/hanh-trinh`)}
        className="w-full text-left bg-gradient-to-r from-[#1E5225] to-[#2B6830] rounded-2xl p-5 text-white shadow-lg relative overflow-hidden hover:brightness-110 transition"
      >
        <div className="relative z-10 flex items-center gap-4">
          <div className="text-4xl">🎮</div>
          <div className="min-w-0 flex-1">
            <p className="text-green-200 text-[11px] font-bold uppercase tracking-wider">Khu thi đua</p>
            <p className="text-lg font-extrabold leading-tight">Hành Trình Trưởng Thành</p>
            <p className="text-green-100/90 text-xs mt-0.5">
              {isStaff
                ? 'Nhân sự · chơi không giới hạn lượt'
                : (lifetimeBonus >= 50
                  ? 'Đã mở khóa · Bấm để bắt đầu hành trình'
                  : `Đạt 50 Bonus tích lũy để mở khóa (${lifetimeBonus}/50)`)}
            </p>
          </div>
          <div className="text-sm font-bold bg-white/15 px-3 py-1.5 rounded-lg whitespace-nowrap">
            {isStaff || lifetimeBonus >= 50 ? '▶ Chơi' : '🔒'}
          </div>
        </div>
        <div className="absolute right-0 bottom-0 w-32 h-32 bg-white/10 rounded-full -mr-12 -mb-12 blur-2xl" />
      </button>

      {/* ===== BỘ SƯU TẬP ===== */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <h3 className="text-sm font-bold text-[#2B6830] mb-3 uppercase tracking-wide">🎒 Bộ sưu tập của tôi ({ownedSkins.length})</h3>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {ownedSkins.map(skin => {
            const active = equipped === skin.id;
            return (
              <button key={skin.id} onClick={() => equipSkin(skin.id)}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${active ? 'border-[#2B6830] bg-[#E8F4EC]/50 ring-2 ring-[#2B6830]/15' : 'border-slate-100 hover:border-green-300 bg-white'}`}>
                <StudentAvatar skin={skin} size={48} />
                <span className="text-[11px] font-bold text-slate-600 truncate w-full text-center">{skin.name}</span>
                {active ? <span className="text-[9px] font-bold text-[#2B6830] uppercase">Đang dùng</span>
                        : <span className="text-[9px] font-bold text-slate-400 uppercase">Trang bị</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* ===== CỬA HÀNG SKIN NHÂN SỰ — đổi bằng Bonus nhân sự (MOD thưởng) ===== */}
      {isStaff && (
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
          <h3 className="text-sm font-bold text-[#2B6830] uppercase tracking-wide">🛍️ Cửa hàng Skin (nhân sự)</h3>
          <span className="text-xs font-bold text-slate-500">Bonus: <span className="text-[#2B6830]">{staffBonusBalance}</span></span>
        </div>
        <p className="text-xs text-slate-400 mb-4">Skin do Admin cấp cho nhân sự. Đổi bằng Bonus được cấp quản lý (MOD) thưởng.</p>
        {staffShopSkins.length === 0 ? (
          <p className="text-xs text-slate-400 italic">Chưa có skin nào được Admin cấp cho nhân sự.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {staffShopSkins.map(skin => {
              const ownedThis = isOwned(skin.id);
              const active = equipped === skin.id;
              const meta = RARITY_META[skin.rarity];
              const affordable = (Number(skin.cost) || 0) <= staffBonusBalance;
              const confirming = confirmSkin === skin.id;
              return (
                <div key={skin.id} className={`rounded-xl border overflow-hidden flex flex-col items-center text-center p-4 gap-2 transition-all ${ownedThis ? 'border-green-200 bg-[#E8F4EC]/30' : 'border-slate-200 bg-white hover:border-green-300'}`}>
                  <StudentAvatar skin={skin} size={64} />
                  <p className="font-bold text-slate-800 text-sm leading-snug">{skin.name}</p>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase ${meta.cls}`}>{meta.label}</span>
                  {ownedThis ? (
                    active ? <span className="mt-1 w-full py-2 rounded-xl text-xs font-bold text-[#2B6830] bg-[#E8F4EC] border border-green-200">✓ Đang trang bị</span>
                           : <button onClick={() => equipSkin(skin.id)} className="mt-1 w-full py-2 rounded-xl text-xs font-bold text-white bg-[#2B6830] hover:bg-[#1E5225] transition-colors">Trang bị</button>
                  ) : (
                    <button onClick={() => buyStaffSkin(skin)} disabled={busy || !affordable}
                      className={`mt-1 w-full py-2 rounded-xl text-xs font-bold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${confirming ? 'bg-amber-500 hover:bg-amber-600' : 'bg-[#2B6830] hover:bg-[#1E5225]'}`}>
                      {confirming ? `Bấm lần nữa (−${skin.cost})` : affordable ? `Đổi · ${skin.cost} Bonus` : `Cần ${skin.cost} Bonus`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}

      {/* ===== SKIN MỐC HỌC TẬP (chỉ học viên — nhân sự không có kinh tế Bonus) ===== */}
      {!isStaff && milestoneSkins.length > 0 && (
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
            <h3 className="text-sm font-bold text-emerald-700 uppercase tracking-wide">🎯 Mở khóa theo nỗ lực</h3>
            <span className="text-xs font-bold text-slate-500">Bonus tích lũy: <span className="text-emerald-700">{lifetimeBonus}</span></span>
          </div>
          <p className="text-xs text-slate-400 mb-4">Học đều, kiếm Bonus — đạt mốc là skin tự mở, miễn phí. Không tốn Credit.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {milestoneSkins.map(skin => {
              const ownedThis = isOwned(skin.id);
              const active = equipped === skin.id;
              const reached = lifetimeBonus >= skin.threshold;
              const pct = Math.min(100, Math.round((lifetimeBonus / Math.max(1, skin.threshold)) * 100));
              const meta = RARITY_META[skin.rarity];
              return (
                <div key={skin.id} className={`rounded-xl border p-4 flex flex-col items-center text-center gap-2 transition-all ${ownedThis ? 'border-emerald-200 bg-emerald-50/40' : reached ? 'border-emerald-300 bg-white' : 'border-slate-200 bg-slate-50/60'}`}>
                  <div className={reached || ownedThis ? '' : 'opacity-40 grayscale'}>
                    <StudentAvatar skin={skin} size={60} />
                  </div>
                  <p className="font-bold text-slate-800 text-sm leading-snug">{skin.name}</p>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase ${meta.cls}`}>{meta.label}</span>

                  {ownedThis ? (
                    active ? <span className="mt-1 w-full py-2 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200">✓ Đang trang bị</span>
                           : <button onClick={() => equipSkin(skin.id)} className="mt-1 w-full py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors">Trang bị</button>
                  ) : reached ? (
                    <button onClick={() => claimMilestone(skin)} disabled={busy} className="mt-1 w-full py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-50">🎁 Nhận miễn phí</button>
                  ) : (
                    <div className="mt-1 w-full">
                      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 mt-1">{lifetimeBonus}/{skin.threshold} bonus</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== CỬA HÀNG (mua bằng Credit) — chỉ học viên ===== */}
      {!isStaff && (
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <h3 className="text-sm font-bold text-[#2B6830] mb-4 uppercase tracking-wide">🛍️ Cửa hàng Skin</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {purchaseSkins.map(skin => {
            const ownedThis = isOwned(skin.id);
            const active = equipped === skin.id;
            const meta = RARITY_META[skin.rarity];
            const affordable = skin.cost <= availableCredits;
            const confirming = confirmSkin === skin.id;
            return (
              <div key={skin.id} className={`rounded-xl border overflow-hidden flex flex-col items-center text-center p-4 gap-2 transition-all ${ownedThis ? 'border-green-200 bg-[#E8F4EC]/30' : 'border-slate-200 bg-white hover:border-green-300 hover:-translate-y-1 hover:shadow-md'}`}>
                <StudentAvatar skin={skin} size={64} />
                <p className="font-bold text-slate-800 text-sm leading-snug">{skin.name}</p>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase ${meta.cls}`}>{meta.label}</span>
                {ownedThis ? (
                  active ? <span className="mt-1 w-full py-2 rounded-xl text-xs font-bold text-[#2B6830] bg-[#E8F4EC] border border-green-200">✓ Đang trang bị</span>
                         : <button onClick={() => equipSkin(skin.id)} className="mt-1 w-full py-2 rounded-xl text-xs font-bold text-white bg-[#2B6830] hover:bg-[#1E5225] transition-colors">Trang bị</button>
                ) : (
                  <button onClick={() => buySkin(skin)} disabled={busy || !affordable}
                    className={`mt-1 w-full py-2 rounded-xl text-xs font-bold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${confirming ? 'bg-amber-500 hover:bg-amber-600' : 'bg-[#2B6830] hover:bg-[#1E5225]'}`}>
                    {confirming ? `Bấm lần nữa (−${skin.cost} ⭐)` : affordable ? `Đổi · ${skin.cost} ⭐` : `Cần ${skin.cost} ⭐`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
      )}

      {/* ===== LỊCH SỬ đổi skin ===== */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <h3 className="text-sm font-bold text-[#2B6830] mb-3 uppercase tracking-wide">Lịch sử nhận skin</h3>
        {purchases.length === 0 ? (
          <p className="text-xs text-slate-400 italic">{isStaff ? 'Chưa đổi skin nào. Tích Bonus do MOD thưởng để đổi nhé!' : 'Chưa nhận skin nào. Học chăm để gom Credit và đạt mốc nhé!'}</p>
        ) : (
          <div className="space-y-2.5">
            {purchases.map((p, i) => (
              <div key={i} className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-3 min-w-0">
                  <StudentAvatar skin={resolve(p.skinId)} size={36} ring={false} />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-700 truncate">{p.name}</p>
                    <p className="text-[11px] text-slate-400 font-mono">{new Date(p.date).toLocaleString('vi-VN')}</p>
                  </div>
                </div>
                {p.kind === 'milestone' || p.credits === 0
                  ? <span className="text-xs font-extrabold text-emerald-600 shrink-0">🎯 Mốc học tập</span>
                  : <span className="text-sm font-extrabold text-[#2B6830] shrink-0">−{p.credits} ⭐</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentSkins;
