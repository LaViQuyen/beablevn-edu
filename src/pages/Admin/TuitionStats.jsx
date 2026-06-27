import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../firebase';
import { ref, onValue, update, remove, push, set, get } from 'firebase/database';
import * as XLSX from 'xlsx';

// ─── Helpers ────────────────────────────────────────────────────────────────

// Chuyển ngày Excel (serial hoặc string) sang YYYY-MM-DD
const parseExcelDate = (val) => {
  if (typeof val === 'number') {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(val);
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  if (typeof val === 'string') {
    // DD/MM/YYYY
    const parts = val.trim().split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    // YYYY-MM-DD đã đúng rồi
    return val.trim();
  }
  return '';
};

const fmtDate = (d) => {
  if (!d) return '—';
  try { return new Date(d + 'T00:00:00').toLocaleDateString('vi-VN'); } catch { return d; }
};

const statusStyle = (s) => {
  if (s === 'Quá hạn') return 'bg-red-100 text-red-700 border border-red-200';
  if (s === 'Đã đóng') return 'bg-green-100 text-green-700 border border-green-200';
  return 'bg-yellow-50 text-yellow-700 border border-yellow-200';
};

// Kiểm tra và cập nhật hàng loạt sang "Quá hạn" nếu qua deadline
const autoUpdateOverdue = async (records) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const updates = {};
  records.forEach((r) => {
    if (r.status === 'Chờ' && r.paymentDeadline) {
      const d = new Date(r.paymentDeadline + 'T00:00:00');
      if (d < today) updates[`tuitionRecords/${r.id}/status`] = 'Quá hạn';
    }
  });
  if (Object.keys(updates).length) await update(ref(db), updates);
};

// ─── Confirm Modal (tái dùng) ────────────────────────────────────────────────
const ConfirmModal = ({ title, message, onConfirm, onCancel }) => (
  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
    <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4 border border-slate-100">
      <p className="text-base font-bold text-slate-800">{title}</p>
      {message && <p className="text-sm text-slate-500">{message}</p>}
      <div className="flex gap-3 justify-end">
        <button onClick={onCancel} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Hủy</button>
        <button onClick={onConfirm} className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition-colors">Xóa</button>
      </div>
    </div>
  </div>
);

