import React, { useState, useEffect, useMemo } from 'react';
import { db, storage } from '../../firebase';
import { ref, onValue, remove, push, set, update } from "firebase/database";
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '../../context/AuthContext';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

// Toolbar rich editor, cùng cấu hình với form của Giáo vụ
const quillModules = {
  toolbar: [
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'color': [] }, { 'background': [] }],
    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
    ['clean']
  ],
};

// Nhãn thông báo, giống cổng Giáo vụ để học viên thấy đồng nhất
const LABELS = [
  { id: 'báo bài', color: 'bg-primary-light text-green-700 border-green-200' },
  { id: 'quan trọng', color: 'bg-red-50 text-red-700 border-red-200' },
  { id: 'sự kiện', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
];

// ============================================================
// MODAL XÁC NHẬN XÓA, thay thế window.confirm
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
        <button onClick={onCancel} className="btn-secondary">
          Hủy
        </button>
        <button onClick={onConfirm} className="btn-danger">
          Xóa
        </button>
      </div>
    </div>
  </div>
);

// ============================================================
// HELPER: chuyển HTML thô thành text sạch để hiển thị excerpt
// (nội dung lưu từ Quill / tab Code là HTML, không đổ thẳng ra bảng)
// ============================================================
const stripHtml = (html) => {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')        // bỏ toàn bộ thẻ HTML
    .replace(/&nbsp;/gi, ' ')        // decode các entity hay gặp
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')            // gộp khoảng trắng thừa
    .trim();
};

const PAGE_SIZE = 10; // số thông báo mỗi trang

