import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { ref, onValue } from "firebase/database";
import { useNavigate } from 'react-router-dom'; // Dùng để chuyển trang sang phòng thi

const StudentDashboard = () => {
  const { currentUser, userData } = useAuth();
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // State cho việc nhập mã phòng thi
  const [roomCode, setRoomCode] = useState('');

  useEffect(() => {
    const classesRef = ref(db, 'classes');
    onValue(classesRef, (snapshot) => {
      const data = snapshot.val();
      if (data && userData?.classIds) {
        let myClassIds = [];
        if (Array.isArray(userData.classIds)) {
          myClassIds = userData.classIds;
        } else if (typeof userData.classIds === 'object') {
          myClassIds = Object.values(userData.classIds);
        } else if (userData.classId) {
          myClassIds = [userData.classId];
        }

        const myClasses = Object.entries(data)
          .map(([id, val]) => ({ id, ...val }))
          .filter(c => myClassIds.includes(c.id));
        setClasses(myClasses);
      }
      setLoading(false);
    });
  }, [userData]);

  // Hàm xử lý khi học viên bấm "Vào phòng"
  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (roomCode.trim()) {
      // Chuyển hướng sang giao diện làm bài của dự án Assignment
      navigate(`/student/room/${roomCode.trim().toUpperCase()}`);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-[#003366] to-[#0055aa] p-8 rounded-2xl text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-3xl font-bold mb-2">Chào mừng, {userData?.name || currentUser?.email} 👋</h1>
          <p className="text-blue-100 text-lg">Chúc bạn một ngày học tập thật hiệu quả!</p>
        </div>
      </div>

      {/* KHU VỰC VÀO PHÒNG LÀM BÀI (TỪ DỰ ÁN ASSIGNMENT) */}
      <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
        <h2 className="text-lg font-bold text-[#003366] mb-3 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 22H7a2 2 0 01-2-2V4a2 2 0 012-2h10a2 2 0 012 2v6.5" /><path d="M22 17.5L18 22l-4.5-4.5" /><line x1="18" y1="22" x2="18" y2="12" /></svg>
          Vào phòng làm bài tập / Ôn từ vựng
        </h2>
        <form onSubmit={handleJoinRoom} className="flex flex-col md:flex-row gap-3">
          <input 
            type="text" 
            value={roomCode}
            onChange={e => setRoomCode(e.target.value)}
            placeholder="Nhập mã phòng (Room Code) giáo viên cung cấp..."
            className="flex-1 border border-slate-200 p-3 rounded-lg outline-none focus:border-[#003366] uppercase"
            required
          />
          <button type="submit" className="bg-[#003366] text-white px-8 py-3 rounded-lg font-bold hover:bg-[#002244] transition-colors">
            Vào phòng
          </button>
        </form>
      </div>

      {/* DANH SÁCH LỚP HỌC (TỪ DỰ ÁN EDU) */}
      <div>
        <h2 className="text-xl font-bold text-[#003366] mb-4 flex items-center gap-2">
          Lớp học của tôi
        </h2>
        {loading ? (
          <div className="text-center py-8 text-slate-400">Đang tải dữ liệu...</div>
        ) : classes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {classes.map(c => (
              <div key={c.id} className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-blue-50 text-[#003366] rounded-lg group-hover:bg-[#003366] group-hover:text-white transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" /></svg>
                  </div>
                  <span className="text-xs font-bold px-2 py-1 bg-green-50 text-green-600 rounded">Đang học</span>
                </div>
                <h3 className="font-bold text-lg text-gray-800 mb-1">{c.name}</h3>
                <p className="text-sm text-slate-500 mb-3 line-clamp-1">{c.courseName}</p>
                <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-sm">
                  <span className="text-slate-500 font-medium">{c.schedule}</span>
                  <span className="text-[#003366] font-bold bg-slate-50 px-2 py-1 rounded">{c.startTime} - {c.endTime}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white p-8 rounded-xl border border-slate-100 text-center shadow-sm">
            <div className="text-slate-400 mb-2">Bạn chưa được xếp vào lớp học nào.</div>
            <p className="text-sm text-slate-400">Vui lòng liên hệ giáo vụ để được hỗ trợ.</p>
          </div>
        )}
      </div>
    </div>
  );
};
export default StudentDashboard;