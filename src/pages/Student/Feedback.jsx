import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { ref, push, set, onValue, get } from 'firebase/database';
import emailjs from '@emailjs/browser';

// ============================================================
// CẤU HÌNH EMAILJS — điền credentials của bạn vào đây
// ============================================================
const EMAILJS_SERVICE_ID  = 'service_gvlyalu';
const EMAILJS_TEMPLATE_ID = 'template_yi89u66';
const EMAILJS_PUBLIC_KEY  = 'Tq7e72DxJoSIlhIU4';
const ADMIN_EMAIL         = 'support@beablevn.com';

// Danh mục phản ánh
const CATEGORIES = [
  { id: 'hoc-tap',    label: '📚 Học tập',          color: 'bg-[#E8F4EC] text-green-700 border-green-200' },
  { id: 'giao-vien',  label: '👨‍🏫 Giáo viên',        color: 'bg-[#1E5225]/10 text-[#1E5225] border-[#1E5225]/25' },
  { id: 'co-so',      label: '🏫 Cơ sở vật chất',   color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { id: 'khac',       label: '💬 Khác',              color: 'bg-slate-50 text-slate-600 border-slate-200' },
];

const STATUS_MAP = {
  pending:  { label: 'Chờ xử lý',  color: 'bg-amber-50 text-amber-700 border-amber-200' },
  read:     { label: 'Đã xem',     color: 'bg-[#E8F4EC] text-green-700 border-green-200' },
  resolved: { label: 'Đã xử lý',  color: 'bg-green-50 text-green-700 border-green-200' },
};

const Feedback = () => {
  const { currentUser } = useAuth();

  const [tab, setTab] = useState('new'); // 'new' | 'history'
  const [form, setForm] = useState({ category: 'hoc-tap', title: '', content: '', isAnonymous: false });
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [myFeedbacks, setMyFeedbacks] = useState([]);
  const [expandedId, setExpandedId] = useState(null);

  // Lấy lịch sử phản ánh của học viên
  useEffect(() => {
    if (!currentUser?.id) return;
    const fbRef = ref(db, 'feedback');
    const unsub = onValue(fbRef, (snap) => {
      const data = snap.val() || {};
      const list = Object.entries(data)
        .map(([id, val]) => ({ id, ...val }))
        .filter(f => f.studentId === currentUser.id)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      setMyFeedbacks(list);
    });
    return () => unsub();
  }, [currentUser?.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!form.title.trim() || !form.content.trim()) {
      setErrorMsg('Vui lòng điền tiêu đề và nội dung.'); return;
    }

    setSubmitting(true);
    try {
      // 1. Lưu vào Firebase
      const newRef = push(ref(db, 'feedback'));
      const feedbackPayload = {
        studentId:    currentUser.id,
        studentName:  form.isAnonymous ? 'Ẩn danh' : currentUser.name,
        studentCode:  form.isAnonymous ? '' : (currentUser.studentCode || ''),
        classIds:     currentUser.classIds || [],
        category:     form.category,
        title:        form.title.trim(),
        content:      form.content.trim(),
        isAnonymous:  form.isAnonymous,
        date:         new Date().toISOString(),
        status:       'pending',
        staffReply:   null,
        replyDate:    null,
        replyBy:      null,
      };
      await set(newRef, feedbackPayload);

      // 2. Gửi email thông báo về support@beablevn.com qua EmailJS
      const catLabel = CATEGORIES.find(c => c.id === form.category)?.label || form.category;
      const classIds = Array.isArray(currentUser.classIds)
        ? currentUser.classIds
        : Object.values(currentUser.classIds || {});

      // Lấy tên lớp để đưa vào email
      let classNameStr = '';
      try {
        const classSnap = await get(ref(db, 'classes'));
        const classData = classSnap.val() || {};
        classNameStr = classIds.map(id => classData[id]?.name || id).join(', ');
      } catch (_) {}

      // Gửi email — chỉ gửi nếu đã cấu hình credentials
      if (EMAILJS_SERVICE_ID !== 'YOUR_SERVICE_ID') {
        await emailjs.send(
          EMAILJS_SERVICE_ID,
          EMAILJS_TEMPLATE_ID,
          {
            to_email:     ADMIN_EMAIL,
            subject:      `[Phản ánh mới] ${form.title.trim()}`,
            student_name: form.isAnonymous ? 'Ẩn danh' : currentUser.name,
            student_code: form.isAnonymous ? '' : (currentUser.studentCode || ''),
            class_name:   classNameStr || '—',
            category:     catLabel,
            title:        form.title.trim(),
            content:      form.content.trim(),
            date:         new Date().toLocaleString('vi-VN'),
          },
          EMAILJS_PUBLIC_KEY
        );
      }

      // 3. Tạo in-app notification cho GV/CCO phụ trách lớp
      // Lấy danh sách staff phụ trách lớp học viên
      try {
        const usersSnap = await get(ref(db, 'users'));
        const usersData = usersSnap.val() || {};
        const staffToNotify = Object.entries(usersData)
          .map(([id, val]) => ({ id, ...val }))
          .filter(u => {
            if (u.role !== 'staff' && u.role !== 'admin') return false;
            if (u.role === 'admin') return true; // Admin luôn nhận
            const assigned = u.assignedClasses || [];
            return assigned.some(cid => classIds.includes(cid));
          });

        // Ghi notification cho từng người
        const notifPromises = staffToNotify.map(staff => {
          const nRef = push(ref(db, 'staffNotifications'));
          return set(nRef, {
            toUserId:    staff.id,
            type:        'feedback',
            title:       `Phản ánh mới: ${form.title.trim()}`,
            preview:     form.content.trim().substring(0, 80),
            from:        form.isAnonymous ? 'Ẩn danh' : currentUser.name,
            date:        new Date().toISOString(),
            isRead:      false,
            feedbackId:  newRef.key,
          });
        });
        await Promise.all(notifPromises);
      } catch (_) {
        // Không block flow chính nếu notification lỗi
      }

      setSuccessMsg('Phản ánh của bạn đã được gửi thành công!');
      setForm({ category: 'hoc-tap', title: '', content: '', isAnonymous: false });
      setTab('history');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg('Lỗi khi gửi: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const catInfo = (id) => CATEGORIES.find(c => c.id === id) || CATEGORIES[3];

  return (
    <div className="space-y-6 pb-20">

      {/* Flash success */}
      {successMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
          {successMsg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
        <div className="p-2 bg-orange-50 rounded-xl text-orange-500">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#2B6830]">Phản ánh</h2>
          <p className="text-xs text-slate-400 mt-0.5">Ý kiến của bạn giúp chúng tôi cải thiện chất lượng dạy và học.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {[{ id: 'new', label: '✏️ Gửi phản ánh' }, { id: 'history', label: `📋 Lịch sử (${myFeedbacks.length})` }].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${tab === t.id ? 'bg-white text-[#2B6830] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* === FORM GỬI MỚI === */}
      {tab === 'new' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6 max-w-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">

            {errorMsg && (
              <div className="flex items-start gap-2 bg-red-50 text-red-700 border border-red-200 px-4 py-3 rounded-xl text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0 mt-0.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                {errorMsg}
              </div>
            )}

            {/* Danh mục */}
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Danh mục</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setForm({ ...form, category: cat.id })}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                      form.category === cat.id ? cat.color + ' ring-2 ring-offset-1 ring-[#2B6830]/30' : 'bg-white text-slate-400 border-slate-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tiêu đề */}
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Tiêu đề *</label>
              <input
                className="w-full border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10 transition"
                placeholder="Tóm tắt vấn đề bạn muốn phản ánh..."
                value={form.title}
                onChange={e => { setForm({ ...form, title: e.target.value }); setErrorMsg(''); }}
                maxLength={100}
              />
              <p className="text-xs text-slate-300 text-right mt-1">{form.title.length}/100</p>
            </div>

            {/* Nội dung */}
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Nội dung chi tiết *</label>
              <textarea
                className="w-full border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10 resize-none transition"
                rows={5}
                placeholder="Mô tả chi tiết vấn đề, thời gian xảy ra, và kỳ vọng của bạn..."
                value={form.content}
                onChange={e => { setForm({ ...form, content: e.target.value }); setErrorMsg(''); }}
              />
            </div>

            {/* Ẩn danh */}
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                className="w-4 h-4 accent-[#2B6830] rounded"
                checked={form.isAnonymous}
                onChange={e => setForm({ ...form, isAnonymous: e.target.checked })}
              />
              <span className="text-sm text-slate-500 group-hover:text-slate-700 transition-colors select-none">
                Gửi ẩn danh (tên bạn sẽ không hiển thị với giáo viên)
              </span>
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#2B6830] text-white py-3 rounded-xl font-bold hover:bg-[#1E5225] transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <><svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Đang gửi...</>
              ) : '📤 Gửi phản ánh'}
            </button>
          </form>
        </div>
      )}

      {/* === LỊCH SỬ === */}
      {tab === 'history' && (
        <div className="space-y-3 max-w-2xl">
          {myFeedbacks.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-10 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="#cbd5e1" className="w-12 h-12 mx-auto mb-3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <p className="text-slate-400 text-sm font-medium">Bạn chưa gửi phản ánh nào.</p>
              <button onClick={() => setTab('new')} className="mt-3 text-[#2B6830] text-sm font-bold hover:underline">Gửi phản ánh đầu tiên →</button>
            </div>
          ) : myFeedbacks.map(fb => {
            const cat = catInfo(fb.category);
            const st = STATUS_MAP[fb.status] || STATUS_MAP.pending;
            const isOpen = expandedId === fb.id;
            return (
              <div key={fb.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <button
                  className="w-full p-4 text-left flex items-start gap-3 hover:bg-slate-50 transition-colors"
                  onClick={() => setExpandedId(isOpen ? null : fb.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap gap-2 mb-1.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${cat.color}`}>{cat.label}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${st.color}`}>{st.label}</span>
                    </div>
                    <p className="font-bold text-slate-800 text-sm truncate">{fb.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{new Date(fb.date).toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric' })}</p>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#94a3b8" className={`w-4 h-4 shrink-0 mt-1 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 border-t border-slate-100 space-y-3">
                    {/* Nội dung phản ánh */}
                    <div className="bg-slate-50 rounded-xl p-3 mt-3">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Nội dung</p>
                      <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{fb.content}</p>
                    </div>

                    {/* Phản hồi từ nhà trường */}
                    {fb.staffReply ? (
                      <div className="bg-[#E8F4EC] border border-green-200 rounded-xl p-3">
                        <p className="text-xs font-bold text-green-600 uppercase tracking-wider mb-1.5">
                          Phản hồi từ {fb.replyBy || 'Nhà trường'} · {fb.replyDate && new Date(fb.replyDate).toLocaleDateString('vi-VN')}
                        </p>
                        <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{fb.staffReply}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic px-1">Chưa có phản hồi từ nhà trường.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Feedback;
