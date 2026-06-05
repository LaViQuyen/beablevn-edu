import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { ref, onValue } from 'firebase/database';

// ============================================================
// HELPER: tính điểm tổng kết từ records
// ============================================================
const calcGPA = (sData) => {
  const getAvg = (cat) => {
    const vals = Object.values(sData[cat] || {}).map(r => Number(r.score) || 0);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  };
  const sumRecs = Object.values(sData['summative'] || {});
  const mmtVals = sumRecs.filter(r => r.examType === 'MMT').map(r => Number(r.score) || 0);
  const eomtVals = sumRecs.filter(r => r.examType === 'EOMT').map(r => Number(r.score) || 0);
  const mmtAvg  = mmtVals.length  ? mmtVals.reduce((a, b) => a + b, 0)  / mmtVals.length  : 0;
  const eomtAvg = eomtVals.length ? eomtVals.reduce((a, b) => a + b, 0) / eomtVals.length : 0;
  return (getAvg('assignment') * 0.10 + getAvg('formative') * 0.20 + mmtAvg * 0.30 + eomtAvg * 0.40);
};

// ============================================================
// MINI STAT CARD
// ============================================================
const StatCard = ({ label, value, sub, color }) => (
  <div className={`rounded-2xl p-4 text-center border border-slate-100 ${color}`}>
    <p className="text-3xl font-extrabold text-slate-800">{value}</p>
    <p className="text-xs font-bold text-slate-500 mt-1">{label}</p>
    {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
  </div>
);

// ============================================================
// MAIN
// ============================================================
const ClassStats = () => {
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [students, setStudents] = useState([]);
  const [scores, setScores] = useState({});
  const [attendance, setAttendance] = useState({});
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState('gpa'); // 'gpa' | 'att' | 'name'
  const [sortDir, setSortDir] = useState('desc');

  // Lấy danh sách lớp
  useEffect(() => {
    onValue(ref(db, 'classes'), (snap) => {
      const data = snap.val() || {};
      setClasses(Object.entries(data).map(([id, val]) => ({ id, ...val })).sort((a, b) => a.name.localeCompare(b.name)));
    });
  }, []);

  // Khi chọn lớp → load students, scores, attendance
  useEffect(() => {
    if (!selectedClass) return;
    setLoading(true);

    let loaded = { users: false, scores: false, att: false };
    const check = () => { if (Object.values(loaded).every(Boolean)) setLoading(false); };

    const unsubUsers = onValue(ref(db, 'users'), (snap) => {
      const data = snap.val() || {};
      const list = Object.entries(data)
        .map(([id, val]) => ({ id, ...val }))
        .filter(u => u.role === 'student' && Array.isArray(u.classIds) && u.classIds.includes(selectedClass));
      setStudents(list);
      loaded.users = true; check();
    });

    const unsubScores = onValue(ref(db, `scores/${selectedClass}`), (snap) => {
      setScores(snap.val() || {});
      loaded.scores = true; check();
    });

    const unsubAtt = onValue(ref(db, `attendance/${selectedClass}`), (snap) => {
      setAttendance(snap.val() || {});
      loaded.att = true; check();
    });

    return () => { unsubUsers(); unsubScores(); unsubAtt(); };
  }, [selectedClass]);

  // Tính chuyên cần từng học viên
  const getAttRate = (studentId) => {
    let present = 0, total = 0;
    Object.values(attendance).forEach(session => {
      const rec = session[studentId];
      if (!rec) return;
      total++;
      const s = typeof rec === 'object' ? rec.status : rec;
      if (s === 'present' || s === 'late') present++;
    });
    return total > 0 ? Math.round((present / total) * 100) : null;
  };

  // Build rows
  const rows = students.map(st => {
    const sData = scores[st.id] || {};
    const gpa   = calcGPA(sData);
    const att   = getAttRate(st.id);
    const bonus = Object.values(sData['bonus'] || {}).reduce((s, r) => s + (Number(r.score) || 0), 0);
    return { ...st, gpa, att, bonus };
  });

  // Sort
  const sorted = [...rows].sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'gpa')  cmp = a.gpa - b.gpa;
    if (sortBy === 'att')  cmp = (a.att ?? -1) - (b.att ?? -1);
    if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
    return sortDir === 'desc' ? -cmp : cmp;
  });

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  // Class-level stats
  const cls = classes.find(c => c.id === selectedClass);
  const avgGPA = rows.length ? (rows.reduce((s, r) => s + r.gpa, 0) / rows.length).toFixed(2) : '—';
  const avgAtt = rows.filter(r => r.att !== null).length
    ? Math.round(rows.filter(r => r.att !== null).reduce((s, r) => s + r.att, 0) / rows.filter(r => r.att !== null).length)
    : null;
  const lowAttCount = rows.filter(r => r.att !== null && r.att < 70).length;

  // Export CSV
  const handleExport = () => {
    if (!sorted.length) return;
    const header = ['Xếp hạng', 'Họ tên', 'Mã HV', 'Điểm Tổng Kết', 'Chuyên cần (%)', 'Bonus'];
    const rowsCSV = sorted.map((st, i) => [
      i + 1, st.name, st.studentCode || '',
      st.gpa.toFixed(2), st.att !== null ? `${st.att}%` : '—', st.bonus,
    ]);
    const csv = [header, ...rowsCSV].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `THONGKE_${cls?.name?.replace(/\s/g, '_') || selectedClass}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Color helpers
  const attColor = (rate) => {
    if (rate === null) return 'text-slate-300';
    if (rate >= 80) return 'text-emerald-600';
    if (rate >= 60) return 'text-amber-500';
    return 'text-red-500';
  };
  const gpaColor = (g) => {
    if (g >= 8) return 'text-emerald-600';
    if (g >= 6) return 'text-amber-500';
    if (g > 0)  return 'text-red-500';
    return 'text-slate-300';
  };

  const SortIcon = ({ col }) => (
    <span className="ml-1 opacity-60">
      {sortBy === col ? (sortDir === 'desc' ? '↓' : '↑') : '↕'}
    </span>
  );

  return (
    <div className="space-y-6 pb-20">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#E8F4EC] rounded-xl text-[#3D8B47]">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#2B6830]">Thống kê Lớp học</h2>
            <p className="text-xs text-slate-400 mt-0.5">Điểm số + chuyên cần tổng hợp theo lớp.</p>
          </div>
        </div>
        {selectedClass && sorted.length > 0 && (
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Xuất CSV
          </button>
        )}
      </div>

      {/* Selector lớp */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Chọn lớp cần xem thống kê</label>
        <select
          className="w-full md:w-80 border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10 bg-white transition"
          value={selectedClass}
          onChange={e => setSelectedClass(e.target.value)}
        >
          <option value="">-- Chọn lớp --</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.subject ? `(${c.subject})` : ''}</option>)}
        </select>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-slate-100 rounded-2xl animate-pulse" />)}
        </div>
      )}

      {!loading && selectedClass && (
        <>
          {/* Stat summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Học viên" value={rows.length} sub={cls?.name} color="bg-[#E8F4EC]" />
            <StatCard label="GPA Trung bình" value={avgGPA} sub="Assignment·Formative·MMT·EOMT" color="bg-[#E8F4EC]" />
            <StatCard
              label="Chuyên cần TB"
              value={avgAtt !== null ? `${avgAtt}%` : '—'}
              sub={lowAttCount > 0 ? `⚠️ ${lowAttCount} người dưới 70%` : 'Tất cả đạt'}
              color={lowAttCount > 0 ? 'bg-red-50' : 'bg-emerald-50'}
            />
            <StatCard label="Buổi đã điểm danh" value={Object.keys(attendance).length} sub="từ Firebase" color="bg-amber-50" />
          </div>

          {/* Bảng xếp hạng */}
          {rows.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-10 text-center">
              <p className="text-slate-400 text-sm">Lớp này chưa có học viên nào.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold text-[#2B6830] text-sm">Bảng xếp hạng ({sorted.length} học viên)</h3>
                <p className="text-xs text-slate-400">Bấm vào tiêu đề cột để sắp xếp</p>
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold border-b border-slate-100">
                    <tr>
                      <th className="p-4 w-12 text-center">Hạng</th>
                      <th className="p-4 cursor-pointer hover:text-[#2B6830] transition-colors" onClick={() => toggleSort('name')}>
                        Học viên <SortIcon col="name" />
                      </th>
                      <th className="p-4 text-center cursor-pointer hover:text-[#2B6830] transition-colors" onClick={() => toggleSort('gpa')}>
                        Điểm TK <SortIcon col="gpa" />
                      </th>
                      <th className="p-4 text-center cursor-pointer hover:text-[#2B6830] transition-colors" onClick={() => toggleSort('att')}>
                        Chuyên cần <SortIcon col="att" />
                      </th>
                      <th className="p-4 text-center">Bonus</th>
                      <th className="p-4 text-center">Chi tiết điểm</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {sorted.map((st, idx) => {
                      const sData = scores[st.id] || {};
                      const getAvg = (cat) => {
                        const vals = Object.values(sData[cat] || {}).map(r => Number(r.score) || 0);
                        return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : '—';
                      };
                      const rank = idx + 1;
                      const medalClass = rank === 1 ? 'text-amber-500' : rank === 2 ? 'text-slate-400' : rank === 3 ? 'text-amber-700' : 'text-slate-300';

                      return (
                        <tr key={st.id} className={`hover:bg-slate-50 transition-colors ${rank <= 3 ? 'bg-amber-50/20' : ''}`}>
                          <td className="p-4 text-center">
                            <span className={`text-lg font-extrabold ${medalClass}`}>
                              {rank <= 3 ? ['🥇','🥈','🥉'][rank-1] : rank}
                            </span>
                          </td>
                          <td className="p-4">
                            <p className="font-bold text-slate-800">{st.name}</p>
                            <p className="text-xs text-slate-400 font-mono">{st.studentCode}</p>
                          </td>
                          <td className="p-4 text-center">
                            <span className={`text-lg font-extrabold ${gpaColor(st.gpa)}`}>
                              {st.gpa > 0 ? st.gpa.toFixed(2) : '—'}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            {st.att !== null ? (
                              <div className="flex flex-col items-center gap-1">
                                <span className={`font-bold ${attColor(st.att)}`}>{st.att}%</span>
                                <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${st.att >= 80 ? 'bg-emerald-500' : st.att >= 60 ? 'bg-amber-400' : 'bg-red-500'}`} style={{ width: `${st.att}%` }} />
                                </div>
                              </div>
                            ) : <span className="text-slate-300 text-xs">—</span>}
                          </td>
                          <td className="p-4 text-center">
                            <span className="font-bold text-amber-600">{st.bonus || 0}</span>
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex justify-center gap-2 text-[10px] font-bold">
                              {[
                                { label: 'A', val: getAvg('assignment'), color: 'bg-green-50 text-green-700' },
                                { label: 'F', val: getAvg('formative'),  color: 'bg-[#E8F4EC] text-green-700' },
                                { label: 'S', val: getAvg('summative'),  color: 'bg-[#E8F4EC] text-green-700' },
                              ].map(d => (
                                <span key={d.label} className={`px-1.5 py-0.5 rounded ${d.color}`} title={d.label === 'A' ? 'Assignment' : d.label === 'F' ? 'Formative' : 'Summative'}>
                                  {d.label}: {d.val}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-slate-100">
                {sorted.map((st, idx) => {
                  const rank = idx + 1;
                  return (
                    <div key={st.id} className={`p-4 flex items-start gap-3 ${rank <= 3 ? 'bg-amber-50/30' : ''}`}>
                      <div className="text-2xl w-8 text-center shrink-0">
                        {rank <= 3 ? ['🥇','🥈','🥉'][rank-1] : <span className="text-base font-bold text-slate-400">{rank}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800 text-sm">{st.name}</p>
                        <p className="text-xs text-slate-400 font-mono mb-2">{st.studentCode}</p>
                        <div className="flex gap-3 text-xs">
                          <span className={`font-extrabold ${gpaColor(st.gpa)}`}>
                            GPA: {st.gpa > 0 ? st.gpa.toFixed(2) : '—'}
                          </span>
                          {st.att !== null && (
                            <span className={`font-bold ${attColor(st.att)}`}>Chuyên cần: {st.att}%</span>
                          )}
                          {st.bonus > 0 && (
                            <span className="text-amber-600 font-bold">+{st.bonus} bonus</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {!loading && !selectedClass && (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="#cbd5e1" className="w-16 h-16 mx-auto mb-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
          <p className="text-slate-500 font-medium">Chọn một lớp học ở trên để xem thống kê.</p>
          <p className="text-slate-400 text-xs mt-1">Dữ liệu bao gồm: điểm tổng kết, chuyên cần, xếp hạng toàn lớp.</p>
        </div>
      )}
    </div>
  );
};

export default ClassStats;
