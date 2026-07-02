import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../firebase';
import { ref, push, set, onValue } from 'firebase/database';
import bcrypt from 'bcryptjs';

// Hướng dẫn format CSV
const CSV_TEMPLATE = `Họ tên,Mã học viên,Mật khẩu,Lớp 1,Lớp 2,Lớp 3
Nguyễn Văn An,HV001,BAVNbavn,Kids 1,,
Trần Thị Bình,HV002,BAVNbavn,Kids 1,IELTS A,
Lê Minh Châu,HV003,BAVNbavn,IELTS A,,`;

const BulkImport = () => {
  const [classes, setClasses] = useState([]);
  const [rawText, setRawText] = useState('');
  const [preview, setPreview] = useState([]); // rows đã parse
  const [errors, setErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null); // { success, failed }
  const fileRef = useRef(null);

  useEffect(() => {
    onValue(ref(db, 'classes'), (snap) => {
      const data = snap.val() || {};
      setClasses(Object.entries(data).map(([id, val]) => ({ id, ...val })));
    });
  }, []);

  // Parse CSV text → rows
  const parseCSV = (text) => {
    const lines = text.trim().split('\n').filter(l => l.trim());
    if (lines.length < 2) return { rows: [], errors: ['File không có dữ liệu (cần ít nhất 1 dòng sau header).'] };

    const errs = [];
    const rows = [];

    lines.slice(1).forEach((line, idx) => {
      const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      const [name, code, password, cls1, cls2, cls3] = cols;

      if (!name || !code) {
        errs.push(`Dòng ${idx + 2}: Thiếu họ tên hoặc mã học viên.`);
        return;
      }

      // Map tên lớp → classId
      const classIds = [cls1, cls2, cls3]
        .filter(Boolean)
        .map(cName => {
          const found = classes.find(c => c.name.toLowerCase() === cName.toLowerCase());
          if (!found) errs.push(`Dòng ${idx + 2}: Không tìm thấy lớp "${cName}".`);
          return found?.id;
        })
        .filter(Boolean);

      rows.push({
        name: name.trim(),
        studentCode: code.trim(),
        password: password?.trim() || 'BAVNbavn',
        classIds,
        classNames: [cls1, cls2, cls3].filter(Boolean),
      });
    });

    return { rows, errors: errs };
  };

  const handleTextChange = (text) => {
    setRawText(text);
    setResults(null);
    if (!text.trim()) { setPreview([]); setErrors([]); return; }
    const { rows, errors: errs } = parseCSV(text);
    setPreview(rows);
    setErrors(errs);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => handleTextChange(ev.target.result);
    reader.readAsText(file, 'UTF-8');
  };

  const downloadTemplate = () => {
    const blob = new Blob(['﻿' + CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'mau_import_hocvien.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!preview.length) return;
    setImporting(true);
    let success = 0, failed = 0;

    for (const row of preview) {
      try {
        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync(row.password, salt);
        const newRef = push(ref(db, 'users'));
        await set(newRef, {
          name: row.name,
          studentCode: row.studentCode,
          loginId: row.studentCode,
          username: row.studentCode,
          email: `${row.studentCode}@beable.vn`,
          password: hashedPassword,
          role: 'student',
          classIds: row.classIds,
          createdAt: new Date().toISOString(),
        });
        success++;
      } catch (err) {
        console.error(`Lỗi import ${row.name}:`, err);
        failed++;
      }
    }

    setResults({ success, failed });
    setImporting(false);
    if (success > 0) {
      setRawText('');
      setPreview([]);
      setErrors([]);
    }
  };

  return (
    <div className="space-y-6 pb-20">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          </div>
          <div>
            <h2 className="page-title">Import học viên từ CSV</h2>
            <p className="page-sub">Tạo nhiều tài khoản học viên cùng lúc.</p>
          </div>
        </div>
        <button
          onClick={downloadTemplate}
          className="btn-secondary"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Tải file mẫu
        </button>
      </div>

      {/* Kết quả import */}
      {results && (
        <div className={`rounded-2xl border p-4 flex items-start gap-3 ${results.failed > 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke={results.failed > 0 ? '#d97706' : '#059669'} className="w-5 h-5 shrink-0 mt-0.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          <div>
            <p className="font-bold text-sm text-slate-800">
              ✅ {results.success} học viên được tạo thành công
              {results.failed > 0 && ` · ❌ ${results.failed} thất bại`}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Vào tab "Học viên" để kiểm tra danh sách.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Nhập CSV */}
        <div className="space-y-4">
          <div className="card-std p-5">
            <h3 className="font-bold text-[#2B6830] mb-3">1. Nhập dữ liệu</h3>

            {/* Upload file */}
            <div
              className="border-2 border-dashed border-slate-200 rounded-xl p-5 text-center cursor-pointer hover:border-[#2B6830] hover:bg-[#E8F4EC]/30 transition-all mb-3"
              onClick={() => fileRef.current?.click()}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="#94a3b8" className="w-10 h-10 mx-auto mb-2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <p className="text-sm text-slate-500 font-medium">Kéo thả hoặc bấm để chọn file CSV</p>
              <p className="text-xs text-slate-400 mt-1">Hỗ trợ .csv, .txt — Encoding UTF-8</p>
              <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
            </div>

            <p className="text-xs text-slate-400 text-center mb-3">— hoặc dán trực tiếp —</p>

            {/* Textarea paste */}
            <textarea
              className="w-full border border-slate-200 p-3 rounded-xl text-xs font-mono outline-none focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10 resize-none transition"
              rows={8}
              placeholder={`Họ tên,Mã học viên,Mật khẩu,Lớp 1,Lớp 2,Lớp 3\nNguyễn Văn An,HV001,BAVNbavn,Kids 1,,\n...`}
              value={rawText}
              onChange={e => handleTextChange(e.target.value)}
            />

            {/* Lỗi parse */}
            {errors.length > 0 && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3 space-y-1">
                <p className="text-xs font-bold text-red-700 mb-1">⚠️ Cảnh báo ({errors.length})</p>
                {errors.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
              </div>
            )}
          </div>

          {/* Hướng dẫn */}
          <div className="bg-[#E8F4EC] border border-green-100 rounded-2xl p-4 text-xs text-green-700 space-y-1.5">
            <p className="font-bold text-green-800 mb-2">📋 Quy tắc format CSV:</p>
            <p>• <strong>Cột bắt buộc:</strong> Họ tên, Mã học viên</p>
            <p>• <strong>Mật khẩu</strong> mặc định <code className="bg-green-100 px-1 rounded">BAVNbavn</code> nếu để trống</p>
            <p>• <strong>Tên lớp</strong> phải khớp chính xác với lớp trong hệ thống</p>
            <p>• Dòng đầu tiên là header, bỏ qua khi import</p>
            <p>• Tối đa 3 lớp mỗi học viên</p>
          </div>
        </div>

        {/* Preview */}
        <div className="card-std p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-[#2B6830]">2. Xem trước ({preview.length} học viên)</h3>
            {preview.length > 0 && (
              <button
                onClick={handleImport}
                disabled={importing}
                className="btn-primary disabled:opacity-50"
              >
                {importing ? (
                  <><svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Đang import...</>
                ) : `🚀 Import ${preview.length} học viên`}
              </button>
            )}
          </div>

          {preview.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="#cbd5e1" className="w-12 h-12 mx-auto mb-3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-1.5 0H3.375" />
              </svg>
              <p className="text-sm">Nhập CSV để xem trước danh sách học viên.</p>
            </div>
          ) : (
            <>
            <div className="hidden md:block overflow-auto max-h-96 rounded-xl border border-slate-100">
              <table className="table-std">
                <thead className="sticky top-0">
                  <tr>
                    <th>#</th>
                    <th>Họ tên</th>
                    <th>Mã HV</th>
                    <th>Mật khẩu</th>
                    <th>Lớp</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i}>
                      <td className="text-slate-400">{i + 1}</td>
                      <td className="font-bold">{row.name}</td>
                      <td className="font-mono text-[#2B6830]">{row.studentCode}</td>
                      <td className="font-mono text-slate-500">{row.password}</td>
                      <td>
                        {row.classNames.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {row.classNames.map((cn, j) => (
                              <span key={j} className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                row.classIds.length > j
                                  ? 'bg-green-50 text-green-700 border-green-200'
                                  : 'bg-red-50 text-red-600 border-red-200'
                              }`}>
                                {cn} {row.classIds.length <= j && '⚠️'}
                              </span>
                            ))}
                          </div>
                        ) : <span className="text-slate-300 italic">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* MOBILE CARDS */}
            <div className="md:hidden space-y-2 max-h-96 overflow-auto">
              {preview.map((row, i) => (
                <div key={i} className="p-3 border border-slate-200 rounded-xl bg-white">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h4 className="font-bold text-slate-700 text-sm">{i + 1}. {row.name}</h4>
                      <p className="text-xs font-mono text-[#2B6830] mt-0.5">{row.studentCode}</p>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">{row.password}</span>
                  </div>
                  <div className="mt-2">
                    {row.classNames.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {row.classNames.map((cn, j) => (
                          <span key={j} className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${row.classIds.length > j ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                            {cn} {row.classIds.length <= j && '⚠️'}
                          </span>
                        ))}
                      </div>
                    ) : <span className="text-slate-300 italic text-xs">— Chưa có lớp</span>}
                  </div>
                </div>
              ))}
            </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkImport;
