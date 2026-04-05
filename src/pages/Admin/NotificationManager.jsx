import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { ref, onValue, remove } from "firebase/database";

const NotificationManager = () => {
  const [notifs, setNotifs] = useState([]);
  const [classes, setClasses] = useState({});

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
          .sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort theo date mới nhất
        setNotifs(list);
      } else {
        setNotifs([]);
      }
    });
  }, []);

  const handleDelete = (id) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa thông báo này không? Hành động này không thể hoàn tác.")) {
      remove(ref(db, `notifications/${id}`));
    }
  };

  const renderTargets = (n) => {
    if (n.scope === 'all') return <span className="bg-green-100 text-green-800 text-[10px] font-bold px-2 py-1 rounded border border-green-200">TOÀN HỆ THỐNG</span>;
    const clsName = classes[n.scope]?.name || n.scope;
    return <span className="bg-blue-50 text-[#003366] text-[10px] font-bold px-2 py-1 rounded border border-blue-200">Lớp {clsName}</span>;
  };

  return (
    <div className="space-y-6 pb-20 mt-16 md:mt-0"> {/* Fix header che nội dung mobile */}
      <div className="bg-white p-4 md:p-6 rounded-xl border border-slate-100 shadow-sm">
        <h2 className="text-lg font-bold text-[#003366] mb-4 md:mb-6 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>
            Quản lý Thông báo
        </h2>
        
        {/* DESKTOP TABLE */}
        <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200">
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
                        {n.type === 'link' ? (
                            <span className="text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100 font-bold text-[10px]">LINK</span>
                        ) : (
                            <span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 font-bold text-[10px]">CONTENT</span>
                        )}
                        <span className="truncate max-w-[200px]">{n.type === 'link' ? n.linkUrl : n.content}</span>
                    </div>
                  </td>
                  <td className="p-4 font-medium">{renderTargets(n)}</td>
                  <td className="p-4 text-slate-500 text-xs font-medium bg-slate-50 rounded-lg px-2 py-1 inline-block">{n.author || 'Admin'}</td>
                  <td className="p-4 text-right">
                    <button 
                      onClick={() => handleDelete(n.id)} 
                      className="text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors text-xs font-bold border border-red-100"
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
              {notifs.length === 0 && <tr><td colSpan="5" className="p-8 text-center text-slate-400 italic">Chưa có thông báo nào.</td></tr>}
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
                                {n.type === 'link' ? 'Hyperlink' : n.label || 'Tin tức'}
                            </span>
                            <span className="text-[10px] text-slate-400">{new Date(n.date).toLocaleDateString('vi-VN')}</span>
                        </div>
                        {renderTargets(n)}
                    </div>

                    <div>
                        <h4 className="font-bold text-slate-800 text-sm mb-1">{n.title}</h4>
                        <p className="text-xs text-slate-500 line-clamp-2">{n.type === 'link' ? n.linkUrl : n.content}</p>
                    </div>

                    <div className="flex justify-between items-center pt-3 border-t border-slate-100 mt-1">
                        <span className="text-xs text-slate-400 italic">Bởi: {n.author || 'Admin'}</span>
                        <button 
                            onClick={() => handleDelete(n.id)} 
                            className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-xs font-bold border border-red-100 active:bg-red-100"
                        >
                            Xóa
                        </button>
                    </div>
                </div>
            ))}
            {notifs.length === 0 && <div className="p-8 text-center text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">Chưa có thông báo nào.</div>}
        </div>
      </div>
    </div>
  );
};

export default NotificationManager;