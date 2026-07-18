import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../../firebase';
import { ref, onValue } from 'firebase/database';
import { useAuth } from '../../context/AuthContext';
import StudentDetailModal from './StudentDetailModal';
import { computeAttendance, computeClassScores, attendanceColor, normClassIds } from '../../utils/contactBook';
import { getReserveStatus, RESERVE_LABEL, RESERVE_BADGE } from '../../utils/reserve';
import { fmtStudentName } from '../../utils/studentName';

// ============================================================
// THEO DÕI LỚP (trang chủ Cổng Giáo vụ)
// Góc nhìn THEO LỚP: mỗi lớp một thẻ sức khỏe (sĩ số, chuyên cần TB,
// HV cần chú ý, báo bài, việc đang chờ). Bấm vào lớp → toàn cảnh lớp đó:
// thao tác nhanh (điểm danh / nhập điểm / báo bài đã chọn sẵn lớp),
// bảng học viên với chuyên cần + điểm tổng kết + bonus, cảnh báo,
// báo bài gần nhất. Dùng chung công thức với Sổ liên lạc (utils/contactBook).
// ============================================================

const fmtDate = (d) => { try { return new Date(d).toLocaleDateString('vi-VN'); } catch { return d; } };
const isHomework = (n) => n && n.type !== 'link' && n.label === 'báo bài';

// Thống kê 1 lớp: chuyên cần TB, số buổi đã điểm danh, HV chuyên cần thấp
const computeClassHealth = (cls, students, attendanceData) => {
  const rates = [];
  let lowCount = 0;
  students.forEach((st) => {
    const a = computeAttendance(attendanceData, cls.id, st.id);
    if (a.rate !== null) {
      rates.push(a.rate);
      if (a.rate < 70) lowCount++;
    }
  });
  const avgRate = rates.length ? Math.round(rates.reduce((s, r) => s + r, 0) / rates.length) : null;
  const sessionCount = Object.keys((attendanceData || {})[cls.id] || {}).length;
  return { avgRate, lowCount, sessionCount };
};

// ============ THẺ SỨC KHỎE 1 LỚP (chế độ lưới) ============
const ClassHealthCard = ({ cls, students, attendanceData, homeworkCount, latestHomework, pendingCount, onOpen }) => {
  const { avgRate, lowCount, sessionCount } = useMemo(
    () => computeClassHealth(cls, students, attendanceData),
    [cls, students, attendanceData]
  );
  const { text } = attendanceColor(avgRate);
  return (
    <button type="button" onClick={onOpen}
      className="card-std p-5 text-left hover:shadow-md hover:border-green-200 transition-all group w-full">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="font-bold text-primary text-base truncate group-hover:underline">{cls.name}</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {cls.schedule || 'Chưa có lịch'}{cls.startTime ? ` · ${cls.startTime}–${cls.endTime || ''}` : ''} · {cls.room || 'Online'}
          </p>
        </div>
        <span className="shrink-0 text-[10px] font-bold bg-primary-light text-primary px-2 py-1 rounded-full border border-green-100">{students.length} HV</span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center mb-3">
        <div className="bg-slate-50 rounded-xl py-2">
          <div className={`text-lg font-extrabold leading-tight ${text}`}>{avgRate !== null ? `${avgRate}%` : '–'}</div>
          <div className="text-[9px] font-bold text-slate-400 uppercase">Chuyên cần TB</div>
        </div>
        <div className="bg-slate-50 rounded-xl py-2">
          <div className="text-lg font-extrabold leading-tight text-slate-700">{sessionCount}</div>
          <div className="text-[9px] font-bold text-slate-400 uppercase">Buổi đã dạy</div>
        </div>
        <div className="bg-slate-50 rounded-xl py-2">
          <div className="text-lg font-extrabold leading-tight text-slate-700">{homeworkCount}</div>
          <div className="text-[9px] font-bold text-slate-400 uppercase">Báo bài</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {lowCount > 0 && (
          <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded">⚠️ {lowCount} HV chuyên cần thấp</span>
        )}
        {pendingCount > 0 && (
          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">🔔 {pendingCount} việc đang chờ</span>
        )}
        <span className="text-[10px] text-slate-400 ml-auto self-center">
          {latestHomework ? `Báo bài mới: ${fmtDate(latestHomework.date)}` : 'Chưa có báo bài'}
        </span>
      </div>
    </button>
  );
};