// ─── Main Component ──────────────────────────────────────────────────────────
const TuitionStats = () => {
  const [records, setRecords]         = useState([]);
  const [classes, setClasses]         = useState([]);
  const [filterName, setFilterName]   = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterSessions, setFilterSessions] = useState('');
  const [editingDeadline, setEditingDeadline] = useState(null); // { id, value }
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [successMsg, setSuccessMsg]   = useState('');
  const fileInputRef = useRef(null);

  // ─── Firebase listeners ───────────────────────────────────────────────────
  useEffect(() => {
    const unsubRec = onValue(ref(db, 'tuitionRecords'), (snap) => {
      const data = snap.val() || {};
      const arr = Object.entries(data).map(([id, val]) => ({ id, ...val }));
      setRecords(arr);
      autoUpdateOverdue(arr);
    });
    const unsubCls = onValue(ref(db, 'classes'), (snap) => {
      const data = snap.val() || {};
      setClasses(
        Object.entries(data)
          .map(([id, val]) => ({ id, ...val }))
          .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'))
      );
    });
    return () => { unsubRec(); unsubCls(); };
  }, []);

  const showSuccess = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 3500); };

  // ─── Import Excel ─────────────────────────────────────────────────────────
  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        // raw: false để XLSX tự format số/ngày; header: 1 để lấy mảng thô
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (rows.length < 2) return showSuccess('❌ File không có dữ liệu (cần ít nhất 1 hàng dữ liệu sau header).');

        // Cột thứ tự: [0] Mã HV, [1] Họ và tên, [2] Số buổi còn lại, [3] Số buổi cộng thêm, [4] Hạn thanh toán, [5] Tình trạng
        const updates = {};
        let count = 0;
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const code = String(row[0] || '').trim();
          const name = String(row[1] || '').trim();
          if (!code && !name) continue; // bỏ qua hàng trống
          const newKey = push(ref(db, 'tuitionRecords')).key;
          updates[`tuitionRecords/${newKey}`] = {
            studentCode:       code,
            name:              name,
            remainingSessions: Number(row[2]) || 0,
            addedSessions:     Number(row[3]) || 0,
            paymentDeadline:   parseExcelDate(row[4]),
            status:            String(row[5] || 'Chờ').trim() || 'Chờ',
            extensionRequested: false,
            importedAt:        new Date().toISOString(),
          };
          count++;
        }
        await update(ref(db), updates);
        showSuccess(`✅ Import thành công ${count} học viên.`);
      } catch (err) {
        showSuccess('❌ Lỗi đọc file: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = ''; // reset để import lại file cùng tên
  };

  // ─── Chốt: tạo snapshot ───────────────────────────────────────────────────
  const handleChot = async () => {
    if (records.length === 0) return showSuccess('⚠️ Không có dữ liệu để chốt.');
    try {
      const snapshotRef = push(ref(db, 'tuitionSnapshots'));
      await set(snapshotRef, {
        createdAt: new Date().toISOString(),
        count:     records.length,
        records:   records.map((r) => ({ ...r })),
      });
      showSuccess('✅ Đã chốt danh sách! Thẻ lịch sử đã được lưu.');
    } catch (err) {
      showSuccess('❌ Lỗi chốt: ' + err.message);
    }
  };

  // ─── Sửa Hạn thanh toán ───────────────────────────────────────────────────
  const handleSaveDeadline = async (id) => {
    if (!editingDeadline) return;
    const record = records.find((r) => r.id === id);
    const extra = {};
    // Nếu học viên đang xin gia hạn → tự động duyệt khi admin cập nhật deadline
    if (record?.extensionRequested) {
      extra.extensionRequested  = false;
      extra.extensionApproved   = true;
      extra.extensionApprovedAt = new Date().toISOString();
    }
    try {
      await update(ref(db, `tuitionRecords/${id}`), {
        paymentDeadline: editingDeadline.value,
        // Nếu đang Quá hạn và admin set deadline mới → reset về Chờ
        ...(record?.status === 'Quá hạn' ? { status: 'Chờ' } : {}),
        ...extra,
      });
      setEditingDeadline(null);
      showSuccess('✅ Đã cập nhật hạn thanh toán.');
    } catch (err) {
      showSuccess('❌ Lỗi: ' + err.message);
    }
  };

  // ─── Xóa record ───────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    try {
      await remove(ref(db, `tuitionRecords/${deleteTarget}`));
      setDeleteTarget(null);
      showSuccess('✅ Đã xóa học viên khỏi danh sách.');
    } catch (err) {
      showSuccess('❌ Lỗi: ' + err.message);
    }
  };

  // ─── Filter ───────────────────────────────────────────────────────────────
  const filteredRecords = records.filter((r) => {
    if (filterName) {
      const term = filterName.toLowerCase();
      if (
        !r.name?.toLowerCase().includes(term) &&
        !r.studentCode?.toLowerCase().includes(term)
      ) return false;
    }
    if (filterClass && r.classId !== filterClass) return false;
    if (filterSessions && String(r.remainingSessions) !== filterSessions) return false;
    return true;
  });

  const sessionValues = [...new Set(records.map((r) => r.remainingSessions))].sort((a, b) => a - b);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* Flash success */}
      {successMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
          {successMsg}
        </div>
      )}

      {/* Confirm delete */}
      {deleteTarget && (
        <ConfirmModal
          title="Xóa học viên này khỏi danh sách?"
          message="Hành động không thể hoàn tác."
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* ─── Bộ lọc ────────────────────────────────── */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Bộ lọc</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            className="p-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10"
            placeholder="Tìm tên hoặc mã học viên..."
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
          />
          <select
            className="p-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10 bg-white"
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
          >
            <option value="">Tất cả lớp</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select
            className="p-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10 bg-white"
            value={filterSessions}
            onChange={(e) => setFilterSessions(e.target.value)}
          >
            <option value="">Tất cả số buổi</option>
            {sessionValues.map((v) => <option key={v} value={v}>{v} buổi</option>)}
          </select>
        </div>
      </div>

      {/* ─── Nút Import + Chốt ─────────────────────── */}
      <div className="flex gap-3 items-center flex-wrap">
        <input
          type="file"
          ref={fileInputRef}
          accept=".xlsx,.xls,.csv"
          onChange={handleImport}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#2B6830] text-white rounded-xl text-sm font-bold hover:bg-[#1E5225] shadow-sm transition-all active:scale-95"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          Import Excel
        </button>
        <button
          onClick={handleChot}
          className="flex items-center gap-2 px-5 py-2.5 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-600 shadow-sm transition-all active:scale-95"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Chốt
        </button>
        {records.length > 0 && (
          <span className="text-xs text-slate-400 font-medium">
            Hiển thị {filteredRecords.length} / {records.length} học viên
          </span>
        )}
      </div>

      {/* ─── Bảng danh sách ────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 text-xs uppercase font-bold">
              <tr>
                <th className="p-4 w-10 text-center">STT</th>
                <th className="p-4">Mã HV</th>
                <th className="p-4">Họ và tên</th>
                <th className="p-4 text-center">Buổi còn lại</th>
                <th className="p-4 text-center">Buổi cộng thêm</th>
                <th className="p-4">Hạn thanh toán</th>
                <th className="p-4">Tình trạng</th>
                <th className="p-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-10 text-center text-slate-400 italic">
                    {records.length === 0
                      ? 'Chưa có dữ liệu. Nhấn "Import Excel" để nhập danh sách.'
                      : 'Không tìm thấy học viên phù hợp với bộ lọc.'}
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r, idx) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 text-center text-slate-400 font-bold text-xs">{idx + 1}</td>
                    <td className="p-4 font-bold text-[#2B6830] font-mono text-xs">{r.studentCode || '—'}</td>
                    <td className="p-4 font-medium text-slate-800">
                      {r.name || '—'}
                      {r.extensionRequested && !r.extensionApproved && (
                        <span className="ml-1.5 text-[10px] font-bold bg-purple-50 text-purple-600 border border-purple-200 px-1.5 py-0.5 rounded">Xin gia hạn</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <span className="font-bold text-slate-700">{r.remainingSessions ?? '—'}</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="font-bold text-blue-600">{r.addedSessions ?? 0}</span>
                    </td>
                    <td className="p-4">
                      {editingDeadline?.id === r.id ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <input
                            type="date"
                            className="p-2 border border-[#2B6830] rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#2B6830]/10"
                            value={editingDeadline.value}
                            onChange={(e) => setEditingDeadline({ id: r.id, value: e.target.value })}
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveDeadline(r.id)}
                            className="text-[#2B6830] font-bold text-xs px-2.5 py-1 bg-[#E8F4EC] rounded-lg border border-green-200 hover:bg-green-200 transition"
                          >
                            Lưu
                          </button>
                          <button
                            onClick={() => setEditingDeadline(null)}
                            className="text-slate-400 text-xs px-2.5 py-1 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
                          >
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-700">{fmtDate(r.paymentDeadline)}</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={`text-xs font-bold px-2 py-1 rounded-lg ${statusStyle(r.status)}`}>
                        {r.status || 'Chờ'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setEditingDeadline({ id: r.id, value: r.paymentDeadline || '' })}
                          className="text-[#2B6830] border border-[#2B6830] px-2 py-1 rounded text-xs font-bold hover:bg-[#2B6830] hover:text-white transition-all"
                        >
                          Sửa
                        </button>
                        <button
                          onClick={() => setDeleteTarget(r.id)}
                          className="text-red-500 border border-red-200 px-2 py-1 rounded text-xs font-bold hover:bg-red-500 hover:text-white transition-all"
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TuitionStats;
