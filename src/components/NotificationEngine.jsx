import React, { useEffect, useRef, useState } from 'react';
import { db } from '../firebase';
import { ref, onValue, set } from 'firebase/database';
import { VAPID_KEY } from '../notifyConfig';

// ============================================================
// NOTIFICATION ENGINE — thông báo trình duyệt + âm thanh chuông
// Hoạt động khi app đang mở (kể cả ở tab khác / cửa sổ thu nhỏ).
// - Học viên: báo bài/thông báo mới · lịch học sắp bắt đầu (30')
//             · đơn đổi được xác nhận / từ chối
// - Nhân sự : FF/FF+ nhận đơn MÓN mới · BOD nhận đơn QUÀ mới
//             · đơn của chính mình được xác nhận / từ chối
// ============================================================

// --- Âm thanh chuông: tổng hợp bằng WebAudio, không cần file mp3 ---
let audioCtx = null;
const playDing = () => {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    // 2 nốt "ting-tong" nhẹ nhàng
    [[880, 0], [1174.66, 0.18]].forEach(([freq, delay]) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.25, now + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.6);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.7);
    });
  } catch (e) { /* trình duyệt chặn audio khi chưa có tương tác — bỏ qua */ }
};

// --- Bắn thông báo trình duyệt + chuông ---
const fireNotify = (title, body) => {
  playDing();
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      const n = new Notification(title, { body, icon: '/BA LOGO.png', badge: '/BA LOGO.png' });
      n.onclick = () => { window.focus(); n.close(); };
    }
  } catch (e) { /* ignore */ }
};

// --- Hook theo dõi node DB, gọi onNew cho key MỚI xuất hiện sau lần tải đầu ---
const useNewChildWatcher = (path, onNew, enabled = true) => {
  const seenRef = useRef(null);
  const cbRef = useRef(onNew);
  cbRef.current = onNew;
  useEffect(() => {
    if (!enabled || !path) { seenRef.current = null; return; }
    seenRef.current = null;
    const unsub = onValue(ref(db, path), (snap) => {
      const data = snap.val() || {};
      const keys = Object.keys(data);
      if (seenRef.current === null) { seenRef.current = new Set(keys); return; } // lần đầu: chỉ ghi nhận, không báo
      keys.forEach(k => {
        if (!seenRef.current.has(k)) {
          seenRef.current.add(k);
          cbRef.current(k, data[k]);
        }
      });
    });
    return () => unsub();
  }, [path, enabled]);
};

// --- Hook theo dõi ĐỔI TRẠNG THÁI đơn của chính mình (pending → confirmed/rejected) ---
const useMyOrderStatusWatcher = (userId) => {
  const prevRef = useRef(null);
  useEffect(() => {
    if (!userId) return;
    prevRef.current = null;
    const unsub = onValue(ref(db, 'redemptions'), (snap) => {
      const data = snap.val() || {};
      const mine = {};
      Object.entries(data).forEach(([id, r]) => { if (r.studentId === userId) mine[id] = r.status; });
      if (prevRef.current === null) { prevRef.current = mine; return; }
      Object.entries(mine).forEach(([id, status]) => {
        const prev = prevRef.current[id];
        if (prev === 'pending' && status !== 'pending') {
          const r = data[id];
          const items = (r.items || []).map(i => `${i.name} ×${i.qty}`).join(', ');
          const kind = r.channel === 'gift' ? 'đổi quà' : 'đổi món';
          if (status === 'confirmed') {
            fireNotify(`✅ Yêu cầu ${kind} đã được xác nhận`, `${items} — ${r.channel === 'gift' ? 'nhận quà từ BOD' : 'nhận tại quầy Fresh Fit'} nhé!`);
          } else if (status === 'rejected') {
            fireNotify(`❌ Yêu cầu ${kind} bị từ chối`, `${items}${r.rejectReason ? ` — Lý do: ${r.rejectReason}` : ''}. Credits đã được hoàn lại.`);
          }
        }
      });
      prevRef.current = mine;
    });
    return () => unsub();
  }, [userId]);
};

