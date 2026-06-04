import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { ref, onValue, remove, push, set } from "firebase/database";
import { useAuth } from '../../context/AuthContext';

// ============================================================
// MODAL XÁC NHẬN XÓA — thay thế window.confirm
// ============================================================
const ConfirmModal = ({ message, onConfirm, onCancel }) => (
  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4 border border-slate-100">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#dc2626" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-slate-700">{message}</p>
      </div>
      <div className="flex gap-3 justify-end">
        <button onClick={onCancel} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
          Hủy
        </button>
        <button onClick={onConfirm} className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition-colors">
          Xóa
        </button>
      </div>
    </div>
  </div>
);

// ============================================================
// MAIN COMPONENT
// ============================================================
const NotificationManager = () => {
  const { userData } = useAuth();
  const [notifs, setNotifs] = useState([]);
  const [classes, setClasses] = useState({});

  // --- State form tạo mới ---
  const [form, setForm] = useState({
    title: '',
    type: 'content', // 'content' | 'link'
    content: '',
    linkUrl: '',
    scope: 'all',    // 'all' | classId
    label: 'Tin tức' // nhãn hiển thị cho loại content
  });
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // --- State modal xóa ---
  const [deleteTarget, setDeleteTarget] = useState(null); // id cần xóa

  useEffect(() => {
    onValue(ref(db, 'classes'), (snapshot) => {
      const data = snapshot.val();
      if (data) setClasses(data);
    });
    onValue(ref(db, 'notifications'), (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data)
          .map(([id, val]) => ({ id, ...val }))
          .sort((a, b) => new Date(b.date) - new Date(a.date));
        setNotifs(list);
      } else {
        setNotifs([]);
      }
    });
  }, []);

  // --- Xử lý tạo thông báo mới ---
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    if (form.type === 'content' && !form.content.trim()) return;
    if (form.type === 'link' && !form.linkUrl.trim()) return;

    setSubmitting(true);
    try {
      const newRef = push(ref(db, 'notifications'));
      await set(newRef, {
        title: form.title.trim(),
        type: form.type,
        content: form.type === 'content' ? form.content.trim() : '',
        linkUrl: form.type === 'link' ? form.linkUrl.trim() : '',
        label: form.type === 'content' ? form.label : '',
        scope: form.scope,
        author: userData?.name || 'Admin',
        date: new Date().toISOString(),
      });
      // Reset form
      setForm({ title: '', type: 'content', content: '', linkUrl: '', scope: 'all', label: 'Tin tức' });
      setSuccessMsg('Đã đăng thông báo thành công!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setSuccessMsg('❌ Lỗi: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // --- Xóa (qua modal, không dùng window.confirm) ---
  const handleDelete = (id) => setDeleteTarget(id);
  const confirmDelete = () => {
    remove(ref(db, `notifications/${deleteTarget}`));
    setDeleteTarget(null);
  };

  const renderTargets = (n) => {
    if (n.scope === 'all') return <span className="bg-green-100 text-green-800 text-[10px] font-bold px-2 py-1 rounded border border-green-200">TOÀN HỆ THỐNG</span>;
    const clsName = classes[n.scope]?.name || n.scope;
    return <span className="bg-blue-50 text-[#003366] text-[10px] font-bold px-2 py-1 rounded border border-blue-200">Lớp {clsName}</span>;
  };

  return (
    <div className="space-y-6 pb-20">

      {/* ===== MODAL XÓA ===== */}
      {deleteTarget && (
        <ConfirmModal
          message="Xóa thông báo này? Hành động không thể hoàn tác."
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* ===== FORM TẠO THÔNG BÁO MỚI ===== */}
      <div className="bg-white p-4 md:p-6 rounded-xl border border-slate-100 shadow-sm">
        <h2 className="text-lg font-bold text-[#003366] mb-4 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Tạo Thông báo Mới
        </h2>

        {/* Flash success */}
        {successMsg && (
          <div className="mb-4 flex items-center gap-2 bg-green-50 text-green-700 border border-green-200 px-4 py-3 rounded-xl text-sm font-medium">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            {successMsg}
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-4">
          {/* Tiêu đề */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Tiêu đề *</label>
            <input
              className="w-full border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-[#003366] focus:ring-2 focus:ring-[#003366]/10 transition"
              placeholder="VD: Lịch nghỉ lễ 30/4 - 1/5"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>

          {/* Loại + Phạm vi */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Loại nội dung</label>
              <div className="flex gap-2">
                {['content', 'link'].map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm({ ...form, type: t })}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-colors ${
                      form.type === t
                        ? 'bg-[#003366] text-white border-[#003366]'
                        : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {t === 'content' ? '📝 Nội dung' : '🔗 Đường link'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Gửi đến</label>
              <select
                className="w-full border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-[#003366] focus:ring-2 focus:ring-[#003366]/10 bg-white transition"
                value={form.scope}
                onChange={e => setForm({ ...form, scope: e.target.value })}
              >
                <option value="all">🌐 Toàn hệ thống</option>
                {Object.entries(classes).map(([id, cls]) => (
                  <option key={id} value={id}>🏫 Lớp {cls.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Nội dung / Link */}
          {form.type === 'content' ? (
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Nội dung *</label>
              <textarea
                className="w-full border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-[#003366] focus:ring-2 focus:ring-[#003366]/10 resize-none transition"
                rows={4}
                placeholder="Nhập nội dung thông báo..."
                value={form.content}
                onChange={e => setForm({ ...form, content: e.target.value })}
                required
              />
            </div>
          ) : (
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">URL *</label>
              <input
                type="url"
                className="w-full border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-[#003366] focus:ring-2 focus:ring-[#003366]/10 transition"
                placeholder="https://..."
                value={form.linkUrl}
                onChange={e => setForm({ ...form, linkUrl: e.target.value })}
                required
              />
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="bg-[#003366] text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-[#004080] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Đang gửi...
                </>
              ) : '📣 Đăng thông báo'}
            </button>
          </div>
        </form>
      </div>

      {/* ===== BẢNG QUẢN LÝ ===== */}
      <div className="bg-white p-4 md:p-6 rounded-xl border border-slate-100 shadow-sm">
        <h2 className="text-lg font-bold text-[#003366] mb-4 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
          Lịch sử Thông báo ({notifs.length})
        </h2>

        {/* DESKTOP TABLE */}
        <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 text-xs uppercase font-bold">
              <tr>
                <th className="p-4 w-32">Ngày đăng</th>
                <th className="p-4">Tiêu đề / Loại</th>
                <th className="p-4">Phạm vi</th>
                <th className="p-4">Người đăng</th>
                <th className="p-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {notifs.map(n => (
                <tr key={n.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 text-slate-500 text-xs font-mono">{new Date(n.date).toLocaleDateString('vi-VN')}</td>
                  <td className="p-4">
                    <div className="font-bold text-slate-800">{n.title}</div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                      {n.type === 'link'
                        ? <span className="text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100 font-bold text-[10px]">LINK</span>
                        : <span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 font-bold text-[10px]">CONTENT</span>
                      }
                      <span className="truncate max-w-[200px]">{n.type === 'link' ? n.linkUrl : n.content}</span>
                    </div>
                  </td>
                  <td className="p-4 font-medium">{renderTargets(n)}</td>
                  <td className="p-4 text-slate-500 text-xs font-medium">{n.author || 'Admin'}</td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => handleDelete(n.id)}
                      className="text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-xl transition-colors text-xs font-bold border border-red-100"
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
              {notifs.length === 0 && (
                <tr><td colSpan="5" className="p-8 text-center text-slate-400 italic">Chưa có thông báo nào.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* MOBILE CARDS */}
        <div className="md:hidden space-y-3">
          {notifs.map(n => (
            <div key={n.id} className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                    n.type === 'link' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                  }`}>
                    {n.type === 'link' ? 'Link' : n.label || 'Tin tức'}
                  </span>
                  <span className="text-[10px] text-slate-400">{new Date(n.date).toLocaleDateString('vi-VN')}</span>
                </div>
                {renderTargets(n)}
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-sm mb-1">{n.title}</h4>
                <p className="text-xs text-slate-500 line-clamp-2">{n.type === 'link' ? n.linkUrl : n.content}</p>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                <span className="text-xs text-slate-400 italic">Bởi: {n.author || 'Admin'}</span>
                <button
                  onClick={() => handleDelete(n.id)}
                  className="bg-red-50 text-red-600 px-4 py-2 rounded-xl text-xs font-bold border border-red-100 active:bg-red-100"
                >
                  Xóa
                </button>
              </div>
            </div>
          ))}
          {notifs.length === 0 && (
            <div className="p-8 text-center text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
              Chưa có thông báo nào.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationManager;
