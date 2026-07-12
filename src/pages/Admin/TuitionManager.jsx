import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../firebase';
import { ref, onValue, update, remove, set, push } from 'firebase/database';
import * as XLSX from 'xlsx';
import { getDaysLeft } from '../../utils/tuition';

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
  if (!d) return '–';
  try { return new Date(d + 'T00:00:00').toLocaleDateString('vi-VN'); } catch { return d; }
};

const fmtDateTime = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
};

const STATUS_STYLE = {
  'Quá hạn':             'bg-red-100 text-red-700 border border-red-200',
  'Đã thanh toán':       'bg-green-100 text-green-700 border border-green-200',
  'Chờ duyệt gia hạn':   'bg-purple-50 text-purple-700 border border-purple-200',
  'Chờ':                 'bg-yellow-50 text-yellow-700 border border-yellow-200',
};

const statusStyle = (s) => STATUS_STYLE[s] || STATUS_STYLE['Chờ'];

const STATUS_OPTIONS = ['Chờ', 'Đã thanh toán', 'Chờ duyệt gia hạn', 'Quá hạn'];

// Auto-mark overdue: "Chờ" đã qua deadline → "Quá hạn".
// "Chờ duyệt gia hạn" được ân hạn đúng 7 ngày như popup cam kết với học viên;
// lố quá deadline + 7 ngày mà admin chưa xử lý thì hệ thống tự chuyển "Quá hạn".
const autoUpdateOverdue = async (records) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const updates = {};
  records.forEach((r) => {
    if (!r.paymentDeadline) return;
    const d = new Date(r.paymentDeadline + 'T00:00:00');
    if (isNaN(d.getTime())) return;
    if (r.status === 'Chờ' && d < today) {
      updates[`tuitionRecords/${r.dbCode}/${r.id}/status`] = 'Quá hạn';
    }
    if (r.status === 'Chờ duyệt gia hạn') {
      const grace = new Date(d); grace.setDate(grace.getDate() + 7);
      if (grace < today) updates[`tuitionRecords/${r.dbCode}/${r.id}/status`] = 'Quá hạn';
    }
  });
  if (Object.keys(updates).length) await update(ref(db), updates);
};

// Chuyển 1 hàng Excel thành record học phí. Trả về null nếu hàng trống.
// Cột: [0] Mã HV  [1] Họ và tên  [2] Lớp  [3] Buổi còn lại  [4] Buổi cộng thêm  [5] Hạn TT  [6] Tình trạng
const rowToRecord = (row) => {
  const code = String(row[0] || '').trim().toUpperCase();
  const name = String(row[1] || '').trim();
  if (!code) return null; // Mã HV bắt buộc: là key nhánh + điều kiện rules + khớp banner học viên
  const rawStatus = String(row[6] || '').trim();
  return {
    studentCode:       code,
    name,
    className:         String(row[2] || '').trim(),
    remainingSessions: Number(row[3]) || 0,
    addedSessions:     Number(row[4]) || 0,
    paymentDeadline:   parseExcelDate(row[5]),
    status:            STATUS_OPTIONS.includes(rawStatus) ? rawStatus : 'Chờ',
  };
};

// Khóa so trùng khi nhập bổ sung: Mã HV + Lớp
const mergeKey = (r) =>
  `${String(r.studentCode || '').trim().toUpperCase()}||${String(r.className || '').trim().toUpperCase()}`;