// --- Đăng ký FCM token: nhận push cả khi ĐÓNG trình duyệt (cần VAPID key + Functions đã deploy) ---
const registerFcmToken = async (userId) => {
  try {
    if (!userId) return;
    if (!VAPID_KEY || VAPID_KEY.startsWith('DAN_')) return; // chưa cấu hình VAPID → bỏ qua êm
    if (!('serviceWorker' in navigator) || !('Notification' in window) || Notification.permission !== 'granted') return;
    const { getMessaging, getToken, isSupported } = await import('firebase/messaging');
    if (!(await isSupported())) return;
    // Scope riêng để không xung đột với service worker của PWA (/sw.js)
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/firebase-cloud-messaging-push-scope',
    });
    // Chờ SW kích hoạt xong mới xin token (tránh lỗi "no active Service Worker")
    await new Promise((resolve) => {
      if (reg.active) return resolve();
      const sw = reg.installing || reg.waiting;
      if (!sw) return resolve();
      const onState = () => { if (sw.state === 'activated') { sw.removeEventListener('statechange', onState); resolve(); } };
      sw.addEventListener('statechange', onState);
      setTimeout(resolve, 8000); // chốt chặn: tối đa 8 giây
    });
    const token = await getToken(getMessaging(), { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    if (!token) return;
    // key không được chứa ./#$[]: → thay bằng _ ; trùng token thì tự đè (dedupe)
    const key = token.replace(/[.#$/\[\]:]/g, '_');
    await set(ref(db, `fcmTokens/${userId}/${key}`), {
      token,
      ua: navigator.userAgent.slice(0, 120),
      date: new Date().toISOString(),
    });
  } catch (e) { console.warn('FCM token:', e?.message); }
};

// --- Banner xin quyền thông báo (hiện 1 lần khi chưa cấp quyền) ---
const PermissionBanner = ({ onGranted }) => {
  const [show, setShow] = useState(
    'Notification' in window && Notification.permission === 'default' && !localStorage.getItem('notifyBannerDismissed')
  );
  if (!show) return null;
  return (
    <div className="fixed bottom-20 md:bottom-5 left-1/2 -translate-x-1/2 z-[70] bg-white border border-green-200 shadow-xl rounded-2xl px-4 py-3 flex items-center gap-3 max-w-[92vw]">
      <span className="text-xl">🔔</span>
      <p className="text-xs text-slate-600 font-medium">Bật thông báo để nhận báo bài, nhắc lịch học và cập nhật đổi quà kèm âm thanh.</p>
      <button
        onClick={async () => {
          try {
            const perm = await Notification.requestPermission();
            if (perm === 'granted' && onGranted) onGranted(); // đăng ký FCM token ngay khi được cấp quyền
          } catch (e) { /* ignore */ }
          playDing(); // mở khóa audio bằng tương tác này luôn
          setShow(false);
        }}
        className="shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-[#2B6830] hover:bg-[#1E5225] transition-colors"
      >
        Bật thông báo
      </button>
      <button onClick={() => { localStorage.setItem('notifyBannerDismissed', '1'); setShow(false); }} className="shrink-0 text-slate-400 hover:text-slate-600 text-sm font-bold px-1">✕</button>
    </div>
  );
};

// ============================================================
// ENGINE CHO HỌC VIÊN
// ============================================================
export const StudentNotifyEngine = ({ currentUser }) => {
  const myClassIds = currentUser?.classIds
    ? (Array.isArray(currentUser.classIds) ? currentUser.classIds : Object.values(currentUser.classIds))
    : [];
  const classIdsKey = myClassIds.join(',');

  // 1. Báo bài / thông báo mới đúng phạm vi của mình
  useNewChildWatcher('notifications', (id, n) => {
    if (n.scope !== 'all' && !myClassIds.includes(n.scope)) return;
    const label = n.type === 'link' ? 'liên kết' : (n.label || 'thông báo');
    fireNotify(`📢 ${label.charAt(0).toUpperCase() + label.slice(1)} mới`, n.title || 'Mở app để xem chi tiết.');
  }, !!currentUser?.id);

  // 2. Đơn đổi của mình được xác nhận / từ chối
  useMyOrderStatusWatcher(currentUser?.id);

  // Đăng ký FCM token nếu đã có quyền (push khi đóng trình duyệt)
  useEffect(() => { registerFcmToken(currentUser?.id); }, [currentUser?.id]);

  // 3. Nhắc lịch học: còn ≤30 phút nữa bắt đầu — mỗi lớp nhắc 1 lần/ngày
  const [classes, setClasses] = useState([]);
  useEffect(() => {
    const unsub = onValue(ref(db, 'classes'), (snap) => {
      const data = snap.val() || {};
      setClasses(Object.entries(data).map(([id, val]) => ({ id, ...val })).filter(c => myClassIds.includes(c.id)));
    });
    return () => unsub();
  }, [classIdsKey]);

  useEffect(() => {
    // Đọc lịch dạng "T2 - T4 - T6", "Thứ 3, Thứ 5", "CN"... → danh sách thứ trong tuần (getDay: CN=0, T2=1...)
    const parseDays = (schedule) => {
      const s = (schedule || '').toLowerCase();
      const days = new Set();
      if (/(^|[^a-zà-ỹ])cn|chủ\s*nhật/.test(s)) days.add(0);
      const re = /(?:t|thứ)\s*([2-7])/g;
      let m;
      while ((m = re.exec(s)) !== null) days.add(Number(m[1]) - 1);
      return days;
    };

    const check = () => {
      const now = new Date();
      const todayKey = now.toISOString().slice(0, 10);
      classes.forEach(c => {
        if (!c.startTime) return;
        const days = parseDays(c.schedule);
        if (days.size > 0 && !days.has(now.getDay())) return; // có lịch thứ mà hôm nay không khớp → bỏ
        const [hh, mm] = String(c.startTime).split(':').map(Number);
        if (isNaN(hh)) return;
        const start = new Date(now); start.setHours(hh, mm || 0, 0, 0);
        const diffMin = Math.round((start - now) / 60000);
        if (diffMin > 0 && diffMin <= 30) {
          const key = `classRemind_${c.id}_${todayKey}`;
          if (localStorage.getItem(key)) return;
          localStorage.setItem(key, '1');
          fireNotify(`⏰ Sắp đến giờ học lớp ${c.name}`, `Bắt đầu lúc ${c.startTime} (còn ${diffMin} phút). Chuẩn bị sẵn sàng nhé!`);
        }
      });
    };
    check();
    const t = setInterval(check, 30000); // kiểm tra mỗi 30 giây
    return () => clearInterval(t);
  }, [classes]);

  return <PermissionBanner onGranted={() => registerFcmToken(currentUser?.id)} />;
};

// ============================================================
// ENGINE CHO NHÂN SỰ
// ============================================================
export const StaffNotifyEngine = ({ currentUser, ffAccess, bodAccess }) => {
  // 1. FF/FF+: đơn MÓN mới · BOD: đơn QUÀ mới
  useNewChildWatcher('redemptions', (id, r) => {
    if (r.status !== 'pending') return;
    const items = (r.items || []).map(i => `${i.name} ×${i.qty}`).join(', ');
    const isGift = r.channel === 'gift';
    if (isGift && bodAccess) {
      fireNotify('🎁 Đơn đổi quà mới (BOD duyệt)', `${r.studentName}: ${items} — ${r.totalCredits}⭐`);
    } else if (!isGift && ffAccess) {
      fireNotify('🛎️ Yêu cầu đổi món mới', `${r.studentName}: ${items} — ${r.totalCredits}⭐${r.note ? ` · 📝 ${r.note}` : ''}`);
    }
  }, !!currentUser?.id && (ffAccess || bodAccess));

  // 2. Đơn của chính nhân sự này được xác nhận / từ chối
  useMyOrderStatusWatcher(currentUser?.id);

  // Đăng ký FCM token nếu đã có quyền (push khi đóng trình duyệt)
  useEffect(() => { registerFcmToken(currentUser?.id); }, [currentUser?.id]);

  return <PermissionBanner onGranted={() => registerFcmToken(currentUser?.id)} />;
};
