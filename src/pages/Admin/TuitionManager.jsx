import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../firebase';
import { ref, onValue, update, remove, set, push } from 'firebase/database';
import * as XLSX from 'xlsx';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const parseExcelDate = (val) => {
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val);
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  if (typeof val === 'string') {
    const parts = val.trim().split('/');
    if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    return val.trim();
  }
  return '';
};

const fmtDate = (d) => {
  if (!d) return '—';
  try { return new Date(d + 'T00:00:00').toLocaleDateString('vi-VN'); } catch { return d; }
};

const STATUS_STYLE = {
  'Quá hạn':             'bg-red-100 text-red-700 border border-red-200',
  'Đã thanh toán':       'bg-green-100 text-green-700 border border-green-200',
  'Chờ duyệt gia hạn':   'bg-purple-50 text-purple-700 border border-purple-200',
  'Chờ':                 'bg-yellow-50 text-yellow-700 border border-yellow-200',
};

const statusStyle = (s) => STATUS_STYLE[s] || STATUS_STYLE['Chờ'];

const STATUS_OPTIONS = ['Chờ', 'Đã thanh toán', 'Chờ duyệt gia hạn', 'Quá hạn'];

// Auto-mark overdue: chỉ cập nhật "Chờ" đã qua deadline → "Quá hạn"
const autoUpdateOverdue = async (records) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const updates = {};
  records.forEach((r) => {
    if (r.status === 'Chờ' && r.paymentDeadline) {
      const d = new Date(r.paymentDeadline + 'T00:00:00');
      if (d < today) updates[`tuitionRecords/${r.id}/status`] = 'Quá hạn';
    }
  });
  if (Object.keys(updates).length) await update(ref(db), updates);
};

// ─── PDF Export ───────────────────────────────────────────────────────────────

