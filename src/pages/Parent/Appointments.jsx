import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { ref, onValue, push, set, update } from 'firebase/database';
import { useAuth } from '../../context/AuthContext';
import { useChildren } from './useChildren';
import { normClassIds } from '../../utils/contactBook';

// ============================================================
// LỊCH HẸN HỖ TRỢ (cổng Phụ huynh)
// Phụ huynh đặt lịch hẹn trao đổi với phòng Đào tạo; theo dõi trạng thái
// pending → confirmed → done (hoặc cancelled). Node: appointments/{parentUid}/{aid}
// ============================================================

const TOPICS = [
  { id: 'lo-trinh',  label: '🧭 Tư vấn lộ trình học' },
  { id: 'ket-qua',   label: '📈 Trao đổi kết quả học tập' },
  { id: 'hoc-phi',   label: '💰 Học phí & thủ tục' },
  { id: 'khac',      label: '💬 Nội dung khác' },
];

const TIME_SLOTS = ['Sáng (8:00 – 11:00)', 'Chiều (14:00 – 17:00)', 'Tối (18:00 – 20:30)'];

const STATUS_MAP = {
  pending:   { label: '⏳ Chờ xác nhận', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  confirmed: { label: '✅ Đã xác nhận',  color: 'bg-primary-light text-green-700 border-green-200' },
  done:      { label: '🏁 Đã hoàn tất',  color: 'bg-green-50 text-green-700 border-green-200' },
  cancelled: { label: '❌ Đã hủy',       color: 'bg-slate-100 text-slate-500 border-slate-200' },
};

const todayStr = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD theo giờ máy

const ParentAppointments = () => {
  const { currentUser } = useAuth();
  const { children } = useChildren(currentUser?.id);

  const [tab, setTab] = useState('new'); // 'new' | 'history'
  const [form, setForm] = useState({ studentId: '', topic: 'lo-trinh', date: '', slot: TIME_SLOTS[0], content: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [myAppointments, setMyAppointments] = useState([]);
  const [cancelTarget, setCancelTarget] = useState(null);

  // Điền sẵn SĐT từ hồ sơ + con đầu tiên
  useEffect(() => {
    setForm(f => ({ ...f, phone: f.phone || currentUser?.phone || '' }));
  }, [currentUser?.phone]);
  useEffect(() => {
    if (children.length && !form.studentId) setForm(f => ({ ...f, studentId: children[0].id }));
  }, [children.map(c => c.id).join(',')]);

  // Lịch sử lịch hẹn của mình
  useEffect(() => {
    if (!currentUser?.id) return;
    const unsub = onValue(ref(db, `appointments/${currentUser.id}`), (snap) => {
      const data = snap.val() || {};
      const list = Object.entries(data)
        .map(([id, val]) => ({ id, ...val }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setMyAppointments(list);
    });
    return () => unsub();
  }, [currentUser?.id]);

  // Mở tab lịch sử → đánh dấu đã xem cập nhật (xóa badge)
  useEffect(() => {
    if (tab !== 'history' || !currentUser?.id) return;
    myAppointments.forEach(a => {
      if (a.parentUnread) {
        update(ref(db, `appointments/${currentUser.id}/${a.id}`), { parentUnread: 0 }).catch(() => {});
      }
    });
  }, [tab, myAppointments, currentUser?.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!form.date) return setErrorMsg('Vui lòng chọn ngày mong muốn.');
    if (form.date < todayStr()) return setErrorMsg('Ngày hẹn phải từ hôm nay trở đi.');
    if (!form.content.trim()) return setErrorMsg('Vui lòng mô tả nội dung cần trao đổi.');

    setSubmitting(true);
    try {
      const child = children.find(c => c.id === form.studentId) || null;
      const topicLabel = TOPICS.find(t => t.id === form.topic)?.label || form.topic;
      const newRef = push(ref(db, `appointments/${currentUser.id}`));
      await set(newRef, {
        parentId:      currentUser.id,
        parentName:    currentUser.name || 'Phụ huynh',
        phone:         form.phone.trim(),
        studentId:     child?.id || null,
        studentName:   child?.name || null,
        studentCode:   child?.studentCode || null,
        classIds:      child ? normClassIds(child.classIds) : [],
        topic:         form.topic,
        topicLabel,
        preferredDate: form.date,
        preferredSlot: form.slot,
        content:       form.content.trim(),
        status:        'pending',
        createdAt:     new Date().toISOString(),
        parentUnread:  0,
      });
      setSuccessMsg('Đã gửi yêu cầu đặt lịch. Phòng Đào tạo sẽ xác nhận sớm nhất!');
      setForm(f => ({ ...f, date: '', content: '' }));
      setTab('history');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg('Lỗi khi gửi: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const confirmCancel = async () => {
    const a = cancelTarget;
    setCancelTarget(null);
    try {
      await update(ref(db, `appointments/${currentUser.id}/${a.id}`), {
        status: 'cancelled',
        cancelledBy: 'parent',
        cancelledAt: new Date().toISOString(),
      });
    } catch (err) { console.error(err); }
  };

  const fmtDate = (d) => { try { return new Date(d + 'T00:00:00').toLocaleDateString('vi-VN'); } catch { return d; } };

  return (
    <div className="space-y-6 pb-20 animate-fade-in-up">
      {successMsg && (
        <div className="toast-success">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
          {successMsg}
        </div>
      )}

      {/* Xác nhận hủy lịch */}
      {cancelTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4 border border-slate-100">
            <p className="text-base font-bold text-slate-800">Hủy lịch hẹn này?</p>
            <p className="text-sm text-slate-500">{cancelTarget.topicLabel} · {fmtDate(cancelTarget.preferredDate)}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setCancelTarget(null)} className="btn-secondary">Giữ lịch</button>
              <button onClick={confirmCancel} className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition-colors">Hủy lịch</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
        <div className="p-2 bg-primary-light rounded-xl text-primary">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
        </div>
        <div>
          <h2 className="page-title">Lịch hẹn hỗ trợ</h2>
          <p className="page-sub">Đặt lịch trao đổi trực tiếp với phòng Đào tạo Định Năng.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {[{ id: 'new', label: '📅 Đặt lịch mới' }, { id: 'history', label: `📋 Lịch của tôi (${myAppointments.length})` }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${tab === t.id ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ===== FORM ĐẶT LỊCH ===== */}
      {tab === 'new' && (
        <div className="card-std p-5 md:p-6 max-w-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            {errorMsg && (
              <div className="alert-error">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0 mt-0.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                {errorMsg}
              </div>
            )}

            {children.length > 0 && (
              <div>
                <label className="stat-label block mb-1.5">Về học viên</label>
                <select className="input-base" value={form.studentId} onChange={e => setForm({ ...form, studentId: e.target.value })}>
                  {children.map(c => <option key={c.id} value={c.id}>{c.name} ({c.studentCode || '–'})</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="stat-label block mb-2">Chủ đề trao đổi</label>
              <div className="flex flex-wrap gap-2">
                {TOPICS.map(t => (
                  <button key={t.id} type="button" onClick={() => setForm({ ...form, topic: t.id })}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${form.topic === t.id ? 'bg-primary-light text-green-800 border-green-300 ring-2 ring-offset-1 ring-primary/30' : 'bg-white text-slate-400 border-slate-200'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="stat-label block mb-1.5">Ngày mong muốn *</label>
                <input type="date" className="input-base" min={todayStr()} value={form.date}
                  onChange={e => { setForm({ ...form, date: e.target.value }); setErrorMsg(''); }} />
              </div>
              <div>
                <label className="stat-label block mb-1.5">Khung giờ</label>
                <select className="input-base" value={form.slot} onChange={e => setForm({ ...form, slot: e.target.value })}>
                  {TIME_SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="stat-label block mb-1.5">Số điện thoại liên hệ</label>
              <input className="input-base" placeholder="09xx xxx xxx" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>

            <div>
              <label className="stat-label block mb-1.5">Nội dung cần trao đổi *</label>
              <textarea className="input-base resize-none" rows={4}
                placeholder="Ba Mẹ mô tả ngắn gọn điều muốn trao đổi để phòng Đào tạo chuẩn bị chu đáo..."
                value={form.content} onChange={e => { setForm({ ...form, content: e.target.value }); setErrorMsg(''); }} />
            </div>

            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? 'Đang gửi...' : '📅 Gửi yêu cầu đặt lịch'}
            </button>
            <p className="text-[11px] text-slate-400 text-center">Phòng Đào tạo sẽ liên hệ xác nhận qua điện thoại hoặc thông báo trong app. Hotline: <b>088 699 7099</b></p>
          </form>
        </div>
      )}

      {/* ===== LỊCH SỬ ===== */}
      {tab === 'history' && (
        <div className="space-y-3 max-w-2xl">
          {myAppointments.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-10 text-center">
              <p className="text-slate-400 text-sm font-medium">Ba Mẹ chưa đặt lịch hẹn nào.</p>
              <button onClick={() => setTab('new')} className="mt-3 text-primary text-sm font-bold hover:underline">Đặt lịch đầu tiên →</button>
            </div>
          ) : myAppointments.map(a => {
            const st = STATUS_MAP[a.status] || STATUS_MAP.pending;
            return (
              <div key={a.id} className="card-std p-4 md:p-5 space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded border ${st.color}`}>{st.label}</span>
                  <span className="text-[10px] font-bold px-2 py-1 rounded border bg-slate-50 text-slate-600 border-slate-200">{a.topicLabel}</span>
                  {a.studentName && <span className="text-[10px] font-bold px-2 py-1 rounded border bg-primary-subtle text-primary border-green-100">👧 {a.studentName}</span>}
                  <span className="text-[11px] text-slate-400 font-mono ml-auto">Gửi {new Date(a.createdAt).toLocaleDateString('vi-VN')}</span>
                </div>
                <p className="text-sm font-bold text-slate-800">
                  🗓 {fmtDate(a.preferredDate)} · {a.preferredSlot}
                </p>
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{a.content}</p>
                {a.staffNote && (
                  <div className="bg-primary-light/60 border border-green-100 rounded-xl px-3.5 py-2.5">
                    <p className="text-[10px] font-bold text-green-700 uppercase mb-0.5">Phản hồi từ phòng Đào tạo{a.handledBy ? ` · ${a.handledBy}` : ''}</p>
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{a.staffNote}</p>
                  </div>
                )}
                {a.status === 'pending' && (
                  <button onClick={() => setCancelTarget(a)} className="text-red-500 text-xs font-bold hover:underline">Hủy lịch hẹn</button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ParentAppointments;
