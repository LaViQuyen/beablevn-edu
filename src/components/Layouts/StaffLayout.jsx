import React, { useState, useEffect, useRef } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSwipeTabs } from '../useSwipeTabs';
import { db } from '../../firebase';
import { ref, update, get, onValue, push, set } from 'firebase/database';
import bcrypt from 'bcryptjs'; // Import mã hóa
import { StaffNotifyEngine } from '../NotificationEngine'; // thông báo + chuông cho FF/FF+/BOD
import StudentAvatar from '../StudentAvatar'; // avatar cho khối danh tính người đăng nhập

const Icons = {
  Class: ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={active ? "#2B6830" : "#64748b"} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m-6 2.292c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 006 18c2.305 0 4.408.867 6 2.292M7.5 12h3" />
    </svg>
  ),
  Attendance: ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={active ? "#2B6830" : "#64748b"} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
    </svg>
  ),
  Scores: ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={active ? "#2B6830" : "#64748b"} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
  Noti: ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={active ? "#2B6830" : "#64748b"} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  ),
  Logout: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
    </svg>
  ),
  Key: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
    </svg>
  ),
  Inbox: ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={active ? "#2B6830" : "#64748b"} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z" />
    </svg>
  ),
  Credits: ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={active ? "#2B6830" : "#64748b"} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  ),
  Bavn: ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={active ? "#7c3aed" : "#64748b"} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
  ),
  FreshFit: ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={active ? "#2B6830" : "#64748b"} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.87c1.355 0 2.697.055 4.024.165C17.155 8.51 18 9.473 18 10.608v2.513m-3-4.87v-1.5m-6 1.5v-1.5m12 9.75l-1.5.75a3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0L3 16.5m15-3.38a48.474 48.474 0 00-6-.37c-2.032 0-4.034.125-6 .37m12 0c.39.049.777.102 1.163.16 1.07.16 1.837 1.094 1.837 2.175v5.17c0 .62-.504 1.124-1.125 1.124H4.125A1.125 1.125 0 013 20.625v-5.17c0-1.08.768-2.014 1.837-2.174A47.78 47.78 0 016 13.12" />
    </svg>
  ),
  Game: ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={active ? "#2B6830" : "#64748b"} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 8.25v3m1.5-1.5h-3M15 9.75h.008v.008H15V9.75zm2.25 2.25h.008v.008h-.008V12zM4.5 6.75h15a1.5 1.5 0 011.5 1.5v7.5a1.5 1.5 0 01-1.5 1.5h-15a1.5 1.5 0 01-1.5-1.5v-7.5a1.5 1.5 0 011.5-1.5z" />
    </svg>
  ),
  Mod: ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={active ? "#e11d48" : "#64748b"} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
    </svg>
  ),
  // Icon "Thêm" (dấu 3 chấm) mở Drawer chức năng phụ trên mobile
  More: ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={active ? "#2B6830" : "#64748b"} className="w-5 h-5">
      <path d="M6 12a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM13.5 12a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM21 12a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
    </svg>
  ),
};

const StaffLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, currentUser } = useAuth(); // Lấy thêm currentUser

  const [showPassModal, setShowPassModal] = useState(false);
  const [passForm, setPassForm] = useState({ oldPass: '', newPass: '', confirmPass: '' });
  const [loadingPass, setLoadingPass] = useState(false);
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState('');
  const [inboxUnread, setInboxUnread] = useState(0); // badge hộp thư
  const [ffAccess, setFfAccess] = useState(false);   // cờ quyền Fresh Fit (realtime)
  const [ffPending, setFfPending] = useState(0);     // badge số yêu cầu đổi MÓN chờ duyệt (FF)
  const [bodAccess, setBodAccess] = useState(false); // cờ quyền BOD (realtime)
  const [giftPending, setGiftPending] = useState(0); // badge số đơn QUÀ chờ duyệt (BOD)
  const [modAccess, setModAccess] = useState(false); // cờ quyền MOD (thưởng Bonus nhân sự)
  const [moreOpen, setMoreOpen] = useState(false);   // Drawer "Thêm" trên mobile

  // Badge Hộp thư = số phản ánh CHƯA xử lý (theo lớp phụ trách) + tin nhắn chưa đọc
  useEffect(() => {
    if (!currentUser?.id) return;
    const isAdmin = currentUser.role === 'admin';
    const myClassIds = currentUser.assignedClasses || [];
    let fbCount = 0, msgCount = 0;
    const recompute = () => setInboxUnread(fbCount + msgCount);

    const unsubFb = onValue(ref(db, 'feedback'), (snap) => {
      const data = snap.val() || {};
      fbCount = Object.values(data).filter(fb => {
        if (fb.status === 'resolved') return false; // đã xử lý thì không tính
        if (isAdmin) return true;
        const cls = Array.isArray(fb.classIds) ? fb.classIds : Object.values(fb.classIds || {});
        return cls.some(c => myClassIds.includes(c));
      }).length;
      recompute();
    });
    const unsubMsg = onValue(ref(db, 'messages'), (snap) => {
      const data = snap.val() || {};
      msgCount = Object.values(data)
        .filter(m => isAdmin || m.recipientId === currentUser.id)
        .reduce((s, m) => s + (m.staffUnread || 0), 0);
      recompute();
    });
    return () => { unsubFb(); unsubMsg(); };
  }, [currentUser?.id]);

  // Nhắc trước 1 tuần khi sắp hết bảo lưu (client-side, chạy khi mở app, có cờ chống gửi trùng)
  useEffect(() => {
    if (!currentUser?.id) return;
    (async () => {
      try {
        const [uSnap, cSnap] = await Promise.all([get(ref(db, 'users')), get(ref(db, 'classes'))]);
        const users = uSnap.val() || {};
        const classes = cSnap.val() || {};
        const now = Date.now();
        const nowIso = new Date().toISOString();
        const staffAll = Object.entries(users).map(([id, u]) => ({ id, ...u }));
        for (const [sid, stu] of Object.entries(users)) {
          if (!stu || stu.role !== 'student') continue;
          const r = stu.reserve;
          if (!r || !r.start || !r.end || r.weekReminderSent) continue;
          const startT = new Date(r.start + 'T00:00:00').getTime();
          const endT = new Date(r.end + 'T23:59:59').getTime();
          const wb = new Date(r.end + 'T00:00:00'); wb.setDate(wb.getDate() - 7);
          if (now >= startT && now <= endT && now >= wb.getTime()) {
            // Đặt cờ TRƯỚC để chống gửi trùng nếu nhiều người mở app cùng lúc
            await update(ref(db, `users/${sid}/reserve`), { weekReminderSent: true });
            const sClasses = stu.classIds || [];
            const classNameStr = sClasses.map(c => classes[c]?.name || c).join(', ');
            const content = `Học viên ${stu.name}, học lớp ${classNameStr}, thời gian bảo lưu còn một tuần`;
            const recipients = staffAll.filter(u => u.role === 'staff' && (u.assignedClasses || []).some(c => sClasses.includes(c)));
            await Promise.all(recipients.map(staff => set(push(ref(db, 'messages')), {
              studentId: sid, studentName: 'Admin', studentCode: '',
              recipientId: staff.id, recipientName: staff.name, recipientRole: staff.subRole || 'staff',
              subject: 'THÔNG TIN BẢO LƯU', lastDate: nowIso, lastMessage: content,
              studentUnread: 0, staffUnread: 1, system: true,
              thread: [{ from: 'student', fromName: 'Admin', content, date: nowIso }],
            })));
          }
        }
      } catch (e) { console.error('Reserve reminder error:', e); }
    })();
  }, [currentUser?.id]);

  // Theo dõi cờ FF realtime, admin gán/gỡ là menu hiện/ẩn ngay
  useEffect(() => {
    if (!currentUser?.id) return;
    if (currentUser.role === 'admin') { setFfAccess(true); return; }
    const unsubFF = onValue(ref(db, `users/${currentUser.id}/ffAccess`), (snap) => setFfAccess(!!snap.val()));
    return () => unsubFF();
  }, [currentUser?.id, currentUser?.role]);

  // Theo dõi cờ BOD realtime
  useEffect(() => {
    if (!currentUser?.id) return;
    if (currentUser.role === 'admin') { setBodAccess(true); return; }
    const unsubB = onValue(ref(db, `users/${currentUser.id}/bodAccess`), (snap) => setBodAccess(!!snap.val()));
    return () => unsubB();
  }, [currentUser?.id, currentUser?.role]);

  // Theo dõi cờ MOD realtime, admin gán/gỡ là menu Thưởng Bonus hiện/ẩn ngay
  useEffect(() => {
    if (!currentUser?.id) return;
    if (currentUser.role === 'admin') { setModAccess(true); return; }
    const unsubM = onValue(ref(db, `users/${currentUser.id}/modAccess`), (snap) => setModAccess(!!snap.val()));
    return () => unsubM();
  }, [currentUser?.id, currentUser?.role]);

  // Badge yêu cầu chờ duyệt: FF đếm đơn MÓN, BOD đếm đơn QUÀ
  useEffect(() => {
    if (!ffAccess && !bodAccess) { setFfPending(0); setGiftPending(0); return; }
    const unsubR = onValue(ref(db, 'redemptions'), (snap) => {
      const data = snap.val() || {};
      const all = Object.values(data).filter(r => r.status === 'pending');
      setFfPending(all.filter(r => (r.channel || 'ff') !== 'gift').length);
      setGiftPending(all.filter(r => r.channel === 'gift').length);
    });
    return () => unsubR();
  }, [ffAccess, bodAccess]);

  const isActive = (path) => location.pathname.includes(path);
  // Moi the co be rong toi thieu co dinh + khong co lai (shrink-0) de thanh nav cuon ngang duoc
  const mobileLinkClass = (path) => `relative flex flex-col items-center justify-center shrink-0 min-w-[64px] h-full space-y-1 px-0.5 ${isActive(path) ? "text-primary before:absolute before:top-0 before:inset-x-3.5 before:h-[3px] before:bg-primary before:rounded-b-full" : 'text-slate-500 hover:text-slate-700'}`;

  // Thu tu the tren bottom nav - dung cho VUOT NGANG chuyen the (mobile);
  // cac the theo co quyen (FF/BOD/MOD) chi vao day khi duoc cap quyen
  const TABS = [
    { key: 'classes',       to: '/staff/classes' },
    { key: 'attendance',    to: '/staff/attendance' },
    { key: 'scores',        to: '/staff/scores' },
    { key: 'notifications', to: '/staff/notifications' },
    { key: 'inbox',         to: '/staff/inbox' },
    { key: 'credits',       to: '/staff/credits' },
    { key: 'skins',         to: '/staff/skins' },
    ...(ffAccess ? [{ key: 'freshfit', to: '/staff/freshfit' }] : []),
    ...(bodAccess ? [{ key: 'bavn', to: '/staff/bavn' }] : []),
    ...(modAccess ? [{ key: 'mod-bonus', to: '/staff/mod-bonus' }] : []),
  ];
  const { onTouchStart, onTouchEnd, slideKey, slideClass } = useSwipeTabs(TABS);

  // Bottom nav mobile: 4 thẻ chính hiện trực tiếp, phần còn lại (kể cả tab gated) gom vào Drawer "Thêm"
  const MORE_ITEMS = [
    { to: '/staff/notifications', key: 'notifications', label: 'Thông báo',    Icon: Icons.Noti },
    { to: '/staff/credits',       key: 'credits',       label: 'BAVN Credits', Icon: Icons.Credits },
    { to: '/staff/skins',         key: 'skins',         label: 'Skin & Game',  Icon: Icons.Game, activeExtra: 'games' },
    ...(ffAccess  ? [{ to: '/staff/freshfit',  key: 'freshfit',  label: 'Fresh Fit',     Icon: Icons.FreshFit, badge: ffPending }] : []),
    ...(bodAccess ? [{ to: '/staff/bavn',      key: 'bavn',      label: 'BAVN Center',   Icon: Icons.Bavn, badge: giftPending }] : []),
    ...(modAccess ? [{ to: '/staff/mod-bonus', key: 'mod-bonus', label: 'Thưởng Bonus',  Icon: Icons.Mod }] : []),
  ];
  const moreActive = MORE_ITEMS.some((it) => isActive(it.key) || (it.activeExtra && isActive(it.activeExtra)));
  const morePending = (ffAccess ? ffPending : 0) + (bodAccess ? giftPending : 0);

  // Tu cuon the dang chon vao giua thanh nav
  const bottomNavRef = useRef(null);
  useEffect(() => {
    const active = bottomNavRef.current?.querySelector('[data-active="true"]');
    if (active) active.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPassError(''); setPassSuccess('');
    if (!passForm.oldPass || !passForm.newPass || !passForm.confirmPass) return setPassError("Vui lòng điền đầy đủ thông tin.");
    if (passForm.newPass !== passForm.confirmPass) return setPassError("Xác nhận mật khẩu mới không khớp.");
    if (passForm.newPass.length < 6) return setPassError("Mật khẩu mới phải từ 6 ký tự trở lên.");
    if (passForm.oldPass === passForm.newPass) return setPassError("Mật khẩu mới phải khác mật khẩu cũ.");

    setLoadingPass(true);
    try {
        const userRef = ref(db, `users/${currentUser.id}`);
        const snapshot = await get(userRef);
        const userData = snapshot.val();
        const isMatch = bcrypt.compareSync(passForm.oldPass, userData.password);
        if (!isMatch) { setPassError("Mật khẩu cũ không đúng!"); setLoadingPass(false); return; }

        const salt = bcrypt.genSaltSync(10);
        const newHash = bcrypt.hashSync(passForm.newPass, salt);
        await update(userRef, { password: newHash });

        setPassSuccess("Đổi mật khẩu thành công!");
        setPassForm({ oldPass: '', newPass: '', confirmPass: '' });
        setTimeout(() => { setShowPassModal(false); setPassSuccess(''); }, 1800);
    } catch (error) {
        setPassError("Lỗi: " + error.message);
    } finally {
        setLoadingPass(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      {/* Engine thông báo trình duyệt + âm thanh, đơn mới cho FF/BOD, trạng thái đơn của mình */}
      <StaffNotifyEngine currentUser={currentUser} ffAccess={ffAccess} bodAccess={bodAccess} />
      {/* SIDEBAR (Desktop) */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 h-full fixed left-0 top-0 z-50">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <img src="/BA LOGO.png" alt="Logo" className="w-10 h-10 object-contain" />
          <div>
            <h1 className="font-extrabold text-primary text-lg leading-tight">BE ABLE VN</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Cổng Giáo vụ</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 mt-2">Giảng dạy</p>

          <Link to="/staff/classes" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${isActive('classes') ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Icons.Class active={isActive('classes')} /> Thông tin học viên
          </Link>
          <Link to="/staff/attendance" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${isActive('attendance') ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Icons.Attendance active={isActive('attendance')} /> Điểm danh
          </Link>
          <Link to="/staff/scores" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${isActive('scores') ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Icons.Scores active={isActive('scores')} /> Nhập điểm
          </Link>
          <Link to="/staff/notifications" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${isActive('notifications') ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Icons.Noti active={isActive('notifications')} /> Thông báo
          </Link>
          <Link to="/staff/inbox" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${isActive('inbox') ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Icons.Inbox active={isActive('inbox')} />
            <span className="flex-1">Hộp thư</span>
            {inboxUnread > 0 && (
              <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shrink-0">
                {inboxUnread > 9 ? '9+' : inboxUnread}
              </span>
            )}
          </Link>

          {/* Ví BAVN Credits, mọi nhân sự đều có */}
          <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 mt-4">Ưu đãi</p>
          <Link to="/staff/credits" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${isActive('credits') ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Icons.Credits active={isActive('credits')} />
            <span className="flex-1">BAVN Credits</span>
            <span className="text-[9px] font-bold bg-primary-light text-primary px-1.5 py-0.5 rounded border border-green-100 uppercase">Mới</span>
          </Link>

          {/* Skin & Game, nhân sự đổi skin + chơi Hành Trình Trưởng Thành không giới hạn */}
          <Link to="/staff/skins" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${isActive('skins') || isActive('games') ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Icons.Game active={isActive('skins') || isActive('games')} />
            <span className="flex-1">Skin & Game</span>
            <span className="text-[9px] font-bold bg-primary-light text-primary px-1.5 py-0.5 rounded border border-green-100 uppercase">Mới</span>
          </Link>

          {/* BAVN Center, chỉ hiện với cờ BOD (hoặc admin) */}
          {bodAccess && (
            <Link to="/staff/bavn" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${isActive('bavn') ? 'bg-purple-50 text-purple-700' : 'text-slate-600 hover:bg-slate-50'}`}>
              <Icons.Bavn active={isActive('bavn')} />
              <span className="flex-1">BAVN Center</span>
              {giftPending > 0 && (
                <span className="w-5 h-5 bg-purple-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shrink-0">
                  {giftPending > 9 ? '9+' : giftPending}
                </span>
              )}
            </Link>
          )}

          {/* Khu MOD, thưởng Bonus nhân sự (hiện khi có cờ modAccess hoặc admin) */}
          {modAccess && (
            <Link to="/staff/mod-bonus" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${isActive('mod-bonus') ? 'bg-rose-50 text-rose-700' : 'text-slate-600 hover:bg-slate-50'}`}>
              <Icons.Mod active={isActive('mod-bonus')} />
              <span className="flex-1">Thưởng Bonus</span>
              <span className="text-[9px] font-bold bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded border border-rose-200 uppercase">MOD</span>
            </Link>
          )}

          {/* Khu Fresh Fit, chỉ hiện với nhân sự được gán cờ FF (hoặc admin) */}
          {ffAccess && (
            <>
              <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 mt-4">Fresh Fit</p>
              <Link to="/staff/freshfit" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${isActive('freshfit') ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-50'}`}>
                <Icons.FreshFit active={isActive('freshfit')} />
                <span className="flex-1">Menu & Đổi credits</span>
                {ffPending > 0 && (
                  <span className="w-5 h-5 bg-amber-400 text-amber-900 text-[10px] font-bold rounded-full flex items-center justify-center shrink-0">
                    {ffPending > 9 ? '9+' : ffPending}
                  </span>
                )}
              </Link>
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-100 space-y-1">
           {/* Khối danh tính người đang đăng nhập */}
           <div className="flex items-center gap-3 px-3 py-2.5 mb-1 rounded-xl bg-slate-50">
             <StudentAvatar name={currentUser?.name} size={38} />
             <div className="min-w-0">
               <p className="text-sm font-bold text-slate-800 truncate">{currentUser?.name || 'Nhân sự'}</p>
               <p className="text-[11px] text-slate-500 truncate">{currentUser?.role === 'admin' ? 'Quản trị viên' : 'Giáo vụ'}</p>
             </div>
           </div>
           {/* Nút Đổi Mật Khẩu Desktop */}
           <button onClick={() => setShowPassModal(true)} className="flex items-center gap-3 px-4 py-3 rounded-xl w-full text-slate-500 hover:bg-primary-light hover:text-primary transition-all font-medium text-sm">
             <Icons.Key /> Đổi mật khẩu
           </button>
           <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 rounded-xl w-full text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all font-medium text-sm">
             <Icons.Logout /> Đăng xuất
           </button>
        </div>
      </aside>

      {/* MOBILE HEADER */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 z-50 px-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2">
          <img src="/BA LOGO.png" alt="Logo" className="w-7 h-7 object-contain" />
          <span className="text-primary font-bold text-sm">CỔNG GIÁO VỤ</span>
        </div>
        <div className="flex items-center gap-1">
            {/* Nút Đổi Mật Khẩu Mobile */}
            <button onClick={() => setShowPassModal(true)} aria-label="Đổi mật khẩu" title="Đổi mật khẩu" className="p-2 text-slate-500 hover:text-primary">
                <Icons.Key />
            </button>
            <button onClick={handleLogout} aria-label="Đăng xuất" title="Đăng xuất" className="p-2 text-slate-500 hover:text-red-500">
                <Icons.Logout />
            </button>
        </div>
      </header>

      {/* MAIN CONTENT - vuot ngang tren mobile de chuyen the truoc/sau */}
      <main className="flex-1 md:ml-64 px-4 pt-20 pb-24 md:p-8 md:pb-8 overflow-auto" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div key={slideKey} className={`max-w-6xl mx-auto ${slideClass}`}><Outlet /></div>
      </main>

      {/* MOBILE BOTTOM NAV - 4 the chinh + nut Them (mo Drawer chua phan con lai, ke ca tab gated) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 h-16 flex items-center justify-around z-50 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <Link to="/staff/classes" className={mobileLinkClass('classes')}><Icons.Class active={isActive('classes')} /><span className="text-[10px] font-medium">Học viên</span></Link>
        <Link to="/staff/attendance" className={mobileLinkClass('attendance')}><Icons.Attendance active={isActive('attendance')} /><span className="text-[10px] font-medium">Đ.Danh</span></Link>
        <Link to="/staff/scores" className={mobileLinkClass('scores')}><Icons.Scores active={isActive('scores')} /><span className="text-[10px] font-medium">Điểm</span></Link>
        <Link to="/staff/inbox" className={mobileLinkClass('inbox')}>
          <span className="relative"><Icons.Inbox active={isActive('inbox')} />{inboxUnread > 0 && <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{inboxUnread > 9 ? '9+' : inboxUnread}</span>}</span>
          <span className="text-[10px] font-medium">Hộp thư</span>
        </Link>
        <button
          onClick={() => setMoreOpen(true)}
          aria-label="Thêm chức năng"
          className={`relative flex flex-col items-center justify-center shrink-0 min-w-[64px] h-full space-y-1 px-0.5 ${moreActive ? 'text-primary' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <span className="relative"><Icons.More active={moreActive} />{morePending > 0 && <span className="absolute -top-1 -right-1.5 w-2.5 h-2.5 bg-amber-400 border border-white rounded-full" />}</span>
          <span className="text-[10px] font-medium">Thêm</span>
        </button>
      </nav>

      {/* DRAWER "Thêm" - bottom sheet chua cac chuc nang phu + tab gated (mobile) */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Thêm chức năng">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setMoreOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl p-4 pb-8 pb-safe animate-fade-in-up">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-3" />
            <p className="stat-label px-1 mb-3">Thêm chức năng</p>
            <div className="grid grid-cols-4 gap-2">
              {MORE_ITEMS.map((it) => {
                const act = isActive(it.key) || (it.activeExtra && isActive(it.activeExtra));
                return (
                  <Link
                    key={it.key}
                    to={it.to}
                    onClick={() => setMoreOpen(false)}
                    className={`relative flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl text-center transition-colors ${act ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    {it.badge > 0 && <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 bg-amber-400 text-amber-900 text-[9px] font-bold rounded-full flex items-center justify-center">{it.badge > 9 ? '9+' : it.badge}</span>}
                    <it.Icon active={act} />
                    <span className="text-[11px] font-medium leading-tight">{it.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL ĐỔI MẬT KHẨU */}
      {showPassModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                <h3 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
                    <Icons.Key /> Đổi Mật Khẩu
                </h3>
                <form onSubmit={handleChangePassword} className="space-y-4">
                    {/* Inline error / success */}
                    {passError && (
                        <div className="flex items-start gap-2 bg-red-50 text-red-700 border border-red-200 px-3 py-2.5 rounded-xl text-sm">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0 mt-0.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                            {passError}
                        </div>
                    )}
                    {passSuccess && (
                        <div className="flex items-center gap-2 bg-green-50 text-green-700 border border-green-200 px-3 py-2.5 rounded-xl text-sm font-medium">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                            {passSuccess}
                        </div>
                    )}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mật khẩu cũ</label>
                        <input type="password" className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
                            value={passForm.oldPass} onChange={e => { setPassForm({...passForm, oldPass: e.target.value}); setPassError(''); }}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mật khẩu mới</label>
                        <input type="password" className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
                            value={passForm.newPass} onChange={e => { setPassForm({...passForm, newPass: e.target.value}); setPassError(''); }}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Xác nhận mật khẩu mới</label>
                        <input type="password" className={`w-full p-3 border rounded-xl outline-none focus:ring-2 transition ${passForm.confirmPass && passForm.newPass !== passForm.confirmPass ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : 'border-slate-200 focus:border-primary focus:ring-primary/10'}`}
                            value={passForm.confirmPass} onChange={e => { setPassForm({...passForm, confirmPass: e.target.value}); setPassError(''); }}
                        />
                        {passForm.confirmPass && passForm.newPass !== passForm.confirmPass && (
                            <p className="text-red-500 text-xs mt-1">Mật khẩu không khớp</p>
                        )}
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => { setShowPassModal(false); setPassError(''); setPassSuccess(''); setPassForm({ oldPass: '', newPass: '', confirmPass: '' }); }} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors">Hủy</button>
                        <button type="submit" disabled={loadingPass} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-hover transition-colors disabled:opacity-50">
                            {loadingPass ? "Đang xử lý..." : "Lưu thay đổi"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default StaffLayout;