// ============================================================
// FILE ĐÍNH KÈM PDF: giới hạn 10MB, tên file làm sạch trước khi upload
// Dùng chung path Storage 'notifications_files/' với cổng Giáo vụ
// ============================================================
const MAX_ATTACH_BYTES = 10 * 1024 * 1024; // 10MB
// Làm sạch tên file: chỉ giữ chữ/số/._- để tránh ký tự lạ trong path Storage
const safeFileName = (name) => (name || 'file.pdf').replace(/[^a-zA-Z0-9._-]+/g, '_');
// Kiểm tra file hợp lệ: PDF + dưới 10MB. Trả về chuỗi lỗi hoặc '' nếu OK
const validatePdf = (file) => {
  if (!file) return '';
  const isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
  if (!isPdf) return '❌ Chỉ nhận file PDF.';
  if (file.size > MAX_ATTACH_BYTES) return `❌ File quá lớn (${(file.size / 1024 / 1024).toFixed(1)}MB). Giới hạn 10MB.`;
  return '';
};
// Upload file lên Storage rồi trả về URL tải
const uploadAttachment = async (file) => {
  const fileRef = storageRef(storage, `notifications_files/${Date.now()}_${safeFileName(file.name)}`);
  await uploadBytes(fileRef, file);
  return getDownloadURL(fileRef);
};

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
    label: 'báo bài' // nhãn: báo bài / quan trọng / sự kiện, giống Giáo vụ
  });
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  // File PDF đính kèm cho form tạo mới (tùy chọn)
  const [attachment, setAttachment] = useState(null);
  const [attachmentTitle, setAttachmentTitle] = useState('');

  // --- State modal xóa + modal xem chi tiết + modal sửa ---
  const [deleteTarget, setDeleteTarget] = useState(null); // id cần xóa
  const [viewTarget, setViewTarget] = useState(null);     // thông báo đang xem chi tiết
  const [editTarget, setEditTarget] = useState(null);     // bản sao thông báo đang sửa
  const [savingEdit, setSavingEdit] = useState(false);
  const [editAttachment, setEditAttachment] = useState(null); // file MỚI chọn khi sửa
  const [editRemoveAtt, setEditRemoveAtt] = useState(false);  // cờ gỡ file đính kèm khi sửa

  // --- State bộ lọc / sắp xếp / phân trang ---
  const [filterScope, setFilterScope] = useState('all');   // 'all' | 'system' | classId
  const [filterType, setFilterType] = useState('all');     // 'all' | 'content' | 'link'
  const [searchKeyword, setSearchKeyword] = useState('');
  const [sortDir, setSortDir] = useState('desc');          // 'desc' mới nhất trước | 'asc' cũ nhất trước
  const [page, setPage] = useState(1);

  useEffect(() => {
    onValue(ref(db, 'classes'), (snapshot) => {
      const data = snapshot.val();
      if (data) setClasses(data);
    });
    onValue(ref(db, 'notifications'), (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]) => ({ id, ...val }));
        setNotifs(list);
      } else {
        setNotifs([]);
      }
    });
  }, []);

  // Đổi bộ lọc / tìm kiếm / sắp xếp thì quay về trang 1
  useEffect(() => { setPage(1); }, [filterScope, filterType, searchKeyword, sortDir]);

  // --- Lọc + sắp xếp (cache bằng useMemo, 500+ thông báo không bị giật) ---
  const filteredNotifs = useMemo(() => {
    let list = notifs;

    if (filterScope === 'system') list = list.filter(n => n.scope === 'all');
    else if (filterScope !== 'all') list = list.filter(n => n.scope === filterScope);

    if (filterType !== 'all') list = list.filter(n => (n.type || 'content') === filterType);

    if (searchKeyword.trim()) {
      const kw = searchKeyword.trim().toLowerCase();
      list = list.filter(n => n.title?.toLowerCase().includes(kw));
    }

    return [...list].sort((a, b) =>
      sortDir === 'desc'
        ? new Date(b.date) - new Date(a.date)
        : new Date(a.date) - new Date(b.date)
    );
  }, [notifs, filterScope, filterType, searchKeyword, sortDir]);

  // --- Phân trang ---
  const totalPages = Math.max(1, Math.ceil(filteredNotifs.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedNotifs = filteredNotifs.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Chọn file PDF cho form tạo mới: báo lỗi ngay nếu không phải PDF hoặc quá 10MB
  const handlePickAttachment = (file) => {
    if (!file) return;
    const err = validatePdf(file);
    if (err) {
      setSuccessMsg(err);
      setTimeout(() => setSuccessMsg(''), 4000);
      return;
    }
    setAttachment(file);
  };

  // --- Xử lý tạo thông báo mới ---
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    if (form.type === 'content' && !stripHtml(form.content)) return; // Quill rỗng = '<p><br></p>' nên phải strip HTML mới biết rỗng thật
    if (form.type === 'link' && !form.linkUrl.trim()) return;

    setSubmitting(true);
    try {
      const payload = {
        title: form.title.trim(),
        type: form.type,
        content: form.type === 'content' ? form.content : '', // giữ nguyên HTML từ Quill
        linkUrl: form.type === 'link' ? form.linkUrl.trim() : '',
        label: form.type === 'content' ? form.label : '',
        scope: form.scope,
        author: userData?.name || 'Admin',
        date: new Date().toISOString(),
      };
      // Đính kèm PDF (chỉ áp dụng cho loại nội dung): upload Storage rồi lưu URL + tên file
      // Modal xem chi tiết đã render sẵn attachmentUrl / attachmentTitle / attachmentName
      if (form.type === 'content' && attachment) {
        payload.attachmentUrl = await uploadAttachment(attachment);
        payload.attachmentName = attachment.name;
        payload.attachmentTitle = attachmentTitle.trim() || attachment.name;
      }
      const newRef = push(ref(db, 'notifications'));
      await set(newRef, payload);
      // Reset form
      setForm({ title: '', type: 'content', content: '', linkUrl: '', scope: 'all', label: 'báo bài' });
      setAttachment(null);
      setAttachmentTitle('');
      setSuccessMsg('Đã đăng thông báo thành công!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setSuccessMsg('❌ Lỗi: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // --- Lưu chỉnh sửa thông báo đã đăng (giống cổng Giáo vụ) ---
  const handleSaveEdit = async () => {
    if (!editTarget) return;
    if (!editTarget.title?.trim()) return setSuccessMsg('⚠️ Vui lòng nhập tiêu đề.');
    if (editTarget.type === 'content' && !stripHtml(editTarget.content)) return setSuccessMsg('⚠️ Vui lòng nhập nội dung.');
    if (editTarget.type === 'link' && !editTarget.linkUrl?.trim()) return setSuccessMsg('⚠️ Vui lòng nhập đường dẫn.');
    setSavingEdit(true);
    try {
      const changes = {
        title: editTarget.title.trim(),
        editedAt: new Date().toISOString(),
        editedBy: userData?.name || 'Admin',
      };
      if (editTarget.type === 'content') {
        changes.content = editTarget.content;
        changes.label = editTarget.label || 'báo bài';
        // --- Xử lý file PDF đính kèm khi sửa ---
        if (editAttachment) {
          // Thay file mới: upload Storage rồi trỏ URL mới
          changes.attachmentUrl = await uploadAttachment(editAttachment);
          changes.attachmentName = editAttachment.name;
          changes.attachmentTitle = editTarget.attachmentTitle || editAttachment.name;
        } else if (editRemoveAtt) {
          // Gỡ file: set null để xóa key trong Realtime DB
          changes.attachmentUrl = null;
          changes.attachmentName = null;
          changes.attachmentTitle = null;
        } else if (editTarget.attachmentName) {
          // Giữ file cũ, chỉ cập nhật tên hiển thị nếu người dùng đổi
          changes.attachmentTitle = editTarget.attachmentTitle || editTarget.attachmentName;
        }
      } else {
        changes.linkUrl = editTarget.linkUrl.trim();
      }
      await update(ref(db, `notifications/${editTarget.id}`), changes);
      setEditTarget(null);
      setEditAttachment(null);
      setEditRemoveAtt(false);
      setSuccessMsg('Đã cập nhật thông báo!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (e) {
      setSuccessMsg('❌ Lỗi: ' + e.message);
    } finally {
      setSavingEdit(false);
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
    return <span className="bg-primary-light text-primary text-[10px] font-bold px-2 py-1 rounded border border-green-200">Lớp {clsName}</span>;
  };

  return (
    <div className="space-y-6 pb-20">
      {/* PAGE HEADER */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
        <div className="p-2 bg-primary-light rounded-xl text-primary-medium">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
        </div>
        <div>
          <h2 className="page-title">Quản lý Thông báo</h2>
          <p className="page-sub">Tạo và gửi thông báo đến học viên.</p>
        </div>
      </div>

      {/* ===== MODAL XÓA ===== */}
      {deleteTarget && (
        <ConfirmModal
          message="Xóa thông báo này? Hành động không thể hoàn tác."
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* ===== MODAL XEM CHI TIẾT THÔNG BÁO ===== */}
      {viewTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setViewTarget(null)}>
          <div
            className="bg-white rounded-2xl shadow-xl max-w-2xl w-full border border-slate-100 max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header modal */}
            <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-100">
              <div className="min-w-0">
                <h3 className="font-bold text-primary text-base leading-snug">{viewTarget.title}</h3>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {renderTargets(viewTarget)}
                  <span className="text-[11px] text-slate-400 font-mono">{new Date(viewTarget.date).toLocaleString('vi-VN')}</span>
                  <span className="text-[11px] text-slate-500">Bởi: <b>{viewTarget.author || 'Admin'}</b></span>
                  {viewTarget.label && <span className="text-[10px] font-bold uppercase text-green-700 bg-primary-light px-2 py-0.5 rounded border border-green-100">{viewTarget.label}</span>}
                </div>
              </div>
              <button
                onClick={() => setViewTarget(null)}
                className="shrink-0 text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-xl transition-colors"
                title="Đóng"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Body modal, render HTML đúng như học viên thấy (class quill-content) */}
            <div className="p-5 overflow-y-auto">
              {viewTarget.type === 'link' ? (
                <a
                  href={viewTarget.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary bg-primary-light hover:bg-green-100 px-4 py-2.5 rounded-xl border border-green-100 transition-colors break-all"
                >
                  🔗 {viewTarget.linkUrl}
                </a>
              ) : (
                <div
                  className="quill-content text-sm text-slate-700 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: viewTarget.content }}
                />
              )}
              {viewTarget.attachmentUrl && (
                <a
                  href={viewTarget.attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary-light hover:bg-green-100 px-3.5 py-2.5 rounded-xl border border-green-100 transition-colors"
                >
                  📎 {viewTarget.attachmentTitle || viewTarget.attachmentName}
                </a>
              )}
            </div>

            {/* Footer modal */}
            <div className="flex justify-end gap-3 p-4 border-t border-slate-100">
              <button
                onClick={() => { handleDelete(viewTarget.id); setViewTarget(null); }}
                className="px-4 py-2 rounded-xl text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 transition-colors"
              >
                Xóa thông báo
              </button>
              <button
                onClick={() => setViewTarget(null)}
                className="btn-primary"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL SỬA THÔNG BÁO ĐÃ ĐĂNG ===== */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-lg w-full space-y-4 border border-slate-100 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-primary">✏️ Sửa thông báo, {editTarget.scope === 'all' ? 'Toàn hệ thống' : `Lớp ${classes[editTarget.scope]?.name || editTarget.scope}`}</h3>

            <div>
              <label className="stat-label block mb-1.5">Tiêu đề</label>
              <input
                className="input-base"
                value={editTarget.title || ''}
                onChange={e => setEditTarget({ ...editTarget, title: e.target.value })}
              />
            </div>

            {editTarget.type === 'link' ? (
              <div>
                <label className="stat-label block mb-1.5">Đường dẫn (URL)</label>
                <input
                  className="input-base font-mono"
                  value={editTarget.linkUrl || ''}
                  onChange={e => setEditTarget({ ...editTarget, linkUrl: e.target.value })}
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="stat-label block mb-1.5">Nhãn</label>
                  <div className="flex gap-2 flex-wrap">
                    {LABELS.map(l => (
                      <button key={l.id} type="button"
                        onClick={() => setEditTarget({ ...editTarget, label: l.id })}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all uppercase ${editTarget.label === l.id ? l.color + ' ring-2 ring-primary/20' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}>
                        {l.id}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="stat-label block mb-1.5">Nội dung</label>
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <ReactQuill theme="snow" modules={quillModules}
                      value={editTarget.content || ''}
                      onChange={(val) => setEditTarget(prev => ({ ...prev, content: val }))}
                    />
                  </div>
                </div>
                {/* FILE PDF ĐÍNH KÈM: giữ / thay / gỡ */}
                <div className="space-y-2">
                  <label className="stat-label block">File PDF đính kèm</label>
                  {editAttachment ? (
                    <div className="flex items-center justify-between gap-2 bg-primary-light border border-green-200 rounded-xl px-3 py-2">
                      <span className="text-xs font-bold text-green-700 truncate">🆕 {editAttachment.name}</span>
                      <button type="button" onClick={() => setEditAttachment(null)} className="text-xs font-bold text-slate-500 hover:text-red-500 shrink-0">Bỏ chọn</button>
                    </div>
                  ) : (editTarget.attachmentName && !editRemoveAtt) ? (
                    <div className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                      <span className="text-xs font-medium text-slate-600 truncate">📎 {editTarget.attachmentName}</span>
                      <button type="button" onClick={() => setEditRemoveAtt(true)} className="text-xs font-bold text-red-500 hover:text-red-600 shrink-0">Gỡ file</button>
                    </div>
                  ) : editRemoveAtt ? (
                    <div className="flex items-center justify-between gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                      <span className="text-xs font-medium text-red-600">File sẽ bị gỡ khi bấm Lưu</span>
                      <button type="button" onClick={() => setEditRemoveAtt(false)} className="text-xs font-bold text-slate-500 hover:text-primary shrink-0">Hoàn tác</button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">Chưa có file đính kèm.</p>
                  )}
                  <label className="inline-flex items-center gap-2 text-xs font-bold text-primary bg-white border border-primary rounded-xl px-3 py-2 cursor-pointer hover:bg-primary-light transition-all">
                    {(editTarget.attachmentName || editAttachment) ? '🔄 Thay file PDF khác...' : '📎 Chọn file PDF...'}
                    <input type="file" accept=".pdf,application/pdf" className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        if (!f) return;
                        const err = validatePdf(f);
                        if (err) { setSuccessMsg(err); setTimeout(() => setSuccessMsg(''), 4000); return; }
                        setEditAttachment(f); setEditRemoveAtt(false);
                      }} />
                  </label>
                  {(editAttachment || (editTarget.attachmentName && !editRemoveAtt)) && (
                    <input
                      className="w-full border border-slate-200 p-2.5 rounded-xl text-xs outline-none focus:border-primary transition"
                      placeholder="Tên hiển thị của file (tùy chọn)"
                      value={editTarget.attachmentTitle || ''}
                      onChange={e => setEditTarget({ ...editTarget, attachmentTitle: e.target.value })}
                    />
                  )}
                </div>
              </>
            )}

            <div className="flex gap-3 justify-end pt-1">
              <button onClick={() => { setEditTarget(null); setEditAttachment(null); setEditRemoveAtt(false); }} className="btn-secondary">Hủy</button>
              <button onClick={handleSaveEdit} disabled={savingEdit} className="btn-primary disabled:opacity-50">
                {savingEdit ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== FORM TẠO THÔNG BÁO MỚI ===== */}
      <div className="card-std p-5 md:p-6">
        <h2 className="section-title mb-4 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Tạo Thông báo Mới
        </h2>

        {/* Flash success */}
        {successMsg && (
          <div className="alert-success mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            {successMsg}
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-4">
          {/* Tiêu đề */}
          <div>
            <label className="stat-label block mb-1">Tiêu đề *</label>
            <input
              className="input-base"
              placeholder="VD: Lịch nghỉ lễ 30/4 - 1/5"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>

          {/* Loại + Phạm vi */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="stat-label block mb-1">Loại nội dung</label>
              <div className="flex gap-2">
                {['content', 'link'].map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm({ ...form, type: t })}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-colors ${
                      form.type === t
                        ? 'bg-primary text-white border-primary'
                        : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {t === 'content' ? '📝 Nội dung' : '🔗 Đường link'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="stat-label block mb-1">Gửi đến</label>
              <select
                className="input-base"
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
              {/* Nhãn dán, giống cổng Giáo vụ */}
              <label className="stat-label block mb-1.5">Nhãn dán (Label)</label>
              <div className="flex gap-2 mb-4">
                {LABELS.map(lbl => (
                  <button
                    key={lbl.id}
                    type="button"
                    onClick={() => setForm({ ...form, label: lbl.id })}
                    className={`px-3 py-1.5 rounded-md text-[10px] font-bold border transition-all uppercase tracking-wider ${form.label === lbl.id ? lbl.color + ' ring-2 ring-offset-1 ring-green-200' : 'bg-white text-slate-400 border-slate-200'}`}
                  >
                    {lbl.id}
                  </button>
                ))}
              </div>
              <label className="stat-label block mb-1">Nội dung *</label>
              {/* Style cho bullet/số trong editor, giống form Giáo vụ */}
              <style>{`
                .ql-editor ul { list-style-type: disc !important; padding-left: 1.5rem !important; margin-bottom: 0.5rem !important; }
                .ql-editor ol { list-style-type: decimal !important; padding-left: 1.5rem !important; margin-bottom: 0.5rem !important; }
                .ql-editor li { padding-left: 0.25rem !important; margin-bottom: 0.25rem !important; }
              `}</style>
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <ReactQuill
                  theme="snow"
                  modules={quillModules}
                  value={form.content}
                  onChange={(val) => setForm(prev => ({ ...prev, content: val }))}
                  placeholder="Nội dung sẽ được hiển thị cho học viên..."
                  className="h-40 pb-10"
                />
              </div>

              {/* ===== FILE PDF ĐÍNH KÈM (tùy chọn, tối đa 10MB) ===== */}
              <div className="mt-4 space-y-2">
                <label className="stat-label block">File PDF đính kèm (tùy chọn, tối đa 10MB)</label>
                {attachment ? (
                  <div className="flex items-center justify-between gap-2 bg-primary-light border border-green-200 rounded-xl px-3 py-2">
                    <span className="text-xs font-bold text-green-700 truncate">📎 {attachment.name}</span>
                    {/* Nút gỡ file đã chọn */}
                    <button type="button" onClick={() => { setAttachment(null); setAttachmentTitle(''); }}
                      className="text-xs font-bold text-slate-500 hover:text-red-500 shrink-0">Gỡ file</button>
                  </div>
                ) : (
                  <label className="inline-flex items-center gap-2 text-xs font-bold text-primary bg-white border border-primary rounded-xl px-3 py-2 cursor-pointer hover:bg-primary-light transition-all">
                    📎 Chọn file PDF...
                    <input type="file" accept=".pdf,application/pdf" className="hidden"
                      onChange={e => { handlePickAttachment(e.target.files?.[0]); e.target.value = ''; }} />
                  </label>
                )}
                {attachment && (
                  <input
                    className="w-full border border-slate-200 p-2.5 rounded-xl text-xs outline-none focus:border-primary transition"
                    placeholder="Tên hiển thị của file (tùy chọn)"
                    value={attachmentTitle}
                    onChange={e => setAttachmentTitle(e.target.value)}
                  />
                )}
              </div>
            </div>
          ) : (
            <div>
              <label className="stat-label block mb-1">URL *</label>
              <input
                type="url"
                className="input-base"
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
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
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
      <div className="card-std p-5 md:p-6">
        <h2 className="section-title mb-4 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
          Lịch sử Thông báo ({filteredNotifs.length}{filteredNotifs.length !== notifs.length ? `/${notifs.length}` : ''})
        </h2>

        {/* ===== THANH BỘ LỌC + TÌM KIẾM + SẮP XẾP ===== */}
        <div className="flex flex-col md:flex-row gap-3 mb-5">
          {/* Lọc theo phạm vi (lớp) */}
          <select
            className="w-full md:w-52 p-2.5 border border-slate-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 text-sm text-slate-700 bg-slate-50 transition-colors"
            value={filterScope}
            onChange={e => setFilterScope(e.target.value)}
          >
            <option value="all">-- Tất cả phạm vi --</option>
            <option value="system">🌐 Toàn hệ thống</option>
            {Object.entries(classes).map(([id, cls]) => (
              <option key={id} value={id}>🏫 Lớp {cls.name}</option>
            ))}
          </select>

          {/* Lọc theo loại */}
          <select
            className="w-full md:w-44 p-2.5 border border-slate-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 text-sm text-slate-700 bg-slate-50 transition-colors"
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
          >
            <option value="all">-- Tất cả loại --</option>
            <option value="content">📝 Nội dung</option>
            <option value="link">🔗 Đường link</option>
          </select>

          {/* Tìm kiếm theo tiêu đề */}
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-slate-400"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
            </div>
            <input
              type="text"
              className="w-full pl-10 p-2.5 border border-slate-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 text-sm text-slate-700 bg-slate-50 transition-colors"
              placeholder="Tìm kiếm theo tiêu đề..."
              value={searchKeyword}
              onChange={e => setSearchKeyword(e.target.value)}
            />
          </div>

          {/* Nút đảo chiều sắp xếp theo ngày */}
          <button
            type="button"
            onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
            className="shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 bg-slate-50 hover:bg-primary-light hover:text-primary hover:border-green-200 transition-colors"
            title={sortDir === 'desc' ? 'Đang xếp: mới nhất trước, bấm để đảo' : 'Đang xếp: cũ nhất trước, bấm để đảo'}
          >
            {sortDir === 'desc' ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" /></svg>
                Mới nhất
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" /></svg>
                Cũ nhất
              </>
            )}
          </button>
        </div>

        {/* DESKTOP TABLE */}
        <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200">
          <table className="table-std">
            <thead>
              <tr>
                <th className="w-32">Ngày đăng</th>
                <th>Tiêu đề / Loại</th>
                <th>Phạm vi</th>
                <th>Người đăng</th>
                <th className="text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {pagedNotifs.map(n => (
                <tr
                  key={n.id}
                  className="cursor-pointer"
                  onClick={() => setViewTarget(n)}
                >
                  <td className="text-slate-500 text-xs font-mono">{new Date(n.date).toLocaleDateString('vi-VN')}</td>
                  <td>
                    {/* Icon 📎 báo hiệu thông báo có file đính kèm */}
                    <div className="font-bold text-slate-800">{n.title}{n.attachmentUrl && <span className="ml-1.5" title={`Đính kèm: ${n.attachmentTitle || n.attachmentName || 'file'}`}>📎</span>}</div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                      {n.type === 'link'
                        ? <span className="text-green-600 bg-primary-light px-1.5 py-0.5 rounded border border-green-100 font-bold text-[10px]">LINK</span>
                        : <span className="text-green-600 bg-primary-light px-1.5 py-0.5 rounded border border-green-100 font-bold text-[10px] uppercase">{n.label || 'CONTENT'}</span>
                      }
                      {/* Excerpt đã làm sạch HTML, không còn lộ thẻ thô */}
                      <span className="truncate max-w-[280px]">{n.type === 'link' ? n.linkUrl : stripHtml(n.content)}</span>
                    </div>
                  </td>
                  <td className="font-medium">{renderTargets(n)}</td>
                  <td className="text-slate-500 text-xs font-medium">{n.author || 'Admin'}</td>
                  <td className="text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => setViewTarget(n)}
                      className="text-primary hover:bg-primary-light px-3 py-1.5 rounded-xl transition-colors text-xs font-bold border border-green-100 mr-2"
                    >
                      Xem
                    </button>
                    <button
                      onClick={() => { setEditTarget({ ...n }); setEditAttachment(null); setEditRemoveAtt(false); }}
                      className="text-amber-600 hover:bg-amber-50 px-3 py-1.5 rounded-xl transition-colors text-xs font-bold border border-amber-200 mr-2"
                    >
                      Sửa
                    </button>
                    <button
                      onClick={() => handleDelete(n.id)}
                      className="text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-xl transition-colors text-xs font-bold border border-red-100"
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
              {pagedNotifs.length === 0 && (
                <tr><td colSpan="5" className="p-8 text-center text-slate-400 italic">Không tìm thấy thông báo nào phù hợp.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* MOBILE CARDS */}
        <div className="md:hidden space-y-3">
          {pagedNotifs.map(n => (
            <div key={n.id} className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded border uppercase bg-primary-light text-green-700 border-green-200">
                    {n.type === 'link' ? 'Link' : n.label || 'Tin tức'}
                  </span>
                  <span className="text-[10px] text-slate-400">{new Date(n.date).toLocaleDateString('vi-VN')}</span>
                </div>
                {renderTargets(n)}
              </div>
              <div onClick={() => setViewTarget(n)}>
                <h4 className="font-bold text-slate-800 text-sm mb-1">{n.title}{n.attachmentUrl && <span className="ml-1.5" title="Có file đính kèm">📎</span>}</h4>
                <p className="text-xs text-slate-500 line-clamp-2">{n.type === 'link' ? n.linkUrl : stripHtml(n.content)}</p>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                <span className="text-xs text-slate-400 italic">Bởi: {n.author || 'Admin'}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setViewTarget(n)}
                    className="bg-primary-light text-primary px-4 py-2 rounded-xl text-xs font-bold border border-green-100 active:bg-green-100"
                  >
                    Xem
                  </button>
                  <button
                    onClick={() => { setEditTarget({ ...n }); setEditAttachment(null); setEditRemoveAtt(false); }}
                    className="bg-amber-50 text-amber-700 px-4 py-2 rounded-xl text-xs font-bold border border-amber-200 active:bg-amber-100"
                  >
                    Sửa
                  </button>
                  <button
                    onClick={() => handleDelete(n.id)}
                    className="bg-red-50 text-red-600 px-4 py-2 rounded-xl text-xs font-bold border border-red-100 active:bg-red-100"
                  >
                    Xóa
                  </button>
                </div>
              </div>
            </div>
          ))}
          {pagedNotifs.length === 0 && (
            <div className="p-8 text-center text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
              Không tìm thấy thông báo nào phù hợp.
            </div>
          )}
        </div>

        {/* ===== PHÂN TRANG ===== */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-5 flex-wrap gap-3">
            <span className="text-xs text-slate-400">
              Hiển thị {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filteredNotifs.length)} / {filteredNotifs.length} thông báo
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage(1)}
                disabled={safePage === 1}
                className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                «
              </button>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ‹ Trước
              </button>
              <span className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-white">
                {safePage} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Sau ›
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={safePage === totalPages}
                className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                »
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationManager;
