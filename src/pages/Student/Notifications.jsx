import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { ref, onValue } from 'firebase/database';
import { useAuth } from '../../context/AuthContext';

const Notifications = () => {
    const { currentUser } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    // State mở rộng nội dung
    const [expandedId, setExpandedId] = useState(null);
    const [filterLabel, setFilterLabel] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    // THÊM DÒNG NÀY: State quản lý việc mở cửa sổ xem file đính kèm
    const [selectedFile, setSelectedFile] = useState(null);
    const [iframeLoading, setIframeLoading] = useState(true);

    const LABELS = {
        'báo bài': 'bg-[#E8F4EC] text-green-700 border-green-200',
        'quan trọng': 'bg-red-50 text-red-700 border-red-200',
        'sự kiện': 'bg-yellow-50 text-yellow-700 border-yellow-200'
    };

    useEffect(() => {
        if (!currentUser) return;

        const notiRef = ref(db, 'notifications');
        const unsubscribe = onValue(notiRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const myClassIds = Array.isArray(currentUser.classIds)
                    ? currentUser.classIds
                    : Object.values(currentUser.classIds || {});

                // Lấy ra danh sách các thông báo thuộc lớp của học viên này
                let list = Object.entries(data)
                    .map(([id, val]) => ({ id, ...val }))
                    .filter(noti => noti.scope === 'all' || myClassIds.includes(noti.scope));

                // --- BỘ LỌC THỜI GIAN KHÓA (CHỈ LẤY THÔNG BÁO CŨ) ---
                if (currentUser?.lockedAt) {
                    const lockTime = new Date(currentUser.lockedAt).getTime();
                    list = list.filter(noti => new Date(noti.date).getTime() <= lockTime);
                }
                // --------------------------------------------------

                // Sắp xếp bài mới nhất lên đầu
                list.sort((a, b) => new Date(b.date) - new Date(a.date));
                setNotifications(list);
            } else {
                setNotifications([]);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser]);

    const toggleExpand = (id) => {
        setExpandedId(prev => prev === id ? null : id);
    };

    // Lọc theo label và search
    const filteredNotifications = notifications.filter(n => {
        if (filterLabel !== 'all') {
            if (filterLabel === 'link' && n.type !== 'link') return false;
            if (filterLabel !== 'link' && (n.type === 'link' || n.label !== filterLabel)) return false;
        }
        if (searchTerm && !n.title?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        return true;
    });

    // Icons tối giản
    const IconLink = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>;
    const IconBell = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>;

    return (
        
        <div className="space-y-6 pb-20 animate-fade-in-up">
            {/* --- THANH CẢNH BÁO TÀI KHOẢN BỊ GIỚI HẠN (MÀU VÀNG NHẸ NHÀNG) --- */}
            {(currentUser?.lockedAt || currentUser?.isLocked) && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex gap-3 items-start shadow-sm mb-6">
                    <div className="text-yellow-600 mt-0.5 flex-shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-yellow-800">Tài khoản bị giới hạn tính năng</h3>
                        <p className="text-xs text-yellow-700 mt-1 leading-relaxed">
                            {currentUser?.lockedAt 
                                ? <>Bạn chỉ có thể xem các thông báo được đăng trước ngày <strong>{new Date(currentUser.lockedAt).toLocaleDateString('vi-VN')}</strong>.</> 
                                : <>Bạn chỉ có thể xem các thông báo cũ.</>
                            } Vui lòng hoàn thành học phí để nhận các thông báo và bài tập mới nhất.
                        </p>
                    </div>
                </div>
            )}
            {/* ------------------------------------------------------------- */}
            <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
                <div className="p-2 bg-[#E8F4EC] rounded-xl text-[#2B6830]">
                    <IconBell />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-[#2B6830]">Bảng Tin & Sự Kiện</h2>
                    <p className="text-xs text-slate-400 font-medium hidden md:block">Cập nhật tin tức mới nhất từ hệ thống</p>
                </div>
            </div>

            {/* FILTER + SEARCH */}
            {!loading && notifications.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
                        {[
                            { id: 'all',        label: 'Tất cả' },
                            { id: 'báo bài',    label: '📝 Báo bài' },
                            { id: 'quan trọng', label: '🔴 Quan trọng' },
                            { id: 'sự kiện',    label: '🎉 Sự kiện' },
                            { id: 'link',       label: '🔗 Link' },
                        ].map(f => (
                            <button
                                key={f.id}
                                onClick={() => setFilterLabel(f.id)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${filterLabel === f.id ? 'bg-white text-[#2B6830] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex-1 min-w-[180px] relative">
                        <input
                            className="w-full border border-slate-200 pl-8 pr-4 py-2 rounded-xl text-xs outline-none focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10 transition"
                            placeholder="Tìm theo tiêu đề..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#94a3b8" className="w-4 h-4 absolute left-2.5 top-2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                        </svg>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="space-y-3">
                    {[1,2,3].map(i => (
                        <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 animate-pulse space-y-2">
                            <div className="flex gap-2"><div className="h-5 bg-slate-100 rounded w-16" /><div className="h-5 bg-slate-100 rounded w-24" /></div>
                            <div className="h-4 bg-slate-100 rounded w-3/4" />
                            <div className="h-3 bg-slate-100 rounded w-full" />
                        </div>
                    ))}
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredNotifications.length === 0 ? (
                        <div className="bg-white rounded-xl border border-dashed border-slate-200 p-8 text-center">
                            <p className="text-slate-400 text-sm">{notifications.length === 0 ? 'Chưa có thông báo nào.' : 'Không tìm thấy thông báo phù hợp.'}</p>
                            {(filterLabel !== 'all' || searchTerm) && (
                                <button onClick={() => { setFilterLabel('all'); setSearchTerm(''); }} className="mt-2 text-[#2B6830] text-xs font-bold hover:underline">Xóa bộ lọc</button>
                            )}
                        </div>
                    ) : filteredNotifications.map((noti) => {
                            const isExpanded = expandedId === noti.id;

                            return (
                                <div key={noti.id} className="bg-white p-5 md:p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col gap-3 group">

                                    <div className="flex items-center gap-2 mb-1">
                                        {noti.type === 'link' ? (
                                            <span className="bg-[#E8F4EC] text-green-700 text-[10px] font-bold px-2.5 py-1 rounded-md border border-green-100 flex items-center gap-1 uppercase tracking-wide">
                                                <IconLink /> Link
                                            </span>
                                        ) : (
                                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md border uppercase tracking-wide ${LABELS[noti.label] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                                                {noti.label}
                                            </span>
                                        )}
                                        <span className="text-[11px] text-slate-400 font-medium font-mono">
                                            {new Date(noti.date).toLocaleDateString('vi-VN')}
                                        </span>
                                        {noti.scope === 'all' && (
                                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 ml-auto">
                                                Tin chung
                                            </span>
                                        )}
                                    </div>

                                    <div
                                        className={noti.type === 'content' ? "cursor-pointer group/content" : ""}
                                        onClick={() => { if (noti.type === 'content') toggleExpand(noti.id); }}
                                    >
                                        <h3 className={`font-bold text-sm md:text-base mb-2 transition-colors ${noti.type === 'content' ? 'text-slate-800 group-hover/content:text-[#2B6830]' : 'text-slate-800'}`}>
                                            {noti.title}
                                        </h3>

                                        {noti.type === 'link' ? (
                                            <a
                                                href={noti.linkUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2B6830] bg-[#E8F4EC] hover:bg-green-100 px-3.5 py-2 rounded-xl border border-green-100 transition-colors w-fit mt-1"
                                            >
                                                <IconLink /> Mở liên kết
                                            </a>
                                        ) : (
                                                <div className="flex flex-col items-start">
                                                <div 
                                                    className={`quill-content text-sm text-slate-600 leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}
                                                    dangerouslySetInnerHTML={{ __html: noti.content }}
                                                />
                                                {!isExpanded && noti.content?.length > 120 && (
                                                    <span className="text-[10px] text-green-500 font-semibold mt-1.5 mb-1 inline-block group-hover/content:underline">Xem thêm...</span>
                                                )}
                                                {/* Nút Xem File Đính Kèm */}
                                                {noti.attachmentUrl && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation(); 
                                                            setIframeLoading(true);
                                                            // Sửa name lấy theo title mới:
                                                            setSelectedFile({ url: noti.attachmentUrl, name: (noti.attachmentTitle || noti.attachmentName) }); 
                                                        }}
                                                        className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#2B6830] bg-[#E8F4EC] hover:bg-green-100 px-3.5 py-2.5 rounded-xl border border-green-100 transition-colors w-fit"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" /></svg>
                                                        
                                                        {/* SỬA DÒNG DƯỚI ĐÂY */}
                                                        {noti.attachmentTitle || noti.attachmentName}
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                </div>
            )}
            {/* --- CỬA SỔ POPUP HIỂN THỊ FILE NHÚNG DÁN Ở ĐÂY (BÊN TRONG THẺ DIV CUỐI CÙNG) --- */}
            {selectedFile && (
                <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden border border-slate-100">
                        {/* Header */}
                        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 shrink-0">
                            <h3 className="text-sm font-bold text-[#2B6830] truncate">{selectedFile.name || 'Tài liệu đính kèm'}</h3>
                            <div className="flex items-center gap-2 shrink-0">
                                <a
                                    href={selectedFile.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs font-semibold text-[#2B6830] bg-[#E8F4EC] hover:bg-green-100 px-3 py-1.5 rounded-xl border border-green-100 transition-colors"
                                >
                                    Mở tab mới
                                </a>
                                <button
                                    onClick={() => { setSelectedFile(null); setIframeLoading(true); }}
                                    className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                                    aria-label="Đóng"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        </div>
                        {/* Nội dung file — nhúng qua Google Docs Viewer */}
                        <div className="relative flex-1 bg-slate-50">
                            {iframeLoading && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-8 h-8 border-4 border-green-100 border-t-[#2B6830] rounded-full animate-spin" />
                                </div>
                            )}
                            <iframe
                                src={`https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(selectedFile.url)}`}
                                title={selectedFile.name || 'file'}
                                className="w-full h-full"
                                onLoad={() => setIframeLoading(false)}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Notifications;
