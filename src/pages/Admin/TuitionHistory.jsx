import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { ref, onValue } from 'firebase/database';

// ─── Xuất PDF bằng cửa sổ in ────────────────────────────────────────────────
const exportToPDF = (snapshot) => {
  const dateStr = new Date(snapshot.createdAt).toLocaleString('vi-VN');
  const rows = (snapshot.records || [])
    .map((r, i) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${r.studentCode || ''}</td>
        <td>${r.name || ''}</td>
        <td style="text-align:center">${r.remainingSessions ?? ''}</td>
        <td style="text-align:center">${r.addedSessions ?? 0}</td>
        <td>${r.paymentDeadline ? new Date(r.paymentDeadline + 'T00:00:00').toLocaleDateString('vi-VN') : ''}</td>
        <td>${r.status || ''}</td>
      </tr>
    `)
    .join('');

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <title>Thống kê Buổi học, ${dateStr}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, 'Helvetica Neue', sans-serif;
      font-size: 12px;
      color: #1a1a1a;
      padding: 28px 32px;
    }
    .header { margin-bottom: 18px; }
    .header h2 { font-size: 18px; color: #2B6830; font-weight: 700; margin-bottom: 4px; }
    .header .meta { font-size: 11px; color: #666; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th {
      background: #2B6830;
      color: #fff;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 8px 10px;
      text-align: left;
    }
    td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
    tr:nth-child(even) td { background: #f8fafc; }
    .footer {
      margin-top: 24px;
      font-size: 10px;
      color: #94a3b8;
      text-align: center;
      border-top: 1px solid #e2e8f0;
      padding-top: 10px;
    }
    @media print {
      body { padding: 16px; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h2>BE ABLE VN, Thống kê Buổi học</h2>
    <p class="meta">Thời điểm chốt: <strong>${dateStr}</strong> &nbsp;·&nbsp; Tổng số: <strong>${snapshot.records?.length || 0} học viên</strong></p>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:36px;text-align:center">STT</th>
        <th>Mã HV</th>
        <th>Họ và tên</th>
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

  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) {
    alert('Trình duyệt chặn popup. Vui lòng cho phép popup để xuất PDF.');
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
};

// ─── Main Component ──────────────────────────────────────────────────────────
const TuitionHistory = () => {
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    const unsub = onValue(ref(db, 'tuitionSnapshots'), (snap) => {
      const data = snap.val() || {};
      const arr = Object.entries(data)
        .map(([id, val]) => ({ id, ...val }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setSnapshots(arr);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card-std p-5 animate-pulse">
            <div className="h-3 bg-slate-100 rounded w-24 mb-2" />
            <div className="h-4 bg-slate-100 rounded w-48" />
          </div>
        ))}
      </div>
    );
  }

  if (snapshots.length === 0) {
    return (
      <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-200 text-center">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="#cbd5e1" className="w-12 h-12 mx-auto mb-3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
        <p className="text-slate-400 font-medium text-sm">Chưa có lịch sử chốt nào.</p>
        <p className="text-slate-300 text-xs mt-1">Danh sách sẽ xuất hiện sau khi Admin nhấn "Chốt" ở tab Thống kê buổi học.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400 font-medium">{snapshots.length} lần chốt, mới nhất trước</p>
      {snapshots.map((snap) => (
        <div key={snap.id} className="card-std p-5 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            {/* Thông tin snapshot */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#ef4444" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="stat-label">Thời điểm chốt</p>
              </div>
              <p className="font-bold text-slate-800 text-base ml-9">
                {new Date(snap.createdAt).toLocaleString('vi-VN', {
                  weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </p>
              <p className="text-xs text-slate-500 mt-1 ml-9">
                <span className="font-bold text-primary">{snap.count || snap.records?.length || 0}</span> học viên
              </p>
            </div>

            {/* Nút Trích xuất PDF */}
            <button
              onClick={() => exportToPDF(snap)}
              className="btn-danger shrink-0"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Trích xuất PDF
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TuitionHistory;