// ============ CHI TIẾT 1 LỚP (drill-down) ============
const SORTS = {
  name: (a, b) => (a.name || '').localeCompare(b.name || '', 'vi'),
  att: (a, b) => (a._att.rate ?? 101) - (b._att.rate ?? 101),          // thấp nhất lên đầu để soi
  gpa: (a, b) => (b._scores.gpa || 0) - (a._scores.gpa || 0),
  bonus: (a, b) => (b._scores.byType.bonus.total || 0) - (a._scores.byType.bonus.total || 0),
};

const ClassDetail = ({ cls, students, attendanceData, scoresData, homework, pendingFeedback, pendingAppointments, allClassMap, onBack }) => {
  const [sortBy, setSortBy] = useState('name');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [expandedHw, setExpandedHw] = useState(null);
  const [showAllHw, setShowAllHw] = useState(false);

  // Gắn sẵn thống kê từng học viên (chuyên cần + điểm) để bảng và sort dùng chung
  const rows = useMemo(() => students.map((st) => ({
    ...st,
    _att: computeAttendance(attendanceData, cls.id, st.id),
    _scores: computeClassScores(scoresData, cls.id, st.id),
  })).sort(SORTS[sortBy]), [students, attendanceData, scoresData, cls.id, sortBy]);

  const { avgRate, lowCount, sessionCount } = useMemo(
    () => computeClassHealth(cls, students, attendanceData),
    [cls, students, attendanceData]
  );
  const { text } = attendanceColor(avgRate);
  const lowStudents = rows.filter((r) => r._att.rate !== null && r._att.rate < 70);
  const hwList = showAllHw ? homework : homework.slice(0, 3);

  const studentAllClassNames = (st) => normClassIds(st.classIds)
    .map((id) => allClassMap.get(id)?.name).filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'vi'));

  const SortChip = ({ id, label }) => (
    <button type="button" onClick={() => setSortBy(id)}
      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${sortBy === id ? 'bg-primary text-white border-primary' : 'bg-white text-slate-500 border-slate-200 hover:border-green-300'}`}>
      {label}
    </button>
  );

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Quay lại + header lớp */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary transition-colors font-medium">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
        Tất cả lớp
      </button>

      <div className="card-std p-5 bg-gradient-to-r from-primary-subtle to-white">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-primary">{cls.name}</h2>
            <p className="text-xs text-slate-500 mt-1">
              {cls.schedule || 'Chưa có lịch'}{cls.startTime ? ` · ${cls.startTime}–${cls.endTime || ''}` : ''} · {cls.room || 'Online'}
              {cls.teacherName ? ` · GV: ${cls.teacherName}` : ''}
            </p>
          </div>
          <div className="flex gap-4 text-center shrink-0">
            <div><div className="text-2xl font-extrabold text-slate-700 leading-tight">{students.length}</div><div className="text-[9px] font-bold text-slate-400 uppercase">Sĩ số</div></div>
            <div><div className={`text-2xl font-extrabold leading-tight ${text}`}>{avgRate !== null ? `${avgRate}%` : '–'}</div><div className="text-[9px] font-bold text-slate-400 uppercase">Chuyên cần TB</div></div>
            <div><div className="text-2xl font-extrabold text-slate-700 leading-tight">{sessionCount}</div><div className="text-[9px] font-bold text-slate-400 uppercase">Buổi đã dạy</div></div>
          </div>
        </div>

        {/* Thao tác nhanh: sang trang chức năng với LỚP ĐÃ CHỌN SẴN */}
        <div className="flex flex-wrap gap-2 mt-4">
          <Link to={`/staff/attendance?class=${cls.id}`} className="btn-primary btn-sm px-3.5 py-2 text-xs">🗓️ Điểm danh</Link>
          <Link to={`/staff/scores?class=${cls.id}`} className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white text-primary border border-primary hover:bg-primary hover:text-white transition-all">🏅 Nhập điểm</Link>
          <Link to={`/staff/notifications?class=${cls.id}`} className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white text-primary border border-primary hover:bg-primary hover:text-white transition-all">📚 Đăng báo bài</Link>
          {pendingAppointments > 0 && (
            <Link to="/staff/appointments" className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-all">📅 {pendingAppointments} lịch hẹn PH chờ</Link>
          )}
          {pendingFeedback > 0 && (
            <Link to="/staff/inbox" className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-all">💬 {pendingFeedback} phản ánh chưa xử lý</Link>
          )}
        </div>
      </div>

      {/* Cảnh báo chuyên cần thấp */}
      {lowStudents.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm font-bold text-red-700 mb-2">⚠️ {lowStudents.length} học viên chuyên cần dưới 70%, cần liên hệ hỗ trợ</p>
          <div className="flex flex-wrap gap-1.5">
            {lowStudents.map((st) => (
              <button key={st.id} type="button" onClick={() => setSelectedStudent(st)}
                className="text-[11px] font-bold text-red-700 bg-white border border-red-200 px-2.5 py-1 rounded-lg hover:bg-red-100 transition-colors">
                {st.name} · {st._att.rate}%
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bảng học viên */}
      <div className="card-std p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="section-title">Học viên trong lớp</h3>
          <div className="flex gap-1.5 items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Sắp xếp:</span>
            <SortChip id="name" label="Tên A-Z" />
            <SortChip id="att" label="Chuyên cần ↑" />
            <SortChip id="gpa" label="Điểm TK ↓" />
            <SortChip id="bonus" label="Bonus ↓" />
          </div>
        </div>

        {/* Desktop: bảng */}
        <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200">
          <table className="table-std">
            <thead>
              <tr>
                <th className="w-10 text-center">STT</th>
                <th>Học viên</th>
                <th className="text-center">Chuyên cần</th>
                <th className="text-center">Vắng</th>
                <th className="text-center" title="Assignment 10% + Formative 20% + MMT 30% + EOMT 40%">Điểm TK</th>
                <th className="text-center">Bonus ⭐</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((st, i) => {
                const rs = getReserveStatus(st);
                const low = st._att.rate !== null && st._att.rate < 70;
                return (
                  <tr key={st.id} onClick={() => setSelectedStudent(st)} className="cursor-pointer">
                    <td className="text-center text-slate-400 font-bold">{i + 1}</td>
                    <td>
                      <div className="font-bold text-slate-800 flex items-center gap-2 flex-wrap">
                        {fmtStudentName(st.name, st.englishName)}
                        {rs && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${RESERVE_BADGE[rs]}`}>{RESERVE_LABEL[rs]}</span>}
                        {st.isDemo && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200">DEMO</span>}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">{st.studentCode}</div>
                    </td>
                    <td className="text-center">
                      {st._att.rate !== null
                        ? <span className={`font-extrabold ${low ? 'text-red-500' : st._att.rate >= 80 ? 'text-emerald-600' : 'text-amber-500'}`}>{st._att.rate}%</span>
                        : <span className="text-slate-300 italic text-xs">–</span>}
                    </td>
                    <td className="text-center text-slate-600 font-bold">{st._att.absent || 0}</td>
                    <td className="text-center">
                      {st._scores.hasAnyGrade
                        ? <span className="font-extrabold text-primary tabular-nums">{st._scores.gpa.toFixed(2)}</span>
                        : <span className="text-slate-300 italic text-xs">–</span>}
                    </td>
                    <td className="text-center font-bold text-amber-600">{st._scores.byType.bonus.total || 0}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan="6" className="p-8 text-center text-slate-400 italic">Lớp chưa có học viên.</td></tr>}
            </tbody>
          </table>
        </div>

        {/* Mobile: thẻ dọc */}
        <div className="md:hidden space-y-2">
          {rows.map((st, i) => {
            const low = st._att.rate !== null && st._att.rate < 70;
            return (
              <button key={st.id} type="button" onClick={() => setSelectedStudent(st)}
                className={`w-full text-left p-3.5 rounded-xl border transition-all ${low ? 'border-red-200 bg-red-50/30' : 'border-slate-100 bg-white'}`}>
                <div className="flex justify-between items-center gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 text-sm truncate">{i + 1}. {fmtStudentName(st.name, st.englishName)}</p>
                    <p className="text-[11px] text-slate-400 font-mono">{st.studentCode}</p>
                  </div>
                  <div className="flex gap-3 text-center shrink-0">
                    <div><div className={`text-sm font-extrabold ${low ? 'text-red-500' : 'text-emerald-600'}`}>{st._att.rate !== null ? `${st._att.rate}%` : '–'}</div><div className="text-[8px] font-bold text-slate-400 uppercase">C.Cần</div></div>
                    <div><div className="text-sm font-extrabold text-primary">{st._scores.hasAnyGrade ? st._scores.gpa.toFixed(1) : '–'}</div><div className="text-[8px] font-bold text-slate-400 uppercase">Đ.TK</div></div>
                    <div><div className="text-sm font-extrabold text-amber-600">{st._scores.byType.bonus.total || 0}</div><div className="text-[8px] font-bold text-slate-400 uppercase">Bonus</div></div>
                  </div>
                </div>
              </button>
            );
          })}
          {rows.length === 0 && <p className="p-6 text-center text-slate-400 italic text-sm">Lớp chưa có học viên.</p>}
        </div>
      </div>

      {/* Báo bài gần nhất của lớp */}
      <div className="card-std p-4 md:p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="section-title">Báo bài của lớp ({homework.length})</h3>
          <Link to={`/staff/notifications?class=${cls.id}`} className="text-xs font-bold text-primary hover:underline">+ Đăng báo bài</Link>
        </div>
        {homework.length ? (
          <div className="space-y-2">
            {hwList.map((n) => {
              const open = expandedHw === n.id;
              return (
                <div key={n.id} onClick={() => setExpandedHw(open ? null : n.id)}
                  className="bg-white border border-slate-100 rounded-xl p-3.5 cursor-pointer hover:border-green-100 transition-colors" style={{ borderLeft: '3px solid #2B6830' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-primary-light text-green-700 text-[9px] font-bold px-2 py-0.5 rounded border border-green-100 uppercase">Báo bài</span>
                    {n.author && <span className="text-[10px] text-slate-400">{n.author}</span>}
                    <span className="text-[10px] text-slate-400 font-mono ml-auto">{fmtDate(n.date)}</span>
                  </div>
                  <h4 className="font-bold text-xs text-slate-800 mb-1">{n.title}</h4>
                  <div className={`quill-content text-xs text-slate-600 leading-relaxed ${open ? '' : 'line-clamp-2'}`} dangerouslySetInnerHTML={{ __html: n.content }} />
                </div>
              );
            })}
            {homework.length > 3 && (
              <button type="button" onClick={() => setShowAllHw(!showAllHw)} className="text-primary text-xs font-bold hover:underline">
                {showAllHw ? 'Thu gọn' : `Xem cả ${homework.length} báo bài`}
              </button>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">Lớp chưa có báo bài nào.</p>
        )}
      </div>

      {selectedStudent && (
        <StudentDetailModal
          student={selectedStudent}
          classNames={studentAllClassNames(selectedStudent)}
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </div>
  );
};

// ============ TRANG CHÍNH ============
const ClassTracking = () => {
  const { currentUser } = useAuth();
  const [classes, setClasses] = useState([]);       // lớp GV phụ trách (admin: tất cả)
  const [allClasses, setAllClasses] = useState([]); // mọi lớp (tra tên lớp trong popup HV)
  const [users, setUsers] = useState({});
  const [attendanceData, setAttendanceData] = useState({});
  const [scoresData, setScoresData] = useState({});
  const [notiList, setNotiList] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [openClassId, setOpenClassId] = useState(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    const myClassIds = currentUser?.assignedClasses || [];
    const unsubs = [
      onValue(ref(db, 'classes'), (snap) => {
        const data = snap.val() || {};
        const all = Object.entries(data).map(([id, val]) => ({ id, ...val }))
          .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'));
        setAllClasses(all);
        setClasses(isAdmin ? all : all.filter((c) => myClassIds.includes(c.id)));
        setLoading(false);
      }),
      onValue(ref(db, 'users'), (snap) => setUsers(snap.val() || {})),
      onValue(ref(db, 'attendance'), (snap) => setAttendanceData(snap.val() || {})),
      onValue(ref(db, 'scores'), (snap) => setScoresData(snap.val() || {})),
      onValue(ref(db, 'notifications'), (snap) => {
        const data = snap.val() || {};
        setNotiList(Object.entries(data).map(([id, val]) => ({ id, ...val }))
          .sort((a, b) => new Date(b.date) - new Date(a.date)));
      }),
      onValue(ref(db, 'feedback'), (snap) => {
        const data = snap.val() || {};
        setFeedbacks(Object.values(data));
      }),
      onValue(ref(db, 'appointments'), (snap) => {
        const data = snap.val() || {};
        const flat = [];
        Object.values(data).forEach((appts) => Object.values(appts || {}).forEach((a) => flat.push(a)));
        setAppointments(flat);
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [currentUser?.id, isAdmin, (currentUser?.assignedClasses || []).join(',')]);

  const allClassMap = useMemo(() => {
    const m = new Map();
    allClasses.forEach((c) => m.set(c.id, c));
    return m;
  }, [allClasses]);

  // Học viên theo lớp
  const studentsOf = (classId) => Object.entries(users)
    .map(([id, u]) => ({ id, ...u }))
    .filter((u) => u.role === 'student' && normClassIds(u.classIds).includes(classId));

  // Báo bài theo lớp (mới nhất trước, notiList đã sort)
  const homeworkOf = (classId) => notiList.filter((n) => isHomework(n) && n.scope === classId);

  // Việc đang chờ theo lớp: phản ánh chưa xử lý + lịch hẹn PH pending
  const pendingFeedbackOf = (classId) => feedbacks.filter((fb) => {
    if (fb.status === 'resolved') return false;
    const cls = Array.isArray(fb.classIds) ? fb.classIds : Object.values(fb.classIds || {});
    return cls.includes(classId);
  }).length;
  const pendingAppointmentsOf = (classId) => appointments.filter((a) => {
    if (a.status !== 'pending') return false;
    const cls = Array.isArray(a.classIds) ? a.classIds : Object.values(a.classIds || {});
    return cls.includes(classId);
  }).length;

  const openClass = classes.find((c) => c.id === openClassId) || null;

  return (
    <div className="space-y-6 pb-20">
      {!openClass && (
        <>
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="p-2 bg-primary-light rounded-xl text-primary">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6.75" />
              </svg>
            </div>
            <div>
              <h2 className="page-title">Theo dõi lớp</h2>
              <p className="page-sub">Sức khỏe từng lớp: chuyên cần, điểm số, báo bài và việc đang chờ.</p>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => <div key={i} className="h-44 bg-slate-100 rounded-2xl animate-pulse" />)}
            </div>
          ) : classes.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {classes.map((cls) => {
                const hw = homeworkOf(cls.id);
                return (
                  <ClassHealthCard key={cls.id} cls={cls}
                    students={studentsOf(cls.id)}
                    attendanceData={attendanceData}
                    homeworkCount={hw.length}
                    latestHomework={hw[0] || null}
                    pendingCount={pendingFeedbackOf(cls.id) + pendingAppointmentsOf(cls.id)}
                    onOpen={() => setOpenClassId(cls.id)} />
                );
              })}
            </div>
          ) : (
            <div className="bg-white p-10 rounded-2xl border border-dashed border-slate-200 text-center">
              <p className="text-slate-400 text-sm font-medium">Bạn chưa được phân công lớp nào.</p>
              <p className="text-slate-300 text-xs mt-1">Liên hệ Admin để được gán lớp phụ trách.</p>
            </div>
          )}
        </>
      )}

      {openClass && (
        <ClassDetail
          cls={openClass}
          students={studentsOf(openClass.id)}
          attendanceData={attendanceData}
          scoresData={scoresData}
          homework={homeworkOf(openClass.id)}
          pendingFeedback={pendingFeedbackOf(openClass.id)}
          pendingAppointments={pendingAppointmentsOf(openClass.id)}
          allClassMap={allClassMap}
          onBack={() => setOpenClassId(null)}
        />
      )}
    </div>
  );
};

export default ClassTracking;
