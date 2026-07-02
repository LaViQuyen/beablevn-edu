import React, { useRef, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSwipeTabs } from '../useSwipeTabs';

const Icons = {
  Dashboard: ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={active ? "#2B6830" : "#64748b"} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  ),
  Staff: ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={active ? "#2B6830" : "#64748b"} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  Student: ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={active ? "#2B6830" : "#64748b"} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
    </svg>
  ),
  Data: ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={active ? "#2B6830" : "#64748b"} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
    </svg>
  ),
  Import: ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={active ? "#2B6830" : "#64748b"} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
  ),
  Feedback: ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={active ? "#2B6830" : "#64748b"} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
    </svg>
  ),
  Noti: ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={active ? "#2B6830" : "#64748b"} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  ),
  Stats: ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={active ? "#2B6830" : "#64748b"} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
  Skins: ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={active ? "#2B6830" : "#64748b"} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
    </svg>
  ),
  Bonus: ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={active ? "#2B6830" : "#64748b"} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
  ),
  Tuition: ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={active ? "#2B6830" : "#64748b"} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
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
  // Moi the co be rong toi thieu co dinh + khong co lai (shrink-0) de thanh nav cuon ngang duoc
  const mobileLinkClass = (path) => `flex flex-col items-center justify-center shrink-0 min-w-[64px] h-full space-y-1 px-0.5 ${isActive(path) ? 'text-[#2B6830]' : 'text-slate-400 hover:text-slate-600'}`;

  // Thu tu the tren bottom nav - dung cho VUOT NGANG chuyen the (mobile)
  const TABS = [
    { key: 'dashboard',     to: '/admin/dashboard' },
    { key: 'staff',         to: '/admin/staff' },
    { key: 'students',      to: '/admin/students' },
    { key: 'data',          to: '/admin/data' },
    { key: 'stats',         to: '/admin/stats' },
    { key: 'skins',         to: '/admin/skins' },
    { key: 'autobonus',     to: '/admin/autobonus' },
    { key: 'notifications', to: '/admin/notifications' },
    { key: 'feedback',      to: '/admin/feedback' },
    { key: 'import',        to: '/admin/import' },
    { key: 'tuition',       to: '/admin/tuition' },
  ];
  const { onTouchStart, onTouchEnd, slideKey, slideClass } = useSwipeTabs(TABS);

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

  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      {/* SIDEBAR (Desktop) */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 h-full fixed left-0 top-0 z-50">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <img src="/BA LOGO.png" alt="Logo" className="w-10 h-10 object-contain" />
          <div>
            <h1 className="font-extrabold text-[#2B6830] text-lg leading-tight">BE ABLE VN</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Cổng Quản trị</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 mt-2">Tổng quan</p>
          <Link to="/admin/dashboard" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${isActive('dashboard') ? 'bg-[#2B6830]/5 text-[#2B6830]' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Icons.Dashboard active={isActive('dashboard')} /> Dashboard
          </Link>

          <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 mt-4">Quản lý</p>

          <Link to="/admin/staff" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${isActive('staff') ? 'bg-[#2B6830]/5 text-[#2B6830]' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Icons.Staff active={isActive('staff')} /> Nhân sự
          </Link>
          <Link to="/admin/students" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${isActive('students') ? 'bg-[#2B6830]/5 text-[#2B6830]' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Icons.Student active={isActive('students')} /> Học viên
          </Link>
          <Link to="/admin/data" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${isActive('data') ? 'bg-[#2B6830]/5 text-[#2B6830]' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Icons.Data active={isActive('data')} /> Dữ liệu Lớp
          </Link>
          <Link to="/admin/stats" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${isActive('stats') ? 'bg-[#2B6830]/5 text-[#2B6830]' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Icons.Stats active={isActive('stats')} /> Thống kê lớp
          </Link>
          <Link to="/admin/skins" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${isActive('skins') ? 'bg-[#2B6830]/5 text-[#2B6830]' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Icons.Skins active={isActive('skins')} /> Quản lý Skin
          </Link>
          <Link to="/admin/autobonus" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${isActive('autobonus') ? 'bg-[#2B6830]/5 text-[#2B6830]' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Icons.Bonus active={isActive('autobonus')} /> Tự động Bonus
          </Link>
          <Link to="/admin/notifications" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${isActive('notifications') ? 'bg-[#2B6830]/5 text-[#2B6830]' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Icons.Noti active={isActive('notifications')} /> Thông báo
          </Link>
          <Link to="/admin/feedback" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${isActive('feedback') ? 'bg-[#2B6830]/5 text-[#2B6830]' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Icons.Feedback active={isActive('feedback')} /> Phản ánh
          </Link>
          <Link to="/admin/import" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${isActive('import') ? 'bg-[#2B6830]/5 text-[#2B6830]' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Icons.Import active={isActive('import')} /> Import học viên
          </Link>
          <Link to="/admin/tuition" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${isActive('tuition') ? 'bg-[#2B6830]/5 text-[#2B6830]' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Icons.Tuition active={isActive('tuition')} /> Học phí
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
          <span className="text-[#2B6830] font-bold text-sm">CỔNG QUẢN TRỊ</span>
        </div>
        <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-500"><Icons.Logout /></button>
      </header>

      {/* MAIN CONTENT - vuot ngang tren mobile de chuyen the truoc/sau */}
      <main className="flex-1 md:ml-64 px-4 pt-20 pb-24 md:p-8 md:pb-8 overflow-auto" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div key={slideKey} className={`max-w-6xl mx-auto ${slideClass}`}><Outlet /></div>
      </main>

      {/* MOBILE BOTTOM NAV - cuon ngang duoc vi nhieu the; an thanh cuon cho gon */}
      <nav
        ref={bottomNavRef}
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 h-16 flex items-center overflow-x-auto overflow-y-hidden z-50 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        <Link to="/admin/dashboard" data-active={isActive('dashboard')} className={mobileLinkClass('dashboard')}><Icons.Dashboard active={isActive('dashboard')} /><span className="text-[10px] font-medium">Dashboard</span></Link>
        <Link to="/admin/staff" data-active={isActive('staff')} className={mobileLinkClass('staff')}><Icons.Staff active={isActive('staff')} /><span className="text-[10px] font-medium">Nhân sự</span></Link>
        <Link to="/admin/students" data-active={isActive('students')} className={mobileLinkClass('students')}><Icons.Student active={isActive('students')} /><span className="text-[10px] font-medium">Học viên</span></Link>
        <Link to="/admin/data" data-active={isActive('data')} className={mobileLinkClass('data')}><Icons.Data active={isActive('data')} /><span className="text-[10px] font-medium">Dữ liệu</span></Link>
        <Link to="/admin/stats" data-active={isActive('stats')} className={mobileLinkClass('stats')}><Icons.Stats active={isActive('stats')} /><span className="text-[10px] font-medium">Thống kê</span></Link>
        <Link to="/admin/skins" data-active={isActive('skins')} className={mobileLinkClass('skins')}><Icons.Skins active={isActive('skins')} /><span className="text-[10px] font-medium">Skin</span></Link>
        <Link to="/admin/autobonus" data-active={isActive('autobonus')} className={mobileLinkClass('autobonus')}><Icons.Bonus active={isActive('autobonus')} /><span className="text-[10px] font-medium">AutoBonus</span></Link>
        <Link to="/admin/notifications" data-active={isActive('notifications')} className={mobileLinkClass('notifications')}><Icons.Noti active={isActive('notifications')} /><span className="text-[10px] font-medium">TBáo</span></Link>
        <Link to="/admin/feedback" data-active={isActive('feedback')} className={mobileLinkClass('feedback')}><Icons.Feedback active={isActive('feedback')} /><span className="text-[10px] font-medium">Phản ánh</span></Link>
        <Link to="/admin/import" data-active={isActive('import')} className={mobileLinkClass('import')}><Icons.Import active={isActive('import')} /><span className="text-[10px] font-medium">Import</span></Link>
        <Link to="/admin/tuition" data-active={isActive('tuition')} className={mobileLinkClass('tuition')}><Icons.Tuition active={isActive('tuition')} /><span className="text-[10px] font-medium">Học phí</span></Link>
      </nav>
    </div>
  );
};

export default AdminLayout;
