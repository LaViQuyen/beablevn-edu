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

    // THÊM DÒNG NÀY: State quản lý việc mở cửa sổ xem file đính kèm
    const [selectedFile, setSelectedFile] = useState(null);
    const [iframeLoading, setIframeLoading] = useState(true);

    const LABELS = {
        'báo bài': 'bg-blue-50 text-blue-700 border-blue-200',
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

                const notiList = Object.entries(data)
                    .map(([id, val]) => ({ id, ...val }))
                    .filter(n => n.scope === 'all' || myClassIds.includes(n.scope))
                    .sort((a, b) => new Date(b.date) - new Date(a.date));

                setNotifications(notiList);
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

    // Icons tối giản
    const IconLink = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>;
    const IconBell = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>;

    return (
        <div className="space-y-6 mt-16 md:mt-0 pb-20 animate-fade-in-up">
            <style>{`
                .quill-content ul { list-style-type: disc !important; padding-left: 1.5rem !important; margin-bottom: 0.5rem !important; }
                .quill-content ol { list-style-type: decimal !important; padding-left: 1.5rem !important; margin-bottom: 0.5rem !important; }
                .quill-content li { padding-left: 0.25rem !important; margin-bottom: 0.25rem !important; }
            `}</style>
            <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
                <div className="p-2 bg-blue-50 rounded-lg text-[#003366]">
                    <IconBell />
                </div>
                <div>
                    <h2 className="text-xl md:text-2xl font-bold text-[#003366]">Bảng Tin & Sự Kiện</h2>
                    <p className="text-xs text-slate-400 font-medium hidden md:block">Cập nhật tin tức mới nhất từ hệ thống</p>
                </div>
            </div>

            {loading ? <p className="text-slate-400 text-center py-10 font-medium text-sm">Đang tải bảng tin...</p> : (
                <div className="space-y-4">
                    {notifications.length > 0 ? (
                        notifications.map((noti) => {
                            const isExpanded = expandedId === noti.id;

                            return (
                                <div key={noti.id} className="bg-white p-4 md:p-5 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col gap-3 group">

                                    <div className="flex items-center gap-2 mb-1">
                                        {noti.type === 'link' ? (
                                            <span className="bg-purple-50 text-purple-700 text-[10px] font-bold px-2.5 py-1 rounded-md border border-purple-100 flex items-center gap-1 uppercase tracking-wide">
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
                                        <h3 className={`font-bold text-sm md:text-base mb-2 transition-colors ${noti.type === 'content' ? 'text-slate-800 group-hover/content:text-[#003366]' : 'text-slate-800'}`}>
                                            {noti.title}
                                        </h3>

                                        {noti.type === 'link' ? (
                                            <a
                                                href={noti.linkUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#003366] bg-blue-50 hover:bg-blue-100 px-3.5 py-2 rounded-lg border border-blue-100 transition-colors w-fit mt-1"
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
                                                    <span className="text-[10px] text-blue-500 font-semibold mt-1.5 mb-1 inline-block group-hover/content:underline">Xem thêm...</span>
                                                )}
                                                {/* --- Nút Xem File Đính Kèm (Đã sửa đổi) --- */}
                                                {noti.attachmentUrl && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation(); 
                                                            setIframeLoading(true);
                                                            setSelectedFile({ url: noti.attachmentUrl, name: noti.attachmentName }); 
                                                        }}
                                                        className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#003366] bg-blue-50 hover:bg-blue-100 px-3.5 py-2.5 rounded-lg border border-blue-100 transition-colors w-fit"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" /></svg>
                                                        Xem file: {noti.attachmentName}
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })
                    ) : (
                        <div className="text-center py-10 bg-white rounded-xl border border-dashed border-slate-200">
                            <p className="text-slate-400 text-sm">Hiện chưa có thông báo nào dành cho bạn.</p>
                        </div>
                    )}
                </div>
            )}
            {/* --- CỬA SỔ POPUP HIỂN THỊ FILE NHÚNG DÁN Ở ĐÂY (BÊN TRONG THẺ DIV CUỐI CÙNG) --- */}
            {selectedFile && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 sm:p-6">
                    {/* Khung trắng */}
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                        {/* Thanh Tiêu đề & Nút Tắt */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
                            <h3 className="font-bold text-slate-800 text-sm md:text-base truncate pr-4">
                                {selectedFile.name}
                            </h3>
                            <button
                                onClick={() => setSelectedFile(null)}
                                className="p-2 bg-slate-200 hover:bg-red-100 text-slate-600 hover:text-red-600 rounded-lg transition-colors flex-shrink-0"
                                title="Đóng cửa sổ"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        {/* Khu vực hiển thị file (Iframe) */}
                        <div className="flex-1 bg-[#f7f5f0] relative flex items-center justify-center">
                            
                            {/* --- Hiệu ứng Vòng xoay Đang tải --- */}
                            {iframeLoading && (
                                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm">
                                    <svg className="w-10 h-10 text-blue-600 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <p className="mt-3 text-sm font-semibold text-slate-500 animate-pulse">
                                        Đang tải tài liệu...
                                    </p>
                                </div>
                            )}

                            {/* Khung nhúng file */}
                            <iframe
                                src={selectedFile.url}
                                className="absolute inset-0 w-full h-full border-0"
                                title={selectedFile.name}
                                sandbox="allow-scripts allow-same-origin"
                                onLoad={() => setIframeLoading(false)} /* <--- Tự động tắt vòng xoay khi file đã hiện ra */
                            ></iframe>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Notifications;
