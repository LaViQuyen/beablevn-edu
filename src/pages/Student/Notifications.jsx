import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../../firebase';
import { ref, onValue } from 'firebase/database';
import { useAuth } from '../../context/AuthContext';
import { getReserveStatus, fmtReserveDate } from '../../utils/reserve';
import { isContactBookNoti } from '../../utils/contactBook';

const Notifications = () => {
    const { currentUser } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    // State mở rộng nội dung
    const [expandedId, setExpandedId] = useState(null);
    const [filterLabel, setFilterLabel] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    // Nhóm theo lớp: nạp tên lớp + chế độ xem + lọc theo lớp
    const [classMap, setClassMap] = useState({});           // { classId: tên lớp }
    const [viewMode, setViewMode] = useState('class');      // 'class' = nhóm theo lớp, 'time' = mới nhất
    const [filterClass, setFilterClass] = useState('all');  // 'all' | classId | 'sys' (Tin chung)

    // THÊM DÒNG NÀY: State quản lý việc mở cửa sổ xem file đính kèm
    const [selectedFile, setSelectedFile] = useState(null);
    const [iframeLoading, setIframeLoading] = useState(true);

    const LABELS = {
        'báo bài': 'bg-primary-light text-green-700 border-green-200',
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

                // Lấy ra danh sách các thông báo thuộc lớp của học viên này.
                // Báo bài + Link điểm danh đã CHUYỂN HẲN vào Sổ liên lạc → lọc bỏ ở đây, tránh trùng lặp.
                let list = Object.entries(data)
                    .map(([id, val]) => ({ id, ...val }))
                    .filter(noti => (noti.scope === 'all' || myClassIds.includes(noti.scope)) && !isContactBookNoti(noti));

                // --- BỘ LỌC THỜI GIAN KHÓA (CHỈ LẤY THÔNG BÁO CŨ) ---
                if (currentUser?.lockedAt) {
                    const lockTime = new Date(currentUser.lockedAt).getTime();
                    list = list.filter(noti => new Date(noti.date).getTime() <= lockTime);
                }
                // --------------------------------------------------

                // --- BẢO LƯU: ẩn thông báo đăng từ ngày bắt đầu bảo lưu cho tới khi hết bảo lưu ---
                const rsv = currentUser?.reserve;
                if (rsv?.start && rsv?.end) {
                    const now = Date.now();
                    const startT = new Date(rsv.start + 'T00:00:00').getTime();
                    const endT = new Date(rsv.end + 'T23:59:59').getTime();
                    if (now >= startT && now <= endT) {
                        // Đang bảo lưu: chỉ thấy thông báo đăng TRƯỚC ngày bắt đầu bảo lưu
                        list = list.filter(noti => new Date(noti.date).getTime() < startT);
                    }
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

    // Nạp tên lớp để hiển thị chip lớp + gom nhóm theo lớp
    useEffect(() => {
        const unsub = onValue(ref(db, 'classes'), (snap) => {
            const data = snap.val() || {};
            const map = {};
            Object.entries(data).forEach(([id, val]) => { map[id] = val?.name || 'Lớp'; });
            setClassMap(map);
        }, () => {});
        return () => unsub();
    }, []);

    // Tên hiển thị của phạm vi tin: 'all' -> Tin chung; classId -> tên lớp
    const scopeName = (scope) => scope === 'all' ? 'Tin chung' : (classMap[scope] || 'Lớp');

    const toggleExpand = (id) => {
        setExpandedId(prev => prev === id ? null : id);
    };

    // Lọc theo label, theo lớp VÀ search
    const filteredNotifications = notifications.filter(n => {
        if (filterLabel !== 'all') {
            if (filterLabel === 'link' && n.type !== 'link') return false;
            if (filterLabel !== 'link' && (n.type === 'link' || n.label !== filterLabel)) return false;
        }
        if (filterClass !== 'all') {
            if (filterClass === 'sys' && n.scope !== 'all') return false;
            if (filterClass !== 'sys' && n.scope !== filterClass) return false;
        }
        if (searchTerm && !n.title?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        return true;
    });

    // Viền trái theo loại tin: báo bài & link xanh, quan trọng đỏ, sự kiện vàng
    const accentColor = (n) => n.label === 'quan trọng' ? '#dc2626'
        : n.label === 'sự kiện' ? '#ca8a04'
        : '#2B6830';

    // Các lớp của học viên có phát sinh tin (dựng chip lọc + nhóm), theo thứ tự classIds
    const myClassIds = Array.isArray(currentUser?.classIds) ? currentUser.classIds : Object.values(currentUser?.classIds || {});
    const classesWithNotis = myClassIds.filter(cid => notifications.some(n => n.scope === cid));
    const hasSysNotis = notifications.some(n => n.scope === 'all');

    // Gom nhóm cho chế độ "Theo lớp"
    const groups = [];
    classesWithNotis.forEach(cid => {
        const items = filteredNotifications.filter(n => n.scope === cid);
        if (items.length) groups.push({ key: cid, name: classMap[cid] || 'Lớp', items });
    });
    const sysItems = filteredNotifications.filter(n => n.scope === 'all');
    if (sysItems.length) groups.push({ key: 'sys', name: 'Tin chung', items: sysItems });

    // Icons tối giản
    const IconLink = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>;
    const IconBell = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>;

    // Một thẻ thông báo (dùng chung cho cả "xem theo lớp" và "mới nhất"): viền trái theo loại + chip lớp
    const renderCard = (noti) => {
        const isExpanded = expandedId === noti.id;
        return (
            <div key={noti.id} className="card-std p-5 md:p-6 hover:shadow-md transition-all flex flex-col gap-3 group" style={{ borderLeft: `4px solid ${accentColor(noti)}` }}>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                    {noti.type === 'link' ? (
                        <span className="bg-primary-light text-green-700 text-[10px] font-bold px-2.5 py-1 rounded-md border border-green-100 flex items-center gap-1 uppercase tracking-wide">
                            <IconLink /> Link
                        </span>
                    ) : (
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md border uppercase tracking-wide ${LABELS[noti.label] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                            {noti.label}
                        </span>
                    )}
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-md border ${noti.scope === 'all' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                        {noti.scope === 'all' ? 'Tin chung' : scopeName(noti.scope)}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium font-mono ml-auto">
                        {new Date(noti.date).toLocaleDateString('vi-VN')}
                    </span>
                </div>

                <div
                    className={noti.type === 'content' ? "cursor-pointer group/content" : ""}
                    onClick={() => { if (noti.type === 'content') toggleExpand(noti.id); }}
                >
                    <h3 className={`font-bold text-sm md:text-base mb-2 transition-colors ${noti.type === 'content' ? 'text-slate-800 group-hover/content:text-primary' : 'text-slate-800'}`}>
                        {noti.title}
                    </h3>

                    {noti.type === 'link' ? (
                        <a href={noti.linkUrl} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary-light hover:bg-green-100 px-3.5 py-2 rounded-xl border border-green-100 transition-colors w-fit mt-1">
                            <IconLink /> Mở liên kết
                        </a>
                    ) : (
                        <div className="flex flex-col items-start">
                            <div className={`quill-content text-sm text-slate-600 leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}
                                dangerouslySetInnerHTML={{ __html: noti.content }} />
                            {!isExpanded && noti.content?.length > 120 && (
                                <span className="text-[10px] text-green-500 font-semibold mt-1.5 mb-1 inline-block group-hover/content:underline">Xem thêm...</span>
                            )}
                            {noti.attachmentUrl && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setIframeLoading(true); setSelectedFile({ url: noti.attachmentUrl, name: (noti.attachmentTitle || noti.attachmentName) }); }}
                                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary-light hover:bg-green-100 px-3.5 py-2.5 rounded-xl border border-green-100 transition-colors w-fit">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" /></svg>
                                    {noti.attachmentTitle || noti.attachmentName}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    };

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
            {/* --- BANNER BẢO LƯU --- */}
            {getReserveStatus(currentUser) && currentUser?.reserve && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3 items-start shadow-sm mb-6">
                    <div className="text-blue-600 mt-0.5 flex-shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-blue-800">Tài khoản đang trong thời gian bảo lưu</h3>
                        <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                            Từ <strong>{fmtReserveDate(currentUser.reserve.start)}</strong> đến <strong>{fmtReserveDate(currentUser.reserve.end)}</strong>, bạn <strong>không xem được</strong> các thông báo (báo bài, quan trọng, sự kiện, links) đăng trong khoảng thời gian này. Các thông báo đó sẽ tự hiển thị lại sau khi kết thúc bảo lưu.
                        </p>
                    </div>
                </div>
            )}
            {/* ------------------------------------------------------------- */}
            <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
                <div className="p-2 bg-primary-light rounded-xl text-primary">
                    <IconBell />
                </div>
                <div>
                    <h2 className="page-title">Bảng Tin & Sự Kiện</h2>
                    <p className="page-sub hidden md:block">Cập nhật tin tức mới nhất từ hệ thống</p>
                </div>
            </div>

            {/* Dẫn hướng: báo bài + link điểm danh đã dời sang Sổ liên lạc */}
            <div className="flex items-center gap-3 bg-primary-subtle border border-green-100 rounded-xl px-4 py-3">
                <span className="text-lg">📖</span>
                <p className="text-xs text-slate-600 flex-1">
                    <b>Báo bài</b> và <b>Link điểm danh</b> của từng lớp giờ nằm trong <b>Sổ liên lạc</b>, không hiển thị ở trang này nữa.
                </p>
                <Link to="/student/lienlac" className="shrink-0 text-xs font-bold text-primary bg-white px-3 py-1.5 rounded-lg border border-green-200 hover:bg-primary-light transition-colors">Mở sổ →</Link>
            </div>

            {/* FILTER + SEARCH */}
            {!loading && notifications.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
                        {[
                            { id: 'all',        label: 'Tất cả' },
                            { id: 'quan trọng', label: '🔴 Quan trọng' },
                            { id: 'sự kiện',    label: '🎉 Sự kiện' },
                            { id: 'link',       label: '🔗 Link' },
                        ].map(f => (
                            <button
                                key={f.id}
                                onClick={() => setFilterLabel(f.id)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${filterLabel === f.id ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex-1 min-w-[180px] relative">
                        <input
                            className="w-full border border-slate-200 pl-8 pr-4 py-2 rounded-xl text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
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

            {/* CHUYỂN CHẾ ĐỘ XEM (theo lớp / mới nhất) + LỌC THEO LỚP */}
            {!loading && notifications.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
                        {[{ id: 'class', label: 'Theo lớp' }, { id: 'time', label: 'Mới nhất' }].map(v => (
                            <button key={v.id} onClick={() => setViewMode(v.id)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${viewMode === v.id ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                {v.label}
                            </button>
                        ))}
                    </div>
                    {(classesWithNotis.length > 0 || hasSysNotis) && (
                        <div className="flex gap-1.5 flex-wrap">
                            <button onClick={() => setFilterClass('all')}
                                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${filterClass === 'all' ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-slate-200 hover:border-green-300'}`}>
                                Tất cả lớp
                            </button>
                            {classesWithNotis.map(cid => (
                                <button key={cid} onClick={() => setFilterClass(cid)}
                                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${filterClass === cid ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-slate-200 hover:border-green-300'}`}>
                                    {classMap[cid] || 'Lớp'}
                                </button>
                            ))}
                            {hasSysNotis && (
                                <button onClick={() => setFilterClass('sys')}
                                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${filterClass === 'sys' ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-slate-200 hover:border-green-300'}`}>
                                    Tin chung
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {loading ? (
                <div className="space-y-3">
                    {[1,2,3].map(i => (
                        <div key={i} className="card-std p-5 animate-pulse space-y-2">
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
                            {(filterLabel !== 'all' || searchTerm || filterClass !== 'all') && (
                                <button onClick={() => { setFilterLabel('all'); setSearchTerm(''); setFilterClass('all'); }} className="mt-2 text-primary text-xs font-bold hover:underline">Xóa bộ lọc</button>
                            )}
                        </div>
                    ) : viewMode === 'class' ? (
                        <div className="space-y-6">
                            {groups.map(g => (
                                <div key={g.key} className="space-y-3">
                                    <div className="flex items-center gap-2 px-0.5">
                                        <span className="text-sm font-black text-primary">{g.key === 'sys' ? '📢 ' : '📘 '}{g.name}</span>
                                        <span className="text-[10px] font-bold text-primary bg-primary-light px-2 py-0.5 rounded-full border border-green-100">{g.items.length} tin</span>
                                        <div className="flex-1 h-px bg-slate-100" />
                                    </div>
                                    <div className="space-y-3">
                                        {g.items.map(renderCard)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        filteredNotifications.map(renderCard)
                    )}
                </div>
            )}
            {/* --- CỬA SỔ POPUP HIỂN THỊ FILE NHÚNG DÁN Ở ĐÂY (BÊN TRONG THẺ DIV CUỐI CÙNG) --- */}
            {selectedFile && (
                <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden border border-slate-100">
                        {/* Header */}
                        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 shrink-0">
                            <h3 className="text-sm font-bold text-primary truncate">{selectedFile.name || 'Tài liệu đính kèm'}</h3>
                            <div className="flex items-center gap-2 shrink-0">
                                <a
                                    href={selectedFile.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs font-semibold text-primary bg-primary-light hover:bg-green-100 px-3 py-1.5 rounded-xl border border-green-100 transition-colors"
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
                        {/* Nội dung file, nhúng qua Google Docs Viewer */}
                        <div className="relative flex-1 bg-slate-50">
                            {iframeLoading && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-8 h-8 border-4 border-green-100 border-t-primary rounded-full animate-spin" />
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
