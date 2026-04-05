// src/pages/teacher/ExerciseLibrary.jsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, deleteDoc, updateDoc, setDoc } from 'firebase/firestore';
import { firestore as db } from "../../../firebase";
// --- HỆ THỐNG ICONS TỐI GIẢN (SVG Nét mảnh, màu #003366) ---
const Icons = {
  Search: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>,
  Folder: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#003366" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>,
  Quiz: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#003366" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>,
  More: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1.5"></circle><circle cx="12" cy="5" r="1.5"></circle><circle cx="12" cy="19" r="1.5"></circle></svg>,
  Edit: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="16 3 21 8 8 21 3 21 3 16 16 3"></polygon></svg>,
  Copy: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>,
  Move: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><polyline points="9 14 12 17 15 14"></polyline></svg>,
  Trash: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>,
  Restore: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"></polyline><polyline points="23 20 23 14 17 14"></polyline><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path></svg>,
  Back: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>,
  Plus: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
};

export default function ExerciseLibrary() {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);
  const [folders, setFolders] = useState([]);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  // Trạng thái giao diện chung
  const [viewTab, setViewTab] = useState('Quizzes');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentFolder, setCurrentFolder] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);

  // Trạng thái Modals & Menu
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [activeMenuId, setActiveMenuId] = useState(null);

  const menuRef = useRef(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener("mousedown", handleClickOutside);
    }
  }, []);

  // Đồng bộ Quizzes và Folders từ Firebase
  useEffect(() => {
    const fetchData = async () => {
      try {
        const qSnap = await getDocs(collection(db, "quizzes"));
        const qData = qSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setQuizzes(qData);

        const fSnap = await getDocs(collection(db, "folders"));
        const fData = fSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setFolders(fData);
      } catch (error) {
        console.error("Lỗi lấy dữ liệu Library:", error);
      }
    };
    fetchData();
  }, []);

  // --- CÁC HÀM XỬ LÝ ĐƯỢC ĐỒNG BỘ FIREBASE ---

  // TẠO THƯ MỤC
  const handleCreateFolder = async () => {
    if (!inputValue.trim()) {
      alert("Vui lòng nhập tên thư mục!");
      return;
    }
    
    const newFolderId = 'folder_' + Date.now();
    const newFolder = {
      name: inputValue.trim(),
      modified: new Date().toISOString().split('T')[0],
      parentId: currentFolder
    };
    
    try {
      await setDoc(doc(db, "folders", newFolderId), newFolder);
      setFolders([...folders, { id: newFolderId, ...newFolder }]);
      setInputValue('');
      setShowFolderModal(false);
    } catch (error) {
      console.error("Lỗi tạo thư mục:", error);
      alert("Có lỗi xảy ra khi tạo thư mục!");
    }
  };

  // ĐỔI TÊN THƯ MỤC / BÀI TẬP
  const handleRename = async (item, isFolder) => {
    const currentName = isFolder ? item.name : item.title;
    const newName = window.prompt("Nhập tên mới:", currentName);
    if (newName && newName.trim() !== "" && newName !== currentName) {
      if (isFolder) {
        try {
          await updateDoc(doc(db, "folders", item.id), { name: newName });
          setFolders(folders.map(f => f.id === item.id ? { ...f, name: newName } : f));
        } catch (error) {
          console.error(error); alert("Lỗi khi đổi tên thư mục!");
        }
      } else {
        try {
          await updateDoc(doc(db, "quizzes", item.id), { title: newName });
          setQuizzes(quizzes.map(q => q.id === item.id ? { ...q, title: newName } : q));
        } catch (error) { console.error(error); alert("Lỗi khi đổi tên bài tập!"); }
      }
    }
    setActiveMenuId(null);
  };

  // NHÂN BẢN BÀI TẬP
  const handleDuplicate = async (quiz) => {
    const newId = 'q_' + Date.now();
    const duplicatedQuiz = { ...quiz, id: newId, title: quiz.title + ' (Copy)', modified: new Date().toISOString().split('T')[0] };
    try {
      await setDoc(doc(db, "quizzes", newId), duplicatedQuiz);
      setQuizzes([...quizzes, duplicatedQuiz]);
    } catch (error) { console.error(error); alert("Lỗi khi nhân bản trên hệ thống!"); }
    setActiveMenuId(null);
  };

  // DI CHUYỂN THƯ MỤC / BÀI TẬP
  const handleMove = async (item, isFolder) => {
    const targetFolderName = window.prompt("Nhập tên thư mục (Để trống để dời ra ngoài gốc):");
    if (targetFolderName !== null) {
      let targetFolderId = null;
      if (targetFolderName.trim() !== "") {
        const targetFolder = folders.find(f => f.name.toLowerCase() === targetFolderName.toLowerCase().trim());
        if (targetFolder) targetFolderId = targetFolder.id;
        else { alert("Không tìm thấy thư mục có tên này!"); setActiveMenuId(null); return; }
      }
      
      if (isFolder) {
        if (targetFolderId === item.id) {
           alert("Không thể di chuyển thư mục vào chính nó!"); setActiveMenuId(null); return;
        }
        try {
          await updateDoc(doc(db, "folders", item.id), { parentId: targetFolderId });
          setFolders(folders.map(f => f.id === item.id ? { ...f, parentId: targetFolderId } : f));
        } catch (error) { console.error(error); alert("Lỗi khi di chuyển thư mục!"); }
      } else {
        try {
          await updateDoc(doc(db, "quizzes", item.id), { folderId: targetFolderId });
          setQuizzes(quizzes.map(q => q.id === item.id ? { ...q, folderId: targetFolderId } : q));
        } catch (error) { console.error(error); alert("Lỗi khi di chuyển bài tập!"); }
      }
    }
    setActiveMenuId(null);
  };

  // XÓA THƯ MỤC / BÀI TẬP
  const handleDelete = async (item, isFolder) => {
    if (window.confirm(`Bạn có chắc muốn xóa ${isFolder ? 'thư mục' : 'bài tập'} này?`)) {
      if (isFolder) {
        try {
          await deleteDoc(doc(db, "folders", item.id));
          setFolders(folders.filter(f => f.id !== item.id));
        } catch (error) { console.error(error); alert("Lỗi khi xóa thư mục!"); }
      } else {
        try {
          await updateDoc(doc(db, "quizzes", item.id), { isDeleted: true });
          setQuizzes(quizzes.map(q => q.id === item.id ? { ...q, isDeleted: true } : q));
        } catch (error) { console.error(error); alert("Lỗi khi xóa bài tập!"); }
      }
    }
    setActiveMenuId(null);
  };

  const handleRestore = async (item) => {
    try {
      await updateDoc(doc(db, "quizzes", item.id), { isDeleted: false });
      setQuizzes(quizzes.map(q => q.id === item.id ? { ...q, isDeleted: false } : q));
    } catch (error) { console.error(error); alert("Lỗi khi khôi phục trên hệ thống!"); }
    setActiveMenuId(null);
  };

  const handleHardDelete = async (item) => {
    if (window.confirm("Bạn có chắc muốn xóa VĨNH VIỄN bài tập này?")) {
      try {
        await deleteDoc(doc(db, "quizzes", item.id));
        setQuizzes(quizzes.filter(q => q.id !== item.id));
      } catch (error) { console.error(error); alert("Lỗi khi xóa vĩnh viễn trên hệ thống!"); }
    }
    setActiveMenuId(null);
  };

  const handleSelectAll = (e, itemsToSelect) => {
    if (e.target.checked) setSelectedItems(itemsToSelect.map(item => item.id));
    else setSelectedItems([]);
  };

  const handleSelectItem = (id) => {
    setSelectedItems(prev => prev.includes(id) ? prev.filter(itemId => itemId !== id) : [...prev, id]);
  };

  const displayedFolders = folders.filter(f => viewTab === 'Quizzes' && f.parentId === currentFolder && f.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const displayedQuizzes = quizzes.filter(q => {
    const matchSearch = (q.title || '').toLowerCase().includes(searchQuery.toLowerCase());
    if (viewTab === 'Deleted') return q.isDeleted && matchSearch;
    return !q.isDeleted && (q.folderId || null) === currentFolder && matchSearch;
  });

  const allDisplayedItems = [...displayedFolders, ...displayedQuizzes];

  const renderMoreOptions = (item, isFolder) => {
    if (activeMenuId !== item.id) return null;
    const btnStyle = { width: '100%', textAlign: 'left', padding: '12px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', color: '#334155', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '500' };

    if (viewTab === 'Deleted') {
      return (
        <div ref={menuRef} style={{ position: 'absolute', right: '40px', top: '30px', backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 100, minWidth: '180px', padding: '8px 0' }}>
          <button style={{ ...btnStyle, color: '#10b981' }} onClick={() => handleRestore(item)}> <Icons.Restore /> Khôi phục</button>
          <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '4px 0' }} />
          <button style={{ ...btnStyle, color: '#ef4444' }} onClick={() => handleHardDelete(item)}> <Icons.Trash /> Xóa vĩnh viễn</button>
        </div>
      );
    }
    return (
      <div ref={menuRef} style={{ position: 'absolute', right: '40px', top: '30px', backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 100, minWidth: '160px', padding: '8px 0' }}>
        <button style={btnStyle} onClick={() => { if(!isFolder) navigate(`/staff/assignments/exercises/${item.id}`); }}> <Icons.Edit /> Edit</button>
        {!isFolder && <button style={btnStyle} onClick={() => handleDuplicate(item)}> <Icons.Copy /> Duplicate</button>}
        <button style={btnStyle} onClick={() => handleMove(item, isFolder)}> <Icons.Move /> Move</button>
        <button style={btnStyle} onClick={() => handleRename(item, isFolder)}> <Icons.Edit /> Rename</button>
        <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '4px 0' }} />
        <button style={{ ...btnStyle, color: '#ef4444' }} onClick={() => handleDelete(item, isFolder)}> <Icons.Trash /> Delete</button>
      </div>
    );
  };

  return (
    <div style={{ padding: isMobile ? '15px' : '30px', backgroundColor: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Josefin Sans', sans-serif" }}>
      
      {/* HEADER TỐI ƯU CHO DESKTOP VÀ MOBILE */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', marginBottom: '32px', gap: '20px' }}>
        <div>
          <h2 style={{ color: '#003366', margin: 0, fontSize: '28px', fontWeight: '800' }}>Library {currentFolder ? `> Folder` : ''}</h2>
          <p style={{ color: '#64748b', margin: '6px 0 0 0', fontSize: '15px' }}>Quản lý và tổ chức các bài tập</p>
        </div>

        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '12px', width: isMobile ? '100%' : 'auto' }}>
          
          <div style={{ position: 'relative', width: isMobile ? '100%' : 'auto' }}>
            <span style={{ position: 'absolute', left: '14px', top: '12px', color: '#94a3b8' }}><Icons.Search /></span>
            <input 
              type="text" placeholder="Search quiz..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              style={{ padding: '12px 16px 12px 42px', borderRadius: '100px', border: '1px solid #cbd5e1', outlineColor: '#003366', fontSize: '14px', width: '100%', minWidth: isMobile ? '0' : '240px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', width: isMobile ? '100%' : 'auto' }}>
            <button 
              onClick={() => setShowFolderModal(true)} 
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flex: 1, backgroundColor: 'white', color: '#003366', border: '1px solid #cbd5e1', padding: '12px 20px', borderRadius: '100px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s', fontSize: '14px', whiteSpace: 'nowrap' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}
            >
              <Icons.Plus /> New Folder
            </button>
            <button 
              onClick={() => navigate('/staff/assignments/exercises/new')} 
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flex: 1, backgroundColor: '#003366', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '100px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(0,51,102,0.2)', fontSize: '14px', whiteSpace: 'nowrap', transition: 'all 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <Icons.Plus /> Add Quiz
            </button>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: '30px', borderBottom: '2px solid #e2e8f0', marginBottom: '24px', overflowX: 'auto' }}>
        <button 
          onClick={() => { setViewTab('Quizzes'); setSelectedItems([]); }}
          style={{ background: 'none', border: 'none', padding: '12px 0', fontSize: '15px', fontWeight: '800', cursor: 'pointer', color: viewTab === 'Quizzes' ? '#003366' : '#94a3b8', borderBottom: viewTab === 'Quizzes' ? '3px solid #003366' : '3px solid transparent', marginBottom: '-2px', whiteSpace: 'nowrap', transition: 'all 0.2s' }}
        >
          Quizzes
        </button>
        <button 
          onClick={() => { setViewTab('Deleted'); setSelectedItems([]); setCurrentFolder(null); }}
          style={{ background: 'none', border: 'none', padding: '12px 0', fontSize: '15px', fontWeight: '800', cursor: 'pointer', color: viewTab === 'Deleted' ? '#003366' : '#94a3b8', borderBottom: viewTab === 'Deleted' ? '3px solid #003366' : '3px solid transparent', marginBottom: '-2px', whiteSpace: 'nowrap', transition: 'all 0.2s' }}
        >
          Deleted
        </button>
      </div>

      {/* TABLE VIEW TỐI ƯU MOBILE */}
      <div style={{ width: '100%', overflowX: 'auto', backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        <div style={{ minWidth: '600px' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 200px 80px', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc', fontWeight: '800', color: '#64748b', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', borderRadius: '16px 16px 0 0' }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}><input type="checkbox" onChange={(e) => handleSelectAll(e, allDisplayedItems)} checked={selectedItems.length > 0 && selectedItems.length === allDisplayedItems.length} style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#003366' }} /></div>
            <div>Name</div>
            <div>Modified</div>
            <div style={{ textAlign: 'center' }}>Options</div>
          </div>

          {currentFolder && viewTab === 'Quizzes' && (
            <div onClick={() => setCurrentFolder(null)} style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', color: '#64748b', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}>
              <div style={{ width: '60px', display: 'flex', justifyContent: 'center' }}><Icons.Back /></div>
              <span style={{ fontWeight: '700', fontSize: '15px', color: '#003366' }}>Quay lại cấp trước</span>
            </div>
          )}

          {displayedFolders.map(folder => (
            <div key={folder.id} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 200px 80px', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #f1f5f9', position: 'relative', transition: 'background 0.2s', zIndex: activeMenuId === folder.id ? 50 : 1 }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f0f9ff'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}>
              <div style={{ display: 'flex', justifyContent: 'center' }}><input type="checkbox" checked={selectedItems.includes(folder.id)} onChange={() => handleSelectItem(folder.id)} style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#003366' }} /></div>
              <div onClick={() => setCurrentFolder(folder.id)} style={{ display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer' }}>
                <Icons.Folder /><span style={{ fontWeight: '700', color: '#003366', fontSize: '15px' }}>{folder.name}</span>
              </div>
              <div style={{ color: '#64748b', fontSize: '14px', fontWeight: '500' }}>{folder.modified}</div>
              <div style={{ textAlign: 'center' }}>
                <button onClick={() => setActiveMenuId(activeMenuId === folder.id ? null : folder.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}><Icons.More /></button>
                {renderMoreOptions(folder, true)}
              </div>
            </div>
          ))}

          {displayedQuizzes.map(quiz => (
            <div key={quiz.id} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 200px 80px', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #f1f5f9', position: 'relative', transition: 'background 0.2s', zIndex: activeMenuId === quiz.id ? 50 : 1 }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f0f9ff'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}>
              <div style={{ display: 'flex', justifyContent: 'center' }}><input type="checkbox" checked={selectedItems.includes(quiz.id)} onChange={() => handleSelectItem(quiz.id)} style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#003366' }} /></div>
              <div onClick={() => navigate(`/staff/assignments/exercises/${quiz.id}`)} style={{ display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer' }}>
                <Icons.Quiz /><span style={{ fontWeight: '600', color: '#334155', fontSize: '15px', textDecoration: quiz.isDeleted ? 'line-through' : 'none', opacity: quiz.isDeleted ? 0.6 : 1 }}>{quiz.title}</span>
              </div>
              <div style={{ color: '#64748b', fontSize: '14px', fontWeight: '500' }}>{quiz.modified}</div>
              <div style={{ textAlign: 'center' }}>
                <button onClick={() => setActiveMenuId(activeMenuId === quiz.id ? null : quiz.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}><Icons.More /></button>
                {renderMoreOptions(quiz, false)}
              </div>
            </div>
          ))}

          {allDisplayedItems.length === 0 && (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8', fontSize: '15px', fontWeight: '500' }}>Không có dữ liệu trong mục này.</div>
          )}
        </div>
      </div>

      {/* NEW FOLDER MODAL */}
      {showFolderModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '15px', boxSizing: 'border-box' }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '24px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ color: '#003366', marginTop: 0, marginBottom: '20px', fontWeight: '800', fontSize: '20px' }}>Tạo Thư mục mới</h3>
            <input 
              type="text" 
              placeholder="Nhập tên thư mục..." 
              value={inputValue} 
              onChange={e => setInputValue(e.target.value)} 
              style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '15px', color: '#334155', fontWeight: '600', boxSizing: 'border-box', transition: 'all 0.2s', marginBottom: '24px' }}
              onFocus={(e) => { e.target.style.borderColor = '#003366'; e.target.style.backgroundColor = 'white'; }} 
              onBlur={(e) => { e.target.style.borderColor = '#cbd5e1'; e.target.style.backgroundColor = '#f8fafc'; }}
            />
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid #cbd5e1', backgroundColor: 'white', color: '#64748b', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s' }} onClick={() => { setShowFolderModal(false); setInputValue(''); }}>Hủy</button>
              <button onClick={handleCreateFolder} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', backgroundColor: '#003366', color: 'white', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(0,51,102,0.2)', transition: 'all 0.2s' }}>Tạo Mới</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}