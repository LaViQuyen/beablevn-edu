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
                  onClick={() => { if(noti.type === 'content') toggleExpand(noti.id); }}
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
                      <div>
                          <p className={`text-sm text-slate-600 leading-relaxed ${isExpanded ? 'whitespace-pre-wrap' : 'line-clamp-2'}`}>
                              {noti.content}
                          </p>
                          {!isExpanded && noti.content?.length > 120 && (
                              <span className="text-[10px] text-blue-500 font-semibold mt-1.5 inline-block group-hover/content:underline">Xem thêm...</span>
                          )}
                      </div>
                  )}
              </div>
            </div>
          )})
          ) : (
            <div className="text-center py-10 bg-white rounded-xl border border-dashed border-slate-200">
                <p className="text-slate-400 text-sm">Hiện chưa có thông báo nào dành cho bạn.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Notifications;