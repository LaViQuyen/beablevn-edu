import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { ref, onValue, update } from "firebase/database";
import { useAuth } from '../../context/AuthContext';
import { getReserveStatus, RESERVE_LABEL, RESERVE_BADGE } from '../../utils/reserve';
import { fmtStudentName, getBirthdayNotice } from '../../utils/studentName';

// Quy ước chữ hiển thị trong báo cáo theo trạng thái điểm danh
const STATUS_LETTER = { present: 'C', late: 'T', excused: 'P', absent: 'V' };
const STATUS_CELL = {
  present: 'bg-slate-100 text-slate-700',   // C - xám
  late: 'bg-amber-50 text-amber-600',       // T - vàng/hổ phách
  excused: 'bg-blue-50 text-blue-600',      // P - xanh dương
  absent: 'bg-red-50 text-red-600',         // V - đỏ
};

// Bộ chọn tháng tùy biến (đẹp & đúng brand) thay cho input[type=month] mặc định của trình duyệt
const MONTH_LABELS = ['Th 1', 'Th 2', 'Th 3', 'Th 4', 'Th 5', 'Th 6', 'Th 7', 'Th 8', 'Th 9', 'Th 10', 'Th 11', 'Th 12'];
const MonthPicker = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const selYear = Number((value || '').slice(0, 4)) || new Date().getFullYear();
  const selMonth = Number((value || '').slice(5, 7)); // 1-12
  const [year, setYear] = useState(selYear);

  const pick = (m) => { onChange(`${year}-${String(m).padStart(2, '0')}`); setOpen(false); };
  const goThisMonth = () => {
    const now = new Date();
    setYear(now.getFullYear());
    onChange(now.toISOString().slice(0, 7));
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => { setYear(selYear); setOpen(o => !o); }}
        className="flex items-center gap-2 w-full border border-slate-200 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 bg-slate-50 hover:border-primary focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#2B6830" className="w-4 h-4 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
        <span className="flex-1 text-left">{selMonth ? `Tháng ${selMonth}, ${selYear}` : 'Chọn tháng'}</span>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#94a3b8" className={`w-4 h-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 p-3 z-30 animate-fade-in-up">
            {/* Điều hướng năm */}
            <div className="flex items-center justify-between mb-3">
              <button type="button" onClick={() => setYear(y => y - 1)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-primary-light hover:text-primary transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
              </button>
              <span className="font-bold text-primary">{year}</span>
              <button type="button" onClick={() => setYear(y => y + 1)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-primary-light hover:text-primary transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
              </button>
            </div>
            {/* Lưới tháng */}
            <div className="grid grid-cols-3 gap-1.5">
              {MONTH_LABELS.map((m, i) => {
                const mn = i + 1;
                const active = year === selYear && mn === selMonth;
                return (
                  <button
                    key={mn}
                    type="button"
                    onClick={() => pick(mn)}
                    className={`py-2.5 rounded-xl text-sm font-semibold transition-colors ${active ? 'bg-primary text-white shadow-sm' : 'text-slate-600 hover:bg-primary-light hover:text-primary'}`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
            {/* Phím tắt */}
            <div className="flex justify-end mt-3 pt-3 border-t border-slate-100">
              <button type="button" onClick={goThisMonth} className="text-xs font-bold text-primary hover:underline">Tháng này</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

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
    // Báo cáo theo tháng (YYYY-MM), mặc định tháng hiện tại, cột ngày tự đổi khi qua tháng mới
    const [reportMonth, setReportMonth] = useState(() => new Date().toISOString().slice(0, 7));
    const [savedAt, setSavedAt] = useState(null); // indicator trạng thái đã lưu
    const [saveError, setSaveError] = useState('');

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
                // Sắp xếp tên lớp theo bảng chữ cái (có dấu tiếng Việt)
                myClasses.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'));
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
                setStudents(
                    Object.entries(data).map(([id, val]) => ({ id, ...val }))
                        .filter(u => u.role === 'student' && u.classIds && u.classIds.includes(selectedClass))
                        // Sắp xếp tên học viên theo bảng chữ cái (có dấu tiếng Việt)
                        .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'))
                );
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
        setStatus((prev) => {
            // Nếu người dùng click lại vào chính trạng thái đang được chọn
            if (prev[studentId] === val) {
                const newStatus = { ...prev };
                delete newStatus[studentId]; // Bỏ chọn (xóa khỏi object)
                return newStatus;
            }

            // Nếu click vào trạng thái khác thì cập nhật bình thường
            return { ...prev, [studentId]: val };
        });
    };

    const handleSave = () => {
        if (!selectedClass) return setSaveError("Vui lòng chọn lớp trước khi lưu.");
        const payload = {};
        students.forEach(st => {
            if (status[st.id]) {
                payload[st.id] = { status: status[st.id], note: notes[st.id] || '' };
            }
        });
        setSavedAt(null);
        setSaveError('');
        update(ref(db, `attendance/${selectedClass}/${date}`), payload)
            .then(() => {
                const now = new Date();
                setSavedAt(`${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`);
            })
            .catch(e => setSaveError('Lỗi lưu: ' + e.message));
    };

    // Đánh dấu TẤT CẢ có mặt (1 click)
    const handleMarkAll = () => {
        const newStatus = {};
        students.forEach(st => { newStatus[st.id] = 'present'; });
        setStatus(newStatus);
        setSavedAt(null);
    };

    // Xóa tất cả trạng thái (reset)
    const handleClearAll = () => {
        setStatus({});
        setSavedAt(null);
    };

    // Xuất điểm danh ra CSV
    const handleExportCSV = () => {
        if (!selectedClass) return;
        const classData = allAttendance[selectedClass] || {};
        const className = classes.find(c => c.id === selectedClass)?.name || selectedClass;

        // Các buổi học trong tháng đang xem (cột ngày)
        const dates = Object.keys(classData).filter(d => d.startsWith(reportMonth)).sort();

        // Header CSV: ...các cột ngày + tổng kết
        const rows = [[
            'Họ tên', 'Mã HV',
            ...dates.map(d => `${d.slice(8, 10)}/${d.slice(5, 7)}`),
            'Có mặt', 'Đi trễ', 'Có phép', 'Vắng', 'Tổng buổi', '% Chuyên cần'
        ]];

        students.forEach(st => {
            let p = 0, l = 0, a = 0, ex = 0;
            const cells = dates.map(d => {
                const rec = classData[d]?.[st.id];
                const s = rec ? (typeof rec === 'object' ? rec.status : rec) : null;
                if (s === 'present') p++;
                else if (s === 'late') l++;
                else if (s === 'excused') ex++;
                else if (s === 'absent') a++;
                return s ? (STATUS_LETTER[s] || '') : '';
            });
            const total = p + l + a + ex;
            const rate = total > 0 ? Math.round(((p + l) / total) * 100) : 0;
            rows.push([fmtStudentName(st.name, st.englishName), st.studentCode || '', ...cells, p, l, ex, a, total, `${rate}%`]);
        });

        const csvContent = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
        const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `DIEMDANH_${className.replace(/\s/g, '_')}_${reportMonth}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const filteredStudents = students;

    const getSummary = (stId) => {
        let p = 0, l = 0, a = 0, e = 0;
        const classData = allAttendance[selectedClass] || {};
        Object.keys(classData).forEach(d => {
            if (!d.startsWith(reportMonth)) return; // chỉ tính trong tháng đang xem
            const stat = classData[d][stId]?.status;
            if (stat === 'present') p++;
            if (stat === 'late') l++;
            if (stat === 'absent') a++;
            if (stat === 'excused') e++;
        });
        return { present: p, late: l, absent: a, excused: e };
    };

    // Các buổi học (ngày) của lớp trong tháng đang xem -> cột báo cáo, tự đổi khi qua tháng mới
    const sessionDates = Object.keys(allAttendance[selectedClass] || {})
        .filter(d => d.startsWith(reportMonth))
        .sort();

    // SVGs mỏng và tinh tế (Minimal Outline)
    const IconPresent = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>;
    const IconLate = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    const IconExcused = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>;
    const IconAbsent = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>;

    return (
        <div className="space-y-6 pb-20 animate-fade-in-up">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                <div className="p-2 bg-primary-light rounded-xl text-primary">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" /></svg>
                </div>
                <h2 className="page-title">Điểm danh & Chuyên cần</h2>
            </div>

            <div className="card-std p-5 md:p-6 flex flex-col md:flex-row gap-4">
                <select className="input-base flex-1" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
                    <option value="">-- Chọn lớp phụ trách --</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {tab === 'take' && <input type="date" className="p-2.5 border border-slate-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 text-sm text-slate-700 bg-slate-50 transition-colors hover:border-slate-200" value={date} onChange={e => setDate(e.target.value)} />}
            </div>

            {selectedClass && (
                <div className="card-std overflow-hidden">
                    <div className="flex border-b border-slate-100 bg-slate-50/50">
                        <button onClick={() => setTab('take')} className={`px-6 py-4 text-sm font-medium transition-all ${tab === 'take' ? 'bg-white text-primary border-t-2 border-t-primary shadow-[0_1px_0_white]' : 'text-slate-500 hover:text-primary'}`}>Điểm danh</button>
                        <button onClick={() => setTab('report')} className={`px-6 py-4 text-sm font-medium transition-all ${tab === 'report' ? 'bg-white text-primary border-t-2 border-t-primary shadow-[0_1px_0_white]' : 'text-slate-500 hover:text-primary'}`}>Báo cáo</button>
                    </div>

                    {tab === 'take' ? (
                        <div>
                            {/* ===== MOBILE CARD VIEW ===== */}
                            <div className="md:hidden divide-y divide-slate-100">
                                {students.length === 0 && (
                                    <div className="p-8 text-center text-slate-400 italic text-sm">Lớp chưa có học viên.</div>
                                )}
                                {students.map((st, index) => (
                                    <div key={st.id} className="p-4 flex flex-col gap-3">
                                        {/* Header: tên + trạng thái */}
                                        <div className="flex justify-between items-start">
                                            <div>
                                                {(() => { const bd = getBirthdayNotice(st); return bd.cake ? <div className="text-[11px] text-amber-600 font-medium mb-1 flex items-center gap-1">🎂 {bd.message}</div> : null; })()}
                                                <button
                                                    onClick={() => setHistoryStudent(st)}
                                                    className="font-bold text-slate-800 text-sm hover:text-primary transition-colors"
                                                >
                                                    {index + 1}. {fmtStudentName(st.name, st.englishName)}
                                                </button>
                                                <div className="text-xs text-slate-400 font-mono mt-0.5">{st.studentCode}</div>
                                                {(() => { const rs = getReserveStatus(st); return rs ? <span className={`inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${RESERVE_BADGE[rs]}`}>{RESERVE_LABEL[rs]}</span> : null; })()}
                                            </div>
                                            <span className={`text-[10px] font-bold px-2 py-1 rounded border uppercase ${
                                                status[st.id] === 'present' ? 'bg-slate-100 text-slate-700 border-slate-300' :
                                                status[st.id] === 'late'    ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                                status[st.id] === 'excused' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                                                status[st.id] === 'absent'  ? 'bg-red-50 text-red-600 border-red-200' :
                                                'bg-slate-50 text-slate-400 border-slate-200'
                                            }`}>
                                                {status[st.id] === 'present' ? 'Có mặt' :
                                                 status[st.id] === 'late'    ? 'Đi trễ' :
                                                 status[st.id] === 'excused' ? 'Có phép' :
                                                 status[st.id] === 'absent'  ? 'Vắng' : 'Chưa ĐD'}
                                            </span>
                                        </div>

                                        {/* Nút điểm danh, to hơn để dễ bấm trên mobile */}
                                        <div className="grid grid-cols-4 gap-2">
                                            {[
                                                { val: 'present', label: '✓ Có mặt', active: 'bg-slate-500 text-white border-slate-500', hover: 'border-slate-300 text-slate-600' },
                                                { val: 'late',    label: '⏰ Trễ',    active: 'bg-amber-500 text-white border-amber-500', hover: 'border-amber-300 text-amber-600' },
                                                { val: 'excused', label: '📋 Phép',   active: 'bg-blue-500 text-white border-blue-500',   hover: 'border-blue-300 text-blue-600' },
                                                { val: 'absent',  label: '✗ Vắng',   active: 'bg-red-500 text-white border-red-500',     hover: 'border-red-300 text-red-600' },
                                            ].map(btn => (
                                                <button
                                                    key={btn.val}
                                                    onClick={() => handleMark(st.id, btn.val)}
                                                    className={`py-2.5 text-[11px] font-bold rounded-xl border transition-all active:scale-95 ${
                                                        status[st.id] === btn.val
                                                            ? btn.active
                                                            : `bg-white text-slate-400 border-slate-200 hover:${btn.hover}`
                                                    }`}
                                                >
                                                    {btn.label}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Ghi chú, chỉ hiện khi không phải Có mặt */}
                                        {status[st.id] !== 'present' && (
                                            <input
                                                type="text"
                                                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 bg-slate-50 focus:bg-white transition-colors"
                                                placeholder="Ghi chú (tùy chọn)..."
                                                value={notes[st.id] || ''}
                                                onChange={e => setNotes({ ...notes, [st.id]: e.target.value })}
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* ===== DESKTOP TABLE VIEW ===== */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="table-std min-w-[700px]">
                                    <thead>
                                        <tr>
                                            <th className="w-10 !text-center">#</th>
                                            <th>Học Viên</th>
                                            <th className="!text-center w-28">Trạng thái</th>
                                            <th className="!text-center w-48">Thao tác</th>
                                            <th className="w-64">Ghi chú</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {students.map((st, index) => (
                                            <tr key={st.id} className="group">
                                                <td className="text-center text-slate-400">{index + 1}</td>
                                                <td>
                                                    {(() => { const bd = getBirthdayNotice(st); return bd.cake ? <div className="text-[11px] text-amber-600 font-medium mb-1 flex items-center gap-1">🎂 {bd.message}</div> : null; })()}
                                                    <button
                                                        onClick={() => setHistoryStudent(st)}
                                                        className="font-medium text-slate-800 hover:text-primary outline-none transition-all flex items-center gap-2 group-hover:underline decoration-slate-300 underline-offset-4"
                                                        title="Xem lịch sử"
                                                    >
                                                        {fmtStudentName(st.name, st.englishName)}
                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5 text-slate-400 hidden md:block opacity-0 group-hover:opacity-100 transition-opacity"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                    </button>
                                                    <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">{st.studentCode}{(() => { const rs = getReserveStatus(st); return rs ? <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${RESERVE_BADGE[rs]}`}>{RESERVE_LABEL[rs]}</span> : null; })()}</div>
                                                </td>
                                                <td className="text-center">
                                                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-medium uppercase tracking-wider border ${status[st.id] === 'present' ? 'bg-slate-100 text-slate-700 border-slate-300' :
                                                            status[st.id] === 'late' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                                                status[st.id] === 'excused' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                                                                    status[st.id] === 'absent' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-slate-50 text-slate-400 border-slate-200'
                                                        }`}>
                                                        {status[st.id] === 'present' ? 'Có mặt' : status[st.id] === 'late' ? 'Đi trễ' : status[st.id] === 'excused' ? 'Có phép' : status[st.id] === 'absent' ? 'Vắng' : 'Chưa ĐD'}
                                                    </span>
                                                </td>
                                                <td className="text-center">
                                                    {/* Nút bấm thiết kế nét outline tối giản */}
                                                    <div className="flex justify-center gap-2">
                                                        <button title="Có mặt" onClick={() => handleMark(st.id, 'present')} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all border ${status[st.id] === 'present' ? 'bg-slate-500 border-slate-500 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-400 hover:text-slate-600'}`}><IconPresent /></button>
                                                        <button title="Đi trễ" onClick={() => handleMark(st.id, 'late')} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all border ${status[st.id] === 'late' ? 'bg-amber-500 border-amber-500 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-400 hover:border-amber-400 hover:text-amber-500'}`}><IconLate /></button>
                                                        <button title="Có phép" onClick={() => handleMark(st.id, 'excused')} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all border ${status[st.id] === 'excused' ? 'bg-blue-500 border-blue-500 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-400 hover:border-blue-400 hover:text-blue-500'}`}><IconExcused /></button>
                                                        <button title="Vắng" onClick={() => handleMark(st.id, 'absent')} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all border ${status[st.id] === 'absent' ? 'bg-red-500 border-red-500 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-400 hover:border-red-400 hover:text-red-500'}`}><IconAbsent /></button>
                                                    </div>
                                                </td>
                                                <td>
                                                    <input type="text" className="w-full p-2 border border-slate-200 rounded-md outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 text-xs bg-slate-50 focus:bg-white transition-colors" placeholder="Thêm ghi chú..." value={notes[st.id] || ''} onChange={e => setNotes({ ...notes, [st.id]: e.target.value })} disabled={status[st.id] === 'present'} />
                                                </td>
                                            </tr>
                                        ))}
                                        {students.length === 0 && <tr><td colSpan="5" className="p-8 text-center text-slate-400 italic">Lớp chưa có học viên.</td></tr>}
                                    </tbody>
                                </table>
                            </div>

                            <div className="p-4 bg-white border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                                {/* Left: indicator + quick actions */}
                                <div className="flex items-center gap-3 flex-wrap">
                                    <div className="text-xs font-medium">
                                        {saveError && <span className="text-red-500">{saveError}</span>}
                                        {savedAt && !saveError && (
                                            <span className="text-emerald-600 flex items-center gap-1.5">
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                                                Đã lưu lúc {savedAt}
                                            </span>
                                        )}
                                    </div>
                                    {/* Quick mark buttons */}
                                    {students.length > 0 && (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleMarkAll}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-xl text-xs font-bold hover:bg-green-100 transition-colors"
                                                title="Đánh dấu tất cả có mặt"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                                                Tất cả có mặt
                                            </button>
                                            {Object.keys(status).length > 0 && (
                                                <button
                                                    onClick={handleClearAll}
                                                    className="px-3 py-1.5 bg-slate-100 text-slate-500 border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors"
                                                >
                                                    Xóa tất cả
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <button onClick={handleSave} className="btn-primary">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                                    Lưu Điểm Danh
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="p-5">
                            <div className="flex flex-wrap gap-4 mb-4 items-end">
                                <div className="min-w-[180px]">
                                    <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1.5 block tracking-wide">Tháng</label>
                                    <MonthPicker value={reportMonth} onChange={setReportMonth} />
                                </div>
                                <button
                                    onClick={handleExportCSV}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-sm"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                    </svg>
                                    Xuất CSV
                                </button>
                            </div>

                            {/* Chú thích ký hiệu */}
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4 text-[11px] text-slate-500">
                                <span><b className="text-slate-700">C</b> Có mặt</span>
                                <span><b className="text-amber-600">T</b> Đi trễ</span>
                                <span><b className="text-blue-600">P</b> Có phép</span>
                                <span><b className="text-red-600">V</b> Vắng</span>
                            </div>
                            <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white">
                                <table className="w-full text-sm text-left border-collapse">
                                    <thead className="bg-slate-50/50 text-slate-400 font-semibold text-[10px] uppercase border-b border-slate-100">
                                        <tr>
                                            <th className="p-3 sticky left-0 bg-slate-50 z-10 min-w-[150px]">Học viên</th>
                                            {sessionDates.map(d => (
                                                <th key={d} className="p-2 text-center whitespace-nowrap font-semibold">{d.slice(8, 10)}/{d.slice(5, 7)}</th>
                                            ))}
                                            <th className="p-2 text-center text-slate-600">C</th>
                                            <th className="p-2 text-center text-amber-600">T</th>
                                            <th className="p-2 text-center text-blue-600">P</th>
                                            <th className="p-2 text-center text-red-600">V</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {sessionDates.length === 0 && (
                                            <tr><td colSpan={5} className="p-8 text-center text-slate-400 italic">Tháng này chưa có buổi điểm danh nào.</td></tr>
                                        )}
                                        {sessionDates.length > 0 && filteredStudents.map(st => {
                                            const s = getSummary(st.id);
                                            return (
                                                <tr key={st.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="p-3 font-medium text-slate-800 sticky left-0 bg-white z-10 whitespace-nowrap">{fmtStudentName(st.name, st.englishName)}</td>
                                                    {sessionDates.map(d => {
                                                        const rec = (allAttendance[selectedClass]?.[d] || {})[st.id];
                                                        const stt = rec ? (typeof rec === 'object' ? rec.status : rec) : null;
                                                        return (
                                                            <td key={d} className="p-2 text-center">
                                                                {stt
                                                                    ? <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-[11px] font-bold ${STATUS_CELL[stt] || ''}`}>{STATUS_LETTER[stt] || ''}</span>
                                                                    : <span className="text-slate-300">·</span>}
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="p-2 text-center font-bold text-slate-600">{s.present}</td>
                                                    <td className="p-2 text-center font-bold text-amber-600">{s.late}</td>
                                                    <td className="p-2 text-center font-bold text-blue-600">{s.excused}</td>
                                                    <td className="p-2 text-center font-bold text-red-600">{s.absent}</td>
                                                </tr>
                                            );
                                        })}
                                        {sessionDates.length > 0 && filteredStudents.length === 0 && (
                                            <tr><td colSpan={sessionDates.length + 5} className="p-8 text-center text-slate-400 italic">Lớp chưa có học viên.</td></tr>
                                        )}
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
                                <h3 className="section-title">Lịch sử Vắng / Trễ</h3>
                                <p className="text-xs text-slate-500 mt-1">Học viên: <span className="font-medium text-slate-800">{fmtStudentName(historyStudent.name, historyStudent.englishName)}</span></p>
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
                                        <p className="text-slate-500 text-sm">Học viên đi học chuyên cần, chưa vắng hoặc trễ.</p>
                                    </div>
                                );

                                return (
                                    <ul className="space-y-4">
                                        {history.map((h, i) => (
                                            <li key={i} className="flex gap-4">
                                                <div className="flex flex-col items-center pt-1">
                                                    <div className={`w-2.5 h-2.5 rounded-full ring-4 ${h.status === 'absent' ? 'bg-red-500 ring-red-50' : h.status === 'late' ? 'bg-amber-500 ring-amber-50' : 'bg-blue-500 ring-blue-50'}`} />
                                                    {i !== history.length - 1 && <div className="w-[1px] h-full bg-slate-100 mt-2" />}
                                                </div>
                                                <div className="flex-1 pb-4">
                                                    <div className="flex justify-between items-start mb-1.5">
                                                        <p className="text-sm font-medium text-slate-700">
                                                            {new Date(h.date).toLocaleDateString('vi-VN')}
                                                        </p>
                                                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-medium uppercase tracking-wider border ${
                                                            h.status === 'absent' ? 'text-red-600 bg-red-50 border-red-100' :
                                                            h.status === 'late' ? 'text-amber-600 bg-amber-50 border-amber-100' :
                                                            'text-blue-600 bg-blue-50 border-blue-100'
                                                        }`}>
                                                            {h.status === 'absent' ? 'Vắng' : h.status === 'late' ? 'Đi trễ' : 'Có phép'}
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
