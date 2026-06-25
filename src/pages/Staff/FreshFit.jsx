import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { ref, onValue, push, update, remove } from 'firebase/database';
import * as XLSX from 'xlsx'; // xuất file Excel tổng kết (FF+)

// ============================================================
// FRESH FIT — Cổng nhân sự FF / FF+
// Tab 1: Yêu cầu đổi credits (xác nhận = trừ đúng ví: Bonus hoặc Credits +)
// Tab 2: Quản lý Menu (món + giá + ảnh + mô tả) — 1 credit = 1.000đ
// Tab 3: Nạp Credits + (chỉ FF+) — học viên nạp tiền mặt quy đổi credits
// ============================================================

const CATEGORY_META = {
  sothich:   { label: 'Theo sở thích', icon: '🧋' },
  thucduong: { label: 'Thực dưỡng',    icon: '🌿' },
  gift:      { label: 'Quà tặng',      icon: '🎁' },
  drink:     { label: 'Thức uống',     icon: '🥤' },
  food:      { label: 'Đồ ăn',         icon: '🍱' },
};

const STATUS_META = {
  pending:   { label: 'Chờ duyệt', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  confirmed: { label: 'Đã xác nhận', cls: 'bg-green-50 text-green-700 border-green-200' },
  rejected:  { label: 'Từ chối', cls: 'bg-red-50 text-red-600 border-red-200' },
};


// ============================================================
// LỌC THEO KỲ: ngày / tuần (T2–CN) / tháng — neo theo ngày chọn
// ============================================================
const TIME_LABEL = { all: 'Tất cả', day: 'Ngày', week: 'Tuần', month: 'Tháng' };

const todayStr = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
};

