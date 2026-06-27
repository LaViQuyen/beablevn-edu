import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { ref, onValue, update } from 'firebase/database';

// ============================================================
// SKELETON CARD — thay thế "Đang tải..."
// ============================================================
const SkeletonCard = () => (
  <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-100 shadow-sm animate-pulse">
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
// POPUP CHẶN (dùng chung)
// ============================================================
const BlockedPopup = ({ message, onClose }) => (
  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[80] p-4" onClick={onClose}>
    <div className="bg-slate-700 text-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center space-y-4" onClick={(e) => e.stopPropagation()}>
      <div className="w-12 h-12 rounded-full bg-slate-600 flex items-center justify-center mx-auto">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-slate-300">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 00-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
      </div>
      <p className="text-sm leading-relaxed text-slate-200">{message}</p>
      <button onClick={onClose} className="px-5 py-2.5 bg-slate-600 hover:bg-slate-500 text-white rounded-xl text-sm font-bold transition-colors">Đóng</button>
    </div>
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
  const [latestScore, setLatestScore] = useState(null);
  const [totalBonus, setTotalBonus] = useState(0);

  // --- Thông báo học phí ---
  const [tuitionRecord, setTuitionRecord]           = useState(null);   // record từ tuitionRecords/
  const [tuitionRecordId, setTuitionRecordId]       = useState(null);   // key của record
  const [extensionPopup, setExtensionPopup]         = useState(false);  // popup gia hạn
  const [overduePopup, setOverduePopup]             = useState(false);  // popup quá hạn
  const [creditsBlockedPopup, setCreditsBlockedPopup] = useState(false); // popup khóa credits

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

    // 2. Điểm danh → tính % chuyên cần tổng hợp
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

    // 3. Điểm số → entry mới nhất + tổng Bonus
    const unsubScores = onValue(ref(db, 'scores'), (snap) => {
      const data = snap.val() || {};
      let newest = null;
      let bonusSum = 0;
      studentClassIds.forEach(classId => {
        const myTypes = data[classId]?.[currentUser.id] || {};
        Object.entries(myTypes).forEach(([type, records]) => {
          Object.values(records || {}).forEach(rec => {
            if (type === 'bonus') bonusSum += Number(rec?.score) || 0;
            if (!rec?.date) return;
            if (!newest || new Date(rec.date) > new Date(newest.date)) {
              newest = { ...rec, type, classId };
            }
          });
        });
      });
      setLatestScore(newest);
      setTotalBonus(bonusSum);
      loaded.scores = true;
      checkDone();
    });

    return () => { unsubClasses(); unsubAtt(); unsubScores(); };
  }, [currentUser?.id]);

  // 4. Theo dõi bản ghi học phí của học viên (theo studentCode)
  useEffect(() => {
    if (!currentUser?.studentCode) return;
    const unsub = onValue(ref(db, 'tuitionRecords'), (snap) => {
      const data = snap.val() || {};
      const entry = Object.entries(data).find(([, v]) => v.studentCode === currentUser.studentCode);
      if (entry) {
        setTuitionRecordId(entry[0]);
        setTuitionRecord(entry[1]);
      } else {
        setTuitionRecordId(null);
        setTuitionRecord(null);
      }
    });
    return () => unsub();
  }, [currentUser?.studentCode]);

  // Tính số ngày đến hạn thanh toán
  const getDaysLeft = (deadline) => {
    if (!deadline) return null;
    const d = new Date(deadline + 'T00:00:00');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.ceil((d - today) / (1000 * 60 * 60 * 24));
  };

  // Màu chuyên cần theo ngưỡng
  const getAttColor = (rate) => {
    if (rate === null) return 'text-slate-400';
    if (rate >= 80) return 'text-emerald-600';
    if (rate >= 60) return 'text-amber-500';
    return 'text-red-500';
  };

  const typeLabel = { bonus: 'Điểm Bonus', assignment: 'Assignment', formative: 'Formative', summative: 'Summative' };
  const totalCredits = Math.floor(totalBonus / 2); // 2 Bonus = 1 Credit

  // ─── Logic banner học phí ────────────────────────────────────────────────
  const daysLeft = getDaysLeft(tuitionRecord?.paymentDeadline);
  const tuitionStatus = tuitionRecord?.status;
  const deadlineDisplay = tuitionRecord?.paymentDeadline
    ? new Date(tuitionRecord.paymentDeadline + 'T00:00:00').toLocaleDateString('vi-VN')
    : '';

  // Cấp độ banner
  // 3 = Quá hạn (status = 'Quá hạn')
  // 2 = Chờ + còn <= 3 ngày
  // 1 = Chờ + còn > 3 ngày
  // 0 = Không hiển thị (không có record, hoặc Đã đóng)
  const bannerLevel = (() => {
    if (!tuitionRecord) return 0;
    if (tuitionStatus === 'Quá hạn') return 3;
    // "Chờ" và "Chờ duyệt gia hạn" đều hiện banner (đang chờ thanh toán)
    if (tuitionStatus === 'Chờ' || tuitionStatus === 'Chờ duyệt gia hạn') {
      if (daysLeft !== null && daysLeft <= 2) return 2;  // ≤2 ngày → đỏ (urgent)
      return 1;  // ≥3 ngày → vàng (nhắc nhở)
    }
    return 0; // Đã thanh toán hoặc trạng thái khác
  })();

  // Đã gia hạn chờ duyệt (extensionRequested = true và chưa approved)
  const extensionPending = tuitionRecord?.extensionRequested && !tuitionRecord?.extensionApproved;

  // Admin vừa duyệt gia hạn (extensionApproved = true)
  const extensionApproved = tuitionRecord?.extensionApproved;

  // Gửi yêu cầu gia hạn
  const handleRequestExtension = async () => {
    if (!tuitionRecordId) return;
    try {
      await update(ref(db, `tuitionRecords/${tuitionRecordId}`), {
        extensionRequested:   true,
        extensionRequestedAt: new Date().toISOString(),
        extensionApproved:    false,
        status:               'Chờ duyệt gia hạn',
      });
      setExtensionPopup(false);
    } catch (e) {
      console.error('Lỗi gửi yêu cầu gia hạn:', e);
    }
  };

  const isOverdue = bannerLevel === 3;

  return (
    <div className="space-y-6 animate-fade-in-up pb-6">

      {/* ===== POPUP GIA HẠN ===== */}
      {extensionPopup && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[80] p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center space-y-4 border border-slate-100">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#3b82f6" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </div>
            <p className="font-bold text-slate-800">Yêu cầu Gia hạn</p>
            <p className="text-sm text-slate-600 leading-relaxed">
              BE ABLE VN tiếp nhận yêu cầu gia hạn. Thời hạn được dời thêm <strong>07 ngày</strong>.<br />
              <span className="text-slate-500">Hotline Tài vụ: <strong>088 699 7099</strong></span>
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setExtensionPopup(false)} className="px-4 py-2 bg-slate-100 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors">Hủy</button>
              <button onClick={handleRequestExtension} className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors">Xác nhận gửi</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== POPUP QUÁ HẠN ===== */}
      {overduePopup && (
        <BlockedPopup
          message="Đã quá hạn thanh toán học phí. Để tránh ảnh hưởng đến quá trình học và sử dụng dịch vụ, bạn vui lòng liên hệ hotline Tài vụ 088 699 7099. BE ABLE rất mong có thể hỗ trợ bạn."
          onClose={() => setOverduePopup(false)}
        />
      )}

      {/* ===== POPUP CREDITS BỊ KHÓA ===== */}
      {creditsBlockedPopup && (
        <BlockedPopup
          message="BE ABLE xin lỗi vì bất tiện này. Bạn cần thanh toán học phí để mở lại các tính năng."
          onClose={() => setCreditsBlockedPopup(false)}
        />
      )}

      {/* ===== HEADER CHÀO ===== */}
      <div className="bg-gradient-to-r from-[#2B6830] to-[#3D8B47] rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <p className="text-green-200 text-sm font-medium">
            {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' })}
          </p>
          <h1 className="text-2xl font-bold mt-1 mb-3">Xin chào, {currentUser?.name}! 👋</h1>

          {/* QUICK STATS row */}
          {loading ? (
            <div className="flex gap-3">
              {[1,2,3,4].map(i => <div key={i} className="h-16 w-28 bg-white/10 rounded-xl animate-pulse" />)}
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              <StatChip
                label="Chuyên cần"
                value={attendanceStats.rate !== null ? `${attendanceStats.rate}%` : '—'}
                color="bg-white/15 text-white"
              />
              <StatChip label="Số lớp" value={myClasses.length} color="bg-white/15 text-white" />
              <StatChip label="Buổi đã học" value={attendanceStats.total || '—'} color="bg-white/15 text-white" />
              <Link to="/student/credits" className="block">
                <StatChip
                  label="BAVN Credits ⭐"
                  value={totalCredits}
                  color="bg-white/25 text-white ring-1 ring-white/40 hover:bg-white/30 transition-colors cursor-pointer"
                />
              </Link>
            </div>
          )}
        </div>
        <div className="absolute right-0 top-0 w-40 h-40 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl" />
      </div>

      {/* ===== BANNER THÔNG BÁO HỌC PHÍ (3 cấp độ) ===== */}
      {bannerLevel === 1 && (
        <div className="rounded-2xl border border-yellow-300 bg-yellow-50 p-4 flex items-start gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#d97706" className="w-5 h-5 shrink-0 mt-0.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
          <div className="flex-1 min-w-0">
            {extensionApproved ? (
              <p className="text-sm font-bold text-yellow-800">
                Hệ thống đã cập nhật hạn thanh toán học phí đến ngày {deadlineDisplay}.
              </p>
            ) : (
              <p className="text-sm font-bold text-yellow-800">
                Bạn có Thông báo học phí mới. Thời hạn thanh toán đến ngày {deadlineDisplay}.
              </p>
            )}
          </div>
        </div>
      )}

      {bannerLevel === 2 && (
        <div className="rounded-2xl border border-red-300 bg-red-50 p-4 flex items-start gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#dc2626" className="w-5 h-5 shrink-0 mt-0.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-red-700">
              Đã đến gần hạn thanh toán. Bạn vui lòng thanh toán học phí trước ngày {deadlineDisplay}.
            </p>
          </div>
          {extensionPending ? (
            <span className="shrink-0 px-3 py-1.5 bg-slate-200 text-slate-600 rounded-xl text-xs font-bold cursor-default">Chờ xét duyệt</span>
          ) : (
            <button
              onClick={() => setExtensionPopup(true)}
              className="shrink-0 px-3 py-1.5 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-colors active:scale-95"
            >
              Gia hạn
            </button>
          )}
        </div>
      )}

      {bannerLevel === 3 && (
        <div className="rounded-2xl border border-red-400 bg-red-100 p-4 flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#dc2626" className="w-5 h-5 shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-sm font-bold text-red-700 flex-1">
            Tài khoản của bạn có khoản học phí quá hạn.
          </p>
          <button
            onClick={() => setOverduePopup(true)}
            className="shrink-0 px-3 py-1.5 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-colors active:scale-95"
          >
            Quá hạn
          </button>
        </div>
      )}

      {/* ===== BANNER BAVN CREDITS ===== */}
      {!loading && (
        isOverdue ? (
          <button
            onClick={() => setCreditsBlockedPopup(true)}
            className="w-full text-left bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-4 cursor-pointer hover:bg-slate-50 transition-all group opacity-70"
          >
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 text-2xl">🌿</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ví BAVN Credits</p>
              <p className="font-bold text-slate-500 text-sm">
                Bạn có <span className="text-slate-400">{totalBonus} điểm Bonus</span> = <span className="text-slate-400">{totalCredits} credits</span>
              </p>
            </div>
            <span className="shrink-0 text-xs font-bold text-slate-400 bg-slate-100 px-3.5 py-2 rounded-xl border border-slate-200">Đổi quà →</span>
          </button>
        ) : (
          <Link to="/student/credits" className="block bg-white rounded-2xl border border-green-100 shadow-sm p-4 flex items-center gap-4 hover:border-[#2B6830]/40 hover:shadow-md transition-all group">
            <div className="w-12 h-12 rounded-xl bg-[#E8F4EC] flex items-center justify-center shrink-0 text-2xl">🌿</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ví BAVN Credits</p>
              <p className="font-bold text-slate-800 text-sm">
                Bạn có <span className="text-[#2B6830]">{totalBonus} điểm Bonus</span> = <span className="text-[#2B6830]">{totalCredits} credits</span> — đổi đồ uống, đồ ăn Fresh Fit và quà tặng
              </p>
            </div>
            <span className="shrink-0 text-xs font-bold text-[#2B6830] bg-[#E8F4EC] px-3.5 py-2 rounded-xl border border-green-100 group-hover:bg-green-100 transition-colors">Đổi quà →</span>
          </Link>
        )
      )}

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
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-4">
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
          <div className="text-3xl font-extrabold text-[#2B6830] shrink-0">
            {latestScore.score ?? '—'}
          </div>
        </div>
      )}

      {/* ===== DANH SÁCH LỚP HỌC ===== */}
      <div>
        <h2 className="text-base font-bold text-[#2B6830] mb-3 flex items-center gap-2">
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
              <div key={cls.id} className="bg-white p-5 md:p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                <div className="flex justify-between items-start mb-3">
                  <div className="bg-[#E8F4EC] text-[#2B6830] text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                    {cls.room || 'Online'}
                  </div>
                </div>
                <h3 className="font-bold text-lg text-slate-800 mb-1 group-hover:text-[#2B6830] transition-colors">{cls.name}</h3>
                <p className="text-slate-500 text-xs mb-4">GV: {cls.teacherName || 'Đang cập nhật'}</p>
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
