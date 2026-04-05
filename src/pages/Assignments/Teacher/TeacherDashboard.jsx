import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { firestore as db } from "../../../firebase";

// Import các trang con
import Launch from './Launch';
import ExerciseLibrary from './ExerciseLibrary';
import CreateExercise from './CreateExercise';
import LiveResults from './LiveResults';
import Reports from './Reports';
import RoomManager from './RoomManager';
import VocabularyManager from './VocabularyManager';
import { TeacherContext } from './TeacherContext';

export default function TeacherDashboard() {
  const [activeRoom, setActiveRoom] = useState(localStorage.getItem('activeRoom') || '');
  const [rooms, setRooms] = useState([]);
  const location = useLocation();

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

  // Danh sách các Tabs nằm ngang
  const tabs = [
    { id: 'launch', path: '/staff/assignments/launch', label: 'Phát đề (Launch)' },
    { id: 'exercises', path: '/staff/assignments/exercises', label: 'Kho bài tập' },
    { id: 'vocabulary', path: '/staff/assignments/vocabulary', label: 'Kho từ vựng' },
    { id: 'rooms', path: '/staff/assignments/rooms', label: 'Phòng thi (Rooms)' },
    { id: 'live', path: '/staff/assignments/live', label: 'Kết quả Live' },
    { id: 'reports', path: '/staff/assignments/reports', label: 'Báo cáo điểm' }
  ];

  return (
    <TeacherContext.Provider value={{ activeRoom, setActiveRoom }}>
      <div className="flex flex-col h-full animate-fade-in-up">
        
        {/* HEADER ĐIỀU KHIỂN & CHỌN PHÒNG */}
        <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h2 className="text-xl md:text-2xl font-extrabold text-[#003366]">Hệ thống Bài tập & Kiểm tra</h2>
            <p className="text-sm text-slate-500 font-medium mt-1">Quản lý kho dữ liệu và theo dõi học viên trực tuyến</p>
          </div>
          
          <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-100 w-full md:w-auto">
            <span className="text-[#003366] font-bold text-sm whitespace-nowrap px-2">Phòng đang chạy:</span>
            <select 
              value={activeRoom} 
              onChange={handleRoomChange} 
              className="flex-1 md:flex-none bg-white border border-slate-200 text-[#003366] font-bold py-2 px-4 rounded-lg outline-none focus:border-[#003366] shadow-sm min-w-[150px] cursor-pointer"
            >
              <option value="" disabled>-- Chọn phòng --</option>
              {rooms.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>

        {/* THANH MENU TABS NẰM NGANG */}
        <div className="flex overflow-x-auto gap-2 border-b border-slate-200 mb-6 pb-2 scrollbar-hide">
          {tabs.map(tab => {
            const isActive = location.pathname.includes(tab.path);
            return (
              <Link 
                key={tab.id}
                to={tab.path}
                className={`whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
                  isActive 
                    ? 'bg-[#003366] text-white shadow-md' 
                    : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 hover:text-[#003366]'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        {/* KHU VỰC HIỂN THỊ NỘI DUNG TỪNG TRANG */}
        <div className="flex-1 bg-transparent">
          <Routes>
            <Route path="/" element={<Navigate to="launch" replace />} />
            <Route path="vocabulary" element={<VocabularyManager />} />
            <Route path="launch" element={<Launch />} />
            <Route path="exercises" element={<ExerciseLibrary />} />
            <Route path="exercises/new" element={<CreateExercise />} />
            <Route path="exercises/:quizId" element={<CreateExercise />} />
            <Route path="live" element={<LiveResults />} />
            <Route path="reports" element={<Reports />} />
            <Route path="rooms" element={<RoomManager />} />
          </Routes>
        </div>
        
      </div>
    </TeacherContext.Provider>
  );
}