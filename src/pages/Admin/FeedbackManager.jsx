import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { ref, onValue, update } from 'firebase/database';
import { useAuth } from '../../context/AuthContext';

const CATEGORIES = {
  'hoc-tap':   { label: '📚 Học tập',        color: 'bg-[#E8F4EC] text-green-700 border-green-200' },
  'giao-vien': { label: '👨‍🏫 Giáo viên',      color: 'bg-[#1E5225]/10 text-[#1E5225] border-[#1E5225]/25' },
  'co-so':     { label: '🏫 Cơ sở vật chất', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  'khac':      { label: '💬 Khác',            color: 'bg-slate-50 text-slate-600 border-slate-200' },
};

const STATUS_STYLES = {
  pending:  { label: 'Chờ xử lý', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  read:     { label: 'Đã xem',    color: 'bg-[#E8F4EC] text-green-700 border-green-200' },
  resolved: { label: 'Đã xử lý', color: 'bg-green-50 text-green-700 border-green-200' },
};

const FeedbackManager = () => {
  const { currentUser } = useAuth();
  const [feedbacks, setFeedbacks] = useState([]);
  const [classes, setClasses] = useState({});
  const [selectedFb, setSelectedFb] = useState(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCat, setFilterCat] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Lấy tên lớp để hiển thị
    onValue(ref(db, 'classes'), (snap) => {
      const data = snap.val() || {};
      setClasses(data);
    });

    // Lấy toàn bộ feedback (Admin xem tất cả)
    onValue(ref(db, 'feedback'), (snap) => {
      const data = snap.val() || {};
      const list = Object.entries(data)
        .map(([id, val]) => ({ id, ...val }))
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      setFeedbacks(list);
    });
  }, []);

  const openFeedback = async (fb) => {
    setSelectedFb(fb);
    setReply(fb.staffReply || '');
    // Đánh dấu đã xem nếu còn pending
    if (fb.status === 'pending') {
      await update(ref(db, `feedback/${fb.id}`), { status: 'read' });
    }
  };

  const handleReply = async () => {
    if (!reply.trim() || !selectedFb) return;
    setSending(true);
    try {
      await update(ref(db, `feedback/${selectedFb.id}`), {
        staffReply: reply.trim(),
        replyDate:  new Date().toISOString(),
        replyBy:    currentUser.name,
        status:     'resolved',
      });
      setSelectedFb(prev => ({
        ...prev, staffReply: reply.trim(), status: 'resolved', replyBy: currentUser.name,
      }));
    } catch (err) { console.error(err); }
    finally { setSending(false); }
  };

  // Thống kê nhanh
  const stats = {
    total:    feedbacks.length,
    pending:  feedbacks.filter(f => f.status === 'pending').length,
    resolved: feedbacks.filter(f => f.status === 'resolved').length,
  };

  // Lọc danh sách
  const filtered = feedbacks.filter(fb => {
    if (filterStatus !== 'all' && fb.status !== filterStatus) return false;
    if (filterCat !== 'all' && fb.category !== filterCat) return false;
    if (searchTerm && !fb.title?.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !fb.studentName?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  // Lấy tên lớp học viên
  const getClassNames = (classIds) => {
    if (!classIds || !classIds.length) return '—';
    const ids = Array.isArray(classIds) ? classIds : Object.values(classIds);
    return ids.map(id => classes[id]?.name || id).join(', ');
  };

  return (
    <div className="space-y-6 pb-20">

      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
        <div className="p-2 bg-orange-50 rounded-xl text-orange-500">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#2B6830]">Quản lý Phản ánh</h2>
          <p className="text-xs text-slate-400 mt-0.5">Toàn bộ phản ánh từ học viên trong hệ thống.</p>
        </div>
      </div>

      {!selectedFb ? (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Tổng cộng', value: stats.total, color: 'text-slate-700', bg: 'bg-slate-50' },
              { label: 'Chờ xử lý', value: stats.pending, color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'Đã xử lý',  value: stats.resolved, color: 'text-green-600', bg: 'bg-green-50' },
            ].map(s => (
              <div key={s.label} className={`${s.bg} rounded-2xl border border-slate-100 p-4 text-center`}>
                <p className={`text-3xl font-extrabold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-slate-400 mt-1 font-medium">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            {/* Status filter */}
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
              {[
                { id: 'all',      label: 'Tất cả' },
                { id: 'pending',  label: '⏳ Chờ' },
                { id: 'read',     label: '👁 Đã xem' },
                { id: 'resolved', label: '✅ Xử lý' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilterStatus(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${filterStatus === f.id ? 'bg-white text-[#2B6830] shadow-sm' : 'text-slate-500'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Category filter */}
            <select
              className="border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold outline-none focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10 bg-white"
              value={filterCat}
              onChange={e => setFilterCat(e.target.value)}
            >
              <option value="all">Tất cả danh mục</option>
              {Object.entries(CATEGORIES).map(([id, { label }]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>

            {/* Search */}
            <div className="flex-1 min-w-[200px] relative">
              <input
                className="w-full border border-slate-200 pl-8 pr-4 py-1.5 rounded-xl text-xs outline-none focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10 transition"
                placeholder="Tìm theo tiêu đề hoặc tên học viên..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#94a3b8" className="w-4 h-4 absolute left-2.5 top-2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
          </div>

          {/* List */}
          <div className="space-y-2">
            {filtered.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center">
                <p className="text-slate-400 text-sm">Không có phản ánh nào.</p>
              </div>
            ) : filtered.map(fb => {
              const cat = CATEGORIES[fb.category] || CATEGORIES.khac;
              const st  = STATUS_STYLES[fb.status] || STATUS_STYLES.pending;
              return (
                <button
                  key={fb.id}
                  onClick={() => openFeedback(fb)}
                  className={`w-full bg-white rounded-2xl border shadow-sm p-4 text-left hover:shadow-md transition-all flex items-start gap-3 ${fb.status === 'pending' ? 'border-amber-200' : 'border-slate-100 hover:border-green-100'}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap gap-2 mb-1.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${cat.color}`}>{cat.label}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${st.color}`}>{st.label}</span>
                    </div>
                    <p className={`text-sm font-bold truncate ${fb.status === 'pending' ? 'text-slate-900' : 'text-slate-700'}`}>{fb.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {fb.isAnonymous ? 'Ẩn danh' : `${fb.studentName} (${fb.studentCode})`}
                      {' · '}{getClassNames(fb.classIds)}
                      {' · '}{new Date(fb.date).toLocaleDateString('vi-VN')}
                    </p>
                  </div>
                  {fb.status === 'pending' && <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0 mt-2" />}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        /* Chi tiết */
        <div className="max-w-2xl">
          <button onClick={() => setSelectedFb(null)} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#2B6830] mb-4 transition-colors font-medium">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
            Quay lại
          </button>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className={`text-[10px] font-bold px-2 py-1 rounded border ${(CATEGORIES[selectedFb.category] || CATEGORIES.khac).color}`}>
                {(CATEGORIES[selectedFb.category] || CATEGORIES.khac).label}
              </span>
              <span className={`text-[10px] font-bold px-2 py-1 rounded border ${(STATUS_STYLES[selectedFb.status] || STATUS_STYLES.pending).color}`}>
                {(STATUS_STYLES[selectedFb.status] || STATUS_STYLES.pending).label}
              </span>
            </div>

            <h3 className="font-bold text-slate-800 text-lg">{selectedFb.title}</h3>

            <div className="text-xs text-slate-400 space-y-0.5">
              <p>Học viên: <span className="font-medium text-slate-600">{selectedFb.isAnonymous ? 'Ẩn danh' : `${selectedFb.studentName} (${selectedFb.studentCode})`}</span></p>
              <p>Lớp: <span className="font-medium text-slate-600">{getClassNames(selectedFb.classIds)}</span></p>
              <p>Ngày gửi: <span className="font-medium text-slate-600">{new Date(selectedFb.date).toLocaleString('vi-VN')}</span></p>
            </div>

            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{selectedFb.content}</p>
            </div>

            {selectedFb.staffReply ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <p className="text-xs font-bold text-green-700 mb-1.5">
                  Phản hồi của {selectedFb.replyBy} · {selectedFb.replyDate && new Date(selectedFb.replyDate).toLocaleString('vi-VN')}
                </p>
                <p className="text-sm text-slate-700 whitespace-pre-line">{selectedFb.staffReply}</p>
                {/* Cho phép sửa phản hồi */}
                <button
                  onClick={() => setSelectedFb(prev => ({ ...prev, staffReply: null }))}
                  className="mt-2 text-xs text-slate-400 hover:text-[#2B6830] underline"
                >
                  Chỉnh sửa phản hồi
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Phản hồi học viên</label>
                <textarea
                  className="w-full border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10 resize-none transition"
                  rows={4}
                  placeholder="Nhập phản hồi của bạn..."
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                />
                <button
                  onClick={handleReply}
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
    </div>
  );
};

export default FeedbackManager;
