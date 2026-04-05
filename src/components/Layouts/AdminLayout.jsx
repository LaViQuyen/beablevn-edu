import React from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Icons = {
  Staff: ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={active ? "#003366" : "#64748b"} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  Student: ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={active ? "#003366" : "#64748b"} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
    </svg>
  ),
  Data: ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={active ? "#003366" : "#64748b"} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
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
  )
};

const AdminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth(); // Lấy hàm logout từ context

  const isActive = (path) => location.pathname.includes(path);
  const mobileLinkClass = (path) => `flex flex-col items-center justify-center w-full h-full space-y-1 ${isActive(path) ? 'text-[#003366]' : 'text-slate-400 hover:text-slate-600'}`;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      {/* SIDEBAR (Desktop) */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 h-full fixed left-0 top-0 z-50">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <img src="/BA LOGO.png" alt="Logo" className="w-10 h-10 object-contain" />
          <div>
            <h1 className="font-extrabold text-[#003366] text-lg leading-tight">BE ABLE</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Admin Portal</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 mt-2">Quản lý</p>
          
          <Link to="/admin/staff" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${isActive('staff') ? 'bg-[#003366]/5 text-[#003366]' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Icons.Staff active={isActive('staff')} /> Nhân sự
          </Link>
          <Link to="/admin/students" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${isActive('students') ? 'bg-[#003366]/5 text-[#003366]' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Icons.Student active={isActive('students')} /> Học viên
          </Link>
          <Link to="/admin/data" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${isActive('data') ? 'bg-[#003366]/5 text-[#003366]' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Icons.Data active={isActive('data')} /> Dữ liệu Lớp
          </Link>
          <Link to="/admin/notifications" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${isActive('notifications') ? 'bg-[#003366]/5 text-[#003366]' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Icons.Noti active={isActive('notifications')} /> Thông báo
          </Link>
        </nav>

        <div className="p-4 border-t border-slate-100">
           <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 rounded-xl w-full text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all font-medium text-sm">
             <Icons.Logout /> Đăng xuất
           </button>
        </div>
      </aside>

      {/* MOBILE HEADER */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 z-50 px-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2">
          <img src="/BA LOGO.png" alt="Logo" className="w-7 h-7 object-contain" />
          <span className="text-[#003366] font-bold text-sm">BAVN Admin</span>
        </div>
        <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-500"><Icons.Logout /></button>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 md:ml-64 p-4 md:p-8 pb-24 md:pb-8 overflow-auto">
        <div className="max-w-6xl mx-auto"><Outlet /></div>
      </main>

      {/* MOBILE BOTTOM NAV */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 h-16 flex justify-around items-center z-50 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <Link to="/admin/staff" className={mobileLinkClass('staff')}><Icons.Staff active={isActive('staff')} /><span className="text-[10px] font-medium">Nhân sự</span></Link>
        <Link to="/admin/students" className={mobileLinkClass('students')}><Icons.Student active={isActive('students')} /><span className="text-[10px] font-medium">Học viên</span></Link>
        <Link to="/admin/data" className={mobileLinkClass('data')}><Icons.Data active={isActive('data')} /><span className="text-[10px] font-medium">Dữ liệu</span></Link>
        <Link to="/admin/notifications" className={mobileLinkClass('notifications')}><Icons.Noti active={isActive('notifications')} /><span className="text-[10px] font-medium">Thông báo</span></Link>
      </nav>
    </div>
  );
};

export default AdminLayout;