// src/pages/teacher/TeacherDashboard.jsxư
import { useState, useEffect, createContext } from 'react';
import { Routes, Route, useNavigate, useLocation, Link } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { firestore as db } from "../../../firebase";
import Launch from './Launch';
import ExerciseLibrary from './ExerciseLibrary';
import CreateExercise from './CreateExercise';
import LiveResults from './LiveResults';
import Reports from './Reports';
import RoomManager from './RoomManager';
import VocabularyManager from './VocabularyManager';

import { TeacherContext } from './TeacherContext';
// --- HỆ THỐNG SVG ICONS TỐI GIẢN ---
// --- HỆ THỐNG SVG ICONS TỐI GIẢN ---
const SvgIcons = {
  Vocabulary: () => <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>,
  Launch: () => <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M13.5 22H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6.5"></path><path d="M22 17.5L18 22l-4.5-4.5"></path><line x1="18" y1="22" x2="18" y2="12"></line></svg>,
  Library: () => <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>,
  Rooms: () => <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>,
  Reports: () => <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>,
  Live: () => <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>,
  Menu: () => <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>,
  LogOut: () => <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>,
  Back: () => <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
};

export default function TeacherDashboard() {
  const [activeRoom, setActiveRoom] = useState(localStorage.getItem('activeRoom') || '');
  const [rooms, setRooms] = useState([]);
  
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();

  // Khóa cứng thanh Menu khi ở màn hình PC
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth >= 1024) {
        setIsMenuOpen(false); 
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch danh sách phòng
  useEffect(() => {
    const fetchRooms = async () => {
      const snap = await getDocs(collection(db, "rooms"));
      setRooms(snap.docs.map(doc => doc.id));
    };
    fetchRooms();
  }, []);

  const handleRoomChange = (e) => {
    const room = e.target.value;
    setActiveRoom(room);
    localStorage.setItem('activeRoom', room);
  };

  const navItems = [
    { id: 'vocabulary', path: '/staff/assignments/vocabulary', icon: <SvgIcons.Vocabulary />, label: 'Vocabulary' },
    { id: 'launch', path: '/staff/assignments/launch', icon: <SvgIcons.Launch />, label: 'Launch' },
    { id: 'library', path: '/staff/assignments/exercises', icon: <SvgIcons.Library />, label: 'Library' },
    { id: 'rooms', path: '/staff/assignments/rooms', icon: <SvgIcons.Rooms />, label: 'Rooms' },
    { id: 'reports', path: '/staff/assignments/reports', icon: <SvgIcons.Reports />, label: 'Reports' },
    { id: 'live', path: '/staff/assignments/live', icon: <SvgIcons.Live />, label: 'Live Results' }
  ];

  return (
    <TeacherContext.Provider value={{ activeRoom, setActiveRoom }}>
      {/* BAO NGOÀI CỐ ĐỊNH CHIỀU CAO (100vh) VÀ ẨN THANH CUỘN CHUNG */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', height: '100vh', overflow: 'hidden', backgroundColor: '#f8fafc', fontFamily: "'Josefin Sans', sans-serif" }}>
        
        {/* MOBILE HEADER VỚI LOGO */}
        {isMobile && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', backgroundColor: 'white', borderBottom: '1px solid #e2e8f0', zIndex: 200, flexShrink: 0, height: '66px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img src="/BA LOGO.png" alt="BA Logo" style={{ height: '36px', objectFit: 'contain' }} />
              <div>
                <p style={{ color: '#64748b', margin: 0, fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>Teacher</p>
              </div>
            </div>
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} style={{ background: 'none', border: 'none', color: '#003366', cursor: 'pointer', padding: '5px' }}>
              <SvgIcons.Menu />
            </button>
          </div>
        )}

        {/* SIDEBAR VỚI LOGO (Trượt ra vào trên Mobile, Cố định trên Desktop) */}
        {(!isMobile || isMenuOpen) && (
          <div style={{ 
            width: isMobile ? '100%' : '260px', 
            backgroundColor: 'white', 
            borderRight: isMobile ? 'none' : '1px solid #e2e8f0', 
            borderBottom: isMobile ? '1px solid #e2e8f0' : 'none', 
            display: 'flex', 
            flexDirection: 'column', 
            padding: '20px', 
            zIndex: 100, 
            position: isMobile ? 'absolute' : 'relative', 
            top: isMobile ? '66px' : 0, 
            left: 0,
            height: isMobile ? 'calc(100vh - 66px)' : '100vh',
            boxSizing: 'border-box',
            flexShrink: 0
          }}>
            {/* DESKTOP LOGO */}
            {!isMobile && (
              <div style={{ marginBottom: '40px', padding: '0 10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <img src="/BA LOGO.png" alt="BA Logo" style={{ height: '45px', objectFit: 'contain', alignSelf: 'flex-start' }} />
                <p style={{ color: '#64748b', margin: 0, fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>Teacher Dashboard</p>
              </div>
            )}
            
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', flex: 1 }}>
              {navItems.map(item => {
                const isActive = location.pathname.includes(item.path);
                return (
                  <button
                    key={item.id}
                    onClick={() => { navigate(item.path); if(isMobile) setIsMenuOpen(false); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '12px',
                      border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '15px', transition: 'all 0.2s ease',
                      backgroundColor: isActive ? '#003366' : 'transparent',
                      color: isActive ? 'white' : '#64748b',
                      whiteSpace: 'nowrap', width: '100%', textAlign: 'left'
                    }}
                    onMouseEnter={e => { if(!isActive) e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
                    onMouseLeave={e => { if(!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <span style={{ display: 'flex' }}>{item.icon}</span> {item.label}
                  </button>
                );
              })}
            </nav>

            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '20px', marginTop: 'auto' }}>
              <Link 
                to="/staff/classes" 
                onClick={() => setIsMenuOpen(false)} 
                style={{ color: '#003366', textDecoration: 'none', fontWeight: '800', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', transition: 'opacity 0.2s' }} 
              >
                <SvgIcons.Back /> Quay lại Edu
              </Link>
            </div>
          </div>
        )}

        {/* MAIN CONTENT AREA */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', height: isMobile ? 'calc(100vh - 66px)' : '100vh' }}>
          
          {/* TOP HEADER CỐ ĐỊNH CHIỀU CAO (70px), KHÔNG ĐỔI KHI CHUYỂN TAB */}
          <header style={{ height: '70px', minHeight: '70px', backgroundColor: 'white', padding: '0 30px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', borderBottom: '1px solid #e2e8f0', zIndex: 10, boxSizing: 'border-box', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <span style={{ color: '#64748b', fontWeight: '600', fontSize: '14px' }}>Active Room:</span>
              <select value={activeRoom} onChange={handleRoomChange} style={{ height: '40px', padding: '0 16px', borderRadius: '100px', border: '1px solid #cbd5e1', outline: 'none', fontWeight: '700', color: '#003366', backgroundColor: '#f8fafc', cursor: 'pointer', appearance: 'none', minWidth: '120px', boxSizing: 'border-box' }}>
                <option value="" disabled>Select Room</option>
                {rooms.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </header>

          {/* VÙNG CHỨA CÁC THẺ HOẠT ĐỘNG - CHỈ CUỘN NỘI DUNG Ở KHU VỰC NÀY */}
          <main style={{ flex: 1, overflowY: 'auto', backgroundColor: '#f8fafc', position: 'relative' }}>
            <Routes>
              <Route path="/" element={<Launch />} />
              <Route path="vocabulary" element={<VocabularyManager />} />
              <Route path="launch" element={<Launch />} />
              <Route path="exercises" element={<ExerciseLibrary />} />
              <Route path="exercises/new" element={<CreateExercise />} />
              <Route path="exercises/:quizId" element={<CreateExercise />} />
              <Route path="live" element={<LiveResults />} />
              <Route path="reports" element={<Reports />} />
              <Route path="rooms" element={<RoomManager />} />
            </Routes>
          </main>
        </div>

      </div>
    </TeacherContext.Provider>
  );
}