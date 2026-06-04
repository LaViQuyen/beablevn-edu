import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { ref, update, get, onValue } from 'firebase/database';
import bcrypt from 'bcryptjs'; // Import mã hóa

const Icons = {
  Class: ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={active ? "#003366" : "#64748b"} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m-6 2.292c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 006 18c2.305 0 4.408.867 6 2.292M7.5 12h3" />
    </svg>
  ),
  Attendance: ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={active ? "#003366" : "#64748b"} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
    </svg>
  ),
  Scores: ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={active ? "#003366" : "#64748b"} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
  Noti: ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={active ? "#003366" : "#64748b"} className="w-5 h-5">
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
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={active ? "#003366" : "#64748b"} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z" />
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

  // Lắng nghe số thông báo chưa đọc trong hộp thư
  useEffect(() => {
    if (!currentUser?.id) return;
    const unsubSN = onValue(ref(db, 'staffNotifications'), (snap) => {
      const data = snap.val() || {};
      const count = Object.values(data).filter(n => n.toUserId === currentUser.id && !n.isRead).length;
      setInboxUnread(count);
    });
    return () => unsubSN();
  }, [currentUser?.id]);

  const isActive = (path) => location.pathname.includes(path);
  const mobileLinkClass = (path) => `flex flex-col items-center justify-center w-full h-full space-y-1 ${isActive(path) ? 'text-[#003366]' : 'text-slate-400 hover:text-slate-600'}`;

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
      {/* SIDEBAR (Desktop) */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 h-full fixed left-0 top-0 z-50">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <img src="/BA LOGO.png" alt="Logo" className="w-10 h-10 object-contain" />
          <div>
            <h1 className="font-extrabold text-[#003366] text-lg leading-tight">BE ABLE VN</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Cổng Giáo vụ</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 mt-2">Giảng dạy</p>
          
          <Link to="/staff/classes" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${isActive('classes') ? 'bg-[#003366]/5 text-[#003366]' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Icons.Class active={isActive('classes')} /> Lớp học của tôi
          </Link>
          <Link to="/staff/attendance" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${isActive('attendance') ? 'bg-[#003366]/5 text-[#003366]' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Icons.Attendance active={isActive('attendance')} /> Điểm danh
          </Link>
          <Link to="/staff/scores" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${isActive('scores') ? 'bg-[#003366]/5 text-[#003366]' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Icons.Scores active={isActive('scores')} /> Nhập điểm
          </Link>
          <Link to="/staff/notifications" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${isActive('notifications') ? 'bg-[#003366]/5 text-[#003366]' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Icons.Noti active={isActive('notifications')} /> Thông báo
          </Link>
          <Link to="/staff/inbox" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${isActive('inbox') ? 'bg-[#003366]/5 text-[#003366]' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Icons.Inbox active={isActive('inbox')} />
            <span className="flex-1">Hộp thư</span>
            {inboxUnread > 0 && (
              <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shrink-0">
                {inboxUnread > 9 ? '9+' : inboxUnread}
              </span>
            )}
          </Link>
        </nav>

        <div className="p-4 border-t border-slate-100 space-y-1">
           {/* Nút Đổi Mật Khẩu Desktop */}
           <button onClick={() => setShowPassModal(true)} className="flex items-center gap-3 px-4 py-3 rounded-xl w-full text-slate-500 hover:bg-blue-50 hover:text-[#003366] transition-all font-medium text-sm">
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
          <span className="text-[#003366] font-bold text-sm">Staff Portal</span>
        </div>
        <div className="flex items-center gap-1">
            {/* Nút Đổi Mật Khẩu Mobile */}
            <button onClick={() => setShowPassModal(true)} className="p-2 text-slate-400 hover:text-[#003366]">
                <Icons.Key />
            </button>
            <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-500">
                <Icons.Logout />
            </button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 md:ml-64 px-4 pt-20 pb-24 md:p-8 md:pb-8 overflow-auto">
        <div className="max-w-5xl mx-auto"><Outlet /></div>
      </main>

      {/* MOBILE BOTTOM NAV */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 h-16 flex justify-around items-center z-50 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <Link to="/staff/classes" className={mobileLinkClass('classes')}><Icons.Class active={isActive('classes')} /><span className="text-[10px] font-medium">Lớp</span></Link>
        <Link to="/staff/attendance" className={mobileLinkClass('attendance')}><Icons.Attendance active={isActive('attendance')} /><span className="text-[10px] font-medium">Đ.Danh</span></Link>
        <Link to="/staff/scores" className={mobileLinkClass('scores')}><Icons.Scores active={isActive('scores')} /><span className="text-[10px] font-medium">Điểm</span></Link>
        <Link to="/staff/notifications" className={mobileLinkClass('notifications')}><Icons.Noti active={isActive('notifications')} /><span className="text-[10px] font-medium">TBáo</span></Link>
        <Link to="/staff/inbox" className={mobileLinkClass('inbox')}><Icons.Inbox active={isActive('inbox')} /><span className="text-[10px] font-medium">Hộp thư</span></Link>
      </nav>

      {/* MODAL ĐỔI MẬT KHẨU */}
      {showPassModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                <h3 className="text-lg font-bold text-[#003366] mb-4 flex items-center gap-2">
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
                        <input type="password" className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-[#003366] focus:ring-2 focus:ring-[#003366]/10 transition"
                            value={passForm.oldPass} onChange={e => { setPassForm({...passForm, oldPass: e.target.value}); setPassError(''); }}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mật khẩu mới</label>
                        <input type="password" className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-[#003366] focus:ring-2 focus:ring-[#003366]/10 transition"
                            value={passForm.newPass} onChange={e => { setPassForm({...passForm, newPass: e.target.value}); setPassError(''); }}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Xác nhận mật khẩu mới</label>
                        <input type="password" className={`w-full p-3 border rounded-xl outline-none focus:ring-2 transition ${passForm.confirmPass && passForm.newPass !== passForm.confirmPass ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : 'border-slate-200 focus:border-[#003366] focus:ring-[#003366]/10'}`}
                            value={passForm.confirmPass} onChange={e => { setPassForm({...passForm, confirmPass: e.target.value}); setPassError(''); }}
                        />
                        {passForm.confirmPass && passForm.newPass !== passForm.confirmPass && (
                            <p className="text-red-500 text-xs mt-1">Mật khẩu không khớp</p>
                        )}
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => { setShowPassModal(false); setPassError(''); setPassSuccess(''); setPassForm({ oldPass: '', newPass: '', confirmPass: '' }); }} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors">Hủy</button>
                        <button type="submit" disabled={loadingPass} className="flex-1 py-3 bg-[#003366] text-white rounded-xl font-bold hover:bg-[#002244] transition-colors disabled:opacity-50">
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