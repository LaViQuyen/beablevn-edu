import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { ref, onValue, update } from "firebase/database";
import { useAuth } from '../../context/AuthContext';

const Attendance = () => {
  const { currentUser } = useAuth();
  const [tab, setTab] = useState('take'); 
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState({}); 
  const [notes, setNotes] = useState({});
  const [allAttendance, setAllAttendance] = useState({}); 
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // State Modal Lịch sử Điểm danh
  const [historyStudent, setHistoryStudent] = useState(null);

  useEffect(() => {
    if (!currentUser) return;
    onValue(ref(db, 'classes'), (snap) => {
      const data = snap.val();
      if (data) {
         const allClasses = Object.entries(data).map(([id, val]) => ({ id, ...val }));
         const myClassIds = currentUser?.assignedClasses || [];
         const myClasses = currentUser.role === 'admin' ? allClasses : allClasses.filter(c => myClassIds.includes(c.id));
         setClasses(myClasses);
      }
    });

    onValue(ref(db, 'attendance'), (snap) => {
        setAllAttendance(snap.val() || {});
    });
  }, [currentUser]);

  useEffect(() => {
    if (!selectedClass) {
        setStudents([]);
        return;
    }
    onValue(ref(db, 'users'), (snap) => {
      const data = snap.val();
      if (data) {
         setStudents(Object.entries(data).map(([id, val]) => ({ id, ...val })).filter(u => u.role === 'student' && u.classIds && u.classIds.includes(selectedClass)));
      }
    });
  }, [selectedClass]);

  useEffect(() => {
    if (selectedClass && date && allAttendance[selectedClass]?.[date]) {
       const dayData = allAttendance[selectedClass][date];
       const tempStatus = {};
       const tempNotes = {};
       Object.keys(dayData).forEach(stId => {
           tempStatus[stId] = dayData[stId].status;
           tempNotes[stId] = dayData[stId].note || '';
       });
       setStatus(tempStatus);
       setNotes(tempNotes);
    } else {
       setStatus({});
       setNotes({});
    }
  }, [selectedClass, date, allAttendance]);

  const handleMark = (studentId, val) => {
    setStatus(prev => ({ ...prev, [studentId]: val }));
  };

  const handleSave = () => {
    if (!selectedClass) return alert("Chọn lớp!");
    const payload = {};
    students.forEach(st => {
      if (status[st.id]) {
         payload[st.id] = { status: status[st.id], note: notes[st.id] || '' };
      }
    });
    update(ref(db, `attendance/${selectedClass}/${date}`), payload)
      .then(() => alert("Đã lưu điểm danh!"))
      .catch(e => alert("Lỗi: " + e.message));
  };

  const filteredStudents = students.filter(st => {
      if (!startDate && !endDate) return true;
      return true; // Logic filter report nếu có
  });

  const getSummary = (stId) => {
    let p=0, l=0, a=0, e=0;
    const classData = allAttendance[selectedClass] || {};
    Object.keys(classData).forEach(d => {
       if ((!startDate || d >= startDate) && (!endDate || d <= endDate)) {
          const stat = classData[d][stId]?.status;
          if (stat === 'present') p++;
          if (stat === 'late') l++;
          if (stat === 'absent') a++;
          if (stat === 'excused') e++;
       }
    });
    return { present: p, late: l, absent: a, excused: e };
  };

  // SVGs mỏng và tinh tế (Minimal Outline)
  const IconPresent = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>;
  const IconLate = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
  const IconExcused = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>;
  const IconAbsent = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>;

  return (
    <div className="space-y-6 pb-20 mt-16 md:mt-0 animate-fade-in-up">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
         <div className="p-2 bg-blue-50 rounded-lg text-[#003366]">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" /></svg>
         </div>
         <h2 className="text-xl md:text-2xl font-bold text-[#003366]">Điểm danh & Chuyên cần</h2>
      </div>

      <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4">
        <select className="flex-1 p-2.5 border border-slate-200 rounded-lg outline-none focus:border-[#003366] text-sm text-slate-700 bg-slate-50 transition-colors hover:border-slate-300" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
          <option value="">-- Chọn lớp phụ trách --</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {tab === 'take' && <input type="date" className="p-2.5 border border-slate-200 rounded-lg outline-none focus:border-[#003366] text-sm text-slate-700 bg-slate-50 transition-colors hover:border-slate-300" value={date} onChange={e => setDate(e.target.value)} />}
      </div>

      {selectedClass && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex border-b border-slate-100 bg-slate-50/50">
             <button onClick={() => setTab('take')} className={`px-6 py-4 text-sm font-medium transition-all ${tab === 'take' ? 'bg-white text-[#003366] border-t-2 border-t-[#003366] shadow-[0_1px_0_white]' : 'text-slate-500 hover:text-[#003366]'}`}>Điểm danh</button>
             <button onClick={() => setTab('report')} className={`px-6 py-4 text-sm font-medium transition-all ${tab === 'report' ? 'bg-white text-[#003366] border-t-2 border-t-[#003366] shadow-[0_1px_0_white]' : 'text-slate-500 hover:text-[#003366]'}`}>Báo cáo</button>
          </div>

          {tab === 'take' ? (
             <div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm min-w-[700px]">
                        <thead className="bg-white text-slate-400 uppercase text-[10px] font-semibold border-b border-slate-100">
                            <tr>
                                <th className="p-4 w-10 text-center">#</th>
                                <th className="p-4 font-semibold">Học Viên</th>
                                <th className="p-4 text-center w-24">Trạng thái</th>
                                <th className="p-4 text-center w-48">Thao tác</th>
                                <th className="p-4 w-64">Ghi chú</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {students.map((st, index) => (
                                <tr key={st.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="p-4 text-center text-slate-400">{index + 1}</td>
                                    <td className="p-4">
                                        <button 
                                            onClick={() => setHistoryStudent(st)} 
                                            className="font-medium text-slate-800 hover:text-[#003366] outline-none transition-all flex items-center gap-2 group-hover:underline decoration-slate-300 underline-offset-4"
                                            title="Xem lịch sử"
                                        >
                                            {st.name}
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5 text-slate-400 hidden md:block opacity-0 group-hover:opacity-100 transition-opacity"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        </button>
                                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">{st.studentCode}</div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-medium uppercase tracking-wider border ${
                                            status[st.id] === 'present' ? 'bg-green-50 text-green-700 border-green-200' :
                                            status[st.id] === 'late' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                            status[st.id] === 'excused' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                            status[st.id] === 'absent' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-50 text-slate-400 border-slate-200'
                                        }`}>
                                            {status[st.id] === 'present' ? 'Có mặt' : status[st.id] === 'late' ? 'Đi muộn' : status[st.id] === 'excused' ? 'Có phép' : status[st.id] === 'absent' ? 'Vắng' : 'Chưa ĐD'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center">
                                        {/* Nút bấm thiết kế nét outline tối giản */}
                                        <div className="flex justify-center gap-2">
                                            <button title="Có mặt" onClick={() => handleMark(st.id, 'present')} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all border ${status[st.id] === 'present' ? 'bg-green-500 border-green-500 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-400 hover:border-green-400 hover:text-green-500'}`}><IconPresent /></button>
                                            <button title="Đi muộn" onClick={() => handleMark(st.id, 'late')} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all border ${status[st.id] === 'late' ? 'bg-orange-500 border-orange-500 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-400 hover:border-orange-400 hover:text-orange-500'}`}><IconLate /></button>
                                            <button title="Có phép" onClick={() => handleMark(st.id, 'excused')} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all border ${status[st.id] === 'excused' ? 'bg-blue-500 border-blue-500 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-400 hover:border-blue-400 hover:text-blue-500'}`}><IconExcused /></button>
                                            <button title="Vắng" onClick={() => handleMark(st.id, 'absent')} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all border ${status[st.id] === 'absent' ? 'bg-red-500 border-red-500 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-400 hover:border-red-400 hover:text-red-500'}`}><IconAbsent /></button>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <input type="text" className="w-full p-2 border border-slate-200 rounded-md outline-none focus:border-[#003366] text-xs bg-slate-50 focus:bg-white transition-colors" placeholder="Thêm ghi chú..." value={notes[st.id] || ''} onChange={e => setNotes({...notes, [st.id]: e.target.value})} disabled={status[st.id] === 'present'} />
                                    </td>
                                </tr>
                            ))}
                            {students.length === 0 && <tr><td colSpan="5" className="p-8 text-center text-slate-400 italic">Lớp chưa có học viên.</td></tr>}
                        </tbody>
                    </table>
                </div>
                <div className="p-5 bg-white border-t border-slate-100 text-right">
                    <button onClick={handleSave} className="bg-[#003366] text-white px-8 py-2.5 rounded-lg text-sm font-medium hover:bg-[#002244] transition-all flex items-center gap-2 ml-auto">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                        Lưu Điểm Danh
                    </button>
                </div>
             </div>
          ) : (
             <div className="p-5">
                <div className="flex gap-4 mb-6">
                    <div className="flex-1"><label className="text-[10px] font-semibold text-slate-400 uppercase mb-1.5 block tracking-wide">Từ ngày</label><input type="date" className="w-full border border-slate-200 p-2.5 rounded-lg text-sm text-slate-700 bg-slate-50 outline-none focus:border-[#003366] transition-colors" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
                    <div className="flex-1"><label className="text-[10px] font-semibold text-slate-400 uppercase mb-1.5 block tracking-wide">Đến ngày</label><input type="date" className="w-full border border-slate-200 p-2.5 rounded-lg text-sm text-slate-700 bg-slate-50 outline-none focus:border-[#003366] transition-colors" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white">
                    <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50/50 text-slate-400 font-semibold text-[10px] uppercase border-b border-slate-100">
                        <tr>
                            <th className="p-4">Học viên</th>
                            <th className="p-4 text-center"><div className="flex flex-col items-center gap-1"><IconPresent /> <span>Có mặt</span></div></th>
                            <th className="p-4 text-center"><div className="flex flex-col items-center gap-1"><IconLate /> <span>Đi muộn</span></div></th>
                            <th className="p-4 text-center"><div className="flex flex-col items-center gap-1"><IconExcused /> <span>Có phép</span></div></th>
                            <th className="p-4 text-center"><div className="flex flex-col items-center gap-1"><IconAbsent /> <span>Vắng</span></div></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {filteredStudents.map(st => {
                        const s = getSummary(st.id);
                        return <tr key={st.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-4 font-medium text-slate-800">{st.name}</td>
                                <td className="p-4 text-center font-medium text-slate-600">{s.present}</td>
                                <td className="p-4 text-center font-medium text-slate-600">{s.late}</td>
                                <td className="p-4 text-center font-medium text-slate-600">{s.excused}</td>
                                <td className="p-4 text-center font-medium text-slate-600">{s.absent}</td>
                            </tr>
                        })}
                    </tbody>
                    </table>
                </div>
             </div>
          )}
        </div>
      )}

      {/* --- MODAL LỊCH SỬ NGHỈ/MUỘN MINIMALIST --- */}
      {historyStudent && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in-up">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh] border border-slate-100">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-bold text-[#003366]">Lịch sử Vắng / Muộn</h3>
                        <p className="text-xs text-slate-500 mt-1">Học viên: <span className="font-medium text-slate-800">{historyStudent.name}</span></p>
                    </div>
                    <button onClick={() => setHistoryStudent(null)} className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="p-5 overflow-y-auto flex-1 custom-scrollbar">
                    {(() => {
                        const classData = allAttendance[selectedClass] || {};
                        const history = [];
                        Object.entries(classData).forEach(([d, dData]) => {
                            const stData = dData[historyStudent.id];
                            if (stData && (stData.status === 'absent' || stData.status === 'late' || stData.status === 'excused')) {
                                history.push({ date: d, status: stData.status, note: stData.note || '' });
                            }
                        });
                        history.sort((a, b) => new Date(b.date) - new Date(a.date));

                        if (history.length === 0) return (
                            <div className="text-center py-10">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-12 h-12 text-emerald-500 mx-auto mb-3"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" /></svg>
                                <p className="text-slate-500 text-sm">Học viên đi học chuyên cần, chưa vắng hoặc muộn.</p>
                            </div>
                        );
                        
                        return (
                            <ul className="space-y-4">
                                {history.map((h, i) => (
                                    <li key={i} className="flex gap-4">
                                        <div className="flex flex-col items-center pt-1">
                                            <div className={`w-2.5 h-2.5 rounded-full ring-4 ${h.status === 'absent' ? 'bg-red-500 ring-red-50' : h.status === 'late' ? 'bg-orange-500 ring-orange-50' : 'bg-blue-500 ring-blue-50'}`} />
                                            {i !== history.length - 1 && <div className="w-[1px] h-full bg-slate-100 mt-2"></div>}
                                        </div>
                                        <div className="flex-1 pb-4">
                                            <div className="flex justify-between items-start mb-1.5">
                                                <p className="text-sm font-medium text-slate-700">
                                                    {new Date(h.date).toLocaleDateString('vi-VN')}
                                                </p>
                                                <span className={`text-[10px] px-2 py-0.5 rounded uppercase tracking-wider font-medium border ${
                                                    h.status === 'absent' ? 'text-red-600 bg-red-50 border-red-100' : 
                                                    h.status === 'late' ? 'text-orange-600 bg-orange-50 border-orange-100' :
                                                    'text-blue-600 bg-blue-50 border-blue-100'
                                                }`}>
                                                    {h.status === 'absent' ? 'Vắng' : h.status === 'late' ? 'Đi muộn' : 'Có phép'}
                                                </span>
                                            </div>
                                            {h.note ? (
                                                <p className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-md border border-slate-100">{h.note}</p>
                                            ) : (
                                                <p className="text-xs text-slate-400 italic">Không có ghi chú.</p>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        );
                    })()}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Attendance;