const inPeriod = (dateStr, mode, anchorStr) => {
  if (mode === 'all') return true;
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const a = new Date((anchorStr || todayStr()) + 'T00:00:00');
  if (mode === 'day') {
    return d.getFullYear() === a.getFullYear() && d.getMonth() === a.getMonth() && d.getDate() === a.getDate();
  }
  if (mode === 'week') {
    // Tuần tính từ Thứ 2 đến hết Chủ nhật chứa ngày neo
    const monday = new Date(a);
    monday.setDate(a.getDate() - ((a.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const next = new Date(monday);
    next.setDate(monday.getDate() + 7);
    return d >= monday && d < next;
  }
  if (mode === 'month') {
    return d.getFullYear() === a.getFullYear() && d.getMonth() === a.getMonth();
  }
  return true;
};

const FreshFit = () => {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const [ffAccess, setFfAccess] = useState(currentUser?.ffAccess || isAdmin);
  const [ffPlus, setFfPlus] = useState(currentUser?.ffPlusAccess || isAdmin); // quyền nạp Credits +

  const [activeTab, setActiveTab] = useState('orders');
  const [redemptions, setRedemptions] = useState([]);
  const [users, setUsers] = useState({});
  const [allScores, setAllScores] = useState({});
  const [classes, setClasses] = useState({});
  const [menu, setMenu] = useState([]);
  const [creditPlusAll, setCreditPlusAll] = useState({}); // toàn bộ ví Credits + (học viên & nhân sự)
  const [staffCreditsAll, setStaffCreditsAll] = useState({}); // ví Credits do BOD grant cho nhân sự

  const [statusFilter, setStatusFilter] = useState('pending');
  const [menuCatFilter, setMenuCatFilter] = useState('all');
  const [menuSearch, setMenuSearch] = useState(''); // tìm kiếm nhanh món trong tab Quản lý Menu

  // Lọc theo kỳ — riêng cho từng tab
  const [orderTime, setOrderTime] = useState('all');       // Yêu cầu đổi
  const [orderAnchor, setOrderAnchor] = useState(todayStr());
  const [topupTime, setTopupTime] = useState('all');       // Lịch sử Credits +
  const [topupAnchor, setTopupAnchor] = useState(todayStr());
  const [processing, setProcessing] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState(''); // lý do từ chối — bắt buộc, học viên sẽ thấy
  const [toastMsg, setToastMsg] = useState('');
  const showToast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 4000); };

  // --- Form menu ---
  const [menuForm, setMenuForm] = useState({ name: '', category: 'sothich', group: '', price: '' });
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);

  // --- Nạp Credits + ---
  const [topupSearch, setTopupSearch] = useState('');
  const [topupTarget, setTopupTarget] = useState(null); // học viên được chọn
  const [topupAmount, setTopupAmount] = useState('');
  const [topupNote, setTopupNote] = useState('');
  const [topupConfirming, setTopupConfirming] = useState(false); // bấm lần 2 mới nạp

  // Theo dõi cờ FF / FF+ realtime — admin gán/gỡ có hiệu lực ngay
  useEffect(() => {
    if (!currentUser?.id) return;
    if (isAdmin) { setFfAccess(true); setFfPlus(true); return; }
    const u1 = onValue(ref(db, `users/${currentUser.id}/ffAccess`), (snap) => setFfAccess(!!snap.val()));
    const u2 = onValue(ref(db, `users/${currentUser.id}/ffPlusAccess`), (snap) => setFfPlus(!!snap.val()));
    return () => { u1(); u2(); };
  }, [currentUser?.id]);

  useEffect(() => {
    const u1 = onValue(ref(db, 'redemptions'), (snap) => {
      const data = snap.val() || {};
      setRedemptions(Object.entries(data).map(([id, val]) => ({ id, ...val })).sort((a, b) => new Date(b.date) - new Date(a.date)));
    });
    const u2 = onValue(ref(db, 'users'), (snap) => setUsers(snap.val() || {}));
    const u3 = onValue(ref(db, 'scores'), (snap) => setAllScores(snap.val() || {}));
    const u4 = onValue(ref(db, 'classes'), (snap) => setClasses(snap.val() || {}));
    const u5 = onValue(ref(db, 'ffMenu'), (snap) => {
      const data = snap.val() || {};
      setMenu(Object.entries(data).map(([id, val]) => ({ id, ...val })));
    });
    const u6 = onValue(ref(db, 'creditPlus'), (snap) => setCreditPlusAll(snap.val() || {}));
    const u7 = onValue(ref(db, 'staffCredits'), (snap) => setStaffCreditsAll(snap.val() || {}));
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); };
  }, []);

  // --- Tính bonus từng lớp của một học viên ---
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

  const getPlusBalance = (studentId) => Number(creditPlusAll[studentId]?.balance) || 0;
  const getStaffBalance = (staffId) => Number(staffCreditsAll[staffId]?.balance) || 0;
  const itemsText = (items) => (items || []).map(i => `${i.name} ×${i.qty}`).join(', ');

  // Chuẩn hóa link ảnh: link chia sẻ Dropbox (dl=0) tự đổi thành raw=1 để hiển thị được
  const normalizeImageUrl = (url) => {
    const u = (url || '').trim();
    if (!u) return '';
    if (u.includes('dropbox.com')) {
      if (/[?&]raw=1/.test(u)) return u;                              // đã là raw=1 thì giữ nguyên
      if (/[?&]dl=\d/.test(u)) return u.replace(/([?&])dl=\d/, '$1raw=1'); // dl=0/dl=1 → raw=1
      return u + (u.includes('?') ? '&' : '?') + 'raw=1';             // chưa có tham số → thêm raw=1
    }
    return u;
  };

  // --- XÁC NHẬN: trừ đúng ví theo yêu cầu ---
  const handleConfirm = async (r) => {
    setProcessing(r.id);
    try {
      const need = Number(r.totalCredits) || 0;
      const wallet = r.wallet || 'bonus';
      const updates = {};
      const timestamp = new Date().toISOString();

      if (wallet === 'plus') {
        // Trừ ví Credits + (nạp tiền)
        const bal = getPlusBalance(r.studentId);
        if (bal < need) {
          showToast(`⚠️ ${r.studentName} chỉ còn ${bal} Credits + (cần ${need}). Hãy Từ chối yêu cầu này.`);
          setProcessing(null);
          return;
        }
        updates[`creditPlus/${r.studentId}/balance`] = bal - need;
        const hKey = push(ref(db, `creditPlus/${r.studentId}/history`)).key;
        updates[`creditPlus/${r.studentId}/history/${hKey}`] = {
          amount: -need,
          by: currentUser.name,
          date: timestamp,
          note: `Đổi quà: ${itemsText(r.items)}`,
        };
      } else if (r.userType === 'staff') {
        // Nhân sự đổi món — trừ ví Credits do BOD grant
        const bal = getStaffBalance(r.studentId);
        if (bal < need) {
          showToast(`⚠️ ${r.studentName} chỉ còn ${bal} Credits (cần ${need}). Hãy Từ chối yêu cầu này.`);
          setProcessing(null);
          return;
        }
        updates[`staffCredits/${r.studentId}/balance`] = bal - need;
        const sKey = push(ref(db, `staffCredits/${r.studentId}/history`)).key;
        updates[`staffCredits/${r.studentId}/history/${sKey}`] = {
          amount: -need,
          reason: `Đổi món: ${itemsText(r.items)}`,
          by: currentUser.name,
          date: timestamp,
        };
      } else {
        // Trừ ví Credits (từ Bonus) — ghi record bonus ÂM vào sổ điểm
        const needBonus = need * 2; // 1 credit = 2 bonus
        const balances = getBonusBalances(r.studentId);
        const totalAvail = balances.reduce((a, b) => a + b.bonus, 0);
        if (totalAvail < needBonus) {
          showToast(`⚠️ ${r.studentName} chỉ còn ${totalAvail} Bonus (cần ${needBonus}). Hãy Từ chối yêu cầu này.`);
          setProcessing(null);
          return;
        }
        const today = timestamp.slice(0, 10);
        let remaining = needBonus;
        for (const b of balances) {
          if (remaining <= 0) break;
          const take = Math.min(b.bonus, remaining);
          if (take <= 0) continue;
          const key = push(ref(db, `scores/${b.classId}/${r.studentId}/bonus`)).key;
          updates[`scores/${b.classId}/${r.studentId}/bonus/${key}`] = {
            score: -take,
            date: today,
            content: `Đổi BAVN Credits: ${itemsText(r.items)} (−${need} credits)`,
            timestamp,
          };
          remaining -= take;
        }
      }

      updates[`redemptions/${r.id}/status`] = 'confirmed';
      updates[`redemptions/${r.id}/confirmedBy`] = currentUser.name;
      updates[`redemptions/${r.id}/confirmedAt`] = timestamp;

      await update(ref(db), updates);
      showToast(`✅ Đã xác nhận — trừ ${need} credits (ví ${wallet === 'plus' ? 'Credits +' : 'Credits'}) của ${r.studentName}.`);
    } catch (e) {
      showToast('❌ Lỗi: ' + e.message);
    } finally {
      setProcessing(null);
      setConfirmTarget(null);
    }
  };

  const handleReject = async (r) => {
    if (!rejectReason.trim()) return showToast('⚠️ Nhập lý do từ chối để học viên biết.');
    setProcessing(r.id);
    try {
      await update(ref(db, `redemptions/${r.id}`), {
        status: 'rejected',
        rejectedBy: currentUser.name,
        rejectedAt: new Date().toISOString(),
        rejectReason: rejectReason.trim(), // học viên thấy lý do này trong lịch sử đổi quà
      });
      showToast(`Đã từ chối yêu cầu của ${r.studentName} — credits được hoàn lại tự động.`);
      setRejectReason('');
    } catch (e) {
      showToast('❌ Lỗi: ' + e.message);
    } finally {
      setProcessing(null);
      setConfirmTarget(null);
    }
  };

  // --- NẠP CREDITS + (chỉ FF+) ---
  const handleTopup = async () => {
    const amt = Number(topupAmount);
    if (!topupTarget) return showToast('⚠️ Chọn học viên cần nạp.');
    if (!amt || amt <= 0 || !Number.isInteger(amt)) return showToast('⚠️ Số credits phải là số nguyên dương.');
    if (!topupConfirming) { setTopupConfirming(true); return; } // bấm lần đầu: xác nhận

    try {
      const cur = getPlusBalance(topupTarget.id);
      const updates = {};
      updates[`creditPlus/${topupTarget.id}/balance`] = cur + amt;
      const key = push(ref(db, `creditPlus/${topupTarget.id}/history`)).key;
      updates[`creditPlus/${topupTarget.id}/history/${key}`] = {
        amount: amt,
        by: currentUser.name,
        date: new Date().toISOString(),
        note: topupNote.trim() || `Nạp tiền mặt ${amt * 1000}đ`,
      };
      await update(ref(db), updates);
      showToast(`✅ Đã nạp ${amt} Credits + cho ${topupTarget.name} (số dư mới: ${cur + amt}).`);
      // Giữ nguyên học viên đang chọn để thấy ngay số dư mới + lịch sử vừa ghi
      setTopupAmount(''); setTopupNote(''); setTopupConfirming(false);
    } catch (e) {
      showToast('❌ Lỗi: ' + e.message);
      setTopupConfirming(false);
    }
  };

  // Toàn bộ giao dịch Credits + (nạp + trừ), mới nhất trước
  const topupRowsAll = useMemo(() => {
    const rows = [];
    Object.entries(creditPlusAll).forEach(([sid, val]) => {
      Object.entries(val?.history || {}).forEach(([hid, h]) => {
        rows.push({ id: `${sid}_${hid}`, studentId: sid, studentName: users[sid]?.name || sid, ...h });
      });
    });
    return rows.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [creditPlusAll, users]);

  // Lịch sử hiển thị: lọc theo kỳ; chế độ "Tất cả" chỉ hiện 30 dòng gần nhất
  const topupHistory = useMemo(() => {
    const filtered = topupRowsAll.filter(h => inPeriod(h.date, topupTime, topupAnchor));
    return topupTime === 'all' ? filtered.slice(0, 30) : filtered;
  }, [topupRowsAll, topupTime, topupAnchor]);

  // Tổng kết kỳ đang xem: tổng nạp / tổng trừ
  const topupTotals = useMemo(() => topupHistory.reduce((acc, h) => {
    const amt = Number(h.amount) || 0;
    if (amt >= 0) acc.in += amt; else acc.out += -amt;
    return acc;
  }, { in: 0, out: 0 }), [topupHistory]);

  // --- XUẤT EXCEL (FF+) — 2 nút riêng, nội dung riêng ---
  const periodLabel = (mode, anchor) => mode === 'all' ? 'TatCa' : `${TIME_LABEL[mode]}_${anchor}`;
  const periodNote = (mode, anchor) => `${TIME_LABEL[mode]}${mode !== 'all' ? ' · neo ' + anchor : ''}`;

  // Nút 1: chỉ Yêu cầu đổi trong kỳ
  // LOẠI tài khoản DEMO khỏi file báo cáo (giao dịch demo không được ghi nhận)
  const exportOrdersXlsx = (mode, anchor) => {
    const realRedemptions = redemptions.filter(r => !users[r.studentId]?.isDemo);
    const orderRows = realRedemptions
      .filter(r => inPeriod(r.date, mode, anchor))
      .map(r => ({
        'Ngày': new Date(r.date).toLocaleString('vi-VN'),
        'Học viên': r.studentName,
        'Món': itemsText(r.items),
        'Ghi chú': r.note || '',
        'Số credits': Number(r.totalCredits) || 0,
        'Ví': r.wallet === 'plus' ? 'Credits +' : 'Credits (Bonus)',
        'Trạng thái': (STATUS_META[r.status] || STATUS_META.pending).label,
        'Lý do từ chối': r.rejectReason || '',
        'Người xử lý': r.confirmedBy || r.rejectedBy || '',
      }));
    if (orderRows.length === 0) return showToast('⚠️ Không có yêu cầu đổi nào trong kỳ đã chọn.');

    const confirmedTotal = realRedemptions
      .filter(r => inPeriod(r.date, mode, anchor) && r.status === 'confirmed')
      .reduce((a, r) => a + (Number(r.totalCredits) || 0), 0);
    const pendingNum = realRedemptions.filter(r => inPeriod(r.date, mode, anchor) && r.status === 'pending').length;
    const rejectedNum = realRedemptions.filter(r => inPeriod(r.date, mode, anchor) && r.status === 'rejected').length;

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(orderRows);
    XLSX.utils.sheet_add_aoa(ws, [
      [],
      [`TỔNG KẾT YÊU CẦU ĐỔI (${periodNote(mode, anchor)})`],
      [`Tổng số yêu cầu: ${orderRows.length} (đã xác nhận: ${orderRows.length - pendingNum - rejectedNum} · chờ duyệt: ${pendingNum} · từ chối: ${rejectedNum})`],
      [`Credits đã xác nhận trừ: ${confirmedTotal} (= ${(confirmedTotal * 1000).toLocaleString('vi-VN')}đ)`],
    ], { origin: -1 });
    ws['!cols'] = [{ wch: 19 }, { wch: 22 }, { wch: 45 }, { wch: 30 }, { wch: 11 }, { wch: 15 }, { wch: 12 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Yeu cau doi');
    XLSX.writeFile(wb, `FreshFit_YeuCauDoi_${periodLabel(mode, anchor)}.xlsx`);
    showToast('✅ Đã xuất Excel Yêu cầu đổi.');
  };

  // Nút 2: chỉ Lịch sử nạp/trừ Credits + trong kỳ (bản đầy đủ, không cắt 30 dòng)
  const exportTopupXlsx = (mode, anchor) => {
    const plusRows = topupRowsAll
      .filter(h => !users[h.studentId]?.isDemo) // loại giao dịch demo khỏi báo cáo
      .filter(h => inPeriod(h.date, mode, anchor))
      .map(h => ({
        'Ngày': new Date(h.date).toLocaleString('vi-VN'),
        'Học viên': h.studentName,
        'Số credits': Number(h.amount) || 0,
        'Loại': (Number(h.amount) || 0) >= 0 ? 'Nạp' : 'Trừ (đổi quà)',
        'Ghi chú': h.note || '',
        'Người thực hiện': h.by || '',
      }));
    if (plusRows.length === 0) return showToast('⚠️ Không có giao dịch Credits + nào trong kỳ đã chọn.');

    const plusIn = plusRows.reduce((a, r) => a + (r['Số credits'] > 0 ? r['Số credits'] : 0), 0);
    const plusOut = plusRows.reduce((a, r) => a + (r['Số credits'] < 0 ? -r['Số credits'] : 0), 0);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(plusRows);
    XLSX.utils.sheet_add_aoa(ws, [
      [],
      [`TỔNG KẾT CREDITS + (${periodNote(mode, anchor)})`],
      [`Tổng nạp: +${plusIn} (= ${(plusIn * 1000).toLocaleString('vi-VN')}đ tiền mặt)`],
      [`Tổng trừ do đổi quà: −${plusOut}`],
      [`Chênh lệch kỳ: ${plusIn - plusOut >= 0 ? '+' : ''}${plusIn - plusOut}`],
    ], { origin: -1 });
    ws['!cols'] = [{ wch: 19 }, { wch: 22 }, { wch: 11 }, { wch: 14 }, { wch: 40 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Nap Credits +');
    XLSX.writeFile(wb, `FreshFit_NapCreditsPlus_${periodLabel(mode, anchor)}.xlsx`);
    showToast('✅ Đã xuất Excel Lịch sử Credits +.');
  };

  // Danh sách học viên khớp ô tìm kiếm nạp
  const topupCandidates = useMemo(() => {
    const kw = topupSearch.trim().toLowerCase();
    if (!kw) return [];
    return Object.entries(users)
      .map(([id, val]) => ({ id, ...val }))
      .filter(u => (u.role === 'student' || u.role === 'staff') && (u.name?.toLowerCase().includes(kw) || u.loginId?.toLowerCase().includes(kw)))
      .slice(0, 8);
  }, [users, topupSearch]);

  // --- Quản lý menu ---
  const handleAddMenuItem = async (e) => {
    e.preventDefault();
    if (!menuForm.name.trim() || !menuForm.price) return showToast('⚠️ Nhập tên món và giá credit.');
    try {
      await push(ref(db, 'ffMenu'), {
        name: menuForm.name.trim(),
        category: menuForm.category,
        group: menuForm.group.trim() || null,
        price: Number(menuForm.price),
        available: true,
        createdAt: new Date().toISOString(),
      });
      setMenuForm({ name: '', category: menuForm.category, group: menuForm.group, price: '' });
      showToast('✅ Đã thêm món vào menu.');
    } catch (e2) { showToast('❌ Lỗi: ' + e2.message); }
  };

  const handleSaveEdit = async () => {
    if (!editItem?.name?.trim() || !editItem?.price) return showToast('⚠️ Nhập tên món và giá credit.');
    try {
      await update(ref(db, `ffMenu/${editItem.id}`), {
        name: editItem.name.trim(),
        category: editItem.category,
        group: (editItem.group || '').trim() || null,
        price: Number(editItem.price),
        imageUrl: normalizeImageUrl(editItem.imageUrl) || null, // link ảnh — Dropbox tự đổi sang raw=1
        description: (editItem.description || '').trim() || null, // mô tả — hiện khi bấm vào thẻ món
      });
      setEditItem(null);
      showToast('✅ Đã cập nhật món.');
    } catch (e) { showToast('❌ Lỗi: ' + e.message); }
  };

  const toggleAvailable = (item) => update(ref(db, `ffMenu/${item.id}`), { available: item.available === false });
  const confirmDeleteItem = async () => {
    await remove(ref(db, `ffMenu/${deleteItem.id}`));
    setDeleteItem(null);
    showToast('Đã xóa món khỏi menu.');
  };

  // FF chỉ thấy & xử lý đơn MÓN ĂN/UỐNG — đơn quà (channel 'gift') do BOD xử lý ở BAVN Center
  const ffOrders = redemptions.filter(r => (r.channel || 'ff') !== 'gift');
  const filteredRedemptions = ffOrders
    .filter(r => statusFilter === 'all' || r.status === statusFilter)
    .filter(r => inPeriod(r.date, orderTime, orderAnchor));
  const pendingCount = ffOrders.filter(r => r.status === 'pending').length;

  const filteredMenu = useMemo(() => {
    const kw = menuSearch.trim().toLowerCase();
    return menu
      .filter(m => menuCatFilter === 'all' || m.category === menuCatFilter)
      .filter(m => !kw || m.name?.toLowerCase().includes(kw) || m.group?.toLowerCase().includes(kw))
      .sort((a, b) =>
        (a.category || '').localeCompare(b.category || '') ||
        (a.group || '').localeCompare(b.group || '') ||
        (a.name || '').localeCompare(b.name || '', 'vi')
      );
  }, [menu, menuCatFilter, menuSearch]);

  // --- Chặn truy cập nếu không có quyền FF / FF+ ---
  if (!ffAccess && !ffPlus) {
    return (
      <div className="bg-white p-10 rounded-2xl border border-slate-100 shadow-sm text-center">
        <p className="text-4xl mb-3">🔒</p>
        <p className="font-bold text-slate-700">Khu vực Fresh Fit</p>
        <p className="text-sm text-slate-400 mt-1">Bạn chưa được cấp quyền FF / FF+. Liên hệ Admin để được gán quyền trên thẻ nhân sự.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up pb-10">

      {/* TOAST */}
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white max-w-[90vw]"
          style={{ background: toastMsg.startsWith('✅') ? '#059669' : toastMsg.startsWith('⚠️') ? '#d97706' : toastMsg.startsWith('❌') ? '#dc2626' : '#2B6830' }}>
          {toastMsg}
        </div>
      )}

      {/* MODAL XÁC NHẬN DUYỆT / TỪ CHỐI */}
      {confirmTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full space-y-4 border border-slate-100">
            <p className="text-sm font-medium text-slate-700">
              {confirmTarget.action === 'confirm'
                ? ((confirmTarget.r.wallet || 'bonus') === 'plus'
                    ? <>Xác nhận đổi <b>{itemsText(confirmTarget.r.items)}</b> — sẽ trừ <b className="text-sky-700">{confirmTarget.r.totalCredits} Credits +</b> của <b>{confirmTarget.r.studentName}</b>?</>
                    : <>Xác nhận đổi <b>{itemsText(confirmTarget.r.items)}</b> — sẽ trừ <b className="text-red-600">{confirmTarget.r.totalCredits * 2} điểm Bonus</b> ({confirmTarget.r.totalCredits} credits) của <b>{confirmTarget.r.studentName}</b>?</>)
                : <>Từ chối yêu cầu của <b>{confirmTarget.r.studentName}</b>? Credits sẽ được hoàn lại cho học viên.</>}
            </p>
            {/* Lý do từ chối — bắt buộc, hiển thị cho học viên */}
            {confirmTarget.action === 'reject' && (
              <textarea
                rows={2}
                autoFocus
                className={`w-full border p-3 rounded-xl text-sm outline-none transition resize-none ${rejectReason.trim() ? 'border-slate-200 focus:border-red-400 focus:ring-2 focus:ring-red-100' : 'border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100'}`}
                placeholder="Lý do từ chối (bắt buộc — VD: món đã hết nguyên liệu, hết hàng trong hôm nay...)"
                value={rejectReason}
                maxLength={200}
                onChange={e => setRejectReason(e.target.value)}
              />
            )}
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmTarget(null)} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Hủy</button>
              <button
                onClick={() => confirmTarget.action === 'confirm' ? handleConfirm(confirmTarget.r) : handleReject(confirmTarget.r)}
                disabled={processing === confirmTarget.r.id || (confirmTarget.action === 'reject' && !rejectReason.trim())}
                className={`px-4 py-2 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${confirmTarget.action === 'confirm' ? 'bg-[#2B6830] hover:bg-[#1E5225]' : 'bg-red-500 hover:bg-red-600'}`}
              >
                {processing === confirmTarget.r.id ? 'Đang xử lý...' : confirmTarget.action === 'confirm' ? 'Xác nhận trừ credits' : 'Từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SỬA MÓN — có link ảnh + mô tả */}
      {editItem && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full space-y-3 border border-slate-100 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-[#2B6830]">Sửa món</h3>
            <input className="w-full border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10 transition"
              value={editItem.name} onChange={e => setEditItem({ ...editItem, name: e.target.value })} placeholder="Tên món" />
            <div className="flex gap-2">
              <select className="flex-1 border border-slate-200 p-3 rounded-xl text-sm outline-none bg-white focus:border-[#2B6830] transition"
                value={editItem.category} onChange={e => setEditItem({ ...editItem, category: e.target.value })}>
                <option value="sothich">🧋 Theo sở thích</option>
                <option value="thucduong">🌿 Thực dưỡng</option>
              </select>
              <input type="number" min="1" className="w-24 border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-[#2B6830] transition"
                value={editItem.price} onChange={e => setEditItem({ ...editItem, price: e.target.value })} placeholder="Giá ⭐" />
            </div>
            <input className="w-full border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-[#2B6830] transition" list="ff-groups"
              value={editItem.group || ''} onChange={e => setEditItem({ ...editItem, group: e.target.value })} placeholder="Nhóm món (VD: Trà sữa, Món chính...)" />
            {/* Link ảnh món — học viên thấy ảnh cạnh món trên menu */}
            <input className="w-full border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-[#2B6830] transition font-mono"
              value={editItem.imageUrl || ''} onChange={e => setEditItem({ ...editItem, imageUrl: e.target.value })} placeholder="Link ảnh món (https://...)" />
            {editItem.imageUrl?.trim() && (
              <div className="h-44 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-center overflow-hidden">
                <img src={normalizeImageUrl(editItem.imageUrl)} alt="Xem trước" className="max-w-full max-h-full object-contain" onError={(e) => { e.target.parentElement.style.display = 'none'; }} />
              </div>
            )}
            {/* Mô tả món — hiện khi học viên bấm vào thẻ món */}
            <textarea rows={3} className="w-full border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-[#2B6830] transition resize-none"
              value={editItem.description || ''} onChange={e => setEditItem({ ...editItem, description: e.target.value })} placeholder="Mô tả món (nguyên liệu, hương vị, calo...)" />
            <div className="flex gap-3 justify-end pt-1">
              <button onClick={() => setEditItem(null)} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Hủy</button>
              <button onClick={handleSaveEdit} className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-[#2B6830] hover:bg-[#1E5225] transition-colors">Lưu</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL XÓA MÓN */}
      {deleteItem && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4 border border-slate-100">
            <p className="text-sm font-medium text-slate-700">Xóa món "<b>{deleteItem.name}</b>" khỏi menu?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteItem(null)} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Hủy</button>
              <button onClick={confirmDeleteItem} className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition-colors">Xóa</button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
        <div className="p-2 bg-[#E8F4EC] rounded-xl text-[#2B6830] text-xl leading-none">🌿</div>
        <div>
          <h2 className="text-xl font-bold text-[#2B6830]">Fresh Fit — BAVN Credits</h2>
          <p className="text-xs text-slate-400 mt-0.5">Duyệt yêu cầu đổi credits, quản lý menu{ffPlus && ', nạp Credits +'} · 1 credit = 1.000đ.</p>
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-2 md:gap-3 flex-wrap">
        <button
          onClick={() => setActiveTab('orders')}
          className={`flex-1 md:flex-none md:px-5 py-3 rounded-xl text-sm font-semibold transition-all border flex items-center justify-center gap-2 ${activeTab === 'orders' ? 'bg-[#2B6830] text-white border-[#2B6830]' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
        >
          📥 Yêu cầu đổi
          {pendingCount > 0 && <span className="w-5 h-5 bg-amber-400 text-amber-900 text-[10px] font-bold rounded-full flex items-center justify-center">{pendingCount > 9 ? '9+' : pendingCount}</span>}
        </button>
        <button
          onClick={() => setActiveTab('menu')}
          className={`flex-1 md:flex-none md:px-5 py-3 rounded-xl text-sm font-semibold transition-all border ${activeTab === 'menu' ? 'bg-[#2B6830] text-white border-[#2B6830]' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
        >
          🍽️ Quản lý Menu ({menu.length})
        </button>
        {ffPlus && (
          <button
            onClick={() => setActiveTab('topup')}
            className={`flex-1 md:flex-none md:px-5 py-3 rounded-xl text-sm font-semibold transition-all border ${activeTab === 'topup' ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-sky-600 border-sky-200 hover:bg-sky-50'}`}
          >
            💳 Nạp Credits +
          </button>
        )}
      </div>

      {activeTab === 'orders' ? (
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex gap-1.5 flex-wrap mb-2">
            {['pending', 'confirmed', 'rejected', 'all'].map(st => (
              <button key={st} onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${statusFilter === st ? 'bg-[#2B6830] text-white border-[#2B6830]' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}>
                {st === 'all' ? 'Tất cả' : STATUS_META[st].label}
              </button>
            ))}
          </div>

          {/* Lọc theo kỳ: ngày / tuần / tháng (neo theo ngày chọn) */}
          <div className="flex items-center gap-1.5 flex-wrap mb-4">
            <span className="text-[11px] font-bold text-slate-400 uppercase mr-1">Kỳ:</span>
            {['all', 'day', 'week', 'month'].map(m => (
              <button key={m} onClick={() => setOrderTime(m)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${orderTime === m ? 'bg-amber-500 text-white border-amber-500' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}>
                {TIME_LABEL[m]}
              </button>
            ))}
            {orderTime !== 'all' && (
              <input type="date" value={orderAnchor} onChange={e => setOrderAnchor(e.target.value || todayStr())}
                className="px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 bg-white text-slate-600 outline-none focus:border-amber-400" />
            )}
            <span className="text-[11px] font-bold text-slate-400 ml-auto">{filteredRedemptions.length} yêu cầu</span>
            {/* Xuất Excel Yêu cầu đổi theo kỳ của tab này — chỉ FF+ */}
            {ffPlus && (
              <button onClick={() => exportOrdersXlsx(orderTime, orderAnchor)}
                title="Xuất Excel danh sách yêu cầu đổi theo kỳ đang chọn"
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors">
                📊 Xuất Excel Yêu cầu đổi ({TIME_LABEL[orderTime]})
              </button>
            )}
          </div>

          {filteredRedemptions.length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">Không có yêu cầu nào.</p>
          ) : (
            <div className="space-y-3">
              {filteredRedemptions.map(r => {
                const meta = STATUS_META[r.status] || STATUS_META.pending;
                const wallet = r.wallet || 'bonus';
                let availText = '', enough = true;
                if (r.status === 'pending') {
                  if (wallet === 'plus') {
                    const bal = getPlusBalance(r.studentId);
                    enough = bal >= (Number(r.totalCredits) || 0);
                    availText = `Credits + hiện có: ${bal}`;
                  } else if (r.userType === 'staff') {
                    const bal = getStaffBalance(r.studentId);
                    enough = bal >= (Number(r.totalCredits) || 0);
                    availText = `Credits (BOD cấp) hiện có: ${bal}`;
                  } else {
                    const balances = getBonusBalances(r.studentId);
                    const totalAvail = balances.reduce((a, b) => a + b.bonus, 0);
                    enough = totalAvail >= (Number(r.totalCredits) || 0) * 2;
                    availText = `Bonus hiện có: ${totalAvail}` + (balances.length ? ` (${balances.map(b => `${b.className}: ${b.bonus}`).join(' · ')})` : '');
                  }
                }
                return (
                  <div key={r.id} className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col gap-2.5">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 text-sm">
                          {r.studentName}
                          {r.userType === 'staff' && <span className="ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase bg-purple-50 text-purple-700 border-purple-200">Nhân sự</span>}
                          {/* Nhãn DEMO: giúp nhân sự FF nhận biết đơn thử nghiệm, không tính vào báo cáo */}
                          {users[r.studentId]?.isDemo && <span className="ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase bg-amber-100 text-amber-700 border-amber-300">🧪 Demo</span>}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">{itemsText(r.items)}</p>
                        {/* Ghi chú điều chỉnh món của học viên — nổi bật cho quầy dễ thấy */}
                        {r.note && (
                          <p className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mt-1.5 inline-block">📝 {r.note}</p>
                        )}
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">{new Date(r.date).toLocaleString('vi-VN')}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${wallet === 'plus' ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-[#E8F4EC] text-[#2B6830] border-green-200'}`}>
                            {wallet === 'plus' ? '💳 Credits +' : '⭐ Credits'}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${meta.cls}`}>{meta.label}</span>
                        </div>
                        <span className="text-base font-extrabold text-[#2B6830]">
                          {r.totalCredits} ⭐ {wallet !== 'plus' && <span className="text-[10px] text-slate-400 font-bold">= {r.totalCredits * 2} Bonus</span>}
                        </span>
                      </div>
                    </div>

                    {r.status === 'pending' && (
                      <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-slate-100 flex-wrap">
                        <p className={`text-[11px] font-bold ${enough ? 'text-slate-500' : 'text-red-600'}`}>
                          {availText}{!enough && ' — KHÔNG ĐỦ'}
                        </p>
                        <div className="flex gap-2">
                          <button onClick={() => { setRejectReason(''); setConfirmTarget({ r, action: 'reject' }); }}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-colors">Từ chối</button>
                          <button onClick={() => setConfirmTarget({ r, action: 'confirm' })} disabled={!enough}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#2B6830] hover:bg-[#1E5225] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Xác nhận & trừ credits</button>
                        </div>
                      </div>
                    )}
                    {r.status === 'confirmed' && r.confirmedBy && (
                      <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-100">✓ Xác nhận bởi <b>{r.confirmedBy}</b> · {r.confirmedAt && new Date(r.confirmedAt).toLocaleString('vi-VN')}</p>
                    )}
                    {r.status === 'rejected' && r.rejectedBy && (
                      <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                        ✕ Từ chối bởi <b>{r.rejectedBy}</b> · {r.rejectedAt && new Date(r.rejectedAt).toLocaleString('vi-VN')}
                        {r.rejectReason && <span className="text-red-500"> · Lý do: <b>{r.rejectReason}</b></span>}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : activeTab === 'topup' && ffPlus ? (
        /* ===== TAB NẠP CREDITS + ===== */
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-bold text-sky-700 uppercase tracking-wide">💳 Nạp Credits + cho học viên</h3>
            <p className="text-xs text-slate-400 mt-1">Học viên nạp tiền mặt tại quầy → nhập số credits tương ứng (1.000đ = 1 Credit +). Credits + hiển thị riêng với Credits từ Bonus.</p>
          </div>

          {/* Tìm học viên */}
          {!topupTarget ? (
            <div className="relative">
              <input
                type="text"
                className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10 text-sm bg-slate-50 focus:bg-white transition-colors"
                placeholder="Tìm học viên hoặc nhân sự theo tên / ID đăng nhập (nạp được cho cả chính mình)..."
                value={topupSearch}
                onChange={e => setTopupSearch(e.target.value)}
              />
              {topupCandidates.length > 0 && (
                <div className="mt-2 border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                  {topupCandidates.map(u => (
                    <button key={u.id} onClick={() => { setTopupTarget(u); setTopupConfirming(false); }}
                      className="w-full flex items-center justify-between p-3 bg-white hover:bg-sky-50 transition-colors text-left">
                      <div>
                        <p className="text-sm font-bold text-slate-700">
                          {u.name}{u.id === currentUser.id && <span className="text-sky-600"> (chính mình)</span>}
                          <span className={`ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${u.role === 'staff' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-[#E8F4EC] text-[#2B6830] border-green-200'}`}>
                            {u.role === 'staff' ? 'Nhân sự' : 'Học viên'}
                          </span>
                        </p>
                        <p className="text-[11px] text-slate-400">@{u.loginId || (u.email || '').split('@')[0]}</p>
                      </div>
                      <span className="text-xs font-bold text-sky-700 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-100">Credits +: {getPlusBalance(u.id)}</span>
                    </button>
                  ))}
                </div>
              )}
              {topupSearch.trim() && topupCandidates.length === 0 && (
                <p className="text-xs text-slate-400 italic mt-2">Không tìm thấy học viên nào.</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Học viên đã chọn */}
              <div className="flex items-center justify-between p-4 bg-sky-50 border border-sky-200 rounded-xl">
                <div>
                  <p className="text-sm font-bold text-slate-800">{topupTarget.name}</p>
                  <p className="text-[11px] text-slate-500">@{topupTarget.loginId || (topupTarget.email || '').split('@')[0]} · Credits + hiện có: <b className="text-sky-700">{getPlusBalance(topupTarget.id)}</b></p>
                </div>
                <button onClick={() => { setTopupTarget(null); setTopupConfirming(false); }} className="text-xs font-bold text-slate-500 hover:text-red-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200 transition-colors">Đổi học viên</button>
              </div>

              <div className="flex flex-col md:flex-row gap-2">
                <div className="md:w-48">
                  <input type="number" min="1" step="1"
                    className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-sky-500 transition"
                    placeholder="Số credits nạp"
                    value={topupAmount}
                    onChange={e => { setTopupAmount(e.target.value); setTopupConfirming(false); }}
                  />
                  {Number(topupAmount) > 0 && <p className="text-[11px] text-slate-400 mt-1 pl-1">= {(Number(topupAmount) * 1000).toLocaleString('vi-VN')}đ tiền mặt</p>}
                </div>
                <input
                  className="flex-1 p-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-sky-500 transition"
                  placeholder="Ghi chú (tùy chọn — VD: nạp 50k ngày 7/6)"
                  value={topupNote}
                  onChange={e => setTopupNote(e.target.value)}
                />
                <button
                  onClick={handleTopup}
                  className={`px-6 py-3 rounded-xl text-sm font-bold text-white transition-colors ${topupConfirming ? 'bg-amber-500 hover:bg-amber-600' : 'bg-sky-600 hover:bg-sky-700'}`}
                >
                  {topupConfirming ? `Bấm lần nữa để nạp ${topupAmount} ⭐` : 'Nạp Credits +'}
                </button>
              </div>

              {/* Lịch sử nạp/trừ của học viên này */}
              {creditPlusAll[topupTarget.id]?.history && (
                <div className="pt-2">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Lịch sử Credits + của {topupTarget.name}</p>
                  <div className="space-y-1.5 max-h-56 overflow-y-auto">
                    {Object.entries(creditPlusAll[topupTarget.id].history)
                      .map(([id, h]) => ({ id, ...h }))
                      .sort((a, b) => new Date(b.date) - new Date(a.date))
                      .map(h => (
                        <div key={h.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                          <span className="text-slate-600 truncate mr-2">{h.note || '—'} <span className="text-slate-400">· {h.by}</span></span>
                          <span className="flex items-center gap-2 shrink-0">
                            <span className="text-slate-400 font-mono">{new Date(h.date).toLocaleDateString('vi-VN')}</span>
                            <b className={h.amount >= 0 ? 'text-sky-700' : 'text-red-500'}>{h.amount >= 0 ? '+' : ''}{h.amount}</b>
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* LỊCH SỬ CREDITS + TOÀN HỆ THỐNG — luôn hiển thị, lọc theo kỳ + xuất Excel */}
          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">📜 Lịch sử Credits + {topupTime === 'all' ? 'gần đây' : `(${TIME_LABEL[topupTime].toLowerCase()})`} — toàn hệ thống</p>
              <button onClick={() => exportTopupXlsx(topupTime, topupAnchor)}
                title="Xuất Excel lịch sử nạp/trừ Credits + theo kỳ đang chọn"
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 transition-colors">
                📊 Xuất Excel Credits + ({TIME_LABEL[topupTime]})
              </button>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap mb-3">
              <span className="text-[11px] font-bold text-slate-400 uppercase mr-1">Kỳ:</span>
              {['all', 'day', 'week', 'month'].map(m => (
                <button key={m} onClick={() => setTopupTime(m)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${topupTime === m ? 'bg-sky-600 text-white border-sky-600' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}>
                  {TIME_LABEL[m]}
                </button>
              ))}
              {topupTime !== 'all' && (
                <input type="date" value={topupAnchor} onChange={e => setTopupAnchor(e.target.value || todayStr())}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 bg-white text-slate-600 outline-none focus:border-sky-400" />
              )}
              <span className="text-[11px] font-bold ml-auto">
                <span className="text-sky-700">Nạp: +{topupTotals.in}</span> · <span className="text-red-500">Trừ: −{topupTotals.out}</span> · {topupHistory.length} giao dịch
              </span>
            </div>
            {topupHistory.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-5 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                {topupTime === 'all' ? 'Chưa có giao dịch Credits + nào.' : 'Không có giao dịch trong kỳ đã chọn.'}
              </p>
            ) : (
              <div className="space-y-1.5 max-h-80 overflow-y-auto">
                {topupHistory.map(h => (
                  <div key={h.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                    <div className="min-w-0 mr-2">
                      <p className="font-bold text-slate-700 truncate">{h.studentName}</p>
                      <p className="text-slate-500 truncate">{h.note || '—'} <span className="text-slate-400">· bởi {h.by}</span></p>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <b className={`text-sm ${h.amount >= 0 ? 'text-sky-700' : 'text-red-500'}`}>{h.amount >= 0 ? '+' : ''}{h.amount} ⭐</b>
                      <span className="text-slate-400 font-mono text-[10px]">{new Date(h.date).toLocaleString('vi-VN')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* FORM THÊM MÓN + NHẬP MENU CÓ SẴN */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <h3 className="text-sm font-bold text-[#2B6830] uppercase tracking-wide">Thêm món mới</h3>
            </div>
            {/* Gợi ý nhóm món cho ô nhập */}
            <datalist id="ff-groups">
              <option value="Trà sữa" /><option value="Cà phê" /><option value="Trà trái cây" />
              <option value="Latte" /><option value="Đá xay" /><option value="Món chính" />
              <option value="Món ăn kèm" /><option value="Ăn vặt" /><option value="Topping" />
              <option value="Healthy Drinks" />
            </datalist>
            <form onSubmit={handleAddMenuItem} className="flex flex-col md:flex-row gap-2">
              <input className="flex-1 border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10 transition"
                placeholder="Tên món (VD: Nước ép cam)" value={menuForm.name} onChange={e => setMenuForm({ ...menuForm, name: e.target.value })} />
              <select className="border border-slate-200 p-3 rounded-xl text-sm outline-none bg-white focus:border-[#2B6830] transition"
                value={menuForm.category} onChange={e => setMenuForm({ ...menuForm, category: e.target.value })}>
                <option value="sothich">🧋 Theo sở thích</option>
                <option value="thucduong">🌿 Thực dưỡng</option>
              </select>
              <input className="w-full md:w-40 border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-[#2B6830] transition" list="ff-groups"
                placeholder="Nhóm món" value={menuForm.group} onChange={e => setMenuForm({ ...menuForm, group: e.target.value })} />
              <input type="number" min="1" className="w-full md:w-28 border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-[#2B6830] transition"
                placeholder="Giá (⭐)" value={menuForm.price} onChange={e => setMenuForm({ ...menuForm, price: e.target.value })} />
              <button type="submit" className="bg-[#2B6830] text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-[#1E5225] transition-colors">+ Thêm</button>
            </form>
            <p className="text-[11px] text-slate-400 mt-2">💡 Giá credit = giá tiền ÷ 1.000 (1 credit = 1.000đ). Ảnh và mô tả món thêm qua nút <b>Sửa</b> trên từng món.</p>
          </div>

          {/* DANH SÁCH MÓN */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <h3 className="text-sm font-bold text-[#2B6830] uppercase tracking-wide">Menu hiện tại ({filteredMenu.length})</h3>
              <div className="flex gap-1.5 flex-wrap">
                {/* Quà tặng đã tách sang BAVN Center (BOD quản lý) — FF chỉ quản món ăn/uống */}
                {['all', 'sothich', 'thucduong'].map(cat => (
                  <button key={cat} onClick={() => setMenuCatFilter(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${menuCatFilter === cat ? 'bg-[#2B6830] text-white border-[#2B6830]' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}>
                    {cat === 'all' ? 'Tất cả' : `${CATEGORY_META[cat].icon} ${CATEGORY_META[cat].label}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Ô TÌM KIẾM NHANH MÓN — theo tên hoặc nhóm món */}
            <div className="relative mb-4">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-slate-400"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
              </div>
              <input
                type="text"
                className="w-full pl-10 p-3 border border-slate-200 rounded-xl outline-none focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10 text-sm text-slate-700 bg-slate-50 focus:bg-white transition-colors"
                placeholder="Tìm nhanh món theo tên hoặc nhóm (VD: trà sữa, latte, món chính...)..."
                value={menuSearch}
                onChange={e => setMenuSearch(e.target.value)}
              />
              {menuSearch && (
                <button onClick={() => setMenuSearch('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>

            {filteredMenu.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">Chưa có món nào — thêm món mới hoặc bấm "Nhập menu Fresh Fit có sẵn".</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredMenu.map(item => (
                  <div key={item.id} className={`group rounded-xl border overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-1.5 hover:shadow-xl ${item.available === false ? 'border-slate-200 bg-slate-50 opacity-60' : 'border-slate-200 bg-white hover:border-green-300'}`}>
                    {/* Ảnh món lớn phía trên — hover phóng to để kiểm tra rõ món */}
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
                          <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">
                            {CATEGORY_META[item.category]?.label || 'Khác'}{item.group && ` · ${item.group}`}{item.available === false && ' · ĐANG ẨN'}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-extrabold text-[#2B6830] bg-[#E8F4EC] px-2.5 py-1 rounded-lg border border-green-100">{item.price} ⭐</span>
                      </div>
                      <div className="flex gap-2 pt-1 mt-auto">
                        <button onClick={() => toggleAvailable(item)}
                          className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${item.available === false ? 'text-green-700 bg-green-50 border-green-200 hover:bg-green-100' : 'text-slate-500 bg-slate-50 border-slate-200 hover:bg-slate-100'}`}>
                          {item.available === false ? 'Hiện lại' : 'Tạm ẩn'}
                        </button>
                        <button onClick={() => setEditItem({ ...item })}
                          className="flex-1 py-1.5 rounded-lg text-[11px] font-bold text-[#2B6830] bg-[#E8F4EC] border border-green-100 hover:bg-green-100 transition-colors">Sửa</button>
                        <button onClick={() => setDeleteItem(item)}
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

export default FreshFit;