// Key Firebase không được chứa . # $ / [ ]
const toKeySafe = (s) => s.replace(/[.#$/\[\]]/g, '-');

// Mã canonical làm KEY nhánh tuitionRecords/{mã}: ưu tiên đúng chuỗi đang lưu trong
// node users (rules so sánh CHÍNH XÁC với users/{uid}/studentCode), không tìm thấy
// thì dùng bản UPPERCASE. codeMap: UPPER(mã users) -> mã users nguyên bản.
const canonicalCode = (raw, codeMap) => {
  const up = String(raw || '').trim().toUpperCase();
  if (!up) return '';
  return toKeySafe(codeMap[up] || up);
};

// Escape HTML khi chèn dữ liệu record vào cửa sổ in (chống HTML injection từ file Excel)
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ─── PDF Export ───────────────────────────────────────────────────────────────
// Trả về false nếu trình duyệt chặn popup (caller tự hiện toast, không dùng alert)

const exportToPDF = (snapshotRecords, snapshotTitle, snapshotAt) => {
  const now = snapshotAt ? new Date(snapshotAt) : new Date();
  const dateStr = now.toLocaleString('vi-VN');
  const rows = (snapshotRecords || [])
    .map((r, i) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${esc(r.studentCode)}</td>
        <td>${esc(r.name)}</td>
        <td>${esc(r.className)}</td>
        <td style="text-align:center">${esc(r.remainingSessions ?? '')}</td>
        <td style="text-align:center">${esc(r.addedSessions ?? 0)}</td>
        <td>${r.paymentDeadline ? new Date(r.paymentDeadline + 'T00:00:00').toLocaleDateString('vi-VN') : ''}</td>
        <td>${esc(r.status)}</td>
      </tr>`)
    .join('');

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8"/>
  <title>${snapshotTitle || 'Thống kê Buổi học'}, ${dateStr}</title>
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
    <h2>BE ABLE VN, Thống kê Buổi học trả trước còn lại</h2>
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
  <p class="footer">Xuất từ Hệ thống 2SOL / Be Able VN &nbsp;·&nbsp; ${new Date().toLocaleDateString('vi-VN')}</p>
  <script>window.onload = () => { window.print(); };<\/script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=1000,height=700');
  if (!win) return false;
  win.document.open(); win.document.write(html); win.document.close();
  return true;
};

// ─── EditModal (dùng cho cả Chỉnh sửa và Thêm học viên mới) ──────────────────

const EditModal = ({ record, onSave, onClose }) => {
  const isNew = !record.id;
  const [form, setForm] = useState({
    name:              record.name || '',
    studentCode:       record.studentCode || '',
    className:         record.className || '',
    remainingSessions: record.remainingSessions ?? 0,
    addedSessions:     record.addedSessions ?? 0,
    paymentDeadline:   record.paymentDeadline || '',
    status:            record.status || 'Chờ',
  });
  const [err, setErr] = useState('');

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

  // Dời hạn thêm 7 ngày (đúng cam kết trong popup Gia hạn phía học viên),
  // trạng thái quay về "Chờ" để banner học viên trở lại màu vàng Cấp 1.
  const addSevenDays = () => {
    setForm((prev) => {
      // Mốc +7 tính từ max(hôm nay, hạn cũ): admin duyệt trễ thì hạn mới không rơi vào quá khứ
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const oldDl = prev.paymentDeadline ? new Date(prev.paymentDeadline + 'T00:00:00') : today;
      const base = oldDl > today ? oldDl : today;
      base.setDate(base.getDate() + 7);
      const iso = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`;
      return { ...prev, paymentDeadline: iso, status: 'Chờ' };
    });
  };

  const handleSave = () => {
    if (!form.name.trim()) return setErr('Vui lòng nhập Họ và tên.');
    if (!form.studentCode.trim()) return setErr('Vui lòng nhập Mã HV (bắt buộc để khớp tài khoản học viên).');
    if (!form.className.trim()) return setErr('Vui lòng nhập Lớp.');
    setErr('');
    onSave(form);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg border border-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-primary text-base">{isNew ? 'Thêm học viên' : 'Chỉnh sửa học viên'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Học viên đã bấm Gia hạn → gợi ý admin dời hạn +7 ngày */}
        {record.extensionRequested && (
          <div className="mb-4 bg-purple-50 border border-purple-200 rounded-xl p-3 text-xs text-purple-700 leading-relaxed">
            <span className="font-bold">Học viên đã yêu cầu gia hạn</span>
            {record.extensionRequestedAt ? ` lúc ${fmtDateTime(record.extensionRequestedAt)}` : ''}. Bấm nút
            <span className="font-bold"> +7 ngày</span> để dời hạn theo cam kết, trạng thái sẽ trở về "Chờ" và banner
            của học viên tự chuyển về màu vàng.
          </div>
        )}

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="stat-label">Họ và tên</label>
            <input className="w-full border border-slate-200 p-2.5 rounded-xl text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" value={form.name} onChange={f('name')} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="stat-label">Mã HV</label>
              <input className="w-full border border-slate-200 p-2.5 rounded-xl text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 font-mono" value={form.studentCode} onChange={f('studentCode')} />
            </div>
            <div className="space-y-1">
              <label className="stat-label">Lớp</label>
              <input className="w-full border border-slate-200 p-2.5 rounded-xl text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" value={form.className} onChange={f('className')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="stat-label">Buổi còn lại</label>
              <input type="number" min="0" className="w-full border border-slate-200 p-2.5 rounded-xl text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" value={form.remainingSessions} onChange={f('remainingSessions')} />
            </div>
            <div className="space-y-1">
              <label className="stat-label">Buổi cộng thêm</label>
              <input type="number" min="0" className="w-full border border-slate-200 p-2.5 rounded-xl text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" value={form.addedSessions} onChange={f('addedSessions')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="stat-label">Hạn thanh toán</label>
                <button
                  type="button"
                  onClick={addSevenDays}
                  title="Dời hạn thanh toán thêm 7 ngày, trạng thái về Chờ"
                  className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded hover:bg-purple-100 transition-colors"
                >
                  +7 ngày
                </button>
              </div>
              <input type="date" className="w-full border border-slate-200 p-2.5 rounded-xl text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" value={form.paymentDeadline} onChange={handleDeadlineChange} />
              <p className="text-[10px] text-slate-400">Để trống → tự động "Đã thanh toán"</p>
            </div>
            <div className="space-y-1">
              <label className="stat-label">Tình trạng</label>
              <select className="w-full border border-slate-200 p-2.5 rounded-xl text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 bg-white" value={form.status} onChange={f('status')}>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>

        {err && <p className="text-xs text-red-500 font-medium mt-3">{err}</p>}

        <div className="flex gap-3 justify-end mt-5">
          <button onClick={onClose} className="btn-secondary">Hủy</button>
          <button onClick={handleSave} className="btn-primary">{isNew ? 'Thêm học viên' : 'Lưu thay đổi'}</button>
        </div>
      </div>
    </div>
  );
};

// ─── ConfirmModal ─────────────────────────────────────────────────────────────

const ConfirmModal = ({ title, message, onConfirm, onCancel, confirmLabel = 'Xóa' }) => (
  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[80] p-4">
    <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4 border border-slate-100">
      <p className="text-base font-bold text-slate-800">{title}</p>
      {message && <p className="text-sm text-slate-500">{message}</p>}
      <div className="flex gap-3 justify-end">
        <button onClick={onCancel} className="btn-secondary">Hủy</button>
        <button onClick={onConfirm} className="btn-danger">{confirmLabel}</button>
      </div>
    </div>
  </div>
);

// ─── ImportChoiceModal: chọn Nhập bổ sung (import lẻ) hoặc Thay thế toàn bộ ──

const ImportChoiceModal = ({ count, currentCount, onAppend, onReplace, onCancel }) => (
  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[80] p-4">
    <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full space-y-4 border border-slate-100">
      <p className="text-base font-bold text-slate-800">Đã đọc {count} dòng dữ liệu từ file</p>
      <div className="space-y-2 text-sm text-slate-600 leading-relaxed">
        <p>
          <span className="font-bold text-primary">Nhập bổ sung (import lẻ):</span> dòng trùng
          <span className="font-bold"> Mã HV + Lớp</span> sẽ được cập nhật đè, dòng mới được thêm vào.
          Danh sách hiện tại giữ nguyên.
        </p>
        <p>
          <span className="font-bold text-red-600">Thay thế toàn bộ:</span> XOÁ {currentCount} học viên hiện tại
          và ghi lại từ đầu bằng dữ liệu file. Không thể hoàn tác.
        </p>
      </div>
      <div className="flex gap-2 justify-end flex-wrap">
        <button onClick={onCancel} className="btn-secondary">Hủy</button>
        <button onClick={onAppend} className="btn-primary">Nhập bổ sung</button>
        <button onClick={onReplace} className="btn-danger">Thay thế toàn bộ</button>
      </div>
    </div>
  </div>
);

// ─── TuitionManager ───────────────────────────────────────────────────────────

const TuitionManager = () => {
  const [activeSubTab, setActiveSubTab] = useState('stats');

  // Stats state
  const [records, setRecords]               = useState([]);
  const [filterName, setFilterName]         = useState('');
  const [filterClass, setFilterClass]       = useState('');
  const [filterSessions, setFilterSessions] = useState('');
  const [filterStatus, setFilterStatus]     = useState('');
  const [editTarget, setEditTarget]         = useState(null); // record đang sửa, {} = thêm mới
  const [deleteTarget, setDeleteTarget]     = useState(null);
  const [toast, setToast]                   = useState({ msg: '', type: 'success' });
  const [pendingImport, setPendingImport]   = useState(null); // {rows, count} chờ admin chọn chế độ nhập
  const [sortKey, setSortKey]               = useState('');
  const [sortDir, setSortDir]               = useState('asc');
  const fileInputRef = useRef(null);

  // Bản đồ mã HV: UPPER(mã trong users) -> mã nguyên bản (đối soát khi import/lưu)
  const [codeMap, setCodeMap] = useState({});

  // History state
  const [snapshots, setSnapshots]     = useState([]);
  const [filterMonth, setFilterMonth] = useState(''); // '1'..'12'
  const [filterYear, setFilterYear]   = useState(''); // '2026'...

  // ── Firebase listeners ────────────────────────────────────────────────────
  useEffect(() => {
    const unsubRec = onValue(ref(db, 'tuitionRecords'), (snap) => {
      const data = snap.val() || {};
      // Cấu trúc: tuitionRecords/{mã HV}/{recordId} → trải phẳng để hiển thị bảng
      const arr = [];
      Object.entries(data).forEach(([code, recs]) => {
        Object.entries(recs || {}).forEach(([id, val]) => arr.push({ id, dbCode: code, ...val }));
      });
      setRecords(arr);
      autoUpdateOverdue(arr);
    });
    // Node users: lấy mã HV nguyên bản để làm key nhánh (rules so sánh chính xác)
    const unsubUsers = onValue(ref(db, 'users'), (snap) => {
      const data = snap.val() || {};
      const m = {};
      Object.values(data).forEach((u) => {
        const c = String(u?.studentCode || '').trim();
        if (c) m[c.toUpperCase()] = c;
      });
      setCodeMap(m);
    });
    const unsubSnap = onValue(ref(db, 'tuitionSnapshots'), (snap) => {
      const data = snap.val() || {};
      const arr = Object.entries(data)
        .map(([id, val]) => ({ id, ...val }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setSnapshots(arr);
    });
    return () => { unsubRec(); unsubSnap(); unsubUsers(); };
  }, []);

  // Toast phân loại: success (xanh) / error (đỏ) / warning (vàng). Màu lấy TỪ type, không suy từ emoji.
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast((t) => ({ ...t, msg: '' })), 3500);
  };

  // ── Import Excel: PARSE trước, admin chọn Nhập bổ sung / Thay thế toàn bộ ──
  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb   = XLSX.read(evt.target.result, { type: 'binary' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const raw  = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (raw.length < 2) return showToast('File không có dữ liệu (cần ít nhất 1 hàng dữ liệu sau header).', 'error');
        const rows = raw.slice(1).map(rowToRecord).filter(Boolean); // bỏ hàng tiêu đề + hàng trống
        if (rows.length === 0) return showToast('Không đọc được dòng dữ liệu hợp lệ nào từ file.', 'error');
        // KHÔNG ghi ngay: chờ admin chọn chế độ (chống một cú bấm nhầm xoá sạch dữ liệu tiền bạc).
        setPendingImport({ rows, count: rows.length });
      } catch (err) {
        showToast('Lỗi đọc file: ' + err.message, 'error');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // Thực thi import SAU khi admin chọn chế độ trong ImportChoiceModal.
  // mode 'replace' = thay thế toàn bộ; mode 'append' = nhập bổ sung (import lẻ).
  const confirmImport = async (mode) => {
    if (!pendingImport) return;
    const { rows } = pendingImport;
    const now = new Date().toISOString();
    try {
      // Dedupe: file có 2 dòng trùng Mã HV + Lớp thì lấy dòng CUỐI (không sinh record trùng)
      const uniqueRows = [...new Map(rows.map((r) => [mergeKey(r), r])).values()];
      // Đối soát với node users: mã không khớp học viên nào vẫn được lưu nhưng cảnh báo
      const unmatched = uniqueRows.filter((r) => !codeMap[String(r.studentCode).trim().toUpperCase()]).length;
      const warnTail = unmatched > 0 ? ` Lưu ý: ${unmatched} dòng có Mã HV không khớp học viên nào trong hệ thống.` : '';
      if (mode === 'replace') {
        // MỘT lệnh set duy nhất: vừa xoá vừa ghi atomic, không có cửa sổ mất trắng dữ liệu
        const obj = {};
        uniqueRows.forEach((r) => {
          const code = canonicalCode(r.studentCode, codeMap);
          const key = push(ref(db, 'tuitionRecords')).key;
          (obj[code] = obj[code] || {})[key] = { ...r, studentCode: code, extensionRequested: false, extensionApproved: false, importedAt: now };
        });
        await set(ref(db, 'tuitionRecords'), obj);
        showToast(`Import thành công ${uniqueRows.length} học viên (đã thay thế toàn bộ danh sách cũ).${warnTail}`, unmatched ? 'warning' : 'success');
      } else {
        // Nhập bổ sung: so trùng Mã HV + Lớp với danh sách hiện tại
        const existing = new Map();
        records.forEach((rec) => existing.set(mergeKey(rec), rec));
        const updates = {};
        let updated = 0, added = 0;
        uniqueRows.forEach((r) => {
          const code = canonicalCode(r.studentCode, codeMap);
          const rec = { ...r, studentCode: code };
          const match = existing.get(mergeKey(rec));
          if (match) {
            // Cập nhật đè record cũ; dữ liệu file là mới nhất nên reset cờ gia hạn.
            // Mã canonical đổi (vd học viên vừa được tạo tài khoản) → dời nhánh atomic.
            if (match.dbCode !== code) updates[`tuitionRecords/${match.dbCode}/${match.id}`] = null;
            updates[`tuitionRecords/${code}/${match.id}`] = {
              ...rec,
              extensionRequested: false,
              extensionApproved:  false,
              importedAt:         match.importedAt || now,
              updatedAt:          now,
            };
            updated++;
          } else {
            const key = push(ref(db, 'tuitionRecords')).key;
            updates[`tuitionRecords/${code}/${key}`] = { ...rec, extensionRequested: false, extensionApproved: false, importedAt: now };
            added++;
          }
        });
        await update(ref(db), updates);
        showToast(`Nhập bổ sung xong: cập nhật ${updated} dòng, thêm mới ${added} dòng.${warnTail}`, unmatched ? 'warning' : 'success');
      }
    } catch (err) {
      showToast('Lỗi import: ' + err.message, 'error');
    } finally {
      setPendingImport(null);
    }
  };

  // ── Chốt: lưu snapshot + xuất PDF ngay ──────────────────────────────────
  const handleChot = async () => {
    if (records.length === 0) return showToast('Không có dữ liệu để chốt.', 'warning');
    try {
      const snapshotRef = push(ref(db, 'tuitionSnapshots'));
      await set(snapshotRef, {
        createdAt: new Date().toISOString(),
        count:     records.length,
        records:   records.map((r) => ({ ...r })),
      });
      const ok = exportToPDF(records, 'Thống kê Buổi học trả trước còn lại');
      if (ok) showToast('Đã chốt và xuất PDF.', 'success');
      else showToast('Đã chốt, nhưng trình duyệt chặn popup. Cho phép popup rồi tải lại từ tab Danh sách phiên bản.', 'warning');
    } catch (err) {
      showToast('Lỗi chốt: ' + err.message, 'error');
    }
  };

  // ── Lưu chỉnh sửa / thêm mới ─────────────────────────────────────────────
  const handleSaveEdit = async (form) => {
    if (!editTarget) return;
    const code = canonicalCode(form.studentCode, codeMap);
    const base = {
      name:              form.name.trim(),
      studentCode:       code,
      className:         form.className.trim(),
      remainingSessions: Number(form.remainingSessions) || 0,
      addedSessions:     Number(form.addedSessions) || 0,
      paymentDeadline:   form.paymentDeadline,
      status:            form.status,
    };
    try {
      if (!editTarget.id) {
        // Thêm học viên mới (import lẻ bằng tay)
        await set(push(ref(db, `tuitionRecords/${code}`)), {
          ...base,
          extensionRequested: false,
          extensionApproved:  false,
          importedAt:         new Date().toISOString(),
        });
        setEditTarget(null);
        showToast('Đã thêm học viên vào danh sách.', 'success');
        return;
      }
      const updates = { ...base, updatedAt: new Date().toISOString() };
      // Nếu admin đã xử lý gia hạn → clear flag extensionRequested
      if (editTarget.extensionRequested && form.status !== 'Chờ duyệt gia hạn') {
        updates.extensionRequested  = false;
        updates.extensionApproved   = true;
        updates.extensionApprovedAt = new Date().toISOString();
      } else if (!editTarget.extensionRequested && form.paymentDeadline !== (editTarget.paymentDeadline || '')) {
        // Admin đặt hạn MỚI ngoài luồng gia hạn (chu kỳ học phí mới): reset cờ để banner
        // học viên hiện "Bạn có Thông báo học phí mới" thay vì "Hệ thống đã cập nhật hạn"
        updates.extensionApproved = false;
      }
      if (editTarget.dbCode === code) {
        await update(ref(db, `tuitionRecords/${code}/${editTarget.id}`), updates);
      } else {
        // Mã HV đổi → dời record sang nhánh mới (một lệnh atomic, không mất dữ liệu giữa chừng)
        const { id: _id, dbCode: _dbCode, ...rest } = editTarget;
        await update(ref(db), {
          [`tuitionRecords/${editTarget.dbCode}/${editTarget.id}`]: null,
          [`tuitionRecords/${code}/${editTarget.id}`]: { ...rest, ...updates },
        });
      }
      setEditTarget(null);
      showToast('Đã cập nhật thông tin học viên.', 'success');
    } catch (err) {
      showToast('Lỗi: ' + err.message, 'error');
    }
  };

  // ── Xóa record ───────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    try {
      await remove(ref(db, `tuitionRecords/${deleteTarget.dbCode}/${deleteTarget.id}`));  // xoá 1 học viên
      setDeleteTarget(null);
      showToast('Đã xóa học viên khỏi danh sách.', 'success');
    } catch (err) {
      showToast('Lỗi: ' + err.message, 'error');
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
    if (filterStatus && r.status !== filterStatus) return false;
    return true;
  });

  const distinctClasses = [...new Set(records.map((r) => r.className || '').filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'vi')
  );
  const sessionValues = [...new Set(records.map((r) => r.remainingSessions))].filter((v) => v !== undefined).sort((a, b) => a - b);
  const extensionCount = records.filter((r) => r.status === 'Chờ duyệt gia hạn').length;

  // ── Snapshot filter: 2 dropdown Tháng và Năm ─────────────────────────────
  const yearOptions = [...new Set(snapshots.map((s) => new Date(s.createdAt).getFullYear()))]
    .filter((y) => !isNaN(y))
    .sort((a, b) => b - a);

  const filteredSnapshots = snapshots.filter((s) => {
    const d = new Date(s.createdAt);
    if (filterYear && d.getFullYear() !== Number(filterYear)) return false;
    if (filterMonth && d.getMonth() + 1 !== Number(filterMonth)) return false;
    return true;
  });

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-20">

      {/* Flash toast: màu theo type (đỏ = lỗi, vàng = cảnh báo, xanh = thành công) */}
      {toast.msg && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[90] text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 animate-fade-in-up ${toast.type === 'error' ? 'bg-red-500' : toast.type === 'warning' ? 'bg-amber-500' : 'bg-emerald-600'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d={toast.type === 'success' ? 'M4.5 12.75l6 6 9-13.5' : 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z'} />
          </svg>
          {toast.msg}
        </div>
      )}

      {editTarget && <EditModal record={editTarget} onSave={handleSaveEdit} onClose={() => setEditTarget(null)} />}
      {deleteTarget && <ConfirmModal title="Xóa học viên này khỏi danh sách?" message="Hành động không thể hoàn tác." onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />}
      {pendingImport && (
        <ImportChoiceModal
          count={pendingImport.count}
          currentCount={records.length}
          onAppend={() => confirmImport('append')}
          onReplace={() => confirmImport('replace')}
          onCancel={() => setPendingImport(null)}
        />
      )}

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
                ? 'text-primary border-b-2 border-primary'
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
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
              <select
                className="input-base"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">Tất cả tình trạng</option>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
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
              onClick={() => setEditTarget({})}
              className="btn-secondary"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
              </svg>
              Thêm học viên
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
            <span className="mx-1">A=Mã HV (bắt buộc, dòng thiếu mã sẽ bị bỏ qua) · B=Họ và tên · C=Lớp · D=Buổi còn lại · E=Buổi cộng thêm · F=Hạn thanh toán (DD/MM/YYYY) · G=Tình trạng.</span>
            <span>Sau khi chọn file có thể chọn <span className="font-bold">Nhập bổ sung</span> (import lẻ, giữ danh sách cũ) hoặc <span className="font-bold text-red-600">Thay thế toàn bộ</span>.</span>
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
                          className={`flex items-center gap-1 hover:text-primary transition-colors font-bold uppercase text-[11px] tracking-wide ${cls === 'text-center' ? 'mx-auto' : ''}`}
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
                          ? 'Chưa có dữ liệu. Nhấn "Import Excel" để nhập danh sách hoặc "Thêm học viên" để nhập lẻ.'
                          : 'Không tìm thấy học viên phù hợp với bộ lọc.'}
                      </td>
                    </tr>
                  ) : filteredRecords.map((r) => {
                    const dl = getDaysLeft(r.paymentDeadline);
                    return (
                    <tr
                      key={r.id}
                      className={`hover:bg-slate-50 transition-colors ${r.status === 'Chờ duyệt gia hạn' ? 'bg-purple-50/50' : ''}`}
                    >
                      <td className="font-bold text-primary font-mono text-xs">{r.studentCode || '–'}</td>
                      <td className="font-medium text-slate-800">{r.name || '–'}</td>
                      <td className="text-slate-600 text-xs">{r.className || '–'}</td>
                      <td className="text-center">
                        <span className="font-bold text-slate-700">{r.remainingSessions ?? '–'}</span>
                      </td>
                      <td className="text-center">
                        <span className="font-bold text-blue-600">{r.addedSessions ?? 0}</span>
                      </td>
                      <td className="whitespace-nowrap">
                        <span className="text-slate-700">{fmtDate(r.paymentDeadline)}</span>
                        {dl !== null && r.status !== 'Đã thanh toán' && (
                          <p className={`text-[10px] font-medium ${dl < 0 ? 'text-red-500' : dl <= 3 ? 'text-amber-600' : 'text-slate-400'}`}>
                            {dl < 0 ? `Lố ${-dl} ngày` : dl === 0 ? 'Hạn hôm nay' : `Còn ${dl} ngày`}
                          </p>
                        )}
                      </td>
                      <td>
                        <span className={`text-xs font-bold px-2 py-1 rounded-lg whitespace-nowrap ${statusStyle(r.status)}`}>
                          {r.status || 'Chờ'}
                        </span>
                        {r.status === 'Chờ duyệt gia hạn' && r.extensionRequestedAt && (
                          <p className="text-[10px] text-purple-500 mt-1 whitespace-nowrap">Y/c lúc {fmtDateTime(r.extensionRequestedAt)}</p>
                        )}
                      </td>
                      <td>
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => setEditTarget(r)}
                            className="text-primary border border-primary px-2 py-1 rounded text-xs font-bold hover:bg-primary hover:text-white transition-all"
                          >
                            Sửa
                          </button>
                          <button
                            onClick={() => setDeleteTarget({ dbCode: r.dbCode, id: r.id })}
                            className="text-red-500 border border-red-200 px-2 py-1 rounded text-xs font-bold hover:bg-red-500 hover:text-white transition-all"
                          >
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  );})}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══ TAB: DANH SÁCH PHIÊN BẢN ════════════════════════════════════════ */}
      {activeSubTab === 'history' && (
        <div className="space-y-4">
          {/* Bộ lọc Tháng + Năm */}
          <div className="flex items-center gap-3 flex-wrap">
            <select
              className="p-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 bg-white min-w-[140px]"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
            >
              <option value="">Tất cả tháng</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>Tháng {m}</option>
              ))}
            </select>
            <select
              className="p-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 bg-white min-w-[120px]"
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
            >
              <option value="">Tất cả năm</option>
              {yearOptions.map((y) => <option key={y} value={y}>Năm {y}</option>)}
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
                {snapshots.length === 0 ? 'Chưa có phiên bản nào.' : 'Không có phiên bản trong thời gian đã chọn.'}
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
                        <span className="font-bold text-primary">{snap.count || snap.records?.length || 0}</span> học viên
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        if (!exportToPDF(snap.records, 'Thống kê Buổi học trả trước còn lại', snap.createdAt)) {
                          showToast('Trình duyệt chặn popup. Vui lòng cho phép popup để xuất PDF.', 'error');
                        }
                      }}
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
