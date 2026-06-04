import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { ref, onValue, update } from 'firebase/database';

const CATEGORIES = {
  'hoc-tap':   { label: '📚 Học tập',        color: 'bg-blue-50 text-blue-700 border-blue-200' },
  'giao-vien': { label: '👨‍🏫 Giáo viên',      color: 'bg-purple-50 text-purple-700 border-purple-200' },
  'co-so':     { label: '🏫 Cơ sở vật chất', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  'khac':      { label: '💬 Khác',            color: 'bg-slate-50 text-slate-600 border-slate-200' },
};

const STATUS_STYLES = {
  pending:  'bg-amber-50 text-amber-700 border-amber-200',
  read:     'bg-blue-50 text-blue-700 border-blue-200',
  resolved: 'bg-green-50 text-green-700 border-green-200',
};

const Inbox = () => {
  const { currentUser } = useAuth();

  const [activeTab, setActiveTab] = useState('feedback'); // 'feedback' | 'messages'
  const [feedbacks, setFeedbacks] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedFb, setSelectedFb] = useState(null);
  const [selectedMsg, setSelectedMsg] = useState(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const messagesEndRef = useRef(null);

  const myClassIds = currentUser?.assignedClasses || [];
  const isAdmin = currentUser?.role === 'admin';

  // Lấy feedback từ học viên trong lớp mình
  useEffect(() => {
    if (!currentUser?.id) return;
    const unsub = onValue(ref(db, 'feedback'), (snap) => {
      const data = snap.val() || {};
      const list = Object.entries(data)
        .map(([id, val]) => ({ id, ...val }))
        .filter(fb => {
          if (isAdmin) return true;
          // GV chỉ thấy feedback từ lớp mình phụ trách
          const fbClasses = Array.isArray(fb.classIds) ? fb.classIds : Object.values(fb.classIds || {});
          return fbClasses.some(cid => myClassIds.includes(cid));
        })
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      setFeedbacks(list);
    });
    return () => unsub();
  }, [currentUser?.id, myClassIds.join(',')]);

  // Lấy tin nhắn gửi đến mình
  useEffect(() => {
    if (!currentUser?.id) return;
    const unsub = onValue(ref(db, 'messages'), (snap) => {
      const data = snap.val() || {};
      const list = Object.entries(data)
        .map(([id, val]) => ({ id, ...val }))
        .filter(m => isAdmin ? true : m.recipientId === currentUser.id)
        .sort((a, b) => new Date(b.lastDate) - new Date(a.lastDate));
      setMessages(list);
    });
    return () => unsub();
  }, [currentUser?.id]);

  // Cuộn xuống cuối thread
  useEffect(() => {
    if (selectedMsg) setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, [selectedMsg]);

  // Xử lý reply feedback
  const handleFeedbackReply = async () => {
    if (!reply.trim() || !selectedFb) return;
    setSending(true);
    try {
      await update(ref(db, `feedback/${selectedFb.id}`), {
        staffReply: reply.trim(),
        replyDate:  new Date().toISOString(),
        replyBy:    currentUser.name,
        status:     'resolved',
      });
      setReply('');
      setSelectedFb(prev => ({ ...prev, staffReply: reply.trim(), status: 'resolved', replyBy: currentUser.name }));
    } catch (err) { console.error(err); }
    finally { setSending(false); }
  };

  // Xử lý reply message
  const handleMessageReply = async () => {
    if (!reply.trim() || !selectedMsg) return;
    setSending(true);
    try {
      const updatedThread = [
        ...(selectedMsg.thread || []),
        { from: 'staff', fromName: currentUser.name, content: reply.trim(), date: new Date().toISOString() },
      ];
      await update(ref(db, `messages/${selectedMsg.id}`), {
        thread:       updatedThread,
        lastDate:     new Date().toISOString(),
        lastMessage:  reply.trim(),
        studentUnread: (selectedMsg.studentUnread || 0) + 1,
        staffUnread:  0,
      });
      setReply('');
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) { console.error(err); }
    finally { setSending(false); }
  };

  // Mở feedback → đánh dấu đã đọc
  const openFeedback = async (fb) => {
    setSelectedFb(fb);
    setReply('');
    if (fb.status === 'pending') {
      await update(ref(db, `feedback/${fb.id}`), { status: 'read' });
    }
  };

  // Mở message → đánh dấu đã đọc
  const openMessage = async (msg) => {
    setSelectedMsg(msg);
    setReply('');
    if (msg.staffUnread > 0) {
      await update(ref(db, `messages/${msg.id}`), { staffUnread: 0 });
    }
  };

  const unreadFeedback = feedbacks.filter(f => f.status === 'pending').length;
  const unreadMessages = messages.reduce((sum, m) => sum + (m.staffUnread || 0), 0);

  const filteredFeedbacks = feedbacks.filter(fb => filterStatus === 'all' || fb.status === filterStatus);

  return (
    <div className="space-y-6 pb-20">

      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
        <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#003366]">Hộp thư</h2>
          <p className="text-xs text-slate-400 mt-0.5">Phản ánh và tin nhắn từ học viên.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { id: 'feedback', label: 'Phản ánh', badge: unreadFeedback },
          { id: 'messages', label: 'Tin nhắn', badge: unreadMessages },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => { setActiveTab(t.id); setSelectedFb(null); setSelectedMsg(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all ${
              activeTab === t.id ? 'bg-[#003366] text-white border-[#003366]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {t.label}
            {t.badge > 0 && (
              <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${activeTab === t.id ? 'bg-white text-[#003366]' : 'bg-[#003366] text-white'}`}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ====== FEEDBACK TAB ====== */}
      {activeTab === 'feedback' && (
        <>
          {!selectedFb ? (
            <>
              {/* Filter */}
              <div className="flex gap-2 flex-wrap">
                {[
                  { id: 'all',      label: 'Tất cả' },
                  { id: 'pending',  label: '⏳ Chờ xử lý' },
                  { id: 'read',     label: '👁 Đã xem' },
                  { id: 'resolved', label: '✅ Đã xử lý' },
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setFilterStatus(f.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${filterStatus === f.id ? 'bg-[#003366] text-white border-[#003366]' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                {filteredFeedbacks.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center">
                    <p className="text-slate-400 text-sm">Không có phản ánh nào.</p>
                  </div>
                ) : filteredFeedbacks.map(fb => {
                  const cat = CATEGORIES[fb.category] || CATEGORIES.khac;
                  return (
                    <button
                      key={fb.id}
                      onClick={() => openFeedback(fb)}
                      className={`w-full bg-white rounded-2xl border shadow-sm p-4 text-left hover:shadow-md transition-all flex items-start gap-3 ${fb.status === 'pending' ? 'border-amber-200 bg-amber-50/30' : 'border-slate-100 hover:border-blue-100'}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap gap-2 mb-1">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${cat.color}`}>{cat.label}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${STATUS_STYLES[fb.status] || STATUS_STYLES.pending}`}>
                            {fb.status === 'pending' ? 'Chờ xử lý' : fb.status === 'read' ? 'Đã xem' : 'Đã xử lý'}
                          </span>
                        </div>
                        <p className={`text-sm font-bold truncate ${fb.status === 'pending' ? 'text-slate-900' : 'text-slate-700'}`}>{fb.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {fb.isAnonymous ? 'Ẩn danh' : fb.studentName} · {new Date(fb.date).toLocaleDateString('vi-VN')}
                        </p>
                      </div>
                      {fb.status === 'pending' && <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0 mt-2" />}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            /* Chi tiết feedback */
            <div className="max-w-2xl">
              <button onClick={() => setSelectedFb(null)} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#003366] mb-4 transition-colors font-medium">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
                Quay lại
              </button>

              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
                <div className="flex flex-wrap gap-2">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded border ${(CATEGORIES[selectedFb.category] || CATEGORIES.khac).color}`}>
                    {(CATEGORIES[selectedFb.category] || CATEGORIES.khac).label}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded border ${STATUS_STYLES[selectedFb.status] || STATUS_STYLES.pending}`}>
                    {selectedFb.status === 'pending' ? 'Chờ xử lý' : selectedFb.status === 'read' ? 'Đã xem' : 'Đã xử lý'}
                  </span>
                </div>
                <h3 className="font-bold text-slate-800 text-lg">{selectedFb.title}</h3>
                <p className="text-xs text-slate-400">
                  {selectedFb.isAnonymous ? 'Ẩn danh' : `${selectedFb.studentName} (${selectedFb.studentCode})`} · {new Date(selectedFb.date).toLocaleString('vi-VN')}
                </p>

                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{selectedFb.content}</p>
                </div>

                {selectedFb.staffReply ? (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <p className="text-xs font-bold text-green-700 mb-1.5">Phản hồi của bạn · {selectedFb.replyDate && new Date(selectedFb.replyDate).toLocaleString('vi-VN')}</p>
                    <p className="text-sm text-slate-700 whitespace-pre-line">{selectedFb.staffReply}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Phản hồi học viên</label>
                    <textarea
                      className="w-full border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-[#003366] focus:ring-2 focus:ring-[#003366]/10 resize-none transition"
                      rows={4}
                      placeholder="Nhập phản hồi của bạn..."
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                    />
                    <button
                      onClick={handleFeedbackReply}
                      disabled={!reply.trim() || sending}
                      className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 text-sm"
                    >
                      {sending ? 'Đang gửi...' : '✅ Gửi phản hồi & Đánh dấu đã xử lý'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ====== MESSAGES TAB ====== */}
      {activeTab === 'messages' && (
        <>
          {!selectedMsg ? (
            <div className="space-y-2 max-w-2xl">
              {messages.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center">
                  <p className="text-slate-400 text-sm">Chưa có tin nhắn nào.</p>
                </div>
              ) : messages.map(msg => (
                <button
                  key={msg.id}
                  onClick={() => openMessage(msg)}
                  className={`w-full bg-white rounded-2xl border shadow-sm p-4 text-left hover:shadow-md transition-all flex items-start gap-3 ${msg.staffUnread > 0 ? 'border-blue-200 bg-blue-50/20' : 'border-slate-100 hover:border-blue-100'}`}
                >
                  <div className="w-10 h-10 rounded-full bg-[#003366]/10 text-[#003366] font-bold text-sm flex items-center justify-center shrink-0">
                    {msg.studentName?.charAt(0) || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <p className={`text-sm font-bold truncate ${msg.staffUnread > 0 ? 'text-slate-900' : 'text-slate-700'}`}>{msg.studentName}</p>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {msg.staffUnread > 0 && <span className="w-5 h-5 bg-[#003366] text-white text-[10px] font-bold rounded-full flex items-center justify-center">{msg.staffUnread}</span>}
                        <span className="text-[10px] text-slate-400">{new Date(msg.lastDate).toLocaleDateString('vi-VN')}</span>
                      </div>
                    </div>
                    <p className="text-xs font-bold text-slate-500 truncate">{msg.subject}</p>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{msg.lastMessage}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="max-w-2xl">
              <button onClick={() => setSelectedMsg(null)} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#003366] mb-4 transition-colors font-medium">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
                Quay lại
              </button>

              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50">
                  <p className="font-bold text-[#003366]">{selectedMsg.subject}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Từ {selectedMsg.studentName} ({selectedMsg.studentCode})</p>
                </div>

                <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                  {(selectedMsg.thread || []).map((msg, i) => {
                    const isStaff = msg.from === 'staff';
                    return (
                      <div key={i} className={`flex ${isStaff ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${isStaff ? 'bg-[#003366] text-white rounded-br-sm' : 'bg-slate-100 text-slate-800 rounded-bl-sm'}`}>
                          <p className="leading-relaxed whitespace-pre-line">{msg.content}</p>
                          <p className={`text-[10px] mt-1 ${isStaff ? 'text-blue-200' : 'text-slate-400'}`}>
                            {new Date(msg.date).toLocaleString('vi-VN', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                <div className="p-4 border-t border-slate-100 flex gap-3">
                  <input
                    className="flex-1 border border-slate-200 px-4 py-2.5 rounded-xl text-sm outline-none focus:border-[#003366] focus:ring-2 focus:ring-[#003366]/10 transition"
                    placeholder="Nhập phản hồi..."
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleMessageReply(); } }}
                  />
                  <button
                    onClick={handleMessageReply}
                    disabled={!reply.trim() || sending}
                    className="bg-[#003366] text-white px-4 py-2.5 rounded-xl font-bold hover:bg-[#002244] transition-all disabled:opacity-40 flex items-center gap-1.5 text-sm"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
                    Gửi
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Inbox;
