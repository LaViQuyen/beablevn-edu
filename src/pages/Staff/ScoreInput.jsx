import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { ref, onValue, push, set, update, remove } from "firebase/database";
import { useAuth } from '../../context/AuthContext';

const ScoreInput = () => {
  const { currentUser } = useAuth();
  
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [students, setStudents] = useState([]);
  
  const TABS = [
    { id: 'bonus', label: '1. Điểm Bonus' },
    { id: 'assignment', label: '2. Assignment' },
    { id: 'formative', label: '3. Formative Assessment' },
    { id: 'summative', label: '4. Summative Assessment' }
  ];
  const [activeTab, setActiveTab] = useState('bonus');

  const [commonInput, setCommonInput] = useState({
    date: new Date().toISOString().split('T')[0],
    content: '',
    examType: 'MMT'
  });

  const [studentScores, setStudentScores] = useState({});
  const [loading, setLoading] = useState(false);

  // States cho phần Tổng kết & Lịch sử
  const [classScores, setClassScores] = useState({});
  const [selectedStudentForView, setSelectedStudentForView] = useState('');

  // States cho Modal Lịch sử & Chỉnh sửa
  const [historyStudentModal, setHistoryStudentModal] = useState(null);
  const [editingRecordId, setEditingRecordId] = useState(null);
  const [editFormData, setEditFormData] = useState({});

  useEffect(() => {
    if (!currentUser) return;
    onValue(ref(db, 'classes'), (snap) => {
      const data = snap.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]) => ({ id, ...val }));
        const assigned = currentUser.assignedClasses || [];
        const filteredList = currentUser.role === 'admin' ? list : list.filter(c => assigned.includes(c.id));
        setClasses(filteredList);
      }
    });
  }, [currentUser]);

  useEffect(() => {
    if (!selectedClass) {
        setStudents([]);
        setClassScores({});
        setSelectedStudentForView('');
        return;
    }

    const usersRef = ref(db, 'users');
    onValue(usersRef, (snap) => {
      const data = snap.val();
      if (data) {
        const list = Object.entries(data)
          .map(([id, val]) => ({ id, ...val }))
          .filter(u => u.role === 'student' && u.classIds && u.classIds.includes(selectedClass));
        setStudents(list);
        if (list.length > 0 && !selectedStudentForView) setSelectedStudentForView(list[0].id);
      }
    });

    const scoresRef = ref(db, `scores/${selectedClass}`);
    onValue(scoresRef, (snap) => {
        setClassScores(snap.val() || {});
    });

    setStudentScores({});
  }, [selectedClass]);

  const handleScoreChange = (studentId, value) => {
    setStudentScores(prev => ({ ...prev, [studentId]: value }));
  };

  const handleSave = async (student) => {
    const scoreVal = studentScores[student.id];
    if (!scoreVal) return alert(`Chưa nhập điểm cho ${student.name}`);
    if (!commonInput.content) return alert("Vui lòng nhập 'Nội dung ghi nhận'");

    if (!window.confirm(`Xác nhận lưu điểm cho ${student.name}?`)) return;

    setLoading(true);
    try {
      const newScoreRef = push(ref(db, `scores/${selectedClass}/${student.id}/${activeTab}`));
      const payload = {
        score: scoreVal,
        date: commonInput.date,
        content: commonInput.content,
        timestamp: new Date().toISOString()
      };
      if (activeTab === 'summative') payload.examType = commonInput.examType;

      await set(newScoreRef, payload);
      alert(`✅ Đã lưu thành công cho ${student.name}!`);
      
      setStudentScores(prev => {
        const newState = { ...prev };
        delete newState[student.id];
        return newState;
      });
    } catch (error) {
      alert("Lỗi: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Tính điểm tổng hợp (Summary)
  const getSummary = (studentId) => {
    const sData = classScores[studentId] || {};
    const getAvg = (cat) => {
        const vals = Object.values(sData[cat] || {}).map(r => Number(r.score) || 0);
        return vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1) : '-';
    };
    const getSum = (cat) => {
        const vals = Object.values(sData[cat] || {}).map(r => Number(r.score) || 0);
        return vals.reduce((a,b)=>a+b,0);
    };
    return {
        bonus: getSum('bonus'),
        assignment: getAvg('assignment'),
        formative: getAvg('formative'),
        summative: getAvg('summative')
    };
  };

  const getRankInfo = () => {
    if (!students.length) return null;
    const totals = students.map(s => {
        const sData = classScores[s.id] || {};
        const getAvg = (recordsObj) => {
            const vals = Object.values(recordsObj || {}).map(r => Number(r.score) || 0);
            return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
        };

        const assAvg = getAvg(sData['assignment']);
        const formAvg = getAvg(sData['formative']);
        const summativeRecords = Object.values(sData['summative'] || {});
        
        const mmtVals = summativeRecords.filter(r => r.examType === 'MMT').map(r => Number(r.score) || 0);
        const mmtAvg = mmtVals.length ? mmtVals.reduce((a, b) => a + b, 0) / mmtVals.length : 0;
        
        const eomtVals = summativeRecords.filter(r => r.examType === 'EOMT').map(r => Number(r.score) || 0);
        const eomtAvg = eomtVals.length ? eomtVals.reduce((a, b) => a + b, 0) / eomtVals.length : 0;

        const weightedScore = (assAvg * 0.10) + (formAvg * 0.20) + (mmtAvg * 0.30) + (eomtAvg * 0.40);
        return { id: s.id, score: weightedScore };
    });

    totals.sort((a, b) => b.score - a.score);
    const rankIndex = totals.findIndex(t => t.id === selectedStudentForView);
    if (rankIndex === -1) return null;

    return {
        rank: rankIndex + 1,
        totalStudents: students.length,
        totalScore: totals[rankIndex].score.toFixed(2)
    };
  };

  const rankInfo = selectedStudentForView ? getRankInfo() : null;

  // Xử lý Cập nhật & Xóa điểm trong Modal Lịch sử
  const saveEditRecord = async (catKey) => {
    try {
        const { id, score, date, content, examType } = editFormData;
        const payload = { score, date, content };
        if (catKey === 'summative') payload.examType = examType || 'MMT';
        
        await update(ref(db, `scores/${selectedClass}/${historyStudentModal.id}/${catKey}/${id}`), payload);
        setEditingRecordId(null);
    } catch (error) {
        alert("Lỗi khi cập nhật: " + error.message);
    }
  };

  const deleteRecord = async (recordId, catKey) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa điểm này?")) return;
    try {
        await remove(ref(db, `scores/${selectedClass}/${historyStudentModal.id}/${catKey}/${recordId}`));
    } catch (error) {
        alert("Lỗi khi xóa: " + error.message);
    }
  };

  const renderEditableHistoryColumn = (catKey, label, colorClass) => {
    const recordsObj = classScores[historyStudentModal?.id]?.[catKey] || {};
    const records = Object.entries(recordsObj)
        .map(([id, val]) => ({ id, ...val }))
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    return (
        <div className={`p-4 rounded-xl border flex flex-col h-full bg-white shadow-sm ${colorClass}`}>
            <h4 className="font-bold text-sm mb-3 pb-2 border-b border-black/10">{label}</h4>
            <div className="flex-1 overflow-y-auto space-y-3 max-h-[350px] pr-1 custom-scrollbar">
                {records.map(r => (
                    <div key={r.id} className="p-3 border border-slate-200 rounded-lg bg-slate-50 hover:bg-white transition-all shadow-sm">
                        {editingRecordId === r.id ? (
                            <div className="space-y-2">
                                <input type="date" value={editFormData.date} onChange={e=>setEditFormData({...editFormData, date: e.target.value})} className="w-full text-xs p-1.5 border rounded outline-none focus:border-[#003366]" />
                                <input type="number" value={editFormData.score} onChange={e=>setEditFormData({...editFormData, score: e.target.value})} className="w-full text-xs p-1.5 border rounded outline-none focus:border-[#003366]" placeholder="Điểm số" />
                                <textarea value={editFormData.content} onChange={e=>setEditFormData({...editFormData, content: e.target.value})} className="w-full text-xs p-1.5 border rounded outline-none focus:border-[#003366]" placeholder="Nội dung ghi nhận"></textarea>
                                {catKey === 'summative' && (
                                    <select value={editFormData.examType || 'MMT'} onChange={e=>setEditFormData({...editFormData, examType: e.target.value})} className="w-full text-xs p-1.5 border rounded outline-none focus:border-[#003366]">
                                        <option value="MMT">MMT</option>
                                        <option value="EOMT">EOMT</option>
                                    </select>
                                )}
                                <div className="flex gap-2 pt-1">
                                    <button onClick={() => saveEditRecord(catKey)} className="flex-1 bg-green-600 text-white py-1.5 rounded text-xs font-bold hover:bg-green-700 transition-all">Lưu</button>
                                    <button onClick={() => setEditingRecordId(null)} className="flex-1 bg-slate-200 text-slate-700 py-1.5 rounded text-xs font-bold hover:bg-slate-300 transition-all">Hủy</button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-between font-bold text-[#003366] text-sm mb-1.5">
                                    <span>{r.score} điểm</span>
                                    <span className="text-xs text-slate-500 font-mono">{new Date(r.date).toLocaleDateString('vi-VN')}</span>
                                </div>
                                <p className="text-xs text-slate-600 mb-2 leading-relaxed">{r.content}</p>
                                {r.examType && <span className="text-[10px] font-bold bg-slate-200 px-1.5 py-0.5 rounded uppercase mb-2 inline-block">{r.examType}</span>}
                                <div className="flex gap-2 border-t border-slate-200 pt-2 mt-2">
                                    <button onClick={() => { setEditingRecordId(r.id); setEditFormData(r); }} className="text-blue-600 hover:text-blue-800 text-xs font-bold px-2 py-1 rounded bg-blue-50">Sửa</button>
                                    <button onClick={() => deleteRecord(r.id, catKey)} className="text-red-600 hover:text-red-800 text-xs font-bold px-2 py-1 rounded bg-red-50 ml-auto">Xóa</button>
                                </div>
                            </>
                        )}
                    </div>
                ))}
                {records.length === 0 && <p className="text-xs text-center text-slate-400 py-4 italic">Chưa có điểm</p>}
            </div>
        </div>
    );
  };

  return (
    <div className="space-y-6 pb-20 mt-16 md:mt-0 animate-fade-in-up">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
         <div className="p-2 bg-blue-50 rounded-lg text-[#003366]">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
         </div>
         <h2 className="text-xl md:text-2xl font-bold text-[#003366]">Nhập Điểm Chi Tiết</h2>
      </div>

      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Chọn Lớp học (Được phân công)</label>
          <select 
              className="w-full md:w-1/2 p-2.5 border border-slate-300 rounded-lg outline-none focus:border-[#003366] font-medium"
              value={selectedClass}
              onChange={e => setSelectedClass(e.target.value)}
          >
              <option value="">-- Chọn lớp --</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
      </div>

      {selectedClass && (
        <>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex border-b border-slate-200 bg-slate-50 overflow-x-auto custom-scrollbar">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-6 py-4 text-sm font-bold whitespace-nowrap transition-all ${
                                activeTab === tab.id ? 'bg-white text-[#003366] border-t-2 border-t-[#003366]' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="p-5 bg-blue-50/50 border-b border-slate-100 grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                    <div className="md:col-span-3">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ngày ghi nhận</label>
                        <input type="date" className="w-full p-2 border border-slate-300 rounded outline-none focus:border-[#003366]" value={commonInput.date} onChange={e => setCommonInput({...commonInput, date: e.target.value})} />
                    </div>
                    {activeTab === 'summative' && (
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Kỳ thi</label>
                            <select className="w-full p-2 border border-slate-300 rounded outline-none focus:border-[#003366] font-bold text-[#003366]" value={commonInput.examType} onChange={e => setCommonInput({...commonInput, examType: e.target.value})}>
                                <option value="MMT">MMT</option>
                                <option value="EOMT">EOMT</option>
                            </select>
                        </div>
                    )}
                    <div className={activeTab === 'summative' ? "md:col-span-7" : "md:col-span-9"}>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nội dung ghi nhận (Bắt buộc)</label>
                        <input type="text" placeholder="VD: Làm bài tập về nhà đầy đủ..." className="w-full p-2 border border-slate-300 rounded outline-none focus:border-[#003366]" value={commonInput.content} onChange={e => setCommonInput({...commonInput, content: e.target.value})} />
                    </div>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-white text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200 shadow-sm">
                            <tr>
                                <th className="p-4 w-10">#</th>
                                <th className="p-4">Học Viên (Bấm để xem lịch sử)</th>
                                <th className="p-4 text-center text-yellow-700 bg-yellow-50/50 hidden md:table-cell">Bonus</th>
                                <th className="p-4 text-center text-green-700 bg-green-50/50 hidden md:table-cell">Assign</th>
                                <th className="p-4 text-center text-blue-700 bg-blue-50/50 hidden md:table-cell">Format</th>
                                <th className="p-4 text-center text-purple-700 bg-purple-50/50 hidden md:table-cell">Summa</th>
                                <th className="p-4 w-32 text-center border-l border-slate-200 bg-slate-50">Nhập Điểm</th>
                                <th className="p-4 w-24 text-center bg-slate-50">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {students.map((st, index) => {
                                const summary = getSummary(st.id);
                                return (
                                    <tr key={st.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4 text-slate-400">{index + 1}</td>
                                        <td className="p-4">
                                            <button 
                                                onClick={() => setHistoryStudentModal(st)} 
                                                className="font-bold text-[#003366] hover:text-blue-600 hover:underline text-left outline-none transition-all flex items-center gap-2"
                                                title="Bấm để xem & sửa lịch sử điểm"
                                            >
                                                {st.name}
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 text-blue-400 hidden md:block"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
                                            </button>
                                            <div className="text-xs text-slate-400 font-mono mt-0.5">{st.studentCode}</div>
                                        </td>
                                        <td className="p-4 text-center font-bold text-yellow-700 bg-yellow-50/30 hidden md:table-cell">{summary.bonus}</td>
                                        <td className="p-4 text-center font-bold text-green-700 bg-green-50/30 hidden md:table-cell">{summary.assignment}</td>
                                        <td className="p-4 text-center font-bold text-blue-700 bg-blue-50/30 hidden md:table-cell">{summary.formative}</td>
                                        <td className="p-4 text-center font-bold text-purple-700 bg-purple-50/30 hidden md:table-cell">{summary.summative}</td>
                                        <td className="p-4 border-l border-slate-100 bg-slate-50/50">
                                            <input 
                                                type="number" 
                                                className="w-full text-center p-2 border border-slate-300 rounded focus:border-[#003366] focus:ring-1 focus:ring-[#003366] outline-none font-bold text-lg"
                                                placeholder="0-10"
                                                value={studentScores[st.id] || ''}
                                                onChange={(e) => handleScoreChange(st.id, e.target.value)}
                                            />
                                        </td>
                                        <td className="p-4 text-center bg-slate-50/50">
                                            <button 
                                                onClick={() => handleSave(st)}
                                                disabled={loading || !studentScores[st.id]}
                                                className={`px-4 py-2 rounded text-xs font-bold transition-all shadow-sm w-full ${
                                                    studentScores[st.id] ? 'bg-[#003366] text-white hover:bg-[#002244]' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                                }`}
                                            >
                                                Lưu
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                            {students.length === 0 && <tr><td colSpan="8" className="p-8 text-center text-slate-400 italic">Lớp này chưa có học viên nào.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL LỊCH SỬ & CHỈNH SỬA CHO TỪNG HỌC VIÊN */}
            {historyStudentModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in-up">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="text-lg font-bold text-[#003366]">Lịch sử Điểm & Chỉnh sửa</h3>
                                <p className="text-sm font-medium text-slate-500 mt-1">Học viên: <span className="text-[#003366]">{historyStudentModal.name}</span> ({historyStudentModal.studentCode})</p>
                            </div>
                            <button onClick={() => { setHistoryStudentModal(null); setEditingRecordId(null); }} className="p-2 bg-slate-200 text-slate-500 rounded-full hover:bg-red-100 hover:text-red-600 transition-colors">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-5 overflow-y-auto flex-1 bg-slate-100">
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                                {renderEditableHistoryColumn('bonus', '1. Điểm Bonus', 'border-yellow-200 text-yellow-900')}
                                {renderEditableHistoryColumn('assignment', '2. Assignment', 'border-green-200 text-green-900')}
                                {renderEditableHistoryColumn('formative', '3. Formative', 'border-blue-200 text-blue-900')}
                                {renderEditableHistoryColumn('summative', '4. Summative', 'border-purple-200 text-purple-900')}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* KHU VỰC TỔNG KẾT BÊN DƯỚI (Giữ nguyên) */}
            <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm mt-8 hidden md:block">
                <h2 className="text-lg font-bold text-[#003366] mb-5 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
                    Xếp hạng Học viên trong lớp
                </h2>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-5">
                    <div className="w-full md:w-1/3">
                        <select className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-[#003366] font-medium bg-white" value={selectedStudentForView} onChange={e => setSelectedStudentForView(e.target.value)}>
                            <option value="">-- Chọn học viên --</option>
                            {students.map(st => <option key={st.id} value={st.id}>{st.name} - {st.studentCode}</option>)}
                        </select>
                    </div>
                    {selectedStudentForView && rankInfo && (
                        <div className="flex gap-4 md:gap-8 bg-white px-5 py-3 rounded-lg border border-slate-200 shadow-sm">
                            <div className="text-center pr-4 md:pr-8 border-r border-slate-100">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1" title="Assignment(10%) + Formative(20%) + MMT(30%) + EOMT(40%)">Điểm Tổng Kết (Hệ số)</p>
                                <p className="text-2xl font-black text-[#003366]">{rankInfo.totalScore}</p>
                            </div>
                            <div className="text-center pr-2">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Xếp hạng trong lớp</p>
                                <p className="text-2xl font-black text-emerald-600">#{rankInfo.rank} <span className="text-sm font-bold text-slate-400">/ {rankInfo.totalStudents}</span></p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
      )}
    </div>
  );
};

export default ScoreInput;