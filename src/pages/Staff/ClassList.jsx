import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebase';
import { ref, onValue } from "firebase/database";
import { useAuth } from '../../context/AuthContext';
import { getReserveStatus, RESERVE_LABEL, RESERVE_BADGE, RESERVE_CARD } from '../../utils/reserve';
import StudentDetailModal from './StudentDetailModal';
import { fmtStudentName, getBirthdayNotice } from '../../utils/studentName';

// Chuẩn hoá chuỗi tiếng Việt: bỏ dấu, đổi đ->d, về chữ thường -> tìm không phân biệt dấu/hoa thường
const viNorm = (s) => (s || '')
  .toString()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/đ/g, 'd').replace(/Đ/g, 'D')
  .toLowerCase()
  .trim();

const ClassList = () => {
  const { userData } = useAuth();
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [allClasses, setAllClasses] = useState([]); // toàn bộ lớp (để popup hiện ĐỦ lớp của HV, kể cả lớp GV không phụ trách)
  const [attendance, setAttendance] = useState({}); // dữ liệu điểm danh để tính chuyên cần
  const [classFilter, setClassFilter] = useState('');     // lọc theo lớp (dropdown)
  const [programFilter, setProgramFilter] = useState(''); // lọc theo môn học (dropdown)
  const [nameSearch, setNameSearch] = useState('');       // tìm theo tên / mã học viên
  const [selectedStudent, setSelectedStudent] = useState(null); // học viên đang mở popup chi tiết

  useEffect(() => {
    const myClassIds = userData?.assignedClasses || [];

    onValue(ref(db, 'classes'), (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const all = Object.entries(data).map(([id, val]) => ({ id, ...val }));
        setAllClasses(all);
        setClasses(all.filter(c => myClassIds.includes(c.id)));
      }
    });

    onValue(ref(db, 'users'), (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data)
          .map(([id, val]) => ({ id, ...val })) // giữ id để tính chuyên cần & dùng làm key
          .filter(u => {
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

  // Map lớp theo id để tra O(1) (thay cho classes.find lặp lại mỗi lần render)
  const classMap = useMemo(() => {
    const m = new Map();
    classes.forEach(c => m.set(c.id, c));
    return m;
  }, [classes]);

  const getStudentClassIds = (student) =>
    Array.isArray(student.classIds) ? student.classIds : (student.classId ? [student.classId] : []);

  // Tên các lớp của học viên (A-Z) để hiển thị badge, chỉ trong các lớp GV phụ trách
  const getStudentClassNames = (student) =>
    getStudentClassIds(student)
      .map(id => classMap.get(id)?.name)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'vi'));

  // Map TẤT CẢ lớp theo id (không lọc theo GV)
  const allClassMap = useMemo(() => {
    const m = new Map();
    allClasses.forEach(c => m.set(c.id, c));
    return m;
  }, [allClasses]);

  // Tên ĐỦ các lớp của học viên (kể cả lớp GV không phụ trách), dùng cho popup chi tiết
  const getStudentAllClassNames = (student) =>
    getStudentClassIds(student)
      .map(id => allClassMap.get(id)?.name)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'vi'));

  // Môn học của 1 học viên (subject các lớp GV phụ trách)
  const getStudentPrograms = (student) =>
    [...new Set(getStudentClassIds(student).map(id => classMap.get(id)?.subject).filter(Boolean))];

  // Dropdown lớp (A-Z) và dropdown môn học (A-Z)
  const classOptions = useMemo(
    () => [...classes].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi')),
    [classes]
  );
  const programOptions = useMemo(
    () => [...new Set(classes.map(c => c.subject).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi')),
    [classes]
  );

  // Lọc + sắp xếp học viên, chỉ tính lại khi dữ liệu/bộ lọc đổi
  const filteredStudents = useMemo(() => {
    const nameQuery = viNorm(nameSearch); // tìm tên không dấu/hoa thường
    return students.filter(st => {
      const passClass = !classFilter || getStudentClassIds(st).includes(classFilter);
      const passName = !nameQuery || viNorm(st.name).includes(nameQuery) || viNorm(st.studentCode).includes(nameQuery);
      const passProgram = !programFilter || getStudentPrograms(st).includes(programFilter);
      return passClass && passName && passProgram;
    }).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'));
  }, [students, classMap, classFilter, programFilter, nameSearch]);

  // Đếm học viên có chuyên cần thấp (< 70%)
  const lowAttCount = filteredStudents.filter(st => {
    const r = getAttendanceRate(st);
    return r !== null && r < 70;
  }).length;

  return (
    <div className="card-std p-5 md:p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-slate-100 pb-4 gap-4">
        <div className="flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#2B6830" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
          <div>
            <h2 className="page-title">Danh sách Học viên</h2>
            {/* Cảnh báo tổng nếu có học viên chuyên cần thấp */}
            {lowAttCount > 0 && (
              <p className="text-xs text-red-500 font-medium mt-0.5">
                ⚠️ {lowAttCount} học viên có chuyên cần dưới 70%
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {/* Lọc theo lớp (chỉ các lớp GV phụ trách) */}
          <select className="border border-slate-200 p-2 rounded-xl text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 bg-slate-50 font-medium text-primary w-36" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
            <option value="">Tất cả lớp</option>
            {classOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {/* Lọc theo môn học (subject admin set cho lớp) */}
          <select className="border border-slate-200 p-2 rounded-xl text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 bg-slate-50 font-medium text-primary w-36" value={programFilter} onChange={(e) => setProgramFilter(e.target.value)}>
            <option value="">Tất cả môn học</option>
            {programOptions.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <div className="relative flex-1 min-w-[180px]">
            <input
              className="w-full border border-slate-200 pl-7 pr-3 py-2 rounded-xl text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
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
          const infoList = getStudentClassNames(st);
          const attRate = getAttendanceRate(st);
          const isLowAtt = attRate !== null && attRate < 70;
          const rsv = getReserveStatus(st); // 'active' | 'ending' | null
          const bd = getBirthdayNotice(st); // { cake, message }, xét cả HV lẫn PH

          return (
            <div
              key={st.id || idx}
              onClick={() => setSelectedStudent(st)}
              className={`flex justify-between items-center p-4 border rounded-xl hover:shadow-md transition-all bg-white group cursor-pointer ${rsv ? RESERVE_CARD : isLowAtt ? 'border-red-200 bg-red-50/30' : 'border-slate-100 hover:border-green-100'}`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${rsv ? 'bg-yellow-100 text-yellow-700' : isLowAtt ? 'bg-red-100 text-red-600' : 'bg-slate-50 text-primary'}`}>
                  {(st.name || '?').charAt(0)}
                </div>
                <div>
                  <div className="font-bold text-gray-800 flex items-center gap-2 flex-wrap">
                    {fmtStudentName(st.name, st.englishName)}
                    {bd.cake && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 font-medium">🎂 {bd.message}</span>
                    )}
                    {isLowAtt && (
                      <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded border border-red-200">⚠️ Vắng nhiều</span>
                    )}
                    {(() => { const rs = getReserveStatus(st); return rs ? <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${RESERVE_BADGE[rs]}`}>{RESERVE_LABEL[rs]}</span> : null; })()}
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
                    <span className="text-xs text-slate-300 italic">–</span>
                  )}
                </div>

                {/* Lịch học / tên lớp */}
                <div className="flex flex-col items-end gap-1">
                  {infoList.map((info, i) => (
                    <span key={i} className="text-[10px] font-bold bg-primary-light text-primary px-2 py-1 rounded border border-green-100 whitespace-nowrap">{info}</span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Popup chi tiết học viên + phụ huynh */}
      {selectedStudent && (
        <StudentDetailModal
          student={selectedStudent}
          classNames={getStudentAllClassNames(selectedStudent)}
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </div>
  );
};

export default ClassList;
