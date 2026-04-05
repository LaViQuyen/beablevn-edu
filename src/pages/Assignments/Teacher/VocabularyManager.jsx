// src/pages/teacher/VocabularyManager.jsx
import { useState, useEffect, useContext } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { firestore as db } from "../../../firebase";
import { TeacherContext } from './TeacherContext';

const SvgIcons = {
  Plus: () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>,
  Edit: () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polygon points="16 3 21 8 8 21 3 21 3 16 16 3"></polygon></svg>,
  Trash: () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>,
  Back: () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>,
  Save: () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
};

export default function VocabularyManager() {
  const [activeTab, setActiveTab] = useState('SETS'); // SETS, CLASSES, REPORTS
  const [vocabSets, setVocabSets] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [reports, setReports] = useState([]);
  
  const [editingSet, setEditingSet] = useState(null); // null = Đang ở danh sách, Object = Đang Edit
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch Data
  const fetchData = async () => {
    const setsSnap = await getDocs(collection(db, "vocab_sets"));
    setVocabSets(setsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

    const roomsSnap = await getDocs(collection(db, "rooms"));
    setRooms(roomsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => { fetchData(); }, []);

  // --- LOGIC CHO TAB "SETS" (Bộ thẻ) ---
  const handleCreateNewSet = () => {
    setEditingSet({
      id: 'vs_' + Date.now(),
      title: '',
      programme: '',
      cards: [{ id: Date.now(), term: '', definition: '', example: '' }]
    });
  };

  const handleSaveSet = async () => {
    if (!editingSet.title) return alert("Vui lòng nhập tên bộ thẻ!");
    try {
      await setDoc(doc(db, "vocab_sets", editingSet.id), {
        ...editingSet,
        modified: new Date().toISOString()
      });
      alert("Lưu bộ thẻ thành công!");
      setEditingSet(null);
      fetchData();
    } catch (error) {
      console.error(error); alert("Lỗi khi lưu bộ thẻ.");
    }
  };

  const handleDeleteSet = async (id) => {
    if(!window.confirm("Xóa bộ thẻ này?")) return;
    await deleteDoc(doc(db, "vocab_sets", id));
    fetchData();
  };

  // --- LOGIC CHO TAB "CLASSES" (Gán thẻ cho phòng) ---
  const handleAssignSetToRoom = async (roomId, setId) => {
    try {
      await updateDoc(doc(db, "rooms", roomId), { assignedVocabId: setId });
      fetchData();
      alert("Gán bộ thẻ cho lớp thành công!");
    } catch (error) {
      console.error(error); alert("Lỗi khi gán.");
    }
  };

  // --- LOGIC CHO TAB "REPORTS" (Lấy từ rooms/{roomId}/vocab_submissions) ---
  useEffect(() => {
    if (activeTab === 'REPORTS') {
      const fetchReports = async () => {
        let allRep = [];
        for (let r of rooms) {
          const subSnap = await getDocs(collection(db, `rooms/${r.id}/vocab_submissions`));
          subSnap.docs.forEach(d => {
            allRep.push({ roomId: r.id, studentId: d.id, ...d.data() });
          });
        }
        setReports(allRep);
      };
      fetchReports();
    }
  }, [activeTab, rooms]);

  const renderTabs = () => (
    <div style={{ display: 'flex', gap: '20px', borderBottom: '2px solid #e2e8f0', marginBottom: '30px', overflowX: 'auto' }}>
      {['SETS', 'CLASSES', 'REPORTS'].map(tab => (
        <button 
          key={tab} onClick={() => { setActiveTab(tab); setEditingSet(null); }}
          style={{ background: 'none', border: 'none', padding: '12px 0', fontSize: '15px', fontWeight: '800', cursor: 'pointer', color: activeTab === tab ? '#003366' : '#94a3b8', borderBottom: activeTab === tab ? '3px solid #003366' : '3px solid transparent', marginBottom: '-2px', whiteSpace: 'nowrap', transition: 'all 0.2s' }}
        >
          {tab === 'SETS' ? 'Flashcard Sets' : tab === 'CLASSES' ? 'Classes Assignment' : 'Student Reports'}
        </button>
      ))}
    </div>
  );

  // --- GIAO DIỆN EDIT SET ---
  if (editingSet) {
    return (
      <div style={{ padding: isMobile ? '15px' : '30px', backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: "'Josefin Sans', sans-serif", paddingBottom: '100px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <button onClick={() => setEditingSet(null)} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontWeight: '700', fontSize: '15px' }}>
            <SvgIcons.Back /> Back to Library
          </button>
          <button onClick={handleSaveSet} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#003366', color: 'white', padding: '12px 24px', borderRadius: '100px', fontWeight: '700', border: 'none', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(0,51,102,0.2)' }}>
            <SvgIcons.Save /> Save Set
          </button>
        </div>

        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '30px' }}>
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '20px' }}>
            <div style={{ flex: 2 }}>
              <label style={{ display: 'block', fontWeight: '700', color: '#003366', marginBottom: '8px', fontSize: '13px' }}>Title (Tên bộ thẻ)</label>
              <input type="text" value={editingSet.title} onChange={e => setEditingSet({...editingSet, title: e.target.value})} placeholder="VD: IELTS Vocabulary Unit 1" style={{ width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '15px', boxSizing: 'border-box' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontWeight: '700', color: '#003366', marginBottom: '8px', fontSize: '13px' }}>Programme (Chương trình)</label>
              <input type="text" value={editingSet.programme} onChange={e => setEditingSet({...editingSet, programme: e.target.value})} placeholder="VD: IELTS / THPTQG" style={{ width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '15px', boxSizing: 'border-box' }} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {editingSet.cards.map((card, idx) => (
            <div key={card.id} style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #cbd5e1', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px dashed #e2e8f0', paddingBottom: '12px' }}>
                <div style={{ fontWeight: '800', color: '#003366' }}>{idx + 1}</div>
                <button onClick={() => setEditingSet({...editingSet, cards: editingSet.cards.filter(c => c.id !== card.id)})} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><SvgIcons.Trash /></button>
              </div>
              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '20px', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontWeight: '700', color: '#64748b', fontSize: '12px', textTransform: 'uppercase' }}>Term (Thuật ngữ)</label>
                  <input type="text" value={card.term} onChange={e => { const newCards = [...editingSet.cards]; newCards[idx].term = e.target.value; setEditingSet({...editingSet, cards: newCards}); }} style={{ width: '100%', border: 'none', borderBottom: '2px solid #cbd5e1', padding: '8px 0', outline: 'none', fontSize: '16px', fontWeight: '700', color: '#003366' }} placeholder="Nhập từ vựng..." />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontWeight: '700', color: '#64748b', fontSize: '12px', textTransform: 'uppercase' }}>Definition (Định nghĩa)</label>
                  <input type="text" value={card.definition} onChange={e => { const newCards = [...editingSet.cards]; newCards[idx].definition = e.target.value; setEditingSet({...editingSet, cards: newCards}); }} style={{ width: '100%', border: 'none', borderBottom: '2px solid #cbd5e1', padding: '8px 0', outline: 'none', fontSize: '15px' }} placeholder="Nhập định nghĩa tiếng Việt/Anh..." />
                </div>
              </div>
              <div>
                <label style={{ fontWeight: '700', color: '#64748b', fontSize: '12px', textTransform: 'uppercase' }}>Example (Ví dụ)</label>
                <textarea value={card.example} onChange={e => { const newCards = [...editingSet.cards]; newCards[idx].example = e.target.value; setEditingSet({...editingSet, cards: newCards}); }} style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px', outline: 'none', fontSize: '14px', resize: 'vertical', minHeight: '60px', marginTop: '8px', boxSizing: 'border-box' }} placeholder="Ví dụ trong câu..." />
              </div>
            </div>
          ))}
        </div>

        <button onClick={() => setEditingSet({...editingSet, cards: [...editingSet.cards, { id: Date.now(), term: '', definition: '', example: '' }]})} style={{ width: '100%', padding: '20px', marginTop: '20px', backgroundColor: 'white', border: '2px dashed #003366', borderRadius: '16px', color: '#003366', fontWeight: '800', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
          <SvgIcons.Plus /> Thêm thẻ (Add Card)
        </button>
      </div>
    );
  }

  // --- GIAO DIỆN CHÍNH ---
  return (
    <div style={{ padding: isMobile ? '15px' : '30px', backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: "'Josefin Sans', sans-serif" }}>
      <h2 style={{ color: '#003366', margin: '0 0 24px 0', fontSize: isMobile ? '24px' : '28px', fontWeight: '800' }}>Vocabulary Studio</h2>
      {renderTabs()}

      {/* TAB SETS */}
      {activeTab === 'SETS' && (
        <div>
          <button onClick={handleCreateNewSet} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#003366', color: 'white', padding: '12px 24px', borderRadius: '100px', fontWeight: '700', border: 'none', cursor: 'pointer', marginBottom: '24px' }}>
            <SvgIcons.Plus /> Tạo Bộ Thẻ Mới
          </button>
          
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
            {vocabSets.map(set => (
              <div key={set.id} style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', position: 'relative' }}>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '700', backgroundColor: '#f1f5f9', display: 'inline-block', padding: '4px 10px', borderRadius: '100px', marginBottom: '12px' }}>{set.programme || 'General'}</div>
                <h3 style={{ color: '#003366', margin: '0 0 10px 0', fontSize: '18px', fontWeight: '800' }}>{set.title}</h3>
                <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 20px 0' }}>{set.cards?.length || 0} terms</p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setEditingSet(set)} style={{ flex: 1, padding: '8px', backgroundColor: '#f0f9ff', color: '#0369a1', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>Sửa</button>
                  <button onClick={() => handleDeleteSet(set.id)} style={{ padding: '8px 12px', backgroundColor: '#fef2f2', color: '#ef4444', border: 'none', borderRadius: '8px', cursor: 'pointer' }}><SvgIcons.Trash /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CLASSES */}
      {activeTab === 'CLASSES' && (
        <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
              <tr>
                <th style={{ padding: '16px', color: '#475569', fontWeight: '800' }}>Class (Room)</th>
                <th style={{ padding: '16px', color: '#475569', fontWeight: '800' }}>Assigned Vocabulary Set</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map(room => (
                <tr key={room.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '16px', color: '#003366', fontWeight: '700' }}>{room.id}</td>
                  <td style={{ padding: '16px' }}>
                    <select 
                      value={room.assignedVocabId || ''} 
                      onChange={(e) => handleAssignSetToRoom(room.id, e.target.value)}
                      style={{ width: '100%', maxWidth: '300px', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontWeight: '600', color: '#334155' }}
                    >
                      <option value="">-- Không gán thẻ --</option>
                      {vocabSets.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB REPORTS */}
      {activeTab === 'REPORTS' && (
        <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', overflowX: 'auto' }}>
          <table style={{ minWidth: '700px', width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
              <tr>
                <th style={{ padding: '16px', color: '#475569', fontWeight: '800' }}>Room</th>
                <th style={{ padding: '16px', color: '#475569', fontWeight: '800' }}>Student</th>
                <th style={{ padding: '16px', color: '#475569', fontWeight: '800' }}>Learn Mode (Acc/Total)</th>
                <th style={{ padding: '16px', color: '#475569', fontWeight: '800' }}>Match Mode (Time)</th>
                <th style={{ padding: '16px', color: '#475569', fontWeight: '800' }}>Last Active</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? <tr><td colSpan="5" style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>Chưa có dữ liệu học tập.</td></tr> : reports.map((rep, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '16px', fontWeight: '700', color: '#e67e22' }}>{rep.roomId}</td>
                  <td style={{ padding: '16px', fontWeight: '700', color: '#003366' }}>{rep.studentId}</td>
                  <td style={{ padding: '16px', color: '#15803d', fontWeight: '600' }}>{rep.learnCorrect || 0} / {rep.learnTotal || 0}</td>
                  <td style={{ padding: '16px', color: '#b91c1c', fontWeight: '600' }}>{rep.bestMatchTime ? `${rep.bestMatchTime}s` : '--'}</td>
                  <td style={{ padding: '16px', color: '#64748b' }}>{rep.lastActive ? new Date(rep.lastActive).toLocaleString('vi-VN') : '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}