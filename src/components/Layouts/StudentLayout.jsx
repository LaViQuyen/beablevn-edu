import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { ref, update, get } from 'firebase/database';
import bcrypt from 'bcryptjs';

const Icons = {
  Dashboard: ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={active ? "#003366" : "#64748b"} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
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
  )
};

const StudentLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, currentUser } = useAuth();

  const [showPassModal, setShowPassModal] = useState(false);
  const [passForm, setPassForm] = useState({ oldPass: '', newPass: '', confirmPass: '' });
  const [loadingPass, setLoadingPass] = useState(false);

  const isActive = (path) => location.pathname.includes(path);
  const mobileLinkClass = (path) => `flex flex-col items-center justify-center w-full h-full space-y-1 ${isActive(path) ? 'text-[#003366]' : 'text-slate-400 hover:text-slate-600'}`;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!passForm.oldPass || !passForm.newPass || !passForm.confirmPass) return alert("Vui lòng điền đầy đủ thông tin.");
    if (passForm.newPass !== passForm.confirmPass) return alert("Xác nhận mật khẩu mới không khớp.");
    if (passForm.newPass.length < 6) return alert("Mật khẩu mới phải từ 6 ký tự trở lên.");

    setLoadingPass(true);
    try {
        const userRef = ref(db, `users/${currentUser.id}`);
        const snapshot = await get(userRef);
        const userData = snapshot.val();

        const isMatch = bcrypt.compareSync(passForm.oldPass, userData.password);
        if (!isMatch) {
            setLoadingPass(false);
            return alert("Mật khẩu cũ không đúng!");
        }

        const salt = bcrypt.genSaltSync(10);
        const newHash = bcrypt.hashSync(passForm.newPass, salt);

        await update(userRef, { password: newHash });

        alert("Đổi mật khẩu thành công!");
        setShowPassModal(false);
        setPassForm({ oldPass: '', newPass: '', confirmPass: '' });

    } catch (error) {
        alert("Lỗi: " + error.message);
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
            <h1 className="font-extrabold text-[#003366] text-lg leading-tight">BE ABLE</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Student Portal</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 mt-2">Học tập</p>
          
          <Link to="/student/dashboard" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${isActive('dashboard') ? 'bg-[#003366]/5 text-[#003366]' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Icons.Dashboard active={isActive('dashboard')} /> Tổng quan
          </Link>
          <Link to="/student/attendance" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${isActive('attendance') ? 'bg-[#003366]/5 text-[#003366]' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Icons.Attendance active={isActive('attendance')} /> Điểm danh của tôi
          </Link>
          <Link to="/student/scores" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${isActive('scores') ? 'bg-[#003366]/5 text-[#003366]' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Icons.Scores active={isActive('scores')} /> Bảng điểm
          </Link>
          <Link to="/student/notifications" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${isActive('notifications') ? 'bg-[#003366]/5 text-[#003366]' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Icons.Noti active={isActive('notifications')} /> Thông báo
          </Link>
        </nav>

        <div className="p-4 border-t border-slate-100 space-y-1">
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
          <span className="text-[#003366] font-bold text-sm">Student Area</span>
        </div>
        <div className="flex items-center gap-1">
            <button onClick={() => setShowPassModal(true)} className="p-2 text-slate-400 hover:text-[#003366]">
                <Icons.Key />
            </button>
            <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-500">
                <Icons.Logout />
            </button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 md:ml-64 p-4 md:p-8 pb-24 md:pb-8 overflow-auto">
        <div className="max-w-5xl mx-auto"><Outlet /></div>
      </main>

      {/* MOBILE BOTTOM NAV */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 h-16 flex justify-around items-center z-50 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <Link to="/student/dashboard" className={mobileLinkClass('dashboard')}><Icons.Dashboard active={isActive('dashboard')} /><span className="text-[10px] font-medium">Tổng quan</span></Link>
        <Link to="/student/attendance" className={mobileLinkClass('attendance')}><Icons.Attendance active={isActive('attendance')} /><span className="text-[10px] font-medium">Đ.Danh</span></Link>
        <Link to="/student/scores" className={mobileLinkClass('scores')}><Icons.Scores active={isActive('scores')} /><span className="text-[10px] font-medium">Kết quả</span></Link>
        <Link to="/student/notifications" className={mobileLinkClass('notifications')}><Icons.Noti active={isActive('notifications')} /><span className="text-[10px] font-medium">TBáo</span></Link>
      </nav>

      {/* MODAL */}
      {showPassModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                <h3 className="text-lg font-bold text-[#003366] mb-4 flex items-center gap-2">
                    <Icons.Key /> Đổi Mật Khẩu
                </h3>
                <form onSubmit={handleChangePassword} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mật khẩu cũ</label>
                        <input type="password" required className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:border-[#003366]" 
                            value={passForm.oldPass} onChange={e => setPassForm({...passForm, oldPass: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mật khẩu mới</label>
                        <input type="password" required className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:border-[#003366]" 
                            value={passForm.newPass} onChange={e => setPassForm({...passForm, newPass: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Xác nhận mật khẩu mới</label>
                        <input type="password" required className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:border-[#003366]" 
                            value={passForm.confirmPass} onChange={e => setPassForm({...passForm, confirmPass: e.target.value})}
                        />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => setShowPassModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors">Hủy</button>
                        <button type="submit" disabled={loadingPass} className="flex-1 py-3 bg-[#003366] text-white rounded-xl font-bold hover:bg-[#002244] transition-colors shadow-lg shadow-blue-900/10">
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