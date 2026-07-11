import React, { useState, useEffect, useRef } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSwipeTabs } from '../useSwipeTabs';
import { db } from '../../firebase';
import { ref, update, get, onValue } from 'firebase/database';
import bcrypt from 'bcryptjs';
import { StudentNotifyEngine } from '../NotificationEngine'; // thông báo + chuông: báo bài, nhắc lịch học, trạng thái đổi quà
import StudentAvatar from '../StudentAvatar'; // avatar cho khối danh tính người đăng nhập

const Icons = {
  Dashboard: ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={active ? "#2B6830" : "#64748b"} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
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
  Credits: ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={active ? "#2B6830" : "#64748b"} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
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
  Feedback: ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={active ? "#2B6830" : "#64748b"} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
    </svg>
  ),
  Contact: ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={active ? "#2B6830" : "#64748b"} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
    </svg>
  ),
  Practice: ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={active ? "#2B6830" : "#64748b"} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  ),
  // Icon Skin (gương mặt cười), khu Cửa hàng Skin
  Skins: ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={active ? "#2B6830" : "#64748b"} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
    </svg>
  ),
  // Icon cúp, Bảng Vinh Danh
  Trophy: ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={active ? "#2B6830" : "#64748b"} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
    </svg>
  ),
  Lock: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#94a3b8" className="w-3.5 h-3.5 shrink-0">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 00-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  ),
  // Icon "Thêm" (dấu 3 chấm) mở Drawer chức năng phụ trên mobile
  More: ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={active ? "#2B6830" : "#64748b"} className="w-5 h-5">
      <path d="M6 12a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM13.5 12a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM21 12a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
    </svg>
  ),
};

// ─── Popup bị chặn do quá hạn ────────────────────────────────────────────────
const OverdueBlockPopup = ({ onClose }) => (
  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[80] p-4" onClick={onClose}>
    <div className="bg-slate-700 text-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center space-y-4" onClick={(e) => e.stopPropagation()}>
      <div className="w-12 h-12 rounded-full bg-slate-600 flex items-center justify-center mx-auto">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-slate-300">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 00-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
      </div>
      <p className="text-sm leading-relaxed text-slate-200">
        BE ABLE xin lỗi vì bất tiện này. Bạn cần thanh toán học phí để mở lại các tính năng.
      </p>
      <button onClick={onClose} className="px-5 py-2.5 bg-slate-600 hover:bg-slate-500 text-white rounded-xl text-sm font-bold transition-colors">Đóng</button>
    </div>
  </div>
);

const StudentLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, currentUser } = useAuth();

  const [showPassModal, setShowPassModal] = useState(false);
  const [passForm, setPassForm] = useState({ oldPass: '', newPass: '', confirmPass: '' });
  const [loadingPass, setLoadingPass] = useState(false);
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState('');
  const [feedbackUnread, setFeedbackUnread] = useState(0); // số phản hồi mới của GV
  const [moreOpen, setMoreOpen] = useState(false); // Drawer "Thêm" trên mobile

  // ─── Trạng thái học phí để khoá menu khi Quá hạn ─────────────────────────
  const [tuitionStatus, setTuitionStatus] = useState(null); // null | 'Chờ' | 'Quá hạn' | 'Đã đóng'
  const [overdueBlockPopup, setOverdueBlockPopup] = useState(false);

  // Subscribe trạng thái học phí
  useEffect(() => {
    if (!currentUser?.studentCode) return;
    const unsub = onValue(ref(db, 'tuitionRecords'), (snap) => {
      const data = snap.val() || {};
      const entry = Object.values(data).find((v) => v.studentCode === currentUser.studentCode);
      setTuitionStatus(entry?.status || null);
    });
    return () => unsub();
  }, [currentUser?.studentCode]);

  const isOverdue = tuitionStatus === 'Quá hạn';

  // Xử lý click menu bị khoá khi quá hạn
  const handleBlockedMenuClick = (e) => {
    if (isOverdue) {
      e.preventDefault();
      setOverdueBlockPopup(true);
    }
  };

  // Đếm số phản hồi chưa đọc (badge cạnh "Phản ánh")
  useEffect(() => {
    if (!currentUser?.id) return;
    const unsub = onValue(ref(db, 'feedback'), (snap) => {
      const data = snap.val() || {};
      const count = Object.values(data)
        .filter(fb => fb.studentId === currentUser.id)
        .reduce((s, fb) => s + (fb.studentUnread || 0), 0);
      setFeedbackUnread(count);
    });
    return () => unsub();
  }, [currentUser?.id]);

  const isActive = (path) => location.pathname.includes(path);
  // Mỗi thẻ có bề rộng tối thiểu cố định + không co lại (shrink-0) để thanh nav cuộn ngang được
  const mobileLinkClass = (path) => `relative flex flex-col items-center justify-center shrink-0 min-w-[64px] h-full space-y-1 px-0.5 ${isActive(path) ? "text-primary before:absolute before:top-0 before:inset-x-3.5 before:h-[3px] before:bg-primary before:rounded-b-full" : 'text-slate-500 hover:text-slate-700'}`;

  // Thu tu the bottom nav - dung cho VUOT NGANG chuyen the;
  // khi Qua han hoc phi thi BO cac the bi khoa khoi day vuot (khong lach duoc popup)
  const LOCKED_WHEN_OVERDUE = ['credits', 'skins', 'resources', 'notifications'];
  const TABS = [
    { key: 'dashboard',     to: '/student/dashboard' },
    { key: 'attendance',    to: '/student/attendance' },
    { key: 'scores',        to: '/student/scores' },
    { key: 'credits',       to: '/student/credits' },
    { key: 'skins',         to: '/student/skins' },
    { key: 'leaderboard',   to: '/student/leaderboard' },
    { key: 'resources',     to: '/student/resources' },
    { key: 'notifications', to: '/student/notifications' },
    { key: 'feedback',      to: '/student/feedback' },
    { key: 'contact',       to: '/student/contact' },
  ].filter((tb) => !isOverdue || !LOCKED_WHEN_OVERDUE.includes(tb.key));
  const { onTouchStart, onTouchEnd, slideKey, slideClass } = useSwipeTabs(TABS);

  // Bottom nav mobile: 4 thẻ chính hiện trực tiếp, phần còn lại gom vào Drawer "Thêm".
  // Giữ nguyên cơ chế khoá khi Quá hạn: các mục trong LOCKED_WHEN_OVERDUE bị chặn + hiện popup.
  const isLocked = (key) => isOverdue && LOCKED_WHEN_OVERDUE.includes(key);
  const MORE_ITEMS = [
    { to: '/student/credits',       key: 'credits',       label: 'BAVN Credits',  Icon: Icons.Credits },
    { to: '/student/skins',         key: 'skins',         label: 'Cửa hàng Skin', Icon: Icons.Skins },
    { to: '/student/leaderboard',   key: 'leaderboard',   label: 'Bảng Vinh Danh', Icon: Icons.Trophy },
    { to: '/student/resources',     key: 'resources',     label: 'Luyện tập IELTS', Icon: Icons.Practice },
    { to: '/student/feedback',      key: 'feedback',      label: 'Phản ánh',      Icon: Icons.Feedback, badge: feedbackUnread },
    { to: '/student/contact',       key: 'contact',       label: 'Liên hệ GV',    Icon: Icons.Contact },
  ];
  const moreActive = MORE_ITEMS.some((it) => isActive(it.key));

  // Tự cuộn thẻ đang chọn vào giữa thanh nav
  const bottomNavRef = useRef(null);
  useEffect(() => {
    const active = bottomNavRef.current?.querySelector('[data-active="true"]');
    if (active) active.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [location.pathname]);

  const handleLogout = () => { logout(); navigate('/'); };

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
      {/* Engine thông báo trình duyệt + âm thanh */}
      <StudentNotifyEngine currentUser={currentUser} />

      {/* Popup bị khoá do quá hạn */}
      {overdueBlockPopup && <OverdueBlockPopup onClose={() => setOverdueBlockPopup(false)} />}

      {/* SIDEBAR (Desktop) */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 h-full fixed left-0 top-0 z-50">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <img src="/BA LOGO.png" alt="Logo" className="w-10 h-10 object-contain" />
          <div>
            <h1 className="font-extrabold text-primary text-lg leading-tight">BE ABLE VN</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Cổng Học viên</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 mt-2">Học tập</p>

          <Link to="/student/dashboard" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${isActive('dashboard') ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Icons.Dashboard active={isActive('dashboard')} /> Tổng quan
          </Link>
          <Link to="/student/attendance" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${isActive('attendance') ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Icons.Attendance active={isActive('attendance')} /> Điểm danh của tôi
          </Link>
          <Link to="/student/scores" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${isActive('scores') ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Icons.Scores active={isActive('scores')} /> Bảng điểm
          </Link>
          {/* Thông báo, khoá khi Quá hạn */}
          <Link
            to="/student/notifications"
            onClick={handleBlockedMenuClick}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${isActive('notifications') ? 'bg-primary/10 text-primary' : isOverdue ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Icons.Noti active={isActive('notifications') && !isOverdue} />
            <span className="flex-1">Thông báo</span>
            {isOverdue && <Icons.Lock />}
          </Link>

          <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 mt-4">Ưu đãi</p>
          {/* BAVN Credits, khoá khi Quá hạn */}
          <Link
            to="/student/credits"
            onClick={handleBlockedMenuClick}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${isActive('credits') ? 'bg-primary/10 text-primary' : isOverdue ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Icons.Credits active={isActive('credits') && !isOverdue} />
            <span className="flex-1">BAVN Credits</span>
            {isOverdue
              ? <Icons.Lock />
              : <span className="text-[9px] font-bold bg-primary-light text-primary px-1.5 py-0.5 rounded border border-green-100 uppercase">Mới</span>
            }
          </Link>
          {/* Cửa hàng Skin, khoá khi Quá hạn */}
          <Link
            to="/student/skins"
            onClick={handleBlockedMenuClick}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${isActive('skins') ? 'bg-primary/10 text-primary' : isOverdue ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Icons.Skins active={isActive('skins') && !isOverdue} />
            <span className="flex-1">Cửa hàng Skin</span>
            {isOverdue
              ? <Icons.Lock />
              : <span className="text-[9px] font-bold bg-primary-light text-primary px-1.5 py-0.5 rounded border border-green-100 uppercase">Mới</span>
            }
          </Link>
          <Link to="/student/leaderboard" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${isActive('leaderboard') ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Icons.Trophy active={isActive('leaderboard')} />
            <span className="flex-1">Bảng Vinh Danh</span>
            <span className="text-[9px] font-bold bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200 uppercase">Hot</span>
          </Link>

          <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 mt-4">Tài nguyên</p>
          {/* Luyện tập IELTS, khoá khi Quá hạn */}
          <Link
            to="/student/resources"
            onClick={handleBlockedMenuClick}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${isActive('resources') ? 'bg-primary/10 text-primary' : isOverdue ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Icons.Practice active={isActive('resources') && !isOverdue} />
            <span className="flex-1">Luyện tập IELTS</span>
            {isOverdue
              ? <Icons.Lock />
              : <span className="text-[9px] font-bold bg-primary-light text-primary px-1.5 py-0.5 rounded border border-green-100 uppercase">Mới</span>
            }
          </Link>

          <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 mt-4">Tương tác</p>
          <Link to="/student/feedback" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${isActive('feedback') ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Icons.Feedback active={isActive('feedback')} />
            <span className="flex-1">Phản ánh</span>
            {feedbackUnread > 0 && (
              <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shrink-0">
                {feedbackUnread > 9 ? '9+' : feedbackUnread}
              </span>
            )}
          </Link>
          <Link to="/student/contact" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${isActive('contact') ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Icons.Contact active={isActive('contact')} /> Liên hệ GV
          </Link>
        </nav>

        <div className="p-4 border-t border-slate-100 space-y-1">
          {/* Khối danh tính người đang đăng nhập */}
          <div className="flex items-center gap-3 px-3 py-2.5 mb-1 rounded-xl bg-slate-50">
            <StudentAvatar name={currentUser?.name} size={38} />
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-800 truncate">{currentUser?.name || 'Học viên'}</p>
              <p className="text-[11px] text-slate-500 truncate">{currentUser?.studentCode ? `Mã HV: ${currentUser.studentCode}` : 'Cổng Học viên'}</p>
            </div>
          </div>
          <Link to="/student/profile" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${isActive('profile') ? 'bg-primary/10 text-primary' : 'text-slate-500 hover:bg-primary-light hover:text-primary'}`}>
            <Icons.Key /> Tài khoản & Bảo mật
          </Link>
          <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 rounded-xl w-full text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all font-medium text-sm">
            <Icons.Logout /> Đăng xuất
          </button>
        </div>
      </aside>

      {/* MOBILE HEADER */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 z-50 px-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2">
          <img src="/BA LOGO.png" alt="Logo" className="w-7 h-7 object-contain" />
          <span className="text-primary font-bold text-sm">CỔNG HỌC VIÊN</span>
        </div>
        <div className="flex items-center gap-1">
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

      {/* MOBILE BOTTOM NAV, 4 the chinh + nut Them (mo Drawer chua phan con lai) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 h-16 flex items-center justify-around z-50 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <Link to="/student/dashboard" className={mobileLinkClass('dashboard')}><Icons.Dashboard active={isActive('dashboard')} /><span className="text-[10px] font-medium">Tổng quan</span></Link>
        <Link to="/student/scores" className={mobileLinkClass('scores')}><Icons.Scores active={isActive('scores')} /><span className="text-[10px] font-medium">Điểm</span></Link>
        <Link to="/student/attendance" className={mobileLinkClass('attendance')}><Icons.Attendance active={isActive('attendance')} /><span className="text-[10px] font-medium">Đ.Danh</span></Link>
        {/* Thông báo, khoá khi Quá hạn */}
        <Link to="/student/notifications" onClick={handleBlockedMenuClick} className={mobileLinkClass('notifications') + (isOverdue ? ' opacity-40' : '')}>
          <Icons.Noti active={isActive('notifications') && !isOverdue} /><span className="text-[10px] font-medium">TBáo</span>
        </Link>
        <button
          onClick={() => setMoreOpen(true)}
          aria-label="Thêm chức năng"
          className={`relative flex flex-col items-center justify-center shrink-0 min-w-[64px] h-full space-y-1 px-0.5 ${moreActive ? 'text-primary' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <span className="relative"><Icons.More active={moreActive} />{feedbackUnread > 0 && <span className="absolute -top-1 -right-1.5 w-2.5 h-2.5 bg-red-500 border border-white rounded-full" />}</span>
          <span className="text-[10px] font-medium">Thêm</span>
        </button>
      </nav>

      {/* DRAWER "Thêm" - bottom sheet chua cac chuc nang phu (mobile); giu khoa khi Qua han */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Thêm chức năng">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setMoreOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl p-4 pb-8 pb-safe animate-fade-in-up">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-3" />
            <p className="stat-label px-1 mb-3">Thêm chức năng</p>
            <div className="grid grid-cols-4 gap-2">
              {MORE_ITEMS.map((it) => {
                const locked = isLocked(it.key);
                const act = isActive(it.key) && !locked;
                return (
                  <Link
                    key={it.key}
                    to={it.to}
                    onClick={(e) => { if (locked) { handleBlockedMenuClick(e); } else { setMoreOpen(false); } }}
                    className={`relative flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl text-center transition-colors ${act ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-50'} ${locked ? 'opacity-50' : ''}`}
                  >
                    {locked
                      ? <span className="absolute top-1.5 right-1.5"><Icons.Lock /></span>
                      : (it.badge > 0 && <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{it.badge > 9 ? '9+' : it.badge}</span>)}
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
                  value={passForm.oldPass} onChange={e => { setPassForm({...passForm, oldPass: e.target.value}); setPassError(''); }} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mật khẩu mới</label>
                <input type="password" className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
                  value={passForm.newPass} onChange={e => { setPassForm({...passForm, newPass: e.target.value}); setPassError(''); }} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Xác nhận mật khẩu mới</label>
                <input type="password" className={`w-full p-3 border rounded-xl outline-none focus:ring-2 transition ${passForm.confirmPass && passForm.newPass !== passForm.confirmPass ? 'border-red-300 focus:ring-red-100' : 'border-slate-200 focus:border-primary focus:ring-primary/10'}`}
                  value={passForm.confirmPass} onChange={e => { setPassForm({...passForm, confirmPass: e.target.value}); setPassError(''); }} />
                {passForm.confirmPass && passForm.newPass !== passForm.confirmPass && (
                  <p className="text-red-500 text-xs mt-1">Mật khẩu không khớp</p>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowPassModal(false); setPassError(''); setPassSuccess(''); setPassForm({ oldPass:'', newPass:'', confirmPass:'' }); }} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors">Hủy</button>
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

export default StudentLayout;
