import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { ref, push, set, onValue, update } from 'firebase/database';

const Contact = () => {
  const { currentUser } = useAuth();

  const [staffList, setStaffList] = useState([]);       // GV/CCO phụ trách lớp học viên
  const [conversations, setConversations] = useState([]); // thread đã có
  const [selectedConv, setSelectedConv] = useState(null); // thread đang xem
  const [newMsg, setNewMsg] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [firstMsg, setFirstMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [view, setView] = useState('inbox'); // 'inbox' | 'new'
  const messagesEndRef = useRef(null);

  const studentClassIds = currentUser?.classIds
    ? (Array.isArray(currentUser.classIds) ? currentUser.classIds : Object.values(currentUser.classIds))
    : [];

  // Lấy danh sách GV/CCO phụ trách lớp của học viên
  useEffect(() => {
    if (!currentUser?.id) return;
    const unsubUsers = onValue(ref(db, 'usersPublic'), (snap) => { // danh bạ công khai (name/role/subRole/assignedClasses)
      const data = snap.val() || {};
      const staff = Object.entries(data)
        .map(([id, val]) => ({ id, ...val }))
        .filter(u => {
          if (u.role !== 'staff') return false;
          const assigned = u.assignedClasses || [];
          return assigned.some(cid => studentClassIds.includes(cid));
        });
      setStaffList(staff);
    });
    return () => unsubUsers();
  }, [currentUser?.id]);

  // Lấy các conversation liên quan đến học viên này
  useEffect(() => {
    if (!currentUser?.id) return;
    const unsubConv = onValue(ref(db, 'messages'), (snap) => {
      const data = snap.val() || {};
      const list = Object.entries(data)
        .map(([id, val]) => ({ id, ...val }))
        .filter(c => c.studentId === currentUser.id)
        .sort((a, b) => new Date(b.lastDate) - new Date(a.lastDate));
      setConversations(list);
    });
    return () => unsubConv();
  }, [currentUser?.id]);

  // Đồng bộ thread đang mở với dữ liệu realtime:
  // khi 'conversations' cập nhật (có tin nhắn mới), gắn lại selectedConv
  // bằng bản mới nhất -> tin nhắn tự hiện, không cần load lại trang
  useEffect(() => {
    if (!selectedConv) return;
    const fresh = conversations.find(c => c.id === selectedConv.id);
    if (fresh && (fresh.lastDate !== selectedConv.lastDate
        || (fresh.thread?.length || 0) !== (selectedConv.thread?.length || 0))) {
      setSelectedConv(fresh);
    }
  }, [conversations]);

  // Cuộn xuống cuối khi mở conversation
  useEffect(() => {
    if (selectedConv) {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [selectedConv]);

  // Tạo conversation mới
  const handleNewConversation = async (e) => {
    e.preventDefault();
    if (!selectedRecipient || !subject.trim() || !firstMsg.trim()) return;
    const recipient = staffList.find(s => s.id === selectedRecipient);
    if (!recipient) return;

    setSending(true);
    try {
      const newRef = push(ref(db, 'messages'));
      const payload = {
        studentId:      currentUser.id,
        studentName:    currentUser.name,
        studentCode:    currentUser.studentCode || '',
        recipientId:    recipient.id,
        recipientName:  recipient.name,
        recipientRole:  recipient.subRole || 'staff',
        subject:        subject.trim(),
        lastDate:       new Date().toISOString(),
        lastMessage:    firstMsg.trim(),
        studentUnread:  0,
        staffUnread:    1,
        thread: [{
          from:     'student',
          fromName: currentUser.name,
          content:  firstMsg.trim(),
          date:     new Date().toISOString(),
        }],
      };
      await set(newRef, payload);
      setSubject(''); setFirstMsg(''); setSelectedRecipient('');
      setView('inbox');
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  // Gửi tin nhắn trong thread
  const handleReply = async () => {
    if (!newMsg.trim() || !selectedConv) return;
    setSending(true);
    try {
      const updatedThread = [
        ...(selectedConv.thread || []),
        { from: 'student', fromName: currentUser.name, content: newMsg.trim(), date: new Date().toISOString() },
      ];
      await update(ref(db, `messages/${selectedConv.id}`), {
        thread:       updatedThread,
        lastDate:     new Date().toISOString(),
        lastMessage:  newMsg.trim(),
        staffUnread:  (selectedConv.staffUnread || 0) + 1,
        studentUnread: 0,
      });
      setNewMsg('');
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  // Đánh dấu đã đọc khi mở conversation
  const openConversation = async (conv) => {
    setSelectedConv(conv);
    if (conv.studentUnread > 0) {
      await update(ref(db, `messages/${conv.id}`), { studentUnread: 0 });
    }
  };

  const totalUnread = conversations.reduce((sum, c) => sum + (c.studentUnread || 0), 0);

  return (
    <div className="space-y-6 pb-20">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
          </div>
          <div>
            <h2 className="page-title">Liên hệ</h2>
            <p className="page-sub">Nhắn tin trực tiếp đến giáo viên hoặc CCO phụ trách.</p>
          </div>
        </div>
        <button
          onClick={() => { setView(view === 'new' ? 'inbox' : 'new'); setSelectedConv(null); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border transition-all ${view === 'new' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-primary text-white border-primary hover:bg-primary-hover'}`}
        >
          {view === 'new' ? '← Quay lại' : (
            <><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>Tin nhắn mới</>
          )}
        </button>
      </div>

      {/* === FORM TIN NHẮN MỚI === */}
      {view === 'new' && (
        <div className="card-std p-5 md:p-6 max-w-2xl">
          <h3 className="font-bold text-primary mb-4">Gửi tin nhắn mới</h3>
          <form onSubmit={handleNewConversation} className="space-y-4">
            <div>
              <label className="stat-label block mb-1.5">Gửi đến *</label>
              <select
                className="input-base"
                value={selectedRecipient}
                onChange={e => setSelectedRecipient(e.target.value)}
                required
              >
                <option value="">-- Chọn giáo viên / CCO --</option>
                {staffList.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.subRole === 'cco' ? 'CCO' : s.subRole === 'cca' ? 'CCA' : 'Giáo viên'})
                  </option>
                ))}
              </select>
              {staffList.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">Chưa có giáo viên nào được phân công vào lớp của bạn.</p>
              )}
            </div>
            <div>
              <label className="stat-label block mb-1.5">Tiêu đề *</label>
              <input
                className="input-base"
                placeholder="VD: Hỏi về bài tập tuần này"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="stat-label block mb-1.5">Nội dung *</label>
              <textarea
                className="input-base resize-none"
                rows={4}
                placeholder="Nhập nội dung tin nhắn..."
                value={firstMsg}
                onChange={e => setFirstMsg(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              disabled={sending || staffList.length === 0}
              className="btn-primary w-full"
            >
              {sending ? 'Đang gửi...' : '📨 Gửi tin nhắn'}
            </button>
          </form>
        </div>
      )}

      {/* === INBOX === */}
      {view === 'inbox' && !selectedConv && (
        <div className="max-w-2xl space-y-2">
          {conversations.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-10 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="#cbd5e1" className="w-12 h-12 mx-auto mb-3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
              </svg>
              <p className="text-slate-400 text-sm font-medium">Chưa có cuộc trò chuyện nào.</p>
              <button onClick={() => setView('new')} className="mt-3 text-primary text-sm font-bold hover:underline">Gửi tin nhắn đầu tiên →</button>
            </div>
          ) : conversations.map(conv => (
            <button
              key={conv.id}
              onClick={() => openConversation(conv)}
              className="w-full card-std p-4 text-left hover:shadow-md hover:border-green-100 transition-all flex items-start gap-3"
            >
              {/* Avatar GV */}
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center shrink-0">
                {conv.recipientName?.charAt(0) || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-0.5">
                  <p className="font-bold text-slate-800 text-sm truncate">{conv.recipientName}</p>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {conv.studentUnread > 0 && (
                      <span className="w-5 h-5 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center">{conv.studentUnread}</span>
                    )}
                    <span className="text-[10px] text-slate-400">{new Date(conv.lastDate).toLocaleDateString('vi-VN')}</span>
                  </div>
                </div>
                <p className="text-xs font-bold text-slate-500 truncate">{conv.subject}</p>
                <p className="text-xs text-slate-400 truncate mt-0.5">{conv.lastMessage}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* === CONVERSATION THREAD === */}
      {view === 'inbox' && selectedConv && (
        <div className="max-w-2xl">
          <button
            onClick={() => setSelectedConv(null)}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary mb-4 transition-colors font-medium"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
            Quay lại
          </button>

          <div className="card-std overflow-hidden">
            {/* Header cuộc trò chuyện */}
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <p className="font-bold text-primary">{selectedConv.subject}</p>
              <p className="text-xs text-slate-400 mt-0.5">Với {selectedConv.recipientName}</p>
            </div>

            {/* Messages */}
            <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
              {(selectedConv.thread || []).map((msg, i) => {
                const isStudent = msg.from === 'student';
                return (
                  <div key={i} className={`flex ${isStudent ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                      isStudent
                        ? 'bg-primary text-white rounded-br-sm'
                        : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                    }`}>
                      <p className="leading-relaxed whitespace-pre-line">{msg.content}</p>
                      <p className={`text-[10px] mt-1 ${isStudent ? 'text-green-200' : 'text-slate-400'}`}>
                        {new Date(msg.date).toLocaleString('vi-VN', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input reply */}
            <div className="p-4 border-t border-slate-100 flex gap-3">
              <input
                className="flex-1 border border-slate-200 px-4 py-2.5 rounded-xl text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
                placeholder="Nhập tin nhắn..."
                value={newMsg}
                onChange={e => setNewMsg(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(); } }}
              />
              <button
                onClick={handleReply}
                disabled={!newMsg.trim() || sending}
                className="btn-primary"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
                Gửi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Contact;
