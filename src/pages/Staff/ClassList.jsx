import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { ref, onValue } from "firebase/database";
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const ClassList = () => {
  const navigate = useNavigate();
  const { userData } = useAuth();
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [viewMode, setViewMode] = useState('class');
  const [filterValue, setFilterValue] = useState('');

  useEffect(() => {
    onValue(ref(db, 'classes'), (snapshot) => {
      const data = snapshot.val();
      if(data) {
        const allClasses = Object.entries(data).map(([id, val]) => ({ id, ...val }));
        const myClassIds = userData?.assignedClasses || [];
        setClasses(allClasses.filter(c => myClassIds.includes(c.id)));
      }
    });

    onValue(ref(db, 'users'), (snapshot) => {
      const data = snapshot.val();
      if(data) {
        const myClassIds = userData?.assignedClasses || [];
        const list = Object.values(data).filter(u => {
          if (u.role !== 'student') return false;

          // FIX LỖI SẬP MÀN HÌNH TẠI ĐÂY
          let studentClasses = [];
          if (Array.isArray(u.classIds)) studentClasses = u.classIds;
          else if (u.classIds && typeof u.classIds === 'object') studentClasses = Object.values(u.classIds);
          else if (u.classId) studentClasses = [u.classId];

          return studentClasses.some(id => myClassIds.includes(id));
        });
        setStudents(list);
      }
    });
  }, [userData]);

  const getClassInfo = (student, type) => {
    let sClasses = [];
    if (Array.isArray(student.classIds)) sClasses = student.classIds;
    else if (student.classIds && typeof student.classIds === 'object') sClasses = Object.values(student.classIds);
    
    return sClasses.map(id => {
      const foundClass = classes.find(c => c.id === id);
      if (!foundClass) return null;
      return type === 'name' ? foundClass.name : `${foundClass.schedule} (${foundClass.startTime}-${foundClass.endTime})`;
    }).filter(Boolean);
  };

  const filteredStudents = students.filter(st => {
    const classNames = getClassInfo(st, 'name').join(' ').toLowerCase();
    const schedules = getClassInfo(st, 'time').join(' ').toLowerCase();
    const search = filterValue.toLowerCase();
    return viewMode === 'time' ? schedules.includes(search) : classNames.includes(search);
  });

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-slate-100 pb-4 gap-4">
         <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#003366" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>
            <h2 className="text-xl font-bold text-[#003366]">Danh sách Học viên</h2>
         </div>
         
         <div className="flex gap-2 w-full md:w-auto">
            <select className="border border-slate-200 p-2 rounded-lg text-sm outline-none focus:border-[#003366] bg-slate-50 font-medium text-[#003366]" value={viewMode} onChange={(e) => setViewMode(e.target.value)}>
              <option value="class">Xem theo Lớp</option>
              <option value="time">Xem theo Thời gian</option>
            </select>
            <input className="border border-slate-200 p-2 rounded-lg text-sm outline-none focus:border-[#003366] w-full" placeholder={viewMode === 'class' ? "Lọc theo tên lớp..." : "Lọc theo giờ học..."} value={filterValue} onChange={(e) => setFilterValue(e.target.value)} />
            <button onClick={() => navigate('/staff/assignments/launch')} className="bg-[#003366] text-white px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap hover:bg-[#002244] shadow-sm">
               Phát Bài Tập
            </button>
         </div>
      </div>

      <div className="grid gap-3">
        {filteredStudents.length === 0 && <p className="text-slate-400 text-center py-8 italic">Không tìm thấy kết quả phù hợp.</p>}
        {filteredStudents.map((st, idx) => {
          const infoList = getClassInfo(st, viewMode === 'class' ? 'name' : 'time');
          return (
            <div key={idx} className="flex justify-between items-center p-4 border border-slate-100 rounded-xl hover:shadow-md hover:border-blue-100 transition-all bg-white group">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center font-bold text-[#003366]">{st.name?.charAt(0) || '?'}</div>
                 <div>
                    <div className="font-bold text-gray-800">{st.name || 'Unknown'}</div>
                    <div className="text-xs text-slate-500 font-mono">{st.studentCode}</div>
                 </div>
              </div>
              <div className="text-right">
                 <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                    {viewMode === 'class' ? 'Lớp phụ trách' : 'Lịch học'}
                 </div>
                 <div className="flex flex-col items-end gap-1">
                    {infoList.length > 0 ? infoList.map((info, i) => (
                      <span key={i} className={`text-xs px-2 py-1 rounded font-medium border ${viewMode === 'class' ? 'bg-blue-50 text-[#003366] border-blue-100' : 'bg-orange-50 text-orange-700 border-orange-100'}`}>
                        {info}
                      </span>
                    )) : <span className="text-xs text-slate-300 italic">--</span>}
                 </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
export default ClassList;