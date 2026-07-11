import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { ref, onValue } from 'firebase/database';

// ============================================================
// Ý NGHĨA TỪNG LOẠI ĐIỂM, hiển thị trên biểu đồ & cột lịch sử
// ============================================================
const SCORE_META = {
  bonus:      { label: '⭐ Điểm Bonus',  meaning: 'Chỉ số tích cực, tham gia phát biểu & xây dựng bài', color: '#f59e0b', bg: 'bg-yellow-50 border-yellow-200' },
  assignment: { label: '📝 Assignment',  meaning: 'Tinh thần học tập', color: '#10b981', bg: 'bg-green-50 border-green-200' },
  formative:  { label: '📊 Formative',   meaning: 'Sự tiến bộ & Mức độ tiếp thu', color: '#3D8B47', bg: 'bg-primary-light border-green-200' },
  summative:  { label: '🎯 Summative',   meaning: 'Mức độ làm chủ kiến thức', color: '#1E5225', bg: 'bg-primary-light border-green-200' },
};

const MyGrades = () => {
  const { currentUser } = useAuth();

  const [myClasses, setMyClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');

  const [allUsers, setAllUsers] = useState({});
  const [allScores, setAllScores] = useState({});
  const [loading, setLoading] = useState(true);

  // 1. Lấy dữ liệu (Lớp, User, Điểm)
  useEffect(() => {
    if (!currentUser) return;

    const classesRef = ref(db, 'classes');
    const usersRef = ref(db, 'users');
    const scoresRef = ref(db, 'scores');

    let isMounted = true;

    // Lấy danh sách lớp của học viên
    const unsubscribeClasses = onValue(classesRef, (snap) => {
        const data = snap.val() || {};
        const myClassIds = Array.isArray(currentUser.classIds)
            ? currentUser.classIds
            : Object.values(currentUser.classIds || {});

        const filteredClasses = Object.entries(data)
            .map(([id, val]) => ({ id, ...val }))
            .filter(c => myClassIds.includes(c.id));

        if (isMounted) {
            setMyClasses(filteredClasses);
            // Tự động chọn lớp đầu tiên nếu chưa chọn
            if (filteredClasses.length > 0 && !selectedClass) {
                setSelectedClass(filteredClasses[0].id);
            }
        }
    });

    // Lấy tất cả user (để đếm tổng số học viên trong lớp và xếp hạng)
    const unsubscribeUsers = onValue(usersRef, (snap) => {
        if (isMounted) setAllUsers(snap.val() || {});
    });

    // Lấy toàn bộ điểm
    const unsubscribeScores = onValue(scoresRef, (snap) => {
        if (isMounted) {
            setAllScores(snap.val() || {});
            setLoading(false);
        }
    });

    return () => {
        isMounted = false;
        unsubscribeClasses();
        unsubscribeUsers();
        unsubscribeScores();
    };
  }, [currentUser, selectedClass]);

  // 2. Logic tính Điểm tổng kết & Xếp hạng
  const getRankInfo = () => {
    if (!selectedClass || !allUsers || !allScores) return null;

    // Tìm tất cả học viên đang học trong lớp được chọn
    const studentsInClass = Object.entries(allUsers)
        .map(([id, val]) => ({ id, ...val }))
        .filter(u => {
            if (u.role !== 'student') return false;
            const uClasses = Array.isArray(u.classIds) ? u.classIds : Object.values(u.classIds || {});
            return uClasses.includes(selectedClass);
        });

    if (studentsInClass.length === 0) return null;

    const classScores = allScores[selectedClass] || {};

    // Tính điểm tổng kết (GPA) cho TẤT CẢ học viên trong lớp
    const totals = studentsInClass.map(s => {
        const sData = classScores[s.id] || {};

        const getAvg = (recordsObj) => {
            const vals = Object.values(recordsObj || {}).map(r => Number(r.score) || 0);
            return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
        };

        // Tính trung bình từng phần
        const assAvg = getAvg(sData['assignment']);
        const formAvg = getAvg(sData['formative']);

        const summativeRecords = Object.values(sData['summative'] || {});
        const mmtVals = summativeRecords.filter(r => r.examType === 'MMT').map(r => Number(r.score) || 0);
        const mmtAvg = mmtVals.length ? mmtVals.reduce((a, b) => a + b, 0) / mmtVals.length : 0;

        const eomtVals = summativeRecords.filter(r => r.examType === 'EOMT').map(r => Number(r.score) || 0);
        const eomtAvg = eomtVals.length ? eomtVals.reduce((a, b) => a + b, 0) / eomtVals.length : 0;

        // Công thức trọng số: Assignment(10%) + Formative(20%) + MMT(30%) + EOMT(40%)
        const weightedScore = (assAvg * 0.10) + (formAvg * 0.20) + (mmtAvg * 0.30) + (eomtAvg * 0.40);

        return { id: s.id, score: weightedScore };
    });

    // Sắp xếp danh sách giảm dần theo điểm
    totals.sort((a, b) => b.score - a.score);

    // Tìm vị trí của học viên hiện tại
    const rankIndex = totals.findIndex(t => t.id === currentUser.id);
    if (rankIndex === -1) return null;

    return {
        rank: rankIndex + 1,
        totalStudents: studentsInClass.length,
        totalScore: totals[rankIndex].score.toFixed(2)
    };
  };

  const rankInfo = getRankInfo();

  // 3b. Dữ liệu biểu đồ: lấy điểm của MỘT loại theo thời gian
  const getTypePoints = (type) => {
    if (!selectedClass) return [];
    const classScores = allScores[selectedClass] || {};
    const myScores = classScores[currentUser.id] || {};

    return Object.values(myScores[type] || {})
      .filter(rec => rec?.date && rec?.score != null)
      .map(rec => ({ date: rec.date, score: Number(rec.score), content: rec.content || '' }))
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-12); // tối đa 12 cột điểm gần nhất
  };

  // SVG line chart cho MỘT loại điểm, mỗi loại 1 biểu đồ riêng
  const TypeChart = ({ type }) => {
    const meta = SCORE_META[type];
    const data = getTypePoints(type);

    const W = 1000, H = 240, PAD = { top: 30, right: 24, bottom: 42, left: 52 };
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;

    let body;
    if (data.length === 0) {
      body = <div className="flex items-center justify-center h-[160px] text-sm text-slate-400 italic">Chưa có dữ liệu</div>;
    } else if (data.length === 1) {
      body = (
        <div className="flex flex-col items-center justify-center h-[160px] gap-1.5">
          <span className="text-4xl font-extrabold" style={{ color: meta.color }}>{data[0].score}</span>
          <span className="text-sm text-slate-400">1 cột điểm ({new Date(data[0].date).toLocaleDateString('vi-VN')}), cần ≥2 cột để vẽ xu hướng</span>
        </div>
      );
    } else {
      const scores = data.map(d => d.score);
      const minS = Math.max(0, Math.min(...scores) - 2);
      const maxS = Math.max(...scores) + 2;
      const xScale = (i) => PAD.left + (i / (data.length - 1)) * innerW;
      const yScale = (s) => PAD.top + innerH - ((s - minS) / (maxS - minS || 1)) * innerH;
      const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xScale(i).toFixed(1)},${yScale(d.score).toFixed(1)}`).join(' ');

      body = (
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[320px]" style={{ height: H }}>
            {/* Grid lines */}
            {[0, 0.5, 1].map((t, i) => {
              const y = PAD.top + innerH * (1 - t);
              const val = Math.round(minS + (maxS - minS) * t);
              return (
                <g key={i}>
                  <line x1={PAD.left} y1={y} x2={PAD.left + innerW} y2={y} stroke="#f1f5f9" strokeWidth="1.5" />
                  <text x={PAD.left - 10} y={y + 5} textAnchor="end" fontSize="13" fill="#94a3b8">{val}</text>
                </g>
              );
            })}

            {/* Area fill */}
            <path
              d={`${linePath} L${xScale(data.length - 1).toFixed(1)},${(PAD.top + innerH).toFixed(1)} L${PAD.left.toFixed(1)},${(PAD.top + innerH).toFixed(1)} Z`}
              fill={meta.color} fillOpacity="0.07"
            />

            {/* Line */}
            <path d={linePath} fill="none" stroke={meta.color} strokeWidth="3.5" strokeLinejoin="round" />

            {/* Points + giá trị */}
            {data.map((d, i) => (
              <g key={i}>
                <circle cx={xScale(i)} cy={yScale(d.score)} r="6" fill={meta.color} stroke="white" strokeWidth="2.5" />
                <text x={xScale(i)} y={yScale(d.score) - 13} textAnchor="middle" fontSize="15" fontWeight="700" fill="#334155">
                  {d.score}
                </text>
              </g>
            ))}

            {/* X-axis dates */}
            {data.map((d, i) => (
              <text key={i} x={xScale(i)} y={H - 8} textAnchor="middle" fontSize="12" fill="#94a3b8">
                {new Date(d.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
              </text>
            ))}
          </svg>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <p className="section-title">{meta.label}</p>
            <p className="text-sm font-semibold" style={{ color: meta.color }}>{meta.meaning}</p>
          </div>
          {data.length > 0 && (
            <span className="shrink-0 text-xs font-bold text-slate-400 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">{data.length} cột điểm</span>
          )}
        </div>
        {body}
      </div>
    );
  };

  // 3. Component render từng cột lịch sử điểm
  const renderHistoryColumn = (catKey, label, colorClass) => {
    if (!selectedClass) return null;

    const classScores = allScores[selectedClass] || {};
    const currentStudentScores = classScores[currentUser.id] || {};

    const recordsObj = currentStudentScores[catKey] || {};
    const records = Object.entries(recordsObj)
        .map(([id, val]) => ({ id, ...val }))
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    const total = records.reduce((sum, r) => sum + (Number(r.score) || 0), 0);
    const avg = records.length ? (total / records.length).toFixed(1) : 0;

    // Bonus tính tổng, các cột khác hiển thị trung bình
    const summaryText = catKey === 'bonus' ? `Tổng: ${total}` : `TB: ${avg}`;

    return (
        <div className={`p-4 rounded-xl border flex flex-col h-full ${colorClass}`}>
            <div className="flex justify-between items-start mb-3 pb-3 border-b border-black/5">
                <div className="pr-2">
                  <h4 className="font-bold text-sm leading-tight">{label}</h4>
                  <p className="text-xs opacity-70 font-medium mt-0.5">{SCORE_META[catKey]?.meaning}</p>
                </div>
                <span className="text-xs font-bold bg-white/70 px-2 py-1 rounded shadow-sm whitespace-nowrap text-slate-800">{summaryText}</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 max-h-[350px] pr-1 custom-scrollbar">
                {records.length > 0 ? records.map(r => (
                    <div key={r.id} className="bg-white/80 p-3 rounded-xl shadow-sm text-xs transition-all hover:bg-white">
                        <div className="flex justify-between font-bold text-primary mb-1.5">
                            <span className="text-sm">{r.score} điểm</span>
                            <span className="text-slate-500 font-mono font-medium">{new Date(r.date).toLocaleDateString('vi-VN')}</span>
                        </div>
                        <p className="text-slate-600 line-clamp-2 leading-relaxed">{r.content}</p>
                        {r.examType && (
                            <span className="inline-block mt-2 bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase">
                                {r.examType}
                            </span>
                        )}
                    </div>
                )) : (
                    <div className="text-center text-xs text-slate-400 italic py-6 opacity-80">Chưa có dữ liệu</div>
                )}
            </div>
        </div>
    );
  };

  return (
    <div className="space-y-6 pb-20 animate-fade-in-up">
       <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="p-2 bg-primary-light rounded-xl text-primary">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
            </div>
            <div>
                <h2 className="page-title">Bảng Kết Quả Học Tập</h2>
                <p className="page-sub hidden md:block">Chi tiết lịch sử nhận điểm và xếp hạng lớp</p>
            </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-8"><span className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></span></div>
      ) : myClasses.length > 0 ? (
        <div className="card-std p-4 md:p-6">

            {/* Thanh công cụ: Chọn lớp & Hiển thị Xếp hạng */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-5 mb-6">
                <div className="w-full md:w-1/3">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Lọc xem theo Lớp</label>
                    <select
                        className="input-base font-medium"
                        value={selectedClass}
                        onChange={e => setSelectedClass(e.target.value)}
                    >
                        {myClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>

                {selectedClass && rankInfo && (
                    <div className="flex gap-4 md:gap-8 bg-white px-5 py-3 rounded-xl border border-slate-200 shadow-sm w-full md:w-auto">
                        <div className="text-center pr-4 md:pr-8 border-r border-slate-100">
                            <p className="stat-label mb-1" title="Assignment(10%) + Formative(20%) + MMT(30%) + EOMT(40%)">Điểm Tổng Kết</p>
                            <p className="text-3xl font-extrabold leading-tight text-primary">{rankInfo.totalScore}</p>
                        </div>
                        <div className="text-center pr-2">
                            <p className="stat-label mb-1">Xếp hạng của bạn</p>
                            <p className="text-3xl font-extrabold leading-tight text-emerald-600">#{rankInfo.rank} <span className="text-sm font-bold text-slate-400">/ {rankInfo.totalStudents}</span></p>
                        </div>
                    </div>
                )}
            </div>

            {/* ===== CƠ CHẾ TÍNH ĐIỂM & XẾP HẠNG, minh bạch cho Phụ huynh & Học viên ===== */}
            <div className="bg-primary-light/60 rounded-xl border border-green-200 p-4 md:p-5 mb-6">
                <h3 className="section-title mb-3">📐 Cơ chế tính điểm & xếp hạng</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Công thức điểm tổng kết */}
                    <div className="bg-white rounded-xl border border-green-100 p-4">
                        <p className="text-base font-bold text-slate-700 mb-4">ĐIỂM TỔNG KẾT = tổng 4 phần theo trọng số:</p>
                        <div className="space-y-4">
                            {[
                                { label: '📝 Assignment (TB bài tập về nhà)', pct: 10, color: '#10b981' },
                                { label: '📊 Formative (TB kiểm tra trên lớp)', pct: 20, color: '#3D8B47' },
                                { label: '🎯 Thi giữa khóa (MMT)', pct: 30, color: '#2B6830' },
                                { label: '🎯 Thi cuối khóa (EOMT)', pct: 40, color: '#1E5225' },
                            ].map(row => (
                                <div key={row.label}>
                                    {/* Nhãn nằm TRÊN thanh, full width, không bị bóp nhỏ trên mobile */}
                                    <div className="flex items-center justify-between gap-2 mb-1.5">
                                        <span className="text-[15px] font-semibold text-slate-700 leading-tight">{row.label}</span>
                                        <span className="text-lg font-extrabold shrink-0" style={{ color: row.color }}>{row.pct}%</span>
                                    </div>
                                    <div className="bg-slate-100 rounded-full h-5 overflow-hidden">
                                        <div className="h-full rounded-full" style={{ width: `${row.pct}%`, background: row.color }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <p className="text-sm text-slate-500 mt-4">Mỗi phần lấy điểm trung bình của tất cả cột điểm trong phần đó, nhân với trọng số rồi cộng lại.</p>
                    </div>

                    {/* Xếp hạng + Bonus */}
                    <div className="flex flex-col gap-3">
                        <div className="bg-white rounded-xl border border-green-100 p-4 flex-1">
                            <p className="text-base font-bold text-slate-700 mb-1.5">🏆 XẾP HẠNG LỚP</p>
                            <p className="text-[15px] text-slate-600 leading-relaxed">
                                So sánh <b>Điểm Tổng Kết</b> của bạn với tất cả thành viên trong lớp, cập nhật ngay khi có cột điểm mới. Hạng #1 là điểm cao nhất lớp.
                            </p>
                        </div>
                        <div className="bg-white rounded-xl border border-yellow-200 p-4 flex-1">
                            <p className="text-base font-bold text-slate-700 mb-1.5">⭐ ĐIỂM BONUS, KHÔNG tính vào Điểm Tổng Kết</p>
                            <p className="text-[15px] text-slate-600 leading-relaxed">
                                Bonus là điểm thưởng tích lũy cho sự tích cực (phát biểu, xây dựng bài). Bonus quy đổi được thành <b>BAVN Credits</b> (2 Bonus = 1 Credit = 1.000đ) để đổi đồ uống, đồ ăn Fresh Fit và quà tặng, xem thẻ <b>BAVN Credits</b> ở menu.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ===== 4 BIỂU ĐỒ XU HƯỚNG, MỖI LOẠI ĐIỂM 1 BIỂU ĐỒ ===== */}
            {selectedClass && (
              <div className="mb-6">
                <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Xu hướng điểm số theo từng loại</p>
                <div className="grid grid-cols-1 gap-5">
                    <TypeChart type="bonus" />
                    <TypeChart type="assignment" />
                    <TypeChart type="formative" />
                    <TypeChart type="summative" />
                </div>
              </div>
            )}

            {/* Bảng chi tiết điểm (4 Cột) */}
            {selectedClass ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    {renderHistoryColumn('bonus', '1. Điểm Bonus', 'bg-yellow-50 border-yellow-200 text-yellow-900')}
                    {renderHistoryColumn('assignment', '2. Assignment', 'bg-green-50 border-green-200 text-green-900')}
                    {renderHistoryColumn('formative', '3. Formative', 'bg-primary-light border-green-200 text-green-900')}
                    {renderHistoryColumn('summative', '4. Summative', 'bg-primary-light border-green-200 text-green-900')}
                </div>
            ) : null}

        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 bg-white rounded-xl border border-dashed border-slate-200">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#94a3b8" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
            </div>
            <p className="text-slate-500 font-medium">Bạn chưa được phân vào lớp học nào.</p>
        </div>
      )}
    </div>
  );
};

export default MyGrades;
