import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db } from '../../firebase';
import { ref, onValue, push, set, update, remove } from "firebase/database";
import { useAuth } from '../../context/AuthContext';
import { getReserveStatus, RESERVE_LABEL, RESERVE_BADGE } from '../../utils/reserve';
import { fmtStudentName } from '../../utils/studentName';
import { computeAutoBonus } from '../../utils/autoBonus'; // tự cộng Bonus khi nhập điểm

const ScoreInput = () => {
    const { currentUser } = useAuth();
    const [searchParams] = useSearchParams();

    const [classes, setClasses] = useState([]);
    // ?class=<id>: trang Theo dõi lớp dẫn sang với lớp đã chọn sẵn
    const [selectedClass, setSelectedClass] = useState(searchParams.get('class') || '');
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
    const [toastMsg, setToastMsg] = useState('');
    const [pendingSaveCount, setPendingSaveCount] = useState(0);
    const [deleteRecordTarget, setDeleteRecordTarget] = useState(null);
    const [studentSearch, setStudentSearch] = useState(''); // tìm tên học viên trong bảng nhập điểm
    const [bonusRules, setBonusRules] = useState(null); // luật tự động cộng Bonus (Admin cấu hình)

    // Lắng nghe cấu hình auto-bonus
    useEffect(() => {
        const unsub = onValue(ref(db, 'bonusRules'), (snap) => setBonusRules(snap.val() || {}));
        return () => unsub();
    }, []);

    const showToast = (msg, isError = false) => {
        setToastMsg({ text: msg, error: isError });
        setTimeout(() => setToastMsg(''), 3500);
    };

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
                // Sắp xếp tên lớp theo bảng chữ cái (có dấu tiếng Việt)
                filteredList.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'));
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
                // Sắp xếp tên học viên theo bảng chữ cái (có dấu tiếng Việt)
                list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'));
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

    const handleKeyDown = (e, currentIndex) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const nextInput = document.getElementById(`score-input-${currentIndex + 1}`);
            if (nextInput) { nextInput.focus(); nextInput.select(); }
        }
    };

    // ============================================================
    // BULK PASTE, copy cột điểm từ Excel/Sheets, paste vào ô đầu tiên
    // Mỗi dòng (ngăn cách bởi \n hoặc \t) → một học viên theo thứ tự
    // ============================================================
    const handleScorePaste = (e, startIndex) => {
        const text = e.clipboardData.getData('text');
        // Tách theo dòng và tab, lọc giá trị số hợp lệ
        const values = text
            .split(/[\n\r\t]+/)
            .map(v => v.trim())
            .filter(v => v !== '');

        // Nếu chỉ paste 1 giá trị → cho paste bình thường
        if (values.length <= 1) return;

        e.preventDefault();
        const updates = {};
        values.forEach((val, i) => {
            const idx = startIndex + i;
            if (idx < students.length) {
                const numVal = val.replace(',', '.'); // hỗ trợ dấu phẩy thập phân
                if (!isNaN(Number(numVal))) updates[students[idx].id] = numVal;
            }
        });
        setStudentScores(prev => ({ ...prev, ...updates }));
        showToast(`✅ Đã điền điểm cho ${Object.keys(updates).length} học viên`);
    };

    const handleSaveAll = async () => {
        // 1. Kiểm tra điều kiện bắt buộc (phần chung)
        if (!commonInput.content) return showToast("Vui lòng nhập 'Nội dung ghi nhận'", true);

        const studentIdsWithScores = Object.keys(studentScores).filter(id => studentScores[id] !== '');
        if (studentIdsWithScores.length === 0) return showToast("Chưa có điểm nào được nhập!", true);

        // Dùng state để confirm thay window.confirm
        if (pendingSaveCount !== studentIdsWithScores.length) {
            setPendingSaveCount(studentIdsWithScores.length);
            return; // lần bấm đầu: hiện nút xác nhận inline
        }
        setPendingSaveCount(0);

        setLoading(true);
        try {
            const updates = {};
            const timestamp = new Date().toISOString();

            // 3. Duyệt qua từng học sinh đã có điểm để gom vào object updates
            studentIdsWithScores.forEach(studentId => {
                // Tạo một key ngẫu nhiên mới cho bản ghi điểm
                const newRecordKey = push(ref(db, `scores/${selectedClass}/${studentId}/${activeTab}`)).key;

                const payload = {
                    score: studentScores[studentId],
                    date: commonInput.date,
                    content: commonInput.content,
                    timestamp: timestamp
                };

                if (activeTab === 'summative') payload.examType = commonInput.examType;

                // Định nghĩa đường dẫn cần cập nhật trong Firebase
                updates[`scores/${selectedClass}/${studentId}/${activeTab}/${newRecordKey}`] = payload;

                // --- TỰ ĐỘNG CỘNG BONUS theo luật (assignment / kiểm tra đạt ngưỡng) ---
                // Chỉ chạy khi tạo cột điểm mới → mỗi cột chỉ sinh tối đa 1 Bonus tự động.
                const auto = computeAutoBonus(activeTab, studentScores[studentId], bonusRules);
                if (auto) {
                    const bKey = push(ref(db, `scores/${selectedClass}/${studentId}/bonus`)).key;
                    updates[`scores/${selectedClass}/${studentId}/bonus/${bKey}`] = {
                        score: auto.amount,
                        date: commonInput.date,
                        content: `🤖 Tự động: ${auto.reason}`,
                        auto: true, // đánh dấu Bonus do hệ thống tự cộng
                        timestamp,
                    };
                }
            });

            // 4. Thực hiện lệnh update 1 lần duy nhất lên Firebase
            await update(ref(db), updates);

            // Flash toast nhẹ nhàng không dùng alert
            const toast = document.createElement('div');
            toast.textContent = `✅ Đã lưu ${studentIdsWithScores.length} học viên`;
            toast.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);background:#059669;color:white;padding:10px 20px;border-radius:12px;font-size:14px;font-weight:600;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.15)';
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);

            // Xóa trắng state studentScores sau khi lưu thành công
            setStudentScores({});
        } catch (error) {
            showToast("Lỗi khi lưu: " + error.message, true);
        } finally {
            setLoading(false);
        }
    };

    // Tính điểm tổng hợp (Summary)
    const getSummary = (studentId) => {
        const sData = classScores[studentId] || {};
        const getAvg = (cat) => {
            const vals = Object.values(sData[cat] || {}).map(r => Number(r.score) || 0);
            return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : '-';
        };
        const getSum = (cat) => {
            const vals = Object.values(sData[cat] || {}).map(r => Number(r.score) || 0);
            return vals.reduce((a, b) => a + b, 0);
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

    // ============================================================
    // EXPORT ĐIỂM SỐ RA CSV
    // ============================================================
    const handleExportScores = () => {
        if (!selectedClass || !students.length) return;
        const className = classes.find(c => c.id === selectedClass)?.name || selectedClass;

        const header = ['Họ tên', 'Mã HV', 'Tổng Bonus', 'TB Assignment', 'TB Formative', 'TB MMT', 'TB EOMT', 'Điểm Tổng Kết'];
        const rows = [header];

        students.forEach(st => {
            const sData = classScores[st.id] || {};
            const getAvg = (cat) => {
                const vals = Object.values(sData[cat] || {}).map(r => Number(r.score) || 0);
                return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : '0';
            };
            const getSum = (cat) => {
                return Object.values(sData[cat] || {}).reduce((s, r) => s + (Number(r.score) || 0), 0);
            };

            const sumRecs = Object.values(sData['summative'] || {});
            const mmtVals = sumRecs.filter(r => r.examType === 'MMT').map(r => Number(r.score) || 0);
            const eomtVals = sumRecs.filter(r => r.examType === 'EOMT').map(r => Number(r.score) || 0);
            const mmtAvg = mmtVals.length ? (mmtVals.reduce((a, b) => a + b, 0) / mmtVals.length) : 0;
            const eomtAvg = eomtVals.length ? (eomtVals.reduce((a, b) => a + b, 0) / eomtVals.length) : 0;
            const assAvg = parseFloat(getAvg('assignment')) || 0;
            const formAvg = parseFloat(getAvg('formative')) || 0;
            const gpa = (assAvg * 0.10 + formAvg * 0.20 + mmtAvg * 0.30 + eomtAvg * 0.40).toFixed(2);

            rows.push([
                fmtStudentName(st.name, st.englishName), st.studentCode || '',
                getSum('bonus'), getAvg('assignment'), getAvg('formative'),
                mmtAvg.toFixed(1), eomtAvg.toFixed(1), gpa
            ]);
        });

        const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `DIEM_${className.replace(/\s/g, '_')}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Xử lý Cập nhật & Xóa điểm trong Modal Lịch sử
    const saveEditRecord = async (catKey) => {
        try {
            const { id, score, date, content, examType } = editFormData;
            const payload = { score, date, content };
            if (catKey === 'summative') payload.examType = examType || 'MMT';

            await update(ref(db, `scores/${selectedClass}/${historyStudentModal.id}/${catKey}/${id}`), payload);
            setEditingRecordId(null);
        } catch (error) {
            showToast("Lỗi khi cập nhật: " + error.message, true);
        }
    };

    const deleteRecord = (recordId, catKey) => {
        setDeleteRecordTarget({ recordId, catKey });
    };

    const confirmDeleteRecord = async () => {
        if (!deleteRecordTarget) return;
        const { recordId, catKey } = deleteRecordTarget;
        setDeleteRecordTarget(null);
        try {
            await remove(ref(db, `scores/${selectedClass}/${historyStudentModal.id}/${catKey}/${recordId}`));
            showToast('Đã xóa điểm thành công');
        } catch (error) {
            showToast("Lỗi khi xóa: " + error.message, true);
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
                        <div key={r.id} className="p-3 border border-slate-200 rounded-xl bg-slate-50 hover:bg-white transition-all shadow-sm">
                            {editingRecordId === r.id ? (
                                <div className="space-y-2">
                                    <input type="date" value={editFormData.date} onChange={e => setEditFormData({ ...editFormData, date: e.target.value })} className="w-full text-xs p-1.5 border rounded outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" />
                                    <input type="number" value={editFormData.score} onChange={e => setEditFormData({ ...editFormData, score: e.target.value })} className="w-full text-xs p-1.5 border rounded outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" placeholder="Điểm số" />
                                    <textarea value={editFormData.content} onChange={e => setEditFormData({ ...editFormData, content: e.target.value })} className="w-full text-xs p-1.5 border rounded outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" placeholder="Nội dung ghi nhận"></textarea>
                                    {catKey === 'summative' && (
                                        <select value={editFormData.examType || 'MMT'} onChange={e => setEditFormData({ ...editFormData, examType: e.target.value })} className="w-full text-xs p-1.5 border rounded outline-none focus:border-primary focus:ring-2 focus:ring-primary/10">
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
                                    <div className="flex justify-between font-bold text-primary text-sm mb-1.5">
                                        <span>{r.score} điểm</span>
                                        <span className="text-xs text-slate-500 font-mono">{new Date(r.date).toLocaleDateString('vi-VN')}</span>
                                    </div>
                                    <p className="text-xs text-slate-600 mb-2 leading-relaxed">{r.content}</p>
                                    {r.examType && <span className="text-[10px] font-bold bg-slate-200 px-1.5 py-0.5 rounded uppercase mb-2 inline-block">{r.examType}</span>}
                                    <div className="flex gap-2 border-t border-slate-200 pt-2 mt-2">
                                        <button onClick={() => { setEditingRecordId(r.id); setEditFormData(r); }} className="text-green-600 hover:text-green-800 text-xs font-bold px-2 py-1 rounded bg-primary-light">Sửa</button>
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
        <div className="space-y-6 pb-20 animate-fade-in-up">

            {/* MODAL XÓA ĐIỂM */}
            {deleteRecordTarget && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
                    <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4 border border-slate-100">
                        <p className="text-sm font-medium text-slate-700">Xóa điểm này? Hành động không thể hoàn tác.</p>
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setDeleteRecordTarget(null)} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Hủy</button>
                            <button onClick={confirmDeleteRecord} className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition-colors">Xóa</button>
                        </div>
                    </div>
                </div>
            )}

            {/* TOAST */}
            {toastMsg && (
                <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white flex items-center gap-2 transition-all ${toastMsg.error ? 'bg-red-500' : 'bg-emerald-600'}`}>
                    {toastMsg.error
                        ? <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        : <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                    }
                    {toastMsg.text}
                </div>
            )}

            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                <div className="p-2 bg-primary-light rounded-xl text-primary">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                </div>
                <h2 className="page-title">Nhập Điểm Chi Tiết</h2>
            </div>

            <div className="card-std p-5">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Chọn Lớp học (Được phân công)</label>
                <select
                    className="input-base md:w-1/2 font-medium"
                    value={selectedClass}
                    onChange={e => setSelectedClass(e.target.value)}
                >
                    <option value="">-- Chọn lớp --</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>

            {selectedClass && (
                <>
                    <div className="card-std overflow-hidden">
                        <div className="flex border-b border-slate-200 bg-slate-50 overflow-x-auto custom-scrollbar">
                            {TABS.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`px-6 py-4 text-sm font-bold whitespace-nowrap transition-all ${activeTab === tab.id ? 'bg-white text-primary border-t-2 border-t-primary' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                                        }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="p-5 bg-primary-light/50 border-b border-slate-100 grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                            <div className="md:col-span-3">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ngày ghi nhận</label>
                                <input type="date" className="input-base" value={commonInput.date} onChange={e => setCommonInput({ ...commonInput, date: e.target.value })} />
                            </div>
                            {activeTab === 'summative' && (
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Kỳ thi</label>
                                    <select className="input-base font-bold text-primary" value={commonInput.examType} onChange={e => setCommonInput({ ...commonInput, examType: e.target.value })}>
                                        <option value="MMT">MMT</option>
                                        <option value="EOMT">EOMT</option>
                                    </select>
                                </div>
                            )}
                            <div className={activeTab === 'summative' ? "md:col-span-7" : "md:col-span-9"}>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nội dung ghi nhận (Bắt buộc)</label>
                                <input type="text" placeholder="VD: Làm bài tập về nhà đầy đủ..." className="input-base" value={commonInput.content} onChange={e => setCommonInput({ ...commonInput, content: e.target.value })} />
                            </div>
                        </div>

                        {/* Search học viên */}
                        {students.length > 4 && (
                            <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                                <div className="relative flex-1 max-w-xs">
                                    <input
                                        className="w-full border border-slate-200 pl-8 pr-3 py-2 rounded-xl text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
                                        placeholder="Tìm tên học viên..."
                                        value={studentSearch}
                                        onChange={e => setStudentSearch(e.target.value)}
                                    />
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#94a3b8" className="w-4 h-4 absolute left-2.5 top-2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                                    </svg>
                                </div>
                                {studentSearch && (
                                    <button onClick={() => setStudentSearch('')} className="text-xs text-slate-400 hover:text-slate-600">✕ Xóa</button>
                                )}
                                <span className="text-xs text-slate-400 ml-auto">
                                    {studentSearch ? `${students.filter(s => s.name.toLowerCase().includes(studentSearch.toLowerCase()) || (s.studentCode||'').toLowerCase().includes(studentSearch.toLowerCase())).length}/${students.length}` : `${students.length} học viên`}
                                </span>
                            </div>
                        )}

                        {/* Hint bulk paste */}
                        <div className="px-5 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-2 text-xs text-amber-700">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 shrink-0">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                            </svg>
                            <span><strong>Mẹo:</strong> Copy một cột điểm từ Excel/Google Sheets → Paste vào ô điểm đầu tiên để điền hàng loạt. Enter để di chuyển xuống dòng tiếp theo.</span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="table-std">
                                <thead>
                                    <tr>
                                        <th className="w-10">#</th>
                                        <th>Học Viên (Bấm để xem lịch sử)</th>
                                        <th className="!text-center !text-yellow-700 !bg-yellow-50/50 hidden md:table-cell">Bonus</th>
                                        <th className="!text-center !text-green-700 !bg-green-50/50 hidden md:table-cell">Assign</th>
                                        <th className="!text-center !text-green-700 !bg-primary-light/50 hidden md:table-cell">Format</th>
                                        <th className="!text-center !text-green-700 !bg-primary-light/50 hidden md:table-cell">Summa</th>
                                        <th className="w-40 !text-center border-l border-slate-200">Nhập Điểm</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {students.filter(s => !studentSearch || s.name.toLowerCase().includes(studentSearch.toLowerCase()) || (s.studentCode||'').toLowerCase().includes(studentSearch.toLowerCase())).map((st, index) => {
                                        const summary = getSummary(st.id);
                                        return (
                                            <tr key={st.id}>
                                                <td className="text-slate-400">{index + 1}</td>
                                                <td>
                                                    <button
                                                        onClick={() => setHistoryStudentModal(st)}
                                                        className="font-bold text-primary hover:text-green-600 hover:underline text-left outline-none transition-all flex items-center gap-2"
                                                        title="Bấm để xem & sửa lịch sử điểm"
                                                    >
                                                        {fmtStudentName(st.name, st.englishName)}
                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 text-green-400 hidden md:block"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
                                                    </button>
                                                    <div className="text-xs text-slate-400 font-mono mt-0.5 flex items-center gap-2 flex-wrap">{st.studentCode}{(() => { const rs = getReserveStatus(st); return rs ? <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${RESERVE_BADGE[rs]}`}>{RESERVE_LABEL[rs]}</span> : null; })()}</div>

                                                    {/* --- GIAO DIỆN 4 CỘT ĐIỂM DÀNH RIÊNG CHO MOBILE --- */}
                                                    <div className="grid grid-cols-4 gap-1.5 mt-2.5 md:hidden">
                                                        <div className="bg-yellow-50 text-yellow-700 text-[10px] font-bold text-center py-1 rounded border border-yellow-100" title="Bonus">B: {summary.bonus}</div>
                                                        <div className="bg-green-50 text-green-700 text-[10px] font-bold text-center py-1 rounded border border-green-100" title="Assignment">A: {summary.assignment}</div>
                                                        <div className="bg-primary-light text-green-700 text-[10px] font-bold text-center py-1 rounded border border-green-100" title="Formative">F: {summary.formative}</div>
                                                        <div className="bg-primary-light text-green-700 text-[10px] font-bold text-center py-1 rounded border border-green-100" title="Summative">S: {summary.summative}</div>
                                                    </div>
                                                    {/* ------------------------------------------------ */}
                                                </td>
                                                <td className="text-center font-bold !text-yellow-700 bg-yellow-50/30 hidden md:table-cell">{summary.bonus}</td>
                                                <td className="text-center font-bold !text-green-700 bg-green-50/30 hidden md:table-cell">{summary.assignment}</td>
                                                <td className="text-center font-bold !text-green-700 bg-primary-light/30 hidden md:table-cell">{summary.formative}</td>
                                                <td className="text-center font-bold !text-green-700 bg-primary-light/30 hidden md:table-cell">{summary.summative}</td>
                                                <td className="border-l border-slate-100 bg-slate-50/50">
                                                    <div className="flex justify-center">
                                                        <input
                                                            id={`score-input-${index}`} // Cấp ID duy nhất dựa trên index của mảng
                                                            type="number"
                                                            className="w-full max-w-[100px] text-center p-2.5 border border-slate-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none font-bold text-lg transition-all shadow-sm hover:border-primary/50"
                                                            placeholder="0-10"
                                                            value={studentScores[st.id] || ''}
                                                            onChange={(e) => handleScoreChange(st.id, e.target.value)}
                                                            onKeyDown={(e) => handleKeyDown(e, index)}
                                                            onPaste={(e) => handleScorePaste(e, index)} // Bulk paste từ Excel
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                    {students.length === 0 && <tr><td colSpan="8" className="p-8 text-center text-slate-400 italic">Lớp này chưa có học viên nào.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                        {/* NÚT LƯU + EXPORT */}
                        <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-between items-center gap-3 flex-wrap">
                            <button
                                onClick={handleExportScores}
                                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-sm"
                                title="Xuất bảng tổng hợp điểm ra CSV"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                </svg>
                                Xuất CSV
                            </button>
                            {/* Inline confirm, hiện sau lần bấm đầu thay window.confirm */}
                            {pendingSaveCount > 0 && (
                                <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-sm">
                                    <span className="text-amber-700 font-medium">Lưu điểm cho <strong>{pendingSaveCount}</strong> học viên?</span>
                                    <button onClick={handleSaveAll} className="bg-primary text-white px-4 py-1.5 rounded-xl text-xs font-bold hover:bg-primary-hover transition-colors">Xác nhận</button>
                                    <button onClick={() => setPendingSaveCount(0)} className="text-slate-500 px-3 py-1.5 rounded-xl text-xs font-bold bg-white border border-slate-200 hover:bg-slate-50 transition-colors">Hủy</button>
                                </div>
                            )}
                            <button
                                onClick={handleSaveAll}
                                disabled={loading || Object.keys(studentScores).length === 0}
                                className={`px-8 py-3 rounded-xl text-sm font-bold transition-all shadow-sm flex items-center gap-2 ${Object.keys(studentScores).length > 0 && commonInput.content ? 'bg-primary text-white hover:bg-primary-hover' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                    }`}
                            >
                                {loading ? (
                                    <>
                                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        Đang lưu dữ liệu...
                                    </>
                                ) : (
                                    <>
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                                        Lưu Điểm
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* MODAL LỊCH SỬ & CHỈNH SỬA CHO TỪNG HỌC VIÊN */}
                    {historyStudentModal && (
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in-up">
                            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">
                                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                    <div>
                                        <h3 className="section-title">Lịch sử Điểm & Chỉnh sửa</h3>
                                        <p className="text-sm font-medium text-slate-500 mt-1">Học viên: <span className="text-primary">{fmtStudentName(historyStudentModal.name, historyStudentModal.englishName)}</span> ({historyStudentModal.studentCode})</p>
                                    </div>
                                    <button onClick={() => { setHistoryStudentModal(null); setEditingRecordId(null); }} className="p-2 bg-slate-200 text-slate-500 rounded-full hover:bg-red-100 hover:text-red-600 transition-colors">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                                <div className="p-5 overflow-y-auto flex-1 bg-slate-100">
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                                        {renderEditableHistoryColumn('bonus', '1. Điểm Bonus', 'border-yellow-200 text-yellow-900')}
                                        {renderEditableHistoryColumn('assignment', '2. Assignment', 'border-green-200 text-green-900')}
                                        {renderEditableHistoryColumn('formative', '3. Formative', 'border-green-200 text-green-900')}
                                        {renderEditableHistoryColumn('summative', '4. Summative', 'border-green-200 text-green-900')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default ScoreInput;