const exportToPDF = (snapshotRecords, snapshotTitle) => {
  const now = new Date();
  const dateStr = now.toLocaleString('vi-VN');
  const rows = (snapshotRecords || [])
    .map((r, i) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${r.studentCode || ''}</td>
        <td>${r.name || ''}</td>
        <td>${r.className || ''}</td>
        <td style="text-align:center">${r.remainingSessions ?? ''}</td>
        <td style="text-align:center">${r.addedSessions ?? 0}</td>
        <td>${r.paymentDeadline ? new Date(r.paymentDeadline + 'T00:00:00').toLocaleDateString('vi-VN') : ''}</td>
        <td>${r.status || ''}</td>
      </tr>`)
    .join('');

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8"/>
  <title>${snapshotTitle || 'Thống kê Buổi học'} — ${dateStr}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,'Helvetica Neue',sans-serif;font-size:12px;color:#1a1a1a;padding:28px 32px}
    .header{margin-bottom:18px}
    .header h2{font-size:18px;color:#2B6830;font-weight:700;margin-bottom:4px}
    .header .meta{font-size:11px;color:#666}
    table{width:100%;border-collapse:collapse;margin-top:12px}
    th{background:#2B6830;color:#fff;font-size:11px;text-transform:uppercase;letter-spacing:.04em;padding:8px 10px;text-align:left}
    td{padding:8px 10px;border-bottom:1px solid #e2e8f0}
    tr:nth-child(even) td{background:#f8fafc}
    .footer{margin-top:24px;font-size:10px;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;padding-top:10px}
    @media print{body{padding:16px}}
  </style>
</head>
<body>
  <div class="header">
    <h2>BE ABLE VN — Thống kê Buổi học trả trước còn lại</h2>
    <p class="meta">Thời điểm chốt: <strong>${dateStr}</strong> &nbsp;·&nbsp; Tổng: <strong>${snapshotRecords?.length || 0} học viên</strong></p>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:36px;text-align:center">STT</th>
        <th>Mã HV</th>
        <th>Họ và tên</th>
        <th>Lớp</th>
        <th style="text-align:center">Buổi còn lại</th>
        <th style="text-align:center">Buổi cộng thêm</th>
        <th>Hạn thanh toán</th>
        <th>Tình trạng</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="footer">Xuất từ Hệ thống 2SOL / Be Able VN &nbsp;—&nbsp; ${now.toLocaleDateString('vi-VN')}</p>
  <script>window.onload = () => { window.print(); };<\/script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=1000,height=700');
  if (!win) { alert('Trình duyệt chặn popup. Vui lòng cho phép popup để xuất PDF.'); return; }
  win.document.open(); win.document.write(html); win.document.close();
};

// ─── EditModal ────────────────────────────────────────────────────────────────

const EditModal = ({ record, onSave, onClose }) => {
  const [form, setForm] = useState({
    name:              record.name || '',
    studentCode:       record.studentCode || '',
    className:         record.className || '',
    remainingSessions: record.remainingSessions ?? 0,
    addedSessions:     record.addedSessions ?? 0,
    paymentDeadline:   record.paymentDeadline || '',
    status:            record.status || 'Chờ',
  });

  const f = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleDeadlineChange = (e) => {
    const val = e.target.value;
    setForm((prev) => ({
      ...prev,
      paymentDeadline: val,
      // Nếu xóa deadline → tự gợi ý "Đã thanh toán"
      status: !val ? 'Đã thanh toán' : prev.status,
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg border border-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-[#2B6830] text-base">Chỉnh sửa học viên</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="stat-label">Họ và tên</label>
            <input className="w-full border border-slate-200 p-2.5 rounded-xl text-sm outline-none focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10" value={form.name} onChange={f('name')} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="stat-label">Mã HV</label>
              <input className="w-full border border-slate-200 p-2.5 rounded-xl text-sm outline-none focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10 font-mono" value={form.studentCode} onChange={f('studentCode')} />
            </div>
            <div className="space-y-1">
              <label className="stat-label">Lớp</label>
              <input className="w-full border border-slate-200 p-2.5 rounded-xl text-sm outline-none focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10" value={form.className} onChange={f('className')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="stat-label">Buổi còn lại</label>
              <input type="number" min="0" className="w-full border border-slate-200 p-2.5 rounded-xl text-sm outline-none focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10" value={form.remainingSessions} onChange={f('remainingSessions')} />
            </div>
            <div className="space-y-1">
              <label className="stat-label">Buổi cộng thêm</label>
              <input type="number" min="0" className="w-full border border-slate-200 p-2.5 rounded-xl text-sm outline-none focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10" value={form.addedSessions} onChange={f('addedSessions')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="stat-label">Hạn thanh toán</label>
              <input type="date" className="w-full border border-slate-200 p-2.5 rounded-xl text-sm outline-none focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10" value={form.paymentDeadline} onChange={handleDeadlineChange} />
              <p className="text-[10px] text-slate-400">Để trống → tự động "Đã thanh toán"</p>
            </div>
            <div className="space-y-1">
              <label className="stat-label">Tình trạng</label>
              <select className="w-full border border-slate-200 p-2.5 rounded-xl text-sm outline-none focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10 bg-white" value={form.status} onChange={f('status')}>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end mt-5">
          <button onClick={onClose} className="btn-secondary">Hủy</button>
          <button onClick={() => onSave(form)} className="btn-primary">Lưu thay đổi</button>
        </div>
      </div>
    </div>
  );
};

// ─── ConfirmModal ─────────────────────────────────────────────────────────────

const ConfirmModal = ({ title, message, onConfirm, onCancel }) => (
  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[80] p-4">
    <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4 border border-slate-100">
      <p className="text-base font-bold text-slate-800">{title}</p>
      {message && <p className="text-sm text-slate-500">{message}</p>}
      <div className="flex gap-3 justify-end">
        <button onClick={onCancel} className="btn-secondary">Hủy</button>
        <button onClick={onConfirm} className="btn-danger">Xóa</button>
      </div>
    </div>
  </div>
);

// ─── TuitionManager ───────────────────────────────────────────────────────────

const TuitionManager = () => {
  const [activeSubTab, setActiveSubTab] = useState('stats');

  // Stats state
  const [records, setRecords]             = useState([]);
  const [filterName, setFilterName]       = useState('');
  const [filterClass, setFilterClass]     = useState('');
  const [filterSessions, setFilterSessions] = useState('');
  const [editTarget, setEditTarget]       = useState(null);
  const [deleteTarget, setDeleteTarget]   = useState(null);
  const [successMsg, setSuccessMsg]       = useState('');
  const [sortKey, setSortKey]             = useState('');
  const [sortDir, setSortDir]             = useState('asc');
  const fileInputRef = useRef(null);

  // History state
  const [snapshots, setSnapshots]         = useState([]);
  const [filterMonth, setFilterMonth]     = useState('');

  // ── Firebase listeners ────────────────────────────────────────────────────
  useEffect(() => {
    const unsubRec = onValue(ref(db, 'tuitionRecords'), (snap) => {
      const data = snap.val() || {};
      const arr = Object.entries(data).map(([id, val]) => ({ id, ...val }));
      setRecords(arr);
      autoUpdateOverdue(arr);
    });
    const unsubSnap = onValue(ref(db, 'tuitionSnapshots'), (snap) => {
      const data = snap.val() || {};
      const arr = Object.entries(data)
        .map(([id, val]) => ({ id, ...val }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setSnapshots(arr);
    });
    return () => { unsubRec(); unsubSnap(); };
  }, []);

  const showSuccess = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 3500); };

  // ── Import Excel: XÓA TOÀN BỘ rồi ghi mới ───────────────────────────────
  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb   = XLSX.read(evt.target.result, { type: 'binary' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (rows.length < 2) return showSuccess('❌ File không có dữ liệu (cần ít nhất 1 hàng dữ liệu sau header).');

        // 1. Xóa toàn bộ dữ liệu cũ
        await set(ref(db, 'tuitionRecords'), null);

        // 2. Ghi dữ liệu mới
        // Cột: [0] Mã HV  [1] Họ và tên  [2] Lớp  [3] Buổi còn lại  [4] Buổi cộng thêm  [5] Hạn TT  [6] Tình trạng
        const updates = {};
        let count = 0;
        for (let i = 1; i < rows.length; i++) {
          const row  = rows[i];
          const code = String(row[0] || '').trim();
          const name = String(row[1] || '').trim();
          if (!code && !name) continue;
          const newKey = push(ref(db, 'tuitionRecords')).key;
          updates[`tuitionRecords/${newKey}`] = {
            studentCode:        code,
            name,
            className:          String(row[2] || '').trim(),
            remainingSessions:  Number(row[3]) || 0,
            addedSessions:      Number(row[4]) || 0,
            paymentDeadline:    parseExcelDate(row[5]),
            status:             String(row[6] || 'Chờ').trim() || 'Chờ',
            extensionRequested: false,
            extensionApproved:  false,
            importedAt:         new Date().toISOString(),
          };
          count++;
        }
        if (count > 0) await update(ref(db), updates);
        showSuccess(`✅ Import thành công ${count} học viên (đã thay thế toàn bộ danh sách cũ).`);
      } catch (err) {
        showSuccess('❌ Lỗi đọc file: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // ── Chốt: lưu snapshot + xuất PDF ngay ──────────────────────────────────
  const handleChot = async () => {
    if (records.length === 0) return showSuccess('⚠️ Không có dữ liệu để chốt.');
    try {
      const snapshotRef = push(ref(db, 'tuitionSnapshots'));
      await set(snapshotRef, {
        createdAt: new Date().toISOString(),
        count:     records.length,
        records:   records.map((r) => ({ ...r })),
      });
      exportToPDF(records, 'Thống kê Buổi học trả trước còn lại');
      showSuccess('✅ Đã chốt và xuất PDF!');
    } catch (err) {
      showSuccess('❌ Lỗi chốt: ' + err.message);
    }
  };

  // ── Lưu chỉnh sửa ────────────────────────────────────────────────────────
  const handleSaveEdit = async (form) => {
    if (!editTarget) return;
    const updates = {
      name:              form.name,
      studentCode:       form.studentCode,
      className:         form.className,
      remainingSessions: Number(form.remainingSessions),
      addedSessions:     Number(form.addedSessions),
      paymentDeadline:   form.paymentDeadline,
      status:            form.status,
      updatedAt:         new Date().toISOString(),
    };
    // Nếu admin đã xử lý gia hạn → clear flag extensionRequested
    if (editTarget.extensionRequested && form.status !== 'Chờ duyệt gia hạn') {
      updates.extensionRequested  = false;
      updates.extensionApproved   = true;
      updates.extensionApprovedAt = new Date().toISOString();
    }
    try {
      await update(ref(db, `tuitionRecords/${editTarget.id}`), updates);
      setEditTarget(null);
      showSuccess('✅ Đã cập nhật thông tin học viên.');
    } catch (err) {
      showSuccess('❌ Lỗi: ' + err.message);
    }
  };

  // ── Xóa record ───────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    try {
      await remove(ref(db, `tuitionRecords/${deleteTarget}`));
      setDeleteTarget(null);
      showSuccess('✅ Đã xóa học viên khỏi danh sách.');
    } catch (err) {
      showSuccess('❌ Lỗi: ' + err.message);
    }
  };

  // ── Sort handler ─────────────────────────────────────────────────────────
  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  // ── Display: sort + filter ────────────────────────────────────────────────
  const sortedRecords = [...records].sort((a, b) => {
    // "Chờ duyệt gia hạn" luôn lên đầu (priority cố định)
    const aPri = a.status === 'Chờ duyệt gia hạn' ? 0 : 1;
    const bPri = b.status === 'Chờ duyệt gia hạn' ? 0 : 1;
    if (aPri !== bPri) return aPri - bPri;
    // Nếu user chọn sort cột
    if (sortKey) {
      let aVal = a[sortKey] ?? '';
      let bVal = b[sortKey] ?? '';
      // Số
      if (sortKey === 'remainingSessions' || sortKey === 'addedSessions') {
        aVal = Number(aVal); bVal = Number(bVal);
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      // Ngày
      if (sortKey === 'paymentDeadline') {
        aVal = aVal || '9999'; bVal = bVal || '9999';
      }
      const cmp = String(aVal).localeCompare(String(bVal), 'vi');
      return sortDir === 'asc' ? cmp : -cmp;
    }
    return (a.name || '').localeCompare(b.name || '', 'vi');
  });

  const filteredRecords = sortedRecords.filter((r) => {
    if (filterName) {
      const term = filterName.toLowerCase();
      if (!r.name?.toLowerCase().includes(term) && !r.studentCode?.toLowerCase().includes(term)) return false;
    }
    if (filterClass && !r.className?.toLowerCase().includes(filterClass.toLowerCase())) return false;
    if (filterSessions && String(r.remainingSessions) !== filterSessions) return false;
    return true;
  });

  const distinctClasses = [...new Set(records.map((r) => r.className || '').filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'vi')
  );
  const sessionValues = [...new Set(records.map((r) => r.remainingSessions))].filter((v) => v !== undefined).sort((a, b) => a - b);
  const extensionCount = records.filter((r) => r.status === 'Chờ duyệt gia hạn').length;

  // ── Snapshot filter ───────────────────────────────────────────────────────
  const monthOptions = [...new Set(
    snapshots.map((s) => {
      const d = new Date(s.createdAt);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    })
  )].sort((a, b) => b.localeCompare(a));

  const filteredSnapshots = filterMonth
    ? snapshots.filter((s) => {
        const d = new Date(s.createdAt);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === filterMonth;
      })
    : snapshots;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-20">

      {/* Flash success */}
      {successMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[90] bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
          {successMsg}
        </div>
      )}

      {editTarget && <EditModal record={editTarget} onSave={handleSaveEdit} onClose={() => setEditTarget(null)} />}
      {deleteTarget && <ConfirmModal title="Xóa học viên này khỏi danh sách?" message="Hành động không thể hoàn tác." onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />}

      {/* Page header */}
      <div>
        <h1 className="page-title">Học phí</h1>
        <p className="page-sub">Thống kê buổi học trả trước và lịch sử chốt</p>
      </div>

      {/* Sub-tab nav */}
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {[
          { key: 'stats',   label: 'Thống kê Buổi học trả trước còn lại' },
          { key: 'history', label: 'Danh sách phiên bản' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveSubTab(tab.key)}
            className={`pb-3 px-4 text-sm font-bold transition-all whitespace-nowrap ${
              activeSubTab === tab.key
                ? 'text-[#2B6830] border-b-2 border-[#2B6830]'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {tab.label}
            {tab.key === 'stats' && extensionCount > 0 && (
              <span className="ml-1.5 bg-purple-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{extensionCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* ══ TAB: THỐNG KÊ ═══════════════════════════════════════════════════ */}
      {activeSubTab === 'stats' && (
        <div className="space-y-4">

          {/* Bộ lọc */}
          <div className="card-std p-5">
            <p className="stat-label mb-3">Bộ lọc</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                className="input-base"
                placeholder="Tìm tên hoặc mã học viên..."
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
              />
              <select
                className="input-base"
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
              >
                <option value="">Tất cả lớp</option>
                {distinctClasses.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select
                className="input-base"
                value={filterSessions}
                onChange={(e) => setFilterSessions(e.target.value)}
              >
                <option value="">Tất cả số buổi</option>
                {sessionValues.map((v) => <option key={v} value={v}>{v} buổi</option>)}
              </select>
            </div>
          </div>

          {/* Action bar */}
          <div className="flex gap-3 items-center flex-wrap">
            <input type="file" ref={fileInputRef} accept=".xlsx,.xls,.csv" onChange={handleImport} className="hidden" />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-primary"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/>
              </svg>
              Import Excel
            </button>
            <button
              onClick={handleChot}
              className="btn-danger"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              Chốt
            </button>
            {records.length > 0 && (
              <span className="text-xs text-slate-400 font-medium">
                Hiển thị {filteredRecords.length} / {records.length}
              </span>
            )}
            {extensionCount > 0 && (
              <span className="ml-auto text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-1.5 rounded-lg">
                {extensionCount} yêu cầu gia hạn chờ duyệt
              </span>
            )}
          </div>

          {/* Excel format hint */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700 leading-relaxed">
            <span className="font-bold">Định dạng Excel (hàng đầu = tiêu đề, bỏ qua):</span>
            <span className="mx-1">A=Mã HV · B=Họ và tên · C=Lớp · D=Buổi còn lại · E=Buổi cộng thêm · F=Hạn thanh toán (DD/MM/YYYY) · G=Tình trạng</span>
            <span className="font-bold text-red-600">— Import sẽ THAY THẾ toàn bộ danh sách hiện tại.</span>
          </div>

          {/* Bảng */}
          <div className="card-std overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table-std min-w-[900px]">
                <thead>
                  <tr>
                    {[
                      { key: 'studentCode',       label: 'Mã HV',           cls: '' },
                      { key: 'name',              label: 'Họ và tên',       cls: '' },
                      { key: 'className',         label: 'Lớp',             cls: '' },
                      { key: 'remainingSessions', label: 'Buổi còn lại',    cls: 'text-center' },
                      { key: 'addedSessions',     label: 'Buổi cộng thêm',  cls: 'text-center' },
                      { key: 'paymentDeadline',   label: 'Hạn thanh toán',  cls: '' },
                      { key: 'status',            label: 'Tình trạng',      cls: '' },
                    ].map(({ key, label, cls }) => (
                      <th key={key} className={cls}>
                        <button
                          onClick={() => handleSort(key)}
                          className="flex items-center gap-1 hover:text-white/80 transition-colors font-bold uppercase text-[11px] tracking-wide"
                        >
                          {label}
                          <span className="text-[10px] leading-none">
                            {sortKey === key ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                          </span>
                        </button>
                      </th>
                    ))}
                    <th className="text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="p-10 text-center text-slate-400 italic">
                        {records.length === 0
                          ? 'Chưa có dữ liệu. Nhấn "Import Excel" để nhập danh sách.'
                          : 'Không tìm thấy học viên phù hợp với bộ lọc.'}
                      </td>
                    </tr>
                  ) : filteredRecords.map((r) => (
                    <tr
                      key={r.id}
                      className={`hover:bg-slate-50 transition-colors ${r.status === 'Chờ duyệt gia hạn' ? 'bg-purple-50/50' : ''}`}
                    >
                      <td className="font-bold text-[#2B6830] font-mono text-xs">{r.studentCode || '—'}</td>
                      <td className="font-medium text-slate-800">{r.name || '—'}</td>
                      <td className="text-slate-600 text-xs">{r.className || '—'}</td>
                      <td className="text-center">
                        <span className="font-bold text-slate-700">{r.remainingSessions ?? '—'}</span>
                      </td>
                      <td className="text-center">
                        <span className="font-bold text-blue-600">{r.addedSessions ?? 0}</span>
                      </td>
                      <td className="text-slate-700 whitespace-nowrap">{fmtDate(r.paymentDeadline)}</td>
                      <td>
                        <span className={`text-xs font-bold px-2 py-1 rounded-lg whitespace-nowrap ${statusStyle(r.status)}`}>
                          {r.status || 'Chờ'}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => setEditTarget(r)}
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
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══ TAB: DANH SÁCH PHIÊN BẢN ════════════════════════════════════════ */}
      {activeSubTab === 'history' && (
        <div className="space-y-4">
          {/* Filter tháng/năm */}
          <div className="flex items-center gap-3 flex-wrap">
            <select
              className="p-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10 bg-white min-w-[180px]"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
            >
              <option value="">Tất cả tháng</option>
              {monthOptions.map((m) => {
                const [y, mo] = m.split('-');
                return <option key={m} value={m}>Tháng {parseInt(mo)}/{y}</option>;
              })}
            </select>
            {snapshots.length > 0 && (
              <span className="text-xs text-slate-400 font-medium">{filteredSnapshots.length} / {snapshots.length} phiên bản</span>
            )}
          </div>

          {/* Snapshot cards */}
          {filteredSnapshots.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-200 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="#cbd5e1" className="w-12 h-12 mx-auto mb-3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/>
              </svg>
              <p className="text-slate-400 font-medium text-sm">
                {snapshots.length === 0 ? 'Chưa có phiên bản nào.' : 'Không có phiên bản trong tháng đã chọn.'}
              </p>
              <p className="text-slate-300 text-xs mt-1">Nhấn "Chốt" ở tab Thống kê để tạo phiên bản mới.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSnapshots.map((snap) => (
                <div key={snap.id} className="card-std p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <p className="stat-label mb-1">Thời điểm chốt</p>
                      <p className="font-bold text-slate-800 text-sm md:text-base">
                        {new Date(snap.createdAt).toLocaleString('vi-VN', {
                          weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        <span className="font-bold text-[#2B6830]">{snap.count || snap.records?.length || 0}</span> học viên
                      </p>
                    </div>
                    <button
                      onClick={() => exportToPDF(snap.records, 'Thống kê Buổi học trả trước còn lại')}
                      className="btn-danger shrink-0"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/>
                      </svg>
                      Trích xuất PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TuitionManager;
