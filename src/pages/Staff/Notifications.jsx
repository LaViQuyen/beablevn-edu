import React, { useState, useEffect, useMemo } from 'react'; // Bổ sung useMemo
import { db, storage } from '../../firebase';
import { ref, push, set, onValue, remove, update } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '../../context/AuthContext';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

const modules = {
    toolbar: [
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        ['clean']
    ],
};

const Notifications = () => {
    const { currentUser } = useAuth();

    // State quản lý form
    const [postMode, setPostMode] = useState('content');
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [attachment, setAttachment] = useState(null);
    const [attachmentTitle, setAttachmentTitle] = useState('');
    const [linkUrl, setLinkUrl] = useState('');
    const [linkTitle, setLinkTitle] = useState('Link bài tập');
    const [codeHtml, setCodeHtml] = useState(''); // chế độ Code: dán HTML soạn sẵn (từ GEM Gemini), có preview trước khi đăng
    const [selectedLabel, setSelectedLabel] = useState('báo bài');

    // Lưới an toàn: chuyển markdown sót trong HTML (**đậm**, *nghiêng*) thành thẻ HTML
    //, phòng khi GEM/giáo viên dán lẫn cú pháp markdown vào code
    const mdToHtml = (html) => (html || '')
        .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
        .replace(/(^|[\s>([])\*([^*\n<]+)\*(?=[\s<.,;:!?)\]]|$)/g, '$1<i>$2</i>');
    const [scope, setScope] = useState('all');
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(false);
    const [notiList, setNotiList] = useState([]);
    const [expandedId, setExpandedId] = useState(null);
    const [toastMsg, setToastMsg] = useState('');
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [editTarget, setEditTarget] = useState(null);   // bản sao thông báo đang sửa
    const [savingEdit, setSavingEdit] = useState(false);
    const [editAttachment, setEditAttachment] = useState(null);  // file MỚI chọn khi sửa
    const [editRemoveAtt, setEditRemoveAtt] = useState(false);   // cờ gỡ file đính kèm

    const showToast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 3500); };

    // State cho Bộ lọc danh sách
    const [filterClass, setFilterClass] = useState('all');
    const [filterLabel, setFilterLabel] = useState('all');
    const [searchKeyword, setSearchKeyword] = useState('');

    const LINK_TITLES = ["Link điểm danh", "Link sự kiện", "Link bài tập", "Link kiểm tra"];
    const LABELS = [
        { id: 'báo bài', color: 'bg-primary-light text-green-700 border-green-200' },
        { id: 'quan trọng', color: 'bg-red-50 text-red-700 border-red-200' },
        { id: 'sự kiện', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' }
    ];

    useEffect(() => {
        onValue(ref(db, 'classes'), (snap) => {
            const data = snap.val();
            if (data) {
                const list = Object.entries(data).map(([id, val]) => ({ id, ...val }));
                const assigned = currentUser?.assignedClasses || [];
                const filtered = currentUser?.role === 'admin' ? list : list.filter(c => assigned.includes(c.id));
                setClasses(filtered);
            }
        });

        onValue(ref(db, 'notifications'), (snap) => {
            const data = snap.val();
            if (data) {
                const list = Object.entries(data)
                    .map(([id, val]) => ({ id, ...val }))
                    .sort((a, b) => new Date(b.date) - new Date(a.date));
                setNotiList(list);
            } else {
                setNotiList([]);
            }
        });
    }, [currentUser]);

    const handlePost = async () => {
        if (postMode === 'content' && (!title || !content)) return showToast("⚠️ Vui lòng nhập tiêu đề và nội dung.");
        if (postMode === 'code' && (!title || !codeHtml.trim())) return showToast("⚠️ Vui lòng nhập tiêu đề và dán code HTML.");
        if (postMode === 'link' && (!linkUrl)) return showToast("⚠️ Vui lòng nhập đường dẫn (URL).");

        setLoading(true);
        try {
            let fileUrl = null;
            let fileName = null;

            if (postMode !== 'link' && attachment) {
                const fileRef = storageRef(storage, `notifications_files/${Date.now()}_${attachment.name}`);
                await uploadBytes(fileRef, attachment);
                fileUrl = await getDownloadURL(fileRef);
                fileName = attachment.name;
            }

            const payload = {
                date: new Date().toISOString(),
                author: currentUser.name,
                // Chế độ Code lưu như 'content' để phía học viên hiển thị y hệt (render HTML sẵn có)
                type: postMode === 'link' ? 'link' : 'content'
            };

            if (postMode !== 'link') {
                payload.title = title;
                payload.content = postMode === 'code' ? mdToHtml(codeHtml) : content;
                payload.label = selectedLabel;
                if (fileUrl) {
                    payload.attachmentUrl = fileUrl;
                    payload.attachmentName = fileName;
                    payload.attachmentTitle = attachmentTitle || fileName;
                }
            } else {
                payload.title = linkTitle;
                payload.linkUrl = linkUrl;
            }

            if (scope === 'all' && currentUser?.role !== 'admin') {
                if (classes.length === 0) {
                    showToast("⚠️ Bạn chưa được phân công lớp nào!");
                    setLoading(false);
                    return;
                }
                const promises = classes.map(c => {
                    const newNotiRef = push(ref(db, 'notifications'));
                    return set(newNotiRef, { ...payload, scope: c.id });
                });
                await Promise.all(promises);
            } else {
                const newNotiRef = push(ref(db, 'notifications'));
                await set(newNotiRef, { ...payload, scope: scope });
            }

            showToast("✅ Đã đăng thông báo thành công!");
            setTitle('');
            setContent('');
            setCodeHtml('');
            setLinkUrl('');
            setAttachment(null);
            setAttachmentTitle('');
        } catch (error) {
            showToast("❌ Lỗi: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Lưu chỉnh sửa: chỉ cập nhật trường nội dung, giữ nguyên ngày đăng + file đính kèm
    const handleSaveEdit = async () => {
        if (!editTarget) return;
        if (editTarget.type === 'content' && (!editTarget.title || !editTarget.content)) return showToast("⚠️ Vui lòng nhập tiêu đề và nội dung.");
        if (editTarget.type === 'link' && !editTarget.linkUrl) return showToast("⚠️ Vui lòng nhập đường dẫn (URL).");
        setSavingEdit(true);
        try {
            const changes = {
                title: editTarget.title || '',
                editedAt: new Date().toISOString(),   // dấu thời gian chỉnh sửa
                editedBy: currentUser.name,           // ai sửa
            };
            if (editTarget.type === 'content') {
                changes.content = mdToHtml(editTarget.content || '');
                changes.label = editTarget.label || 'báo bài';

                // --- Xử lý file đính kèm khi sửa ---
                if (editAttachment) {
                    // Thay file mới: upload lên Storage rồi trỏ URL mới
                    const fileRef = storageRef(storage, `notifications_files/${Date.now()}_${editAttachment.name}`);
                    await uploadBytes(fileRef, editAttachment);
                    changes.attachmentUrl = await getDownloadURL(fileRef);
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
                changes.linkUrl = editTarget.linkUrl || '';
            }
            await update(ref(db, `notifications/${editTarget.id}`), changes);
            showToast("✅ Đã cập nhật thông báo!");
            setEditTarget(null);
        } catch (e) {
            showToast("❌ Lỗi: " + e.message);
        } finally {
            setSavingEdit(false);
        }
    };

    const handleDelete = (id) => setDeleteTarget(id);
    const confirmDelete = async () => {
        await remove(ref(db, `notifications/${deleteTarget}`));
        setDeleteTarget(null);
    };

    const getScopeName = (scopeId) => {
        if (scopeId === 'all') return "Toàn hệ thống";
        const cls = classes.find(c => c.id === scopeId);
        return cls ? `Lớp ${cls.name}` : "Lớp đã xóa";
    };

    const toggleExpand = (id) => {
        setExpandedId(prev => prev === id ? null : id);
    };

    // Icons tối giản
    const IconContent = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>;
    const IconLink = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>;
    const IconCode = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" /></svg>;
    const IconSearch = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-slate-400"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>;

    // === ĐOẠN CODE TỐI ƯU HÓA BẰNG USEMEMO (CHỐNG GIẬT LAG) ===
    const memoizedNotificationList = useMemo(() => {
        const displayedNotis = notiList.filter(noti => {
            const isAdmin = currentUser?.role === 'admin';
            const assignedClasses = currentUser?.assignedClasses || [];

            let canView = false;
            if (isAdmin) canView = true;
            else if (assignedClasses.includes(noti.scope)) canView = true;
            if (!canView) return false;

            if (filterClass !== 'all' && noti.scope !== filterClass) return false;

            if (filterLabel !== 'all') {
                if (filterLabel === 'link' && noti.type !== 'link') return false;
                if (filterLabel !== 'link' && (noti.type !== 'content' || noti.label !== filterLabel)) return false;
            }

            if (searchKeyword) {
                const keyword = searchKeyword.toLowerCase();
                if (!noti.title?.toLowerCase().includes(keyword)) return false;
            }
            return true;
        });

        if (displayedNotis.length === 0) {
            return <p className="text-slate-400 text-sm italic text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">Không tìm thấy thông báo nào phù hợp.</p>;
        }

        return displayedNotis.map(noti => {
            const isExpanded = expandedId === noti.id;

            return (
                <div key={noti.id} className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 flex flex-col gap-3 group hover:border-green-200 transition-all shadow-sm">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2 mb-1">
                            {noti.type === 'link' ? (
                                <span className="bg-primary-light text-green-700 text-[10px] font-bold px-2.5 py-1 rounded-md border border-green-100 flex items-center gap-1 uppercase tracking-wide">
                                    <IconLink /> Link
                                </span>
                            ) : (
                                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md border uppercase tracking-wide ${LABELS.find(l => l.id === noti.label)?.color || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                                    {noti.label}
                                </span>
                            )}
                            <span className="text-[11px] text-slate-400 font-medium font-mono">{new Date(noti.date).toLocaleDateString('vi-VN')}</span>
                            {noti.editedAt && <span className="text-[10px] text-slate-400 italic">(đã sửa)</span>}
                            <span className="text-[11px] font-bold text-primary bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{getScopeName(noti.scope)}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                        <button
                            onClick={() => { setEditTarget({ ...noti }); setEditAttachment(null); setEditRemoveAtt(false); }}
                            className="text-slate-300 hover:text-primary hover:bg-primary-light p-1.5 rounded-xl transition-all"
                            title="Sửa thông báo"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                        </button>
                                                <button
                            onClick={() => handleDelete(noti.id)}
                            className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-xl transition-all"
                            title="Xóa thông báo"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                        </button>
                        </div>
                    </div>

                    <div
                        className={noti.type === 'content' ? "cursor-pointer group/content" : ""}
                        onClick={() => { if (noti.type === 'content') toggleExpand(noti.id); }}
                    >
                        <h4 className={`font-bold text-sm mb-2 transition-colors ${noti.type === 'content' ? 'text-slate-800 group-hover/content:text-primary' : 'text-slate-800'}`}>
                            {noti.title}
                        </h4>

                        {noti.type === 'link' ? (
                            <a
                                href={noti.linkUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary-light hover:bg-green-100 px-3.5 py-2 rounded-xl border border-green-100 transition-colors"
                            >
                                <IconLink /> Mở liên kết
                            </a>
                        ) : (
                            <div className="flex flex-col items-start">
                            <div
                                    className={`quill-content text-xs text-slate-600 leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}
                                    dangerouslySetInnerHTML={{ __html: noti.content }}
                                />

                                {/* Đưa "Xem thêm..." lên ngay dưới nội dung bị rút gọn */}
                                {!isExpanded && noti.content?.length > 120 && (
                                    <span className="text-[10px] text-green-500 font-semibold mt-1.5 mb-1 inline-block group-hover/content:underline">Xem thêm...</span>
                                )}

                                {/* Nút đính kèm tự động xuống hàng và nằm gọn gàng ở dưới cùng */}
                                {noti.attachmentUrl && (
                                    <a
                                        href={noti.attachmentUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary-light hover:bg-green-100 px-3.5 py-2.5 rounded-xl border border-green-100 transition-colors w-fit"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" /></svg>
                                        {noti.attachmentTitle || noti.attachmentName}
                                    </a>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            );
        });
    // Các biến này thay đổi thì danh sách mới cần tải lại:
    }, [notiList, currentUser, filterClass, filterLabel, searchKeyword, expandedId, classes]);
    // === KẾT THÚC ĐOẠN TỐI ƯU ===

    return (
        <div className="space-y-8 animate-fade-in-up pb-10">

            {/* TOAST */}
            {toastMsg && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white flex items-center gap-2"
                    style={{ background: toastMsg.startsWith('✅') ? '#059669' : toastMsg.startsWith('⚠️') ? '#d97706' : '#dc2626' }}>
                    {toastMsg}
                </div>
            )}

            {/* MODAL XÁC NHẬN XÓA */}
            {deleteTarget && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4 border border-slate-100">
                        <p className="text-sm font-medium text-slate-700">Xóa thông báo này? Hành động không thể hoàn tác.</p>
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Hủy</button>
                            <button onClick={confirmDelete} className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition-colors">Xóa</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL SỬA THÔNG BÁO */}
            {editTarget && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl p-6 max-w-lg w-full space-y-4 border border-slate-100 max-h-[90vh] overflow-y-auto">
                        <h3 className="font-bold text-primary">✏️ Sửa thông báo, {getScopeName(editTarget.scope)}</h3>

                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Tiêu đề</label>
                            <input
                                className="input-base"
                                value={editTarget.title || ''}
                                onChange={e => setEditTarget({ ...editTarget, title: e.target.value })}
                            />
                        </div>

                        {editTarget.type === 'link' ? (
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Đường dẫn (URL)</label>
                                <input
                                    className="input-base font-mono"
                                    value={editTarget.linkUrl || ''}
                                    onChange={e => setEditTarget({ ...editTarget, linkUrl: e.target.value })}
                                />
                            </div>
                        ) : (
                            <>
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Nhãn</label>
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
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Nội dung</label>
                                    <ReactQuill theme="snow" modules={modules}
                                        value={editTarget.content || ''}
                                        onChange={(val) => setEditTarget(prev => ({ ...prev, content: val }))}
                                    />
                                </div>
                                {/* FILE ĐÍNH KÈM: giữ / thay / gỡ */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">File đính kèm</label>
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
                                        {(editTarget.attachmentName || editAttachment) ? '🔄 Thay file khác...' : '📎 Chọn file...'}
                                        <input type="file" className="hidden" onChange={e => { if (e.target.files?.[0]) { setEditAttachment(e.target.files[0]); setEditRemoveAtt(false); } }} />
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
                            <button onClick={() => setEditTarget(null)} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Hủy</button>
                            <button onClick={handleSaveEdit} disabled={savingEdit} className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-primary hover:bg-primary-hover transition-colors disabled:opacity-50">
                                {savingEdit ? 'Đang lưu...' : 'Lưu thay đổi'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .ql-editor ul { list-style-type: disc !important; padding-left: 1.5rem !important; margin-bottom: 0.5rem !important; }
                .ql-editor ol { list-style-type: decimal !important; padding-left: 1.5rem !important; margin-bottom: 0.5rem !important; }
                .ql-editor li { padding-left: 0.25rem !important; margin-bottom: 0.25rem !important; }
            `}</style>
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                <div className="p-2 bg-primary-light rounded-xl text-primary">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.795c0 1.94-.254 3.82-.734 5.622m-4.731.213a23.87 23.87 0 005.932 2.535m0 0A23.753 23.753 0 0122.5 6" /></svg>
                </div>
                <h2 className="page-title">Đăng Thông Báo Mới</h2>
            </div>

            <div className="card-std p-5 md:p-6 max-w-3xl">
                <div className="flex gap-3 mb-6">
                    <button
                        onClick={() => setPostMode('content')}
                        className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all border flex items-center justify-center gap-2 ${postMode === 'content' ? 'bg-primary text-white border-primary' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                    >
                        <IconContent /> Nội dung
                    </button>
                    <button
                        onClick={() => setPostMode('link')}
                        className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all border flex items-center justify-center gap-2 ${postMode === 'link' ? 'bg-primary text-white border-primary' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                    >
                        <IconLink /> Hyperlink
                    </button>
                    <button
                        onClick={() => setPostMode('code')}
                        className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all border flex items-center justify-center gap-2 ${postMode === 'code' ? 'bg-primary text-white border-primary' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                    >
                        <IconCode /> Code
                    </button>
                </div>

                <div className="mb-4">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phạm vi hiển thị</label>
                    <select
                        className="input-base"
                        value={scope}
                        onChange={(e) => setScope(e.target.value)}
                    >
                        <option value="all">Toàn bộ hệ thống</option>
                        {classes.map(c => <option key={c.id} value={c.id}>Lớp: {c.name}</option>)}
                    </select>
                </div>

                {postMode === 'content' ? (
                    <div className="animate-fade-in">
                        <div className="mb-4">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Nhãn dán (Label)</label>
                            <div className="flex gap-2">
                                {LABELS.map(lbl => (
                                    <button
                                        key={lbl.id}
                                        onClick={() => setSelectedLabel(lbl.id)}
                                        className={`px-3 py-1.5 rounded-md text-[10px] font-bold border transition-all uppercase tracking-wider ${selectedLabel === lbl.id ? lbl.color + ' ring-2 ring-offset-1 ring-green-200' : 'bg-white text-slate-400 border-slate-200'}`}
                                    >
                                        {lbl.id}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="mb-4">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tiêu đề</label>
                            <input
                                className="input-base"
                                placeholder="Nhập tiêu đề thông báo..."
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                            />
                        </div>
                        <div className="mb-4">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">File đính kèm (Tùy chọn: HTML, PDF...)</label>
                            <input
                                type="file"
                                accept=".html,.htm,.pdf,.doc,.docx"
                                onChange={(e) => setAttachment(e.target.files[0])}
                                className="w-full p-2 border border-slate-200 rounded-xl outline-none text-sm bg-slate-50 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-light file:text-green-700 hover:file:bg-green-100 transition-colors cursor-pointer"
                            />
                        </div>
                        {/* THÊM KHUNG NHẬP TIÊU ĐỀ FILE VÀO ĐÂY */}
                        {attachment && (
                            <div className="mb-4 animate-fade-in">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tên hiển thị cho File đính kèm</label>
                                <input
                                    className="input-base"
                                    placeholder="Ví dụ: Tài liệu ôn tập Body Paragraph..."
                                    value={attachmentTitle}
                                    onChange={(e) => setAttachmentTitle(e.target.value)}
                                />
                            </div>
                        )}
                        <div className="mb-6">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nội dung chi tiết</label>
                            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                <ReactQuill
                                    theme="snow"
                                    modules={modules}
                                    value={content}
                                    onChange={setContent}
                                    placeholder="Nội dung sẽ được hiển thị cho học viên..."
                                    className="h-40 pb-10"
                                />
                            </div>
                        </div>
                    </div>
                ) : postMode === 'code' ? (
                    <div className="animate-fade-in">
                        {/* CHẾ ĐỘ CODE: dán HTML soạn sẵn (VD từ GEM Gemini), giữ định dạng chuẩn, có preview trước khi đăng */}
                        <div className="mb-4">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Nhãn dán (Label)</label>
                            <div className="flex gap-2">
                                {LABELS.map(lbl => (
                                    <button
                                        key={lbl.id}
                                        onClick={() => setSelectedLabel(lbl.id)}
                                        className={`px-3 py-1.5 rounded-md text-[10px] font-bold border transition-all uppercase tracking-wider ${selectedLabel === lbl.id ? lbl.color + ' ring-2 ring-offset-1 ring-green-200' : 'bg-white text-slate-400 border-slate-200'}`}
                                    >
                                        {lbl.id}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="mb-4">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tiêu đề</label>
                            <input
                                className="input-base"
                                placeholder="Nhập tiêu đề thông báo..."
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                            />
                        </div>
                        <div className="mb-4">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">File đính kèm (Tùy chọn: HTML, PDF...)</label>
                            <input
                                type="file"
                                accept=".html,.htm,.pdf,.doc,.docx"
                                onChange={(e) => setAttachment(e.target.files[0])}
                                className="w-full p-2 border border-slate-200 rounded-xl outline-none text-sm bg-slate-50 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-light file:text-green-700 hover:file:bg-green-100 transition-colors cursor-pointer"
                            />
                        </div>
                        {attachment && (
                            <div className="mb-4 animate-fade-in">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tên hiển thị cho File đính kèm</label>
                                <input
                                    className="input-base"
                                    placeholder="Ví dụ: Tài liệu ôn tập Body Paragraph..."
                                    value={attachmentTitle}
                                    onChange={(e) => setAttachmentTitle(e.target.value)}
                                />
                            </div>
                        )}
                        <div className="mb-4">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Code HTML (dán từ GEM / mẫu soạn sẵn)</label>
                            <textarea
                                value={codeHtml}
                                onChange={(e) => setCodeHtml(e.target.value)}
                                placeholder={'Dán code HTML vào đây, ví dụ:\n<h3 style="color:#2B6830;">1. THEORY MASTERY</h3>\n<ol><li>The 4 Main Comma Rules...</li></ol>'}
                                spellCheck={false}
                                className="input-base h-44 text-xs font-mono resize-y"
                            />
                        </div>
                        <div className="mb-6">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                Xem trước (Preview) <span className="normal-case font-semibold text-green-600">học viên sẽ thấy đúng như bên dưới</span>
                            </label>
                            <div className="border-2 border-dashed border-green-200 rounded-xl p-4 bg-white min-h-[80px]">
                                {codeHtml.trim() ? (
                                    <>
                                        {title && <div className="text-sm font-bold text-primary mb-2">{title}</div>}
                                        <div
                                            className="quill-content text-xs text-slate-600 leading-relaxed"
                                            dangerouslySetInnerHTML={{ __html: mdToHtml(codeHtml) }}
                                        />
                                    </>
                                ) : (
                                    <div className="text-xs text-slate-400 italic">Preview sẽ hiện ở đây khi bạn dán code...</div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="animate-fade-in">
                        <div className="mb-4">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tiêu đề liên kết</label>
                            <select
                                className="input-base font-semibold text-primary"
                                value={linkTitle}
                                onChange={(e) => setLinkTitle(e.target.value)}
                            >
                                {LINK_TITLES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div className="mb-6">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Đường dẫn (URL)</label>
                            <input
                                className="input-base font-mono text-green-600"
                                placeholder="https://..."
                                value={linkUrl}
                                onChange={(e) => setLinkUrl(e.target.value)}
                            />
                        </div>
                    </div>
                )}

                <button
                    onClick={handlePost}
                    disabled={loading}
                    className="btn-primary w-full"
                >
                    {loading ? "Đang xử lý..." : (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
                            Đăng Thông Báo
                        </>
                    )}
                </button>
            </div>

            <div className="border-t border-slate-200 pt-8">
                <h3 className="section-title mb-4">Danh sách Thông báo đã tạo</h3>

                <div className="flex flex-col md:flex-row gap-3 mb-6">
                    <select
                        className="input-base md:w-auto"
                        value={filterClass}
                        onChange={e => setFilterClass(e.target.value)}
                    >
                        <option value="all">-- Tất cả lớp phụ trách --</option>
                        {classes.map(c => <option key={c.id} value={c.id}>Lớp {c.name}</option>)}
                    </select>

                    <select
                        className="input-base md:w-auto"
                        value={filterLabel}
                        onChange={e => setFilterLabel(e.target.value)}
                    >
                        <option value="all">-- Tất cả loại thông báo --</option>
                        <option value="báo bài">Báo bài</option>
                        <option value="quan trọng">Quan trọng</option>
                        <option value="sự kiện">Sự kiện</option>
                        <option value="link">Hyperlink (Link)</option>
                    </select>

                    <div className="flex-1 relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <IconSearch />
                        </div>
                        <input
                            type="text"
                            className="input-base pl-10"
                            placeholder="Tìm kiếm theo tiêu đề..."
                            value={searchKeyword}
                            onChange={e => setSearchKeyword(e.target.value)}
                        />
                    </div>
                </div>

                <div className="space-y-4">
                    {/* KHÔNG CÒN VÒNG LẶP TRỰC TIẾP Ở ĐÂY NỮA MÀ SỬ DỤNG BIẾN ĐÃ ĐƯỢC CACHE BỞI USEMEMO */}
                    {memoizedNotificationList}
                </div>
            </div>
        </div>
    );
};

export default Notifications;
