import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { ref, push, set, onValue, remove } from 'firebase/database';
import { useAuth } from '../../context/AuthContext';

const Notifications = () => {
  const { currentUser } = useAuth();
  
  // State quản lý form
  const [postMode, setPostMode] = useState('content'); // 'content' | 'link'
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  
  // State cho Hyperlink
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('Link bài tập'); 

  // State cho Nội dung
  const [selectedLabel, setSelectedLabel] = useState('báo bài');

  const [scope, setScope] = useState('all'); 
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notiList, setNotiList] = useState([]); 

  // State quản lý việc thu gọn/mở rộng thông báo
  const [expandedId, setExpandedId] = useState(null);

  // State cho Bộ lọc danh sách
  const [filterClass, setFilterClass] = useState('all');
  const [filterLabel, setFilterLabel] = useState('all'); // State mới cho bộ lọc Loại
  const [searchKeyword, setSearchKeyword] = useState('');

  const LINK_TITLES = ["Link điểm danh", "Link sự kiện", "Link bài tập", "Link kiểm tra"];
  const LABELS = [
      { id: 'báo bài', color: 'bg-blue-50 text-blue-700 border-blue-200' },
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
    if (postMode === 'content' && (!title || !content)) return alert("Vui lòng nhập tiêu đề và nội dung.");
    if (postMode === 'link' && (!linkUrl)) return alert("Vui lòng nhập đường dẫn (URL).");

    setLoading(true);
    try {
      const payload = {
        date: new Date().toISOString(), 
        author: currentUser.name,
        type: postMode 
      };

      if (postMode === 'content') {
          payload.title = title;
          payload.content = content;
          payload.label = selectedLabel;
      } else {
          payload.title = linkTitle; 
          payload.linkUrl = linkUrl;
      }

      if (scope === 'all' && currentUser?.role !== 'admin') {
          if (classes.length === 0) {
              alert("Bạn chưa được phân công lớp nào!");
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

      alert("Đăng thông báo thành công!");
      setTitle('');
      setContent('');
      setLinkUrl('');
    } catch (error) {
      alert("Lỗi: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
      if(window.confirm("Bạn chắc chắn muốn xóa thông báo này?")) {
          await remove(ref(db, `notifications/${id}`));
      }
  }

  const getScopeName = (scopeId) => {
      if(scopeId === 'all') return "Toàn hệ thống";
      const cls = classes.find(c => c.id === scopeId);
      return cls ? `Lớp ${cls.name}` : "Lớp đã xóa";
  };

  const toggleExpand = (id) => {
      setExpandedId(prev => prev === id ? null : id);
  };

  // LOGIC LỌC HIỂN THỊ DANH SÁCH
  const displayedNotis = notiList.filter(noti => {
      const isAdmin = currentUser?.role === 'admin';
      const assignedClasses = currentUser?.assignedClasses || [];

      // 1. Chỉ hiển thị thông báo đối với các lớp mà tài khoản phụ trách
      let canView = false;
      if (isAdmin) {
          canView = true;
      } else {
          if (assignedClasses.includes(noti.scope)) {
              canView = true;
          }
      }
      if (!canView) return false;

      // 2. Lọc theo lớp
      if (filterClass !== 'all' && noti.scope !== filterClass) return false;

      // 3. Lọc theo Loại/Nhãn (Bổ sung mới)
      if (filterLabel !== 'all') {
          if (filterLabel === 'link') {
              if (noti.type !== 'link') return false;
          } else {
              if (noti.type !== 'content' || noti.label !== filterLabel) return false;
          }
      }

      // 4. Lọc theo tiêu đề (Keywords)
      if (searchKeyword) {
          const keyword = searchKeyword.toLowerCase();
          if (!noti.title?.toLowerCase().includes(keyword)) return false;
      }

      return true;
  });

  // Icons tối giản
  const IconContent = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>;
  const IconLink = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>;
  const IconSearch = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-slate-400"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>;

  return (
    <div className="space-y-8 animate-fade-in-up pb-10 mt-16 md:mt-0">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
         <div className="p-2 bg-blue-50 rounded-lg text-[#003366]">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.795c0 1.94-.254 3.82-.734 5.622m-4.731.213a23.87 23.87 0 005.932 2.535m0 0A23.753 23.753 0 0122.5 6" /></svg>
         </div>
         <h2 className="text-xl md:text-2xl font-bold text-[#003366]">Đăng Thông Báo Mới</h2>
      </div>

      <div className="bg-white p-4 md:p-6 rounded-xl border border-slate-100 shadow-sm max-w-3xl">
        <div className="flex gap-3 mb-6">
            <button 
                onClick={() => setPostMode('content')}
                className={`flex-1 py-3 rounded-lg text-sm font-semibold transition-all border flex items-center justify-center gap-2 ${postMode === 'content' ? 'bg-[#003366] text-white border-[#003366]' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
            >
                <IconContent /> Nội dung
            </button>
            <button 
                onClick={() => setPostMode('link')}
                className={`flex-1 py-3 rounded-lg text-sm font-semibold transition-all border flex items-center justify-center gap-2 ${postMode === 'link' ? 'bg-[#003366] text-white border-[#003366]' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
            >
                <IconLink /> Hyperlink
            </button>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phạm vi hiển thị</label>
          <select 
            className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:border-[#003366] text-sm transition-colors bg-slate-50 focus:bg-white"
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
                                className={`px-3 py-1.5 rounded-md text-[10px] font-bold border transition-all uppercase tracking-wider ${selectedLabel === lbl.id ? lbl.color + ' ring-2 ring-offset-1 ring-blue-200' : 'bg-white text-slate-400 border-slate-200'}`}
                            >
                                {lbl.id}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="mb-4">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tiêu đề</label>
                    <input 
                        className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:border-[#003366] text-sm bg-slate-50 focus:bg-white transition-colors" 
                        placeholder="Nhập tiêu đề thông báo..." 
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />
                </div>
                <div className="mb-6">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nội dung chi tiết</label>
                    <textarea 
                        className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:border-[#003366] text-sm h-32 bg-slate-50 focus:bg-white transition-colors custom-scrollbar" 
                        placeholder="Nội dung sẽ được hiển thị cho học viên..." 
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                    />
                </div>
            </div>
        ) : (
            <div className="animate-fade-in">
                <div className="mb-4">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tiêu đề liên kết</label>
                    <select 
                        className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:border-[#003366] text-sm font-semibold text-[#003366] bg-slate-50 focus:bg-white transition-colors"
                        value={linkTitle}
                        onChange={(e) => setLinkTitle(e.target.value)}
                    >
                        {LINK_TITLES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div className="mb-6">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Đường dẫn (URL)</label>
                    <input 
                        className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:border-[#003366] text-sm font-mono text-blue-600 bg-slate-50 focus:bg-white transition-colors" 
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
          className="w-full bg-[#003366] text-white py-3.5 rounded-lg text-sm font-bold hover:bg-[#002244] transition-all shadow-md flex justify-center items-center gap-2 active:scale-[0.98]"
        >
          {loading ? "Đang xử lý..." : (
              <>
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
                 Đăng Thông Báo
              </>
          )}
        </button>
      </div>

      {/* DANH SÁCH THÔNG BÁO ĐÃ TẠO */}
      <div className="border-t border-slate-200 pt-8">
          <h3 className="text-lg font-bold text-[#003366] mb-4">Danh sách Thông báo đã tạo</h3>
          
          {/* BỘ LỌC TÌM KIẾM */}
          <div className="flex flex-col md:flex-row gap-3 mb-6">
              <select 
                  className="w-full md:w-auto p-2.5 border border-slate-200 rounded-lg outline-none focus:border-[#003366] text-sm text-slate-700 bg-slate-50 transition-colors hover:border-slate-300"
                  value={filterClass}
                  onChange={e => setFilterClass(e.target.value)}
              >
                  <option value="all">-- Tất cả lớp phụ trách --</option>
                  {classes.map(c => <option key={c.id} value={c.id}>Lớp {c.name}</option>)}
              </select>

              <select 
                  className="w-full md:w-auto p-2.5 border border-slate-200 rounded-lg outline-none focus:border-[#003366] text-sm text-slate-700 bg-slate-50 transition-colors hover:border-slate-300"
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
                      className="w-full pl-10 p-2.5 border border-slate-200 rounded-lg outline-none focus:border-[#003366] text-sm text-slate-700 bg-slate-50 transition-colors hover:border-slate-300"
                      placeholder="Tìm kiếm theo tiêu đề..." 
                      value={searchKeyword}
                      onChange={e => setSearchKeyword(e.target.value)}
                  />
              </div>
          </div>

          <div className="space-y-4">
              {displayedNotis.map(noti => {
                  const isExpanded = expandedId === noti.id;
                  
                  return (
                  <div key={noti.id} className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 flex flex-col gap-3 group hover:border-blue-200 transition-all shadow-sm">
                      <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2 mb-1">
                              {noti.type === 'link' ? (
                                  <span className="bg-purple-50 text-purple-700 text-[10px] font-bold px-2.5 py-1 rounded-md border border-purple-100 flex items-center gap-1 uppercase tracking-wide">
                                      <IconLink /> Link
                                  </span>
                              ) : (
                                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md border uppercase tracking-wide ${
                                      LABELS.find(l => l.id === noti.label)?.color || 'bg-gray-50 text-gray-600 border-gray-200'
                                  }`}>
                                      {noti.label}
                                  </span>
                              )}
                              <span className="text-[11px] text-slate-400 font-medium font-mono">{new Date(noti.date).toLocaleDateString('vi-VN')}</span>
                              <span className="text-[11px] font-bold text-[#003366] bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{getScopeName(noti.scope)}</span>
                          </div>
                          <button 
                              onClick={() => handleDelete(noti.id)}
                              className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-all"
                              title="Xóa thông báo"
                          >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                          </button>
                      </div>
                      
                      <div 
                          className={noti.type === 'content' ? "cursor-pointer group/content" : ""}
                          onClick={() => { if(noti.type === 'content') toggleExpand(noti.id); }}
                      >
                          <h4 className={`font-bold text-sm mb-2 transition-colors ${noti.type === 'content' ? 'text-slate-800 group-hover/content:text-[#003366]' : 'text-slate-800'}`}>
                              {noti.title}
                          </h4>

                          {noti.type === 'link' ? (
                              <a 
                                  href={noti.linkUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#003366] bg-blue-50 hover:bg-blue-100 px-3.5 py-2 rounded-lg border border-blue-100 transition-colors"
                              >
                                  <IconLink /> Mở liên kết
                              </a>
                          ) : (
                              <div>
                                  <p className={`text-xs text-slate-600 leading-relaxed ${isExpanded ? 'whitespace-pre-wrap' : 'line-clamp-2'}`}>
                                      {noti.content}
                                  </p>
                                  {!isExpanded && noti.content?.length > 120 && (
                                      <span className="text-[10px] text-blue-500 font-semibold mt-1.5 inline-block group-hover/content:underline">Xem thêm...</span>
                                  )}
                              </div>
                          )}
                      </div>
                  </div>
              )})}
              {displayedNotis.length === 0 && <p className="text-slate-400 text-sm italic text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">Không tìm thấy thông báo nào phù hợp.</p>}
          </div>
      </div>
    </div>
  );
};

export default Notifications;