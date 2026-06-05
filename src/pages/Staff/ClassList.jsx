import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { ref, onValue } from "firebase/database";
import { useAuth } from '../../context/AuthContext';

const ClassList = () => {
  const { userData } = useAuth();
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [attendance, setAttendance] = useState({}); // dữ liệu điểm danh để tính chuyên cần
  const [viewMode, setViewMode] = useState('class');
  const [filterValue, setFilterValue] = useState('');
  const [nameSearch, setNameSearch] = useState('');

  useEffect(() => {
    const myClassIds = userData?.assignedClasses || [];

    onValue(ref(db, 'classes'), (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const allClasses = Object.entries(data).map(([id, val]) => ({ id, ...val }));
        setClasses(allClasses.filter(c => myClassIds.includes(c.id)));
      }
    });

    onValue(ref(db, 'users'), (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.values(data).filter(u => {
          if (u.role !== 'student') return false;
          const studentClasses = u.classIds || (u.classId ? [u.classId] : []);
          return studentClasses.some(id => myClassIds.includes(id));
        });
        setStudents(list);
      }
    });

    // Lấy dữ liệu điểm danh để tính tỷ lệ chuyên cần
    onValue(ref(db, 'attendance'), (snapshot) => {
      setAttendance(snapshot.val() || {});
    });
  }, [userData]);

  // Tính tỷ lệ chuyên cần cho 1 học viên trong các lớp GV phụ trách
  const getAttendanceRate = (student) => {
    const myClassIds = userData?.assignedClasses || [];
    let present = 0, total = 0;

    myClassIds.forEach(classId => {
      const classDates = attendance[classId] || {};
      Object.values(classDates).forEach(sessionData => {
        const record = sessionData[student.id];
        if (!record) return;
        total++;
        const status = typeof record === 'object' ? record.status : record;
        if (status === 'present' || status === 'late') present++;
      });
    });

    if (total === 0) return null; // chưa có dữ liệu
    return Math.round((present / total) * 100);
  };

  const getClassInfo = (student, type) => {
    if (!student.classIds || !Array.isArray(student.classIds)) return [];
    return student.classIds.map(id => {
      const foundClass = classes.find(c => c.id === id);
      if (!foundClass) return null;
      return type === 'name' ? foundClass.name : `${foundClass.schedule} (${foundClass.startTime}-${foundClass.endTime})`;
    }).filter(Boolean);
  };

  const filteredStudents = students.filter(st => {
    const classNames = getClassInfo(st, 'name').join(' ').toLowerCase();
    const schedules = getClassInfo(st, 'time').join(' ').toLowerCase();
    const search = filterValue.toLowerCase();
    const passFilter = viewMode === 'time' ? schedules.includes(search) : classNames.includes(search);
    const passName = !nameSearch || st.name.toLowerCase().includes(nameSearch.toLowerCase()) || (st.studentCode || '').toLowerCase().includes(nameSearch.toLowerCase());
    return passFilter && passName;
  });

  // Đếm học viên có chuyên cần thấp (< 70%)
  const lowAttCount = filteredStudents.filter(st => {
    const r = getAttendanceRate(st);
    return r !== null && r < 70;
  }).length;

  return (
    <div className="bg-white p-4 md:p-6 rounded-xl border border-slate-100 shadow-sm">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-slate-100 pb-4 gap-4">
        <div className="flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#2B6830" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
          <div>
            <h2 className="text-xl font-bold text-[#2B6830]">Danh sách Học viên</h2>
            {/* Cảnh báo tổng nếu có học viên chuyên cần thấp */}
            {lowAttCount > 0 && (
              <p className="text-xs text-red-500 font-medium mt-0.5">
                ⚠️ {lowAttCount} học viên có chuyên cần dưới 70%
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <select className="border border-slate-200 p-2 rounded-xl text-sm outline-none focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10 bg-slate-50 font-medium text-[#2B6830]" value={viewMode} onChange={(e) => setViewMode(e.target.value)}>
            <option value="class">Xem theo Lớp</option>
            <option value="time">Xem theo Thời gian</option>
          </select>
          <input className="border border-slate-200 p-2 rounded-xl text-sm outline-none focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10 flex-1 min-w-[120px]" placeholder={viewMode === 'class' ? "Lọc lớp..." : "Lọc giờ..."} value={filterValue} onChange={(e) => setFilterValue(e.target.value)} />
          <div className="relative flex-1 min-w-[160px]">
            <input
              className="w-full border border-slate-200 pl-7 pr-3 py-2 rounded-xl text-sm outline-none focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10"
              placeholder="Tìm tên học viên..."
              value={nameSearch}
              onChange={e => setNameSearch(e.target.value)}
            />
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#94a3b8" className="w-4 h-4 absolute left-2 top-2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        {filteredStudents.length === 0 && (
          <div className="text-center py-12">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="#cbd5e1" className="w-12 h-12 mx-auto mb-3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            <p className="text-slate-400 text-sm font-medium">Không tìm thấy học viên nào.</p>
            <p className="text-slate-300 text-xs mt-1">Kiểm tra lại bộ lọc hoặc liên hệ admin để được gán lớp.</p>
          </div>
        )}

        {filteredStudents.map((st, idx) => {
          const infoList = getClassInfo(st, viewMode === 'class' ? 'name' : 'time');
          const attRate = getAttendanceRate(st);
          const isLowAtt = attRate !== null && attRate < 70;

          return (
            <div
              key={idx}
              className={`flex justify-between items-center p-4 border rounded-xl hover:shadow-md transition-all bg-white group ${isLowAtt ? 'border-red-200 bg-red-50/30' : 'border-slate-100 hover:border-green-100'}`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${isLowAtt ? 'bg-red-100 text-red-600' : 'bg-slate-50 text-[#2B6830]'}`}>
                  {st.name.charAt(0)}
                </div>
                <div>
                  <div className="font-bold text-gray-800 flex items-center gap-2">
                    {st.name}
                    {isLowAtt && (
                      <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded border border-red-200">⚠️ Vắng nhiều</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 font-mono">{st.studentCode}</div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* Tỷ lệ chuyên cần */}
                <div className="text-right hidden sm:block">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Chuyên cần</div>
                  {attRate !== null ? (
                    <span className={`text-sm font-extrabold ${attRate >= 80 ? 'text-emerald-600' : attRate >= 70 ? 'text-amber-500' : 'text-red-500'}`}>
                      {attRate}%
                    </span>
                  ) : (
                    <span className="text-xs text-slate-300 italic">—</span>
                  )}
                </div>

                {/* Lịch học / tên lớp */}
                <div className="flex flex-col items-end gap-1">
                  {infoList.map((info, i) => (
                    <span key={i} className="text-[10px] font-bold bg-[#E8F4EC] text-[#2B6830] px-2 py-1 rounded border border-green-100 whitespace-nowrap">{info}</span>
                  ))}
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
