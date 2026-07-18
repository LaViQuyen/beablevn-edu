import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { ref, onValue, update } from 'firebase/database';

// ============================================================
// LỊCH HẸN PHỤ HUYNH (cổng Giáo vụ / phòng Đào tạo)
// Node: appointments/{parentUid}/{aid}. Admin thấy tất cả;
// staff thấy lịch hẹn liên quan lớp mình phụ trách (hoặc không gắn lớp).
// Luồng trạng thái: pending → confirmed → done, hoặc cancelled.
// ============================================================

const STATUS_MAP = {
  pending:   { label: '⏳ Chờ xác nhận', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  confirmed: { label: '✅ Đã xác nhận',  color: 'bg-primary-light text-green-700 border-green-200' },
  done:      { label: '🏁 Đã hoàn tất',  color: 'bg-green-50 text-green-700 border-green-200' },
  cancelled: { label: '❌ Đã hủy',       color: 'bg-slate-100 text-slate-500 border-slate-200' },
};

const fmtDate = (d) => { try { return new Date(d + 'T00:00:00').toLocaleDateString('vi-VN'); } catch { return d; } };

const StaffAppointments = () => {
  const { currentUser } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [classMap, setClassMap] = useState({});
  const [filterStatus, setFilterStatus] = useState('pending');
  const [actionTarget, setActionTarget] = useState(null); // { appt, nextStatus }
  const [staffNote, setStaffNote] = useState('');
  const [saving, setSaving] = useState(false);

  const isAdmin = currentUser?.role === 'admin';
  const myClassIds = currentUser?.assignedClasses || [];

  useEffect(() => {
    const unsubs = [
      onValue(ref(db, 'appointments'), (snap) => {
        const data = snap.val() || {};
        // Flatten: { parentUid: { aid: {...} } } → mảng
        const list = [];
        Object.entries(data).forEach(([puid, appts]) => {
          Object.entries(appts || {}).forEach(([aid, a]) => list.push({ id: aid, parentKey: puid, ...a }));
        });
        list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setAppointments(list);
      }),
      onValue(ref(db, 'classes'), (snap) => {
        const data = snap.val() || {};
        const map = {};
        Object.entries(data).forEach(([id, val]) => { map[id] = val?.name || 'Lớp'; });
        setClassMap(map);
      }),
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  // Staff chỉ thấy lịch hẹn liên quan lớp phụ trách (hoặc không gắn lớp); admin thấy hết
  const visible = appointments.filter(a => {
    if (isAdmin) return true;
    const cls = Array.isArray(a.classIds) ? a.classIds : Object.values(a.classIds || {});
    return cls.length === 0 || cls.some(c => myClassIds.includes(c));
  });

  const counts = visible.reduce((acc, a) => { acc[a.status] = (acc[a.status] || 0) + 1; return acc; }, {});
  const filtered = visible.filter(a => filterStatus === 'all' || a.status === filterStatus);

  const openAction = (appt, nextStatus) => {
    setActionTarget({ appt, nextStatus });
    setStaffNote(appt.staffNote || '');
  };

  const confirmAction = async () => {
    if (!actionTarget) return;
    const { appt, nextStatus } = actionTarget;
    setSaving(true);
    try {
      await update(ref(db, `appointments/${appt.parentKey}/${appt.id}`), {
        status:       nextStatus,
        staffNote:    staffNote.trim() || null,
        handledBy:    currentUser.name || 'Phòng Đào tạo',
        handledAt:    new Date().toISOString(),
        parentUnread: (appt.parentUnread || 0) + 1, // báo phụ huynh có cập nhật
      });
      setActionTarget(null);
      setStaffNote('');
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const ACTION_LABEL = { confirmed: 'Xác nhận lịch hẹn', done: 'Hoàn tất buổi hẹn', cancelled: 'Từ chối / Hủy lịch' };
  const ACTION_COLOR = { confirmed: 'bg-primary hover:bg-primary-hover', done: 'bg-emerald-600 hover:bg-emerald-700', cancelled: 'bg-red-500 hover:bg-red-600' };

  return (
    <div className="space-y-6 pb-20">
      {/* POPUP XỬ LÝ */}
      {actionTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full space-y-4 border border-slate-100">
            <h3 className="font-bold text-slate-800 text-base">{ACTION_LABEL[actionTarget.nextStatus]}</h3>
            <p className="text-sm text-slate-500">
              PH <b>{actionTarget.appt.parentName}</b> · {fmtDate(actionTarget.appt.preferredDate)} · {actionTarget.appt.preferredSlot}
            </p>
            <div>
              <label className="stat-label block mb-1.5">Ghi chú gửi phụ huynh {actionTarget.nextStatus === 'cancelled' ? '(lý do) ' : ''}(hiện trong app của PH)</label>
              <textarea className="input-base resize-none" rows={3} value={staffNote} onChange={e => setStaffNote(e.target.value)}
                placeholder={actionTarget.nextStatus === 'confirmed' ? 'VD: Trung tâm xác nhận hẹn Ba Mẹ 15:00 thứ Bảy tại cơ sở Quận 10...' : 'Nhập ghi chú...'} />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setActionTarget(null)} className="btn-secondary">Đóng</button>
              <button onClick={confirmAction} disabled={saving}
                className={`px-4 py-2 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-50 ${ACTION_COLOR[actionTarget.nextStatus]}`}>
                {saving ? 'Đang lưu...' : ACTION_LABEL[actionTarget.nextStatus]}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
        <div className="p-2 bg-primary-light rounded-xl text-primary">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
        </div>
        <div>
          <h2 className="page-title">Lịch hẹn Phụ huynh</h2>
          <p className="page-sub">Yêu cầu đặt lịch trao đổi với phòng Đào tạo từ Ba Mẹ học viên.</p>
        </div>
      </div>

      {/* Filter trạng thái */}
      <div className="flex gap-2 flex-wrap">
        {[
          { id: 'pending',   label: `⏳ Chờ xác nhận (${counts.pending || 0})` },
          { id: 'confirmed', label: `✅ Đã xác nhận (${counts.confirmed || 0})` },
          { id: 'done',      label: `🏁 Hoàn tất (${counts.done || 0})` },
          { id: 'cancelled', label: `❌ Đã hủy (${counts.cancelled || 0})` },
          { id: 'all',       label: `Tất cả (${visible.length})` },
        ].map(f => (
          <button key={f.id} onClick={() => setFilterStatus(f.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${filterStatus === f.id ? 'bg-primary text-white border-primary' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Danh sách */}
      <div className="space-y-3 max-w-3xl">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center">
            <p className="text-slate-400 text-sm">Không có lịch hẹn nào trong mục này.</p>
          </div>
        ) : filtered.map(a => {
          const st = STATUS_MAP[a.status] || STATUS_MAP.pending;
          const clsNames = (Array.isArray(a.classIds) ? a.classIds : Object.values(a.classIds || {}))
            .map(cid => classMap[cid]).filter(Boolean).join(', ');
          return (
            <div key={`${a.parentKey}-${a.id}`} className={`card-std p-4 md:p-5 space-y-2.5 ${a.status === 'pending' ? 'border-amber-200 bg-amber-50/30' : ''}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-1 rounded border ${st.color}`}>{st.label}</span>
                <span className="text-[10px] font-bold px-2 py-1 rounded border bg-slate-50 text-slate-600 border-slate-200">{a.topicLabel || a.topic}</span>
                <span className="text-[11px] text-slate-400 font-mono ml-auto">Gửi {new Date(a.createdAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                <p className="font-bold text-slate-800">👤 {a.parentName}{a.phone ? <span className="font-mono font-medium text-slate-500"> · {a.phone}</span> : null}</p>
                {a.studentName && <p className="text-slate-600">👧 {a.studentName}{a.studentCode ? ` (${a.studentCode})` : ''}{clsNames ? ` · ${clsNames}` : ''}</p>}
              </div>

              <p className="text-sm font-bold text-primary">🗓 {fmtDate(a.preferredDate)} · {a.preferredSlot}</p>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2.5">{a.content}</p>

              {a.staffNote && (
                <p className="text-xs text-slate-500"><b>Ghi chú đã gửi PH{a.handledBy ? ` (${a.handledBy})` : ''}:</b> {a.staffNote}</p>
              )}
              {a.status === 'cancelled' && a.cancelledBy === 'parent' && (
                <p className="text-xs text-slate-400 italic">Phụ huynh tự hủy lịch này.</p>
              )}

              {/* Hành động theo trạng thái */}
              <div className="flex flex-wrap gap-2 pt-1">
                {a.status === 'pending' && (
                  <>
                    <button onClick={() => openAction(a, 'confirmed')} className="btn-primary btn-sm px-3 py-1.5 text-xs">✅ Xác nhận</button>
                    <button onClick={() => openAction(a, 'cancelled')} className="px-3 py-1.5 rounded-xl text-xs font-bold border border-red-200 text-red-500 hover:bg-red-500 hover:text-white transition-colors">Từ chối</button>
                  </>
                )}
                {a.status === 'confirmed' && (
                  <>
                    <button onClick={() => openAction(a, 'done')} className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">🏁 Hoàn tất</button>
                    <button onClick={() => openAction(a, 'cancelled')} className="px-3 py-1.5 rounded-xl text-xs font-bold border border-red-200 text-red-500 hover:bg-red-500 hover:text-white transition-colors">Hủy lịch</button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StaffAppointments;
