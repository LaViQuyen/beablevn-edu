import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { ref, onValue } from 'firebase/database';

const StudentDashboard = () => {
  const { currentUser } = useAuth();
  const [myClasses, setMyClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;

    // 1. Lấy danh sách toàn bộ lớp học
    const classesRef = ref(db, 'classes');
    
    // Lắng nghe dữ liệu
    const unsubscribe = onValue(classesRef, (snapshot) => {
      const data = snapshot.val();
      if (data && currentUser.classIds) {
        // Lọc ra những lớp mà học viên này có tham gia
        // currentUser.classIds có thể là Array hoặc Object tùy dữ liệu import
        const studentClassIds = Array.isArray(currentUser.classIds) 
            ? currentUser.classIds 
            : Object.values(currentUser.classIds || {});

        const filteredClasses = Object.entries(data)
          .map(([id, val]) => ({ id, ...val }))
          .filter(c => studentClassIds.includes(c.id));

        setMyClasses(filteredClasses);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* HEADER: Chào mừng */}
      <div className="bg-gradient-to-r from-[#003366] to-[#0055aa] rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-2xl font-bold mb-2">Xin chào, {currentUser?.name}! 👋</h1>
          <p className="opacity-90">Chúc bạn một ngày học tập hiệu quả tại BE ABLE.</p>
        </div>
        {/* Decor */}
        <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
      </div>

      {/* DANH SÁCH LỚP HỌC */}
      <div>
        <h2 className="text-lg font-bold text-[#003366] mb-4 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" /></svg>
          Lớp học của tôi
        </h2>

        {loading ? (
           <p className="text-slate-400 text-sm">Đang tải dữ liệu...</p>
        ) : myClasses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myClasses.map((cls) => (
              <div key={cls.id} className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                <div className="flex justify-between items-start mb-3">
                  <div className="bg-blue-50 text-[#003366] text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                    {cls.room || 'Online'}
                  </div>
                </div>
                <h3 className="font-bold text-lg text-slate-800 mb-1 group-hover:text-[#003366] transition-colors">{cls.name}</h3>
                <p className="text-slate-500 text-xs mb-4">GV: {cls.teacherName || 'Đang cập nhật'}</p>
                
                <div className="pt-4 border-t border-slate-50 flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">Lịch học:</span>
                  <span className="font-bold text-slate-700">
                    {/* Xử lý hiển thị lịch học nếu có */}
                    {cls.schedule || "Thứ 2 - 4 - 6"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white p-8 rounded-xl border border-dashed border-slate-300 text-center">
            <p className="text-slate-400 text-sm">Bạn chưa được gán vào lớp học nào.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentDashboard;