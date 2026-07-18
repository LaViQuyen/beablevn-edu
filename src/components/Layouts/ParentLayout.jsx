import React, { useState, useEffect, useRef } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSwipeTabs } from '../useSwipeTabs';
import { db } from '../../firebase';
import { ref, update, get, onValue } from 'firebase/database';
import bcrypt from 'bcryptjs';
import { ParentNotifyEngine } from '../NotificationEngine';
import StudentAvatar from '../StudentAvatar';

// ============================================================
// LAYOUT CỔNG PHỤ HUYNH (role 'parent')
// Nav: Sổ liên lạc (tổng quan các con) · Thông báo · Lịch hẹn · Hỗ trợ & Phản ánh
// ============================================================

const Icons = {
  Book: ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={active ? "#2B6830" : "#64748b"} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  ),
  Noti: ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={active ? "#2B6830" : "#64748b"} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  ),
  Calendar: ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={active ? "#2B6830" : "#64748b"} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
    </svg>
  ),
  Support: ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={active ? "#2B6830" : "#64748b"} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
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
};

const ParentLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, currentUser } = useAuth();

  const [showPassModal, setShowPassModal] = useState(false);
  const [passForm, setPassForm] = useState({ oldPass: '', newPass: '', confirmPass: '' });
  const [loadingPass, setLoadingPass] = useState(false);
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState('');
  const [supportUnread, setSupportUnread] = useState(0);   // phản hồi mới trong Hỗ trợ & Phản ánh
  const [apptUnread, setApptUnread] = useState(0);         // cập nhật mới của Lịch hẹn

  // Badge Hỗ trợ: phản ánh của phụ huynh này có phản hồi chưa đọc
  useEffect(() => {
    if (!currentUser?.id) return;
    const unsub = onValue(ref(db, 'feedback'), (snap) => {
      const data = snap.val() || {};
      const count = Object.values(data)
        .filter(fb => fb.studentId === currentUser.id)
        .reduce((s, fb) => s + (fb.studentUnread || 0), 0);
      setSupportUnread(count);
    });
    return () => unsub();
  }, [currentUser?.id]);

  // Badge Lịch hẹn: lịch hẹn của mình có cập nhật từ phòng Đào tạo chưa xem
  useEffect(() => {
    if (!currentUser?.id) return;
    const unsub = onValue(ref(db, `appointments/${currentUser.id}`), (snap) => {
      const data = snap.val() || {};
      setApptUnread(Object.values(data).reduce((s, a) => s + (a.parentUnread || 0), 0));
    });
    return () => unsub();
  }, [currentUser?.id]);

  const isActive = (path) => location.pathname.includes(path);
  const mobileLinkClass = (path) => `relative flex flex-col items-center justify-center shrink-0 min-w-[64px] h-full space-y-1 px-0.5 ${isActive(path) ? "text-primary before:absolute before:top-0 before:inset-x-3.5 before:h-[3px] before:bg-primary before:rounded-b-full" : 'text-slate-500 hover:text-slate-700'}`;

  const TABS = [
    { key: 'dashboard',     to: '/parent/dashboard' },
    { key: 'notifications', to: '/parent/notifications' },
    { key: 'appointments',  to: '/parent/appointments' },
    { key: 'support',       to: '/parent/support' },
  ];
  const { onTouchStart, onTouchEnd, slideKey, slideClass } = useSwipeTabs(TABS);

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
      const authRef = ref(db, `userAuth/${currentUser.id}`);
      const snapshot = await get(authRef);
      const userData = snapshot.val() || {};
      const isMatch = bcrypt.compareSync(passForm.oldPass, userData.password || '');
      if (!isMatch) { setPassError("Mật khẩu cũ không đúng!"); setLoadingPass(false); return; }

      const salt = bcrypt.genSaltSync(10);
      await update(authRef, { password: bcrypt.hashSync(passForm.newPass, salt) });

      setPassSuccess("Đổi mật khẩu thành công!");
      setPassForm({ oldPass: '', newPass: '', confirmPass: '' });
      setTimeout(() => { setShowPassModal(false); setPassSuccess(''); }, 1800);
    } catch (error) {
      setPassError("Lỗi: " + error.message);
    } finally {
      setLoadingPass(false);
    }
  };

  const NAV = [
    { to: '/parent/dashboard',     key: 'dashboard',     label: 'Sổ liên lạc',        Icon: Icons.Book },
    { to: '/parent/notifications', key: 'notifications', label: 'Thông báo',           Icon: Icons.Noti },
    { to: '/parent/appointments',  key: 'appointments',  label: 'Lịch hẹn hỗ trợ',     Icon: Icons.Calendar, badge: apptUnread },
    { to: '/parent/support',       key: 'support',       label: 'Hỗ trợ & Phản ánh',   Icon: Icons.Support, badge: supportUnread },
  ];

  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      {/* Engine thông báo trình duyệt + chuông cho phụ huynh */}
      <ParentNotifyEngine currentUser={currentUser} />

      {/* SIDEBAR (Desktop) */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 h-full fixed left-0 top-0 z-50">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <img src="/BA LOGO.png" alt="Logo" className="w-10 h-10 object-contain" />
          <div>
            <h1 className="font-extrabold text-primary text-lg leading-tight">BE ABLE VN</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Cổng Phụ huynh</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 mt-2">Theo dõi con</p>
          {NAV.map((it) => (
            <Link key={it.key} to={it.to} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${isActive(it.key) ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-50'}`}>
              <it.Icon active={isActive(it.key)} />
              <span className="flex-1">{it.label}</span>
              {it.badge > 0 && (
                <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shrink-0">
                  {it.badge > 9 ? '9+' : it.badge}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100 space-y-1">
          <div className="flex items-center gap-3 px-3 py-2.5 mb-1 rounded-xl bg-slate-50">
            <StudentAvatar name={currentUser?.name} size={38} />
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-800 truncate">{currentUser?.name || 'Phụ huynh'}</p>
              <p className="text-[11px] text-slate-500 truncate">Phụ huynh học viên</p>
            </div>
          </div>
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
          <span className="text-primary font-bold text-sm">CỔNG PHỤ HUYNH</span>
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

      {/* MAIN CONTENT */}
      <main className="flex-1 md:ml-64 px-4 pt-20 pb-24 md:p-8 md:pb-8 overflow-auto" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div key={slideKey} className={`max-w-6xl mx-auto ${slideClass}`}><Outlet /></div>
      </main>

      {/* MOBILE BOTTOM NAV */}
      <nav ref={bottomNavRef} className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 h-16 flex items-center justify-around z-50 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <Link to="/parent/dashboard" data-active={isActive('dashboard')} className={mobileLinkClass('dashboard')}><Icons.Book active={isActive('dashboard')} /><span className="text-[10px] font-medium">Sổ liên lạc</span></Link>
        <Link to="/parent/notifications" data-active={isActive('notifications')} className={mobileLinkClass('notifications')}><Icons.Noti active={isActive('notifications')} /><span className="text-[10px] font-medium">TBáo</span></Link>
        <Link to="/parent/appointments" data-active={isActive('appointments')} className={mobileLinkClass('appointments')}>
          <span className="relative"><Icons.Calendar active={isActive('appointments')} />{apptUnread > 0 && <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{apptUnread > 9 ? '9+' : apptUnread}</span>}</span>
          <span className="text-[10px] font-medium">Lịch hẹn</span>
        </Link>
        <Link to="/parent/support" data-active={isActive('support')} className={mobileLinkClass('support')}>
          <span className="relative"><Icons.Support active={isActive('support')} />{supportUnread > 0 && <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{supportUnread > 9 ? '9+' : supportUnread}</span>}</span>
          <span className="text-[10px] font-medium">Hỗ trợ</span>
        </Link>
      </nav>

      {/* MODAL ĐỔI MẬT KHẨU */}
      {showPassModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
              <Icons.Key /> Đổi Mật Khẩu
            </h3>
            <form onSubmit={handleChangePassword} className="space-y-4">
              {passError && (
                <div className="alert-error">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0 mt-0.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                  {passError}
                </div>
              )}
              {passSuccess && (
                <div className="alert-success">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                  {passSuccess}
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mật khẩu cũ</label>
                <input type="password" className="input-base" value={passForm.oldPass} onChange={e => { setPassForm({ ...passForm, oldPass: e.target.value }); setPassError(''); }} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mật khẩu mới</label>
                <input type="password" className="input-base" value={passForm.newPass} onChange={e => { setPassForm({ ...passForm, newPass: e.target.value }); setPassError(''); }} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Xác nhận mật khẩu mới</label>
                <input type="password" className={`input-base ${passForm.confirmPass && passForm.newPass !== passForm.confirmPass ? 'input-error' : ''}`} value={passForm.confirmPass} onChange={e => { setPassForm({ ...passForm, confirmPass: e.target.value }); setPassError(''); }} />
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

export default ParentLayout;
