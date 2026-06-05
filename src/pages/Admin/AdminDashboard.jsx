import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { ref, onValue } from 'firebase/database';

// ============================================================
// STAT CARD — hiển thị 1 chỉ số tổng quan
// ============================================================
const StatCard = ({ title, value, sub, icon, color }) => (
  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
      {icon}
    </div>
    <div>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{title}</p>
      <p className="text-3xl font-extrabold text-slate-800 leading-tight">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  </div>
);

// ============================================================
// SKELETON — hiển thị khi đang tải
// ============================================================
const Skeleton = () => (
  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4 animate-pulse">
    <div className="w-12 h-12 rounded-xl bg-slate-100 shrink-0" />
    <div className="space-y-2 flex-1">
      <div className="h-3 bg-slate-100 rounded w-24" />
      <div className="h-7 bg-slate-100 rounded w-16" />
    </div>
  </div>
);

// ============================================================
// MAIN COMPONENT
// ============================================================
const AdminDashboard = () => {
  const [loading, setLoading] = useState(true);

  // --- State số liệu ---
  const [totalClasses, setTotalClasses] = useState(0);
  const [totalStudents, setTotalStudents] = useState(0);
  const [totalStaff, setTotalStaff] = useState(0);
  const [todayStats, setTodayStats] = useState({ present: 0, absent: 0, late: 0, total: 0 });
  const [recentNotifs, setRecentNotifs] = useState([]);
  const [classesWithCounts, setClassesWithCounts] = useState([]);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    let loaded = { classes: false, users: false, attendance: false, notifs: false };
    const checkDone = () => {
      if (Object.values(loaded).every(Boolean)) setLoading(false);
    };

    // 1. Lớp học
    const unsubClasses = onValue(ref(db, 'classes'), (snap) => {
      const data = snap.val() || {};
      const list = Object.entries(data).map(([id, val]) => ({ id, ...val }));
      setTotalClasses(list.length);
      setClassesWithCounts(list);
      loaded.classes = true;
      checkDone();
    });

    // 2. Users → tách học viên và nhân sự
    const unsubUsers = onValue(ref(db, 'users'), (snap) => {
      const data = snap.val() || {};
      const users = Object.values(data);
      setTotalStudents(users.filter(u => u.role === 'student').length);
      setTotalStaff(users.filter(u => u.role === 'staff').length);
      loaded.users = true;
      checkDone();
    });

    // 3. Điểm danh hôm nay — duyệt qua tất cả lớp, tổng hợp
    const unsubAttendance = onValue(ref(db, 'attendance'), (snap) => {
      const data = snap.val() || {};
      let present = 0, absent = 0, late = 0, total = 0;

      // data = { classId: { date: { studentId: { status, note } } } }
      Object.values(data).forEach(classDates => {
        const todayData = classDates[today];
        if (!todayData) return;
        Object.values(todayData).forEach(record => {
          const status = typeof record === 'object' ? record.status : record;
          total++;
          if (status === 'present') present++;
          else if (status === 'late') late++;
          else absent++;
        });
      });

      setTodayStats({ present, absent, late, total });
      loaded.attendance = true;
      checkDone();
    });

    // 4. Thông báo gần nhất (5 cái)
    const unsubNotifs = onValue(ref(db, 'notifications'), (snap) => {
      const data = snap.val() || {};
      const list = Object.entries(data)
        .map(([id, val]) => ({ id, ...val }))
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5);
      setRecentNotifs(list);
      loaded.notifs = true;
      checkDone();
    });

    return () => {
      unsubClasses();
      unsubUsers();
      unsubAttendance();
      unsubNotifs();
    };
  }, [today]);

  // Tỷ lệ có mặt hôm nay
  const attendanceRate = todayStats.total > 0
    ? Math.round(((todayStats.present + todayStats.late) / todayStats.total) * 100)
    : null;

  // Ngày hiển thị tiếng Việt
  const todayLabel = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div className="space-y-6 pb-20 animate-fade-in-up">

      {/* ===== HEADER ===== */}
      <div className="bg-gradient-to-r from-[#2B6830] to-[#3D8B47] rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <p className="text-green-200 text-sm font-medium capitalize">{todayLabel}</p>
          <h1 className="text-2xl font-extrabold mt-1">Tổng quan hệ thống</h1>
          <p className="text-green-200 text-sm mt-1">Be Able VN — 2Sol EDU</p>
        </div>
        <div className="absolute right-0 top-0 w-40 h-40 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl" />
      </div>

      {/* ===== STAT CARDS ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          [1,2,3,4].map(i => <Skeleton key={i} />)
        ) : (
          <>
            <StatCard
              title="Lớp học"
              value={totalClasses}
              sub="đang hoạt động"
              color="bg-[#E8F4EC]"
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#2B6830" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
                </svg>
              }
            />
            <StatCard
              title="Học viên"
              value={totalStudents}
              sub="đã đăng ký"
              color="bg-green-50"
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#16a34a" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
              }
            />
            <StatCard
              title="Nhân sự"
              value={totalStaff}
              sub="giáo viên / staff"
              color="bg-[#E8F4EC]"
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#2B6830" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                </svg>
              }
            />
            <StatCard
              title="Điểm danh hôm nay"
              value={todayStats.total === 0 ? '—' : `${attendanceRate}%`}
              sub={todayStats.total === 0 ? 'Chưa có dữ liệu' : `${todayStats.present} có mặt · ${todayStats.absent} vắng · ${todayStats.late} trễ`}
              color="bg-amber-50"
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#d97706" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
          </>
        )}
      </div>

      {/* ===== ROW 2: Lớp + Thông báo ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Danh sách lớp */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-[#2B6830] uppercase tracking-wider mb-4">
            Các lớp đang hoạt động
          </h2>
          {loading ? (
            <div className="space-y-2 animate-pulse">
              {[1,2,3].map(i => <div key={i} className="h-10 bg-slate-100 rounded-xl" />)}
            </div>
          ) : classesWithCounts.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">Chưa có lớp nào. <br/>Vào <strong>Dữ liệu Lớp</strong> để thêm.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {classesWithCounts.map(cls => (
                <div key={cls.id} className="flex justify-between items-center px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors">
                  <div>
                    <p className="text-sm font-bold text-slate-700">{cls.name}</p>
                    <p className="text-xs text-slate-400">{cls.schedule || '—'} · {cls.room || '—'}</p>
                  </div>
                  <span className="text-[10px] font-bold text-[#2B6830] bg-[#E8F4EC] px-2 py-1 rounded-full border border-green-100">
                    {cls.subject || 'N/A'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Thông báo gần nhất */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-[#2B6830] uppercase tracking-wider mb-4">
            Thông báo gần nhất
          </h2>
          {loading ? (
            <div className="space-y-2 animate-pulse">
              {[1,2,3].map(i => <div key={i} className="h-10 bg-slate-100 rounded-xl" />)}
            </div>
          ) : recentNotifs.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">Chưa có thông báo nào. <br/>Vào <strong>Thông báo</strong> để tạo mới.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {recentNotifs.map(n => (
                <div key={n.id} className="flex items-start gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${n.scope === 'all' ? 'bg-green-400' : 'bg-green-400'}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-700 truncate">{n.title}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(n.date).toLocaleDateString('vi-VN')} · {n.scope === 'all' ? 'Toàn hệ thống' : `Lớp ${n.scope}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default AdminDashboard;
