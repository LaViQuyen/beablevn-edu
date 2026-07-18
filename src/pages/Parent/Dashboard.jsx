import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { ref, onValue } from 'firebase/database';
import ContactBook from '../../components/ContactBook';
import { useChildren } from './useChildren';
import { normClassIds, computeAttendance } from '../../utils/contactBook';
import StudentAvatar from '../../components/StudentAvatar';

// ============================================================
// SỔ LIÊN LẠC (cổng Phụ huynh), trang tổng quan chính.
// - Nhiều con: thanh chọn con, mỗi con hiện quick stats + thẻ lớp.
// - Nội dung thẻ lớp dùng CHUNG component ContactBook với cổng học viên.
// ============================================================

const StatChip = ({ label, value }) => (
  <div className="rounded-xl px-4 py-3 bg-white/15 text-white flex flex-col">
    <span className="text-xs font-bold opacity-70 uppercase tracking-wider">{label}</span>
    <span className="text-2xl font-extrabold leading-tight">{value}</span>
  </div>
);

const ParentDashboard = () => {
  const { currentUser } = useAuth();
  const { children, loading } = useChildren(currentUser?.id);
  const [selectedId, setSelectedId] = useState(null);
  const [attendanceData, setAttendanceData] = useState({});

  // Chọn sẵn con đầu tiên khi nạp xong liên kết
  useEffect(() => {
    if (children.length && (!selectedId || !children.some(c => c.id === selectedId))) {
      setSelectedId(children[0].id);
    }
  }, [children.map(c => c.id).join(','), selectedId]);

  // Điểm danh để tính quick stats của con đang chọn
  useEffect(() => {
    const unsub = onValue(ref(db, 'attendance'), (s) => setAttendanceData(s.val() || {}));
    return () => unsub();
  }, []);

  const child = children.find(c => c.id === selectedId) || null;

  // Quick stats: gộp chuyên cần các lớp của con đang chọn
  const quick = (() => {
    if (!child) return { rate: null, classCount: 0, sessions: 0 };
    const ids = normClassIds(child.classIds);
    let present = 0, late = 0, total = 0;
    ids.forEach(cid => {
      const a = computeAttendance(attendanceData, cid, child.id);
      present += a.present; late += a.late; total += a.total;
    });
    return {
      rate: total > 0 ? Math.round(((present + late) / total) * 100) : null,
      classCount: ids.length,
      sessions: total,
    };
  })();

  return (
    <div className="space-y-6 animate-fade-in-up pb-6">
      {/* ===== HEADER CHÀO ===== */}
      <div className="bg-gradient-to-r from-primary to-primary-medium rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <p className="text-green-200 text-sm font-medium">
            {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' })}
          </p>
          <h1 className="text-xl font-bold mt-1 mb-3">Kính chào {currentUser?.name}! 🌿</h1>
          {loading ? (
            <div className="flex gap-3">{[1, 2, 3].map(i => <div key={i} className="h-16 w-28 bg-white/10 rounded-xl animate-pulse" />)}</div>
          ) : child ? (
            <div className="flex flex-wrap gap-3">
              <StatChip label="Chuyên cần" value={quick.rate !== null ? `${quick.rate}%` : '–'} />
              <StatChip label="Số lớp" value={quick.classCount} />
              <StatChip label="Buổi đã học" value={quick.sessions || '–'} />
            </div>
          ) : (
            <p className="text-green-100 text-sm">Tài khoản chưa được liên kết với học viên nào. Vui lòng liên hệ trung tâm.</p>
          )}
        </div>
        <div className="absolute right-0 top-0 w-40 h-40 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl" />
      </div>

      {/* ===== THAO TÁC NHANH ===== */}
      <div className="grid grid-cols-2 gap-3">
        <Link to="/parent/appointments" className="card-std p-4 flex items-center gap-3 hover:shadow-md hover:border-green-100 transition-all">
          <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center text-xl shrink-0">📅</div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-800">Đặt lịch hẹn</p>
            <p className="text-[11px] text-slate-400 truncate">Hẹn trao đổi với phòng Đào tạo</p>
          </div>
        </Link>
        <Link to="/parent/support" className="card-std p-4 flex items-center gap-3 hover:shadow-md hover:border-green-100 transition-all">
          <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center text-xl shrink-0">💬</div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-800">Gửi hỗ trợ</p>
            <p className="text-[11px] text-slate-400 truncate">Hỗ trợ, phản ánh, góp ý</p>
          </div>
        </Link>
      </div>

      {/* ===== CHỌN CON (khi có nhiều con) ===== */}
      {children.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {children.map(c => (
            <button key={c.id} onClick={() => setSelectedId(c.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-bold border transition-all ${selectedId === c.id ? 'bg-primary text-white border-primary shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-green-300'}`}>
              <StudentAvatar name={c.name} size={22} />
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* ===== SỔ LIÊN LẠC CỦA CON ĐANG CHỌN ===== */}
      {loading ? (
        <div className="space-y-4">{[1, 2].map(i => <div key={i} className="h-40 bg-slate-100 rounded-2xl animate-pulse" />)}</div>
      ) : child ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <StudentAvatar name={child.name} size={40} />
            <div>
              <h2 className="text-base font-bold text-primary leading-tight">Sổ liên lạc của {child.name}</h2>
              <p className="text-xs text-slate-400">Mã HV: {child.studentCode || '–'}</p>
            </div>
          </div>
          {/* hideAttendanceLink: KHÔNG cho PH thấy link điểm danh, tránh PH điểm danh thay con */}
          <ContactBook student={child} hideAttendanceLink />
        </div>
      ) : (
        <div className="bg-white p-8 rounded-2xl border border-dashed border-slate-200 text-center">
          <p className="text-slate-400 text-sm font-medium">Chưa có học viên nào được liên kết với tài khoản này.</p>
          <p className="text-slate-300 text-xs mt-1">Liên hệ trung tâm: 088 699 7099 để được hỗ trợ liên kết.</p>
        </div>
      )}
    </div>
  );
};

export default ParentDashboard;
