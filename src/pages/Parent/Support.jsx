import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { ref, push, set, onValue, get, update } from 'firebase/database';
import emailjs from '@emailjs/browser';
import { useChildren } from './useChildren';
import { normClassIds } from '../../utils/contactBook';

// ============================================================
// HỖ TRỢ & PHẢN ÁNH (cổng Phụ huynh)
// Dùng chung node `feedback` với học viên để GV/Giáo vụ xử lý trong
// Hộp thư sẵn có; đánh dấu senderRole='parent' để staff nhận diện.
// classIds = gộp lớp của các con → đúng GV phụ trách nhìn thấy.
// ============================================================

const EMAILJS_SERVICE_ID  = 'service_gvlyalu';
const EMAILJS_TEMPLATE_ID = 'template_yi89u66';
const EMAILJS_PUBLIC_KEY  = 'Tq7e72DxJoSIlhIU4';
const ADMIN_EMAIL         = 'support@beablevn.com';

const CATEGORIES = [
  { id: 'hoc-tap',   label: '📚 Học tập',          color: 'bg-primary-light text-green-700 border-green-200' },
  { id: 'giao-vien', label: '👨‍🏫 Giáo viên',        color: 'bg-primary-hover/10 text-primary-hover border-primary-hover/25' },
  { id: 'hoc-phi',   label: '💰 Học phí',           color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  { id: 'co-so',     label: '🏫 Cơ sở vật chất',   color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { id: 'khac',      label: '💬 Khác',              color: 'bg-slate-50 text-slate-600 border-slate-200' },
];

const STATUS_MAP = {
  pending:  { label: 'Chờ xử lý', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  read:     { label: 'Đã xem',    color: 'bg-primary-light text-green-700 border-green-200' },
  resolved: { label: 'Đã xử lý',  color: 'bg-green-50 text-green-700 border-green-200' },
};

const buildThread = (fb) => {
  if (Array.isArray(fb.thread) && fb.thread.length) return fb.thread;
  const t = [{ from: 'student', name: fb.studentName, content: fb.content, date: fb.date }];
  if (fb.staffReply) t.push({ from: 'staff', name: fb.replyBy || 'Nhà trường', content: fb.staffReply, date: fb.replyDate });
  return t;
};

const ParentSupport = () => {
  const { currentUser } = useAuth();
  const { children } = useChildren(currentUser?.id);

  const [tab, setTab] = useState('new');
  const [form, setForm] = useState({ category: 'hoc-tap', title: '', content: '' });
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [myFeedbacks, setMyFeedbacks] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  useEffect(() => {
    if (!currentUser?.id) return;
    const unsub = onValue(ref(db, 'feedback'), (snap) => {
      const data = snap.val() || {};
      const list = Object.entries(data)
        .map(([id, val]) => ({ id, ...val }))
        .filter(f => f.studentId === currentUser.id)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      setMyFeedbacks(list);
    });
    return () => unsub();
  }, [currentUser?.id]);

  const toggleHistoryItem = async (fb) => {
    const opening = expandedId !== fb.id;
    setExpandedId(opening ? fb.id : null);
    setReplyText('');
    if (opening && fb.studentUnread) {
      try { await update(ref(db, `feedback/${fb.id}`), { studentUnread: 0 }); } catch (_) {}
    }
  };

  const handleReply = async (fb) => {
    if (!replyText.trim()) return;
    setSendingReply(true);
    try {
      const now = new Date().toISOString();
      const newThread = [...buildThread(fb), { from: 'student', name: currentUser.name, content: replyText.trim(), date: now }];
      await update(ref(db, `feedback/${fb.id}`), {
        thread:      newThread,
        staffUnread: (fb.staffUnread || 0) + 1,
        status:      fb.status === 'resolved' ? 'pending' : fb.status,
      });
      setReplyText('');
    } catch (err) { console.error(err); }
    finally { setSendingReply(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!form.title.trim() || !form.content.trim()) {
      setErrorMsg('Vui lòng điền tiêu đề và nội dung.'); return;
    }

    setSubmitting(true);
    try {
      const classIds = [...new Set(children.flatMap(c => normClassIds(c.classIds)))];
      const childNames = children.map(c => c.name).filter(Boolean).join(', ');
      const nowIso = new Date().toISOString();
      const newRef = push(ref(db, 'feedback'));
      await set(newRef, {
        studentId:    currentUser.id,          // uid người gửi (phụ huynh), khớp cơ chế thread/badge sẵn có
        studentName:  currentUser.name,
        studentCode:  '',
        senderRole:   'parent',                // để Hộp thư staff nhận diện phản ánh từ phụ huynh
        childNames,
        classIds,
        category:     form.category,
        title:        form.title.trim(),
        content:      form.content.trim(),
        isAnonymous:  false,
        date:         nowIso,
        status:       'pending',
        staffReply:   null,
        replyDate:    null,
        replyBy:      null,
        thread:       [{ from: 'student', name: currentUser.name, content: form.content.trim(), date: nowIso }],
        studentUnread: 0,
        staffUnread:   1,
      });

      // Email về hộp thư hỗ trợ (không chặn flow chính nếu lỗi)
      try {
        const catLabel = CATEGORIES.find(c => c.id === form.category)?.label || form.category;
        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
          to_email:     ADMIN_EMAIL,
          subject:      `[Phụ huynh] ${form.title.trim()}`,
          student_name: `PH ${currentUser.name}${childNames ? ` (con: ${childNames})` : ''}`,
          student_code: currentUser.phone || '',
          class_name:   '–',
          category:     catLabel,
          title:        form.title.trim(),
          content:      form.content.trim(),
          date:         new Date().toLocaleString('vi-VN'),
        }, EMAILJS_PUBLIC_KEY);
      } catch (_) {}

      // In-app notification cho GV/CCO phụ trách lớp các con + admin
      try {
        const usersSnap = await get(ref(db, 'usersPublic'));
        const usersData = usersSnap.val() || {};
        const staffToNotify = Object.entries(usersData)
          .map(([id, val]) => ({ id, ...val }))
          .filter(u => {
            if (u.role !== 'staff' && u.role !== 'admin') return false;
            if (u.role === 'admin') return true;
            const assigned = u.assignedClasses || [];
            return assigned.some(cid => classIds.includes(cid));
          });
        await Promise.all(staffToNotify.map(staff => set(push(ref(db, 'staffNotifications')), {
          toUserId:   staff.id,
          type:       'feedback',
          title:      `Phản ánh từ Phụ huynh: ${form.title.trim()}`,
          preview:    form.content.trim().substring(0, 80),
          from:       `PH ${currentUser.name}`,
          date:       new Date().toISOString(),
          isRead:     false,
          feedbackId: newRef.key,
        })));
      } catch (_) {}

      setSuccessMsg('Đã gửi thành công! Nhà trường sẽ phản hồi sớm nhất.');
      setForm({ category: 'hoc-tap', title: '', content: '' });
      setTab('history');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg('Lỗi khi gửi: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const catInfo = (id) => CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1];

  return (
    <div className="space-y-6 pb-20 animate-fade-in-up">
      {successMsg && (
        <div className="toast-success">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
          {successMsg}
        </div>
      )}

      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
        <div className="p-2 bg-primary-light rounded-xl text-primary">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
          </svg>
        </div>
        <div>
          <h2 className="page-title">Hỗ trợ & Phản ánh</h2>
          <p className="page-sub">Ý kiến của Ba Mẹ giúp Định Năng đồng hành cùng con tốt hơn.</p>
        </div>
      </div>

      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {[{ id: 'new', label: '✏️ Gửi yêu cầu' }, { id: 'history', label: `📋 Lịch sử (${myFeedbacks.length})` }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${tab === t.id ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* === FORM GỬI MỚI === */}
      {tab === 'new' && (
        <div className="card-std p-5 md:p-6 max-w-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            {errorMsg && (
              <div className="alert-error">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0 mt-0.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                {errorMsg}
              </div>
            )}

            <div>
              <label className="stat-label block mb-2">Danh mục</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(cat => (
                  <button key={cat.id} type="button" onClick={() => setForm({ ...form, category: cat.id })}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${form.category === cat.id ? cat.color + ' ring-2 ring-offset-1 ring-primary/30' : 'bg-white text-slate-400 border-slate-200'}`}>
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="stat-label block mb-1.5">Tiêu đề *</label>
              <input className="input-base" placeholder="Tóm tắt vấn đề Ba Mẹ cần hỗ trợ..." value={form.title}
                onChange={e => { setForm({ ...form, title: e.target.value }); setErrorMsg(''); }} maxLength={100} />
              <p className="text-xs text-slate-300 text-right mt-1">{form.title.length}/100</p>
            </div>

            <div>
              <label className="stat-label block mb-1.5">Nội dung chi tiết *</label>
              <textarea className="input-base resize-none" rows={5}
                placeholder="Mô tả chi tiết vấn đề, thời gian xảy ra và mong muốn của Ba Mẹ..."
                value={form.content} onChange={e => { setForm({ ...form, content: e.target.value }); setErrorMsg(''); }} />
            </div>

            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? 'Đang gửi...' : '📤 Gửi yêu cầu hỗ trợ'}
            </button>
          </form>
        </div>
      )}

      {/* === LỊCH SỬ === */}
      {tab === 'history' && (
        <div className="space-y-3 max-w-2xl">
          {myFeedbacks.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-10 text-center">
              <p className="text-slate-400 text-sm font-medium">Ba Mẹ chưa gửi yêu cầu nào.</p>
              <button onClick={() => setTab('new')} className="mt-3 text-primary text-sm font-bold hover:underline">Gửi yêu cầu đầu tiên →</button>
            </div>
          ) : myFeedbacks.map(fb => {
            const cat = catInfo(fb.category);
            const st = STATUS_MAP[fb.status] || STATUS_MAP.pending;
            const isOpen = expandedId === fb.id;
            return (
              <div key={fb.id} className="card-std overflow-hidden">
                <button className="w-full p-4 text-left flex items-start gap-3 hover:bg-slate-50 transition-colors" onClick={() => toggleHistoryItem(fb)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap gap-2 mb-1.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${cat.color}`}>{cat.label}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${st.color}`}>{st.label}</span>
                      {fb.studentUnread > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500 text-white">{fb.studentUnread} phản hồi mới</span>
                      )}
                    </div>
                    <p className="font-bold text-slate-800 text-sm truncate">{fb.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{new Date(fb.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#94a3b8" className={`w-4 h-4 shrink-0 mt-1 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 border-t border-slate-100 space-y-3">
                    <div className="space-y-2 mt-3">
                      {buildThread(fb).map((m, i) => {
                        const isMine = m.from === 'student';
                        return (
                          <div key={i} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${isMine ? 'bg-primary text-white rounded-br-sm' : 'bg-primary-light text-slate-800 rounded-bl-sm border border-green-100'}`}>
                              <p className={`text-[10px] font-bold mb-0.5 ${isMine ? 'text-green-200' : 'text-green-700'}`}>{isMine ? 'Ba Mẹ' : `Phản hồi từ ${m.name || 'Nhà trường'}`}</p>
                              <p className="leading-relaxed whitespace-pre-line">{m.content}</p>
                              <p className={`text-[10px] mt-1 ${isMine ? 'text-green-200' : 'text-slate-400'}`}>{m.date && new Date(m.date).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex gap-2 pt-1">
                      <input
                        className="flex-1 border border-slate-200 px-4 py-2.5 rounded-xl text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
                        placeholder="Nhập trả lời cho nhà trường..."
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(fb); } }}
                      />
                      <button onClick={() => handleReply(fb)} disabled={!replyText.trim() || sendingReply} className="btn-primary shrink-0">
                        {sendingReply ? '...' : 'Gửi'}
                      </button>
                    </div>
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

export default ParentSupport;
