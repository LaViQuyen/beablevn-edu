import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../../firebase';
import { ref, onValue } from 'firebase/database';
import { useAuth } from '../../context/AuthContext';
import { useChildren } from './useChildren';
import { visibleNotifications, isContactBookNoti } from '../../utils/contactBook';

// ============================================================
// THÔNG BÁO (cổng Phụ huynh)
// Phụ huynh thấy đúng những gì các con thấy: gộp thông báo hiển thị
// được của TỪNG con (áp cùng bộ lọc phạm vi lớp + khóa + bảo lưu),
// khử trùng lặp rồi hiển thị mới nhất trước.
// ============================================================

const LABELS = {
  'báo bài': 'bg-primary-light text-green-700 border-green-200',
  'quan trọng': 'bg-red-50 text-red-700 border-red-200',
  'sự kiện': 'bg-yellow-50 text-yellow-700 border-yellow-200',
};

const IconLink = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>;

const ParentNotifications = () => {
  const { currentUser } = useAuth();
  const { children, loading: loadingChildren } = useChildren(currentUser?.id);
  const [notiList, setNotiList] = useState([]);
  const [classMap, setClassMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [filterLabel, setFilterLabel] = useState('all');
  const [filterChild, setFilterChild] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const unsubs = [
      onValue(ref(db, 'notifications'), (snap) => {
        const data = snap.val() || {};
        setNotiList(Object.entries(data).map(([id, val]) => ({ id, ...val })));
        setLoading(false);
      }),
      onValue(ref(db, 'classes'), (snap) => {
        const data = snap.val() || {};
        const map = {};
        Object.entries(data).forEach(([id, val]) => { map[id] = val?.name || 'Lớp'; });
        setClassMap(map);
      }),
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  // Gộp thông báo hiển thị được của từng con (dedupe theo id, nhớ tin thuộc con nào).
  // Lọc bỏ báo bài (đã nằm trong Sổ liên lạc của con) và Link điểm danh
  // (điểm danh là việc của HỌC VIÊN, phụ huynh không được bấm thay con).
  const merged = useMemo(() => {
    const byId = {};
    children.forEach((child) => {
      visibleNotifications(notiList, child).forEach((n) => {
        if (isContactBookNoti(n)) return;
        if (!byId[n.id]) byId[n.id] = { ...n, childIds: [] };
        byId[n.id].childIds.push(child.id);
      });
    });
    return Object.values(byId).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [notiList, children]);

  const filtered = merged.filter((n) => {
    if (filterChild !== 'all' && !n.childIds.includes(filterChild)) return false;
    if (filterLabel !== 'all') {
      if (filterLabel === 'link' && n.type !== 'link') return false;
      if (filterLabel !== 'link' && (n.type === 'link' || n.label !== filterLabel)) return false;
    }
    if (searchTerm && !n.title?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const scopeName = (scope) => (scope === 'all' ? 'Tin chung' : classMap[scope] || 'Lớp');
  const accentColor = (n) => (n.label === 'quan trọng' ? '#dc2626' : n.label === 'sự kiện' ? '#ca8a04' : '#2B6830');
  const childName = (id) => children.find(c => c.id === id)?.name || '';

  const isLoading = loading || loadingChildren;

  return (
    <div className="space-y-6 pb-20 animate-fade-in-up">
      <div className="flex items-center gap-3 mb-2 border-b border-slate-100 pb-4">
        <div className="p-2 bg-primary-light rounded-xl text-primary">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>
        </div>
        <div>
          <h2 className="page-title">Thông báo</h2>
          <p className="page-sub hidden md:block">Tin quan trọng và sự kiện từ các lớp của con.</p>
        </div>
      </div>

      {/* Dẫn hướng: báo bài của con xem trong Sổ liên lạc */}
      <div className="flex items-center gap-3 bg-primary-subtle border border-green-100 rounded-xl px-4 py-3">
        <span className="text-lg">📖</span>
        <p className="text-xs text-slate-600 flex-1"><b>Báo bài</b> của con nằm trong <b>Sổ liên lạc</b> của từng bé, không hiển thị ở trang này.</p>
        <Link to="/parent/dashboard" className="shrink-0 text-xs font-bold text-primary bg-white px-3 py-1.5 rounded-lg border border-green-200 hover:bg-primary-light transition-colors">Mở sổ →</Link>
      </div>

      {/* FILTER */}
      {!isLoading && merged.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
              {[
                { id: 'all', label: 'Tất cả' },
                { id: 'quan trọng', label: '🔴 Quan trọng' },
                { id: 'sự kiện', label: '🎉 Sự kiện' },
                { id: 'link', label: '🔗 Link' },
              ].map(f => (
                <button key={f.id} onClick={() => setFilterLabel(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${filterLabel === f.id ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
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
          {children.length > 1 && (
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={() => setFilterChild('all')}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${filterChild === 'all' ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-slate-200 hover:border-green-300'}`}>
                Tất cả các con
              </button>
              {children.map(c => (
                <button key={c.id} onClick={() => setFilterChild(c.id)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${filterChild === c.id ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-slate-200 hover:border-green-300'}`}>
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="card-std p-5 animate-pulse space-y-2">
              <div className="flex gap-2"><div className="h-5 bg-slate-100 rounded w-16" /><div className="h-5 bg-slate-100 rounded w-24" /></div>
              <div className="h-4 bg-slate-100 rounded w-3/4" />
              <div className="h-3 bg-slate-100 rounded w-full" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 p-8 text-center">
          <p className="text-slate-400 text-sm">{merged.length === 0 ? 'Chưa có thông báo nào cho các lớp của con.' : 'Không tìm thấy thông báo phù hợp.'}</p>
          {(filterLabel !== 'all' || searchTerm || filterChild !== 'all') && (
            <button onClick={() => { setFilterLabel('all'); setSearchTerm(''); setFilterChild('all'); }} className="mt-2 text-primary text-xs font-bold hover:underline">Xóa bộ lọc</button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((noti) => {
            const isExpanded = expandedId === noti.id;
            return (
              <div key={noti.id} className="card-std p-5 md:p-6 hover:shadow-md transition-all flex flex-col gap-3 group" style={{ borderLeft: `4px solid ${accentColor(noti)}` }}>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  {noti.type === 'link' ? (
                    <span className="bg-primary-light text-green-700 text-[10px] font-bold px-2.5 py-1 rounded-md border border-green-100 flex items-center gap-1 uppercase tracking-wide"><IconLink /> Link</span>
                  ) : (
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md border uppercase tracking-wide ${LABELS[noti.label] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>{noti.label}</span>
                  )}
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-md border ${noti.scope === 'all' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                    {scopeName(noti.scope)}
                  </span>
                  {children.length > 1 && noti.scope !== 'all' && (
                    <span className="text-[10px] font-bold px-2 py-1 rounded-md border bg-primary-subtle text-primary border-green-100">
                      👧 {noti.childIds.map(childName).filter(Boolean).join(', ')}
                    </span>
                  )}
                  <span className="text-[11px] text-slate-400 font-medium font-mono ml-auto">{new Date(noti.date).toLocaleDateString('vi-VN')}</span>
                </div>

                <div className={noti.type === 'content' ? 'cursor-pointer group/content' : ''}
                  onClick={() => { if (noti.type === 'content') setExpandedId(isExpanded ? null : noti.id); }}>
                  <h3 className={`font-bold text-sm md:text-base mb-2 transition-colors ${noti.type === 'content' ? 'text-slate-800 group-hover/content:text-primary' : 'text-slate-800'}`}>{noti.title}</h3>
                  {noti.type === 'link' ? (
                    <a href={noti.linkUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary-light hover:bg-green-100 px-3.5 py-2 rounded-xl border border-green-100 transition-colors w-fit mt-1">
                      <IconLink /> Mở liên kết
                    </a>
                  ) : (
                    <div className="flex flex-col items-start">
                      <div className={`quill-content text-sm text-slate-600 leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`} dangerouslySetInnerHTML={{ __html: noti.content }} />
                      {!isExpanded && noti.content?.length > 120 && (
                        <span className="text-[10px] text-green-500 font-semibold mt-1.5 mb-1 inline-block group-hover/content:underline">Xem thêm...</span>
                      )}
                      {noti.attachmentUrl && (
                        <a href={noti.attachmentUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary-light hover:bg-green-100 px-3.5 py-2.5 rounded-xl border border-green-100 transition-colors w-fit">
                          📎 {noti.attachmentTitle || noti.attachmentName || 'Tệp đính kèm'}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ParentNotifications;
