import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { ref, onValue } from 'firebase/database';

// ============================================================
// SKELETON CARD — thay thế "Đang tải..."
// ============================================================
const SkeletonCard = () => (
  <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm animate-pulse">
    <div className="h-3 bg-slate-100 rounded w-16 mb-3" />
    <div className="h-5 bg-slate-100 rounded w-32 mb-2" />
    <div className="h-3 bg-slate-100 rounded w-24 mb-4" />
    <div className="h-3 bg-slate-100 rounded w-full" />
  </div>
);

// ============================================================
// MINI STAT CHIP — dùng trong header
// ============================================================
const StatChip = ({ label, value, color }) => (
  <div className={`rounded-xl px-4 py-3 ${color} flex flex-col`}>
    <span className="text-xs font-bold opacity-70 uppercase tracking-wider">{label}</span>
    <span className="text-2xl font-extrabold leading-tight">{value}</span>
  </div>
);

// ============================================================
// MAIN COMPONENT
// ============================================================
const StudentDashboard = () => {
  const { currentUser } = useAuth();
  const [myClasses, setMyClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- Quick stats ---
  const [attendanceStats, setAttendanceStats] = useState({ rate: null, total: 0 });
  const [latestScore, setLatestScore] = useState(null); // điểm mới nhất

  const studentClassIds = currentUser?.classIds
    ? (Array.isArray(currentUser.classIds) ? currentUser.classIds : Object.values(currentUser.classIds))
    : [];

  useEffect(() => {
    if (!currentUser) return;
    let loaded = { classes: false, attendance: false, scores: false };
    const checkDone = () => { if (Object.values(loaded).every(Boolean)) setLoading(false); };

    // 1. Lớp học
    const unsubClasses = onValue(ref(db, 'classes'), (snap) => {
      const data = snap.val() || {};
      const filtered = Object.entries(data)
        .map(([id, val]) => ({ id, ...val }))
        .filter(c => studentClassIds.includes(c.id));
      setMyClasses(filtered);
      loaded.classes = true;
      checkDone();
    });

    // 2. Điểm danh → tính % chuyên cần tổng hợp tất cả lớp
    const unsubAtt = onValue(ref(db, 'attendance'), (snap) => {
      const data = snap.val() || {};
      let present = 0, total = 0;
      studentClassIds.forEach(classId => {
        const classDates = data[classId] || {};
        Object.values(classDates).forEach(sessionData => {
          const record = sessionData[currentUser.id];
          if (!record) return;
          total++;
          const status = typeof record === 'object' ? record.status : record;
          if (status === 'present' || status === 'late') present++;
        });
      });
      const rate = total > 0 ? Math.round((present / total) * 100) : null;
      setAttendanceStats({ rate, total });
      loaded.attendance = true;
      checkDone();
    });

    // 3. Điểm số → lấy entry mới nhất
    const unsubScores = onValue(ref(db, 'scores'), (snap) => {
      const data = snap.val() || {};
      let newest = null;
      studentClassIds.forEach(classId => {
        const classScores = data[classId] || {};
        // classScores = { scoreType: { studentId: { recordId: { date, score, content } } } }
        Object.entries(classScores).forEach(([type, byStudent]) => {
          const myRecords = byStudent[currentUser.id];
          if (!myRecords) return;
          Object.values(myRecords).forEach(rec => {
            if (!rec?.date) return;
            if (!newest || new Date(rec.date) > new Date(newest.date)) {
              newest = { ...rec, type, classId };
            }
          });
        });
      });
      setLatestScore(newest);
      loaded.scores = true;
      checkDone();
    });

    return () => { unsubClasses(); unsubAtt(); unsubScores(); };
  }, [currentUser?.id]);

  // Màu chuyên cần theo ngưỡng
  const getAttColor = (rate) => {
    if (rate === null) return 'text-slate-400';
    if (rate >= 80) return 'text-emerald-600';
    if (rate >= 60) return 'text-amber-500';
    return 'text-red-500';
  };

  const typeLabel = { bonus: 'Điểm Bonus', assignment: 'Assignment', formative: 'Formative', summative: 'Summative' };

  return (
    <div className="space-y-6 animate-fade-in-up pb-6">

      {/* ===== HEADER CHÀO ===== */}
      <div className="bg-gradient-to-r from-[#003366] to-[#0055aa] rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <p className="text-blue-200 text-sm font-medium">
            {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' })}
          </p>
          <h1 className="text-2xl font-bold mt-1 mb-3">Xin chào, {currentUser?.name}! 👋</h1>

          {/* QUICK STATS row */}
          {loading ? (
            <div className="flex gap-3">
              {[1,2,3].map(i => <div key={i} className="h-16 w-28 bg-white/10 rounded-xl animate-pulse" />)}
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              <StatChip
                label="Chuyên cần"
                value={attendanceStats.rate !== null ? `${attendanceStats.rate}%` : '—'}
                color={`bg-white/15 text-white`}
              />
              <StatChip
                label="Số lớp"
                value={myClasses.length}
                color="bg-white/15 text-white"
              />
              <StatChip
                label="Buổi đã học"
                value={attendanceStats.total || '—'}
                color="bg-white/15 text-white"
              />
            </div>
          )}
        </div>
        <div className="absolute right-0 top-0 w-40 h-40 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl" />
      </div>

      {/* ===== CẢNH BÁO CHUYÊN CẦN ===== */}
      {!loading && attendanceStats.rate !== null && attendanceStats.rate < 70 && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#dc2626" className="w-5 h-5 shrink-0 mt-0.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <div>
            <p className="text-sm font-bold text-red-700">Chuyên cần đang thấp ({attendanceStats.rate}%)</p>
            <p className="text-xs text-red-500 mt-0.5">Liên hệ giáo viên hoặc trung tâm để được hỗ trợ.</p>
          </div>
        </div>
      )}

      {/* ===== ĐIỂM MỚI NHẤT ===== */}
      {!loading && latestScore && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#d97706" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Điểm gần nhất</p>
            <p className="font-bold text-slate-800 text-sm truncate">{latestScore.content || '—'}</p>
            <p className="text-xs text-slate-400">{typeLabel[latestScore.type] || latestScore.type} · {new Date(latestScore.date).toLocaleDateString('vi-VN')}</p>
          </div>
          <div className="text-3xl font-extrabold text-[#003366] shrink-0">
            {latestScore.score ?? '—'}
          </div>
        </div>
      )}

      {/* ===== DANH SÁCH LỚP HỌC ===== */}
      <div>
        <h2 className="text-base font-bold text-[#003366] mb-3 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
          </svg>
          Lớp học của tôi
        </h2>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2].map(i => <SkeletonCard key={i} />)}
          </div>
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
                <p className="text-slate-500 text-xs mb-4">
                  GV: {cls.teacherName || 'Đang cập nhật'}
                </p>
                <div className="pt-4 border-t border-slate-100 flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">Lịch học:</span>
                  <span className="font-bold text-slate-700">{cls.schedule || '—'}</span>
                </div>
                <div className="flex justify-between items-center text-xs mt-2">
                  <span className="text-slate-400 font-medium">Giờ học:</span>
                  <span className="font-mono text-slate-600">{cls.startTime && cls.endTime ? `${cls.startTime} – ${cls.endTime}` : '—'}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white p-8 rounded-xl border border-dashed border-slate-200 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="#cbd5e1" className="w-12 h-12 mx-auto mb-3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
            </svg>
            <p className="text-slate-400 text-sm font-medium">Bạn chưa được gán vào lớp học nào.</p>
            <p className="text-slate-300 text-xs mt-1">Liên hệ trung tâm để được hỗ trợ.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentDashboard;
