/**
 * Biên bản đình chỉ bài thi (chỉ Thi thật), port downloadIncidentReport() của
 * speaking.html. Tạo file .html tải về máy học viên ngay khi bị đình chỉ.
 * Khác gốc: bỏ dòng "Ghi chú" vì bản EDU không còn ô nhập lớp.
 */

const escHtml = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

export default function downloadIncidentReport(studentName, evaluations, violLog, violations) {
  const st = (studentName || 'NGUOI THI').trim();
  const rows = evaluations
    .map(
      (e) =>
        `<tr><td>Part ${e.part}${e.attempt === 2 ? ' (nói lại)' : ''}</td><td>${escHtml(e.question)}</td>` +
        `<td>${
          e.bands
            ? ['FC', 'LR', 'GRA', 'PR'].map((k) => k + ' ' + (e.bands[k] != null ? e.bands[k] : '–')).join(' · ')
            : '–'
        }</td>` +
        `<td>${escHtml(e.transcript_excerpt || '')}</td></tr>`
    )
    .join('');
  const vio = violLog.map((v) => `<li>${v.time} · ${escHtml(v.kind)} (${escHtml(v.where)})</li>`).join('');
  const html =
    `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>BIEN BAN DINH CHI - ${escHtml(st)}</title></head>` +
    `<body style="font-family:Calibri,Arial,sans-serif;max-width:800px;margin:30px auto;line-height:1.6">` +
    `<h1 style="color:#C0392B">🚫 BIÊN BẢN ĐÌNH CHỈ BÀI THI SPEAKING</h1>` +
    `<p><b>Người thi:</b> ${escHtml(st)} &nbsp;·&nbsp; <b>Thời điểm:</b> ${new Date().toLocaleString('vi-VN')}</p>` +
    `<p><b>Lý do:</b> rời khỏi màn hình thi ${violations} lần sau khi đã được cảnh báo lần 1.</p>` +
    `<h3>Nhật ký vi phạm</h3><ul>${vio || '<li>(trống)</li>'}</ul>` +
    `<h3>Bài làm đến thời điểm đình chỉ</h3>` +
    `<table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%">` +
    `<tr style="background:#E8F4EC"><th>Phần</th><th>Câu hỏi</th><th>Band</th><th>Transcript (trích)</th></tr>` +
    `${rows || "<tr><td colspan='4'>(chưa có câu nào được chấm)</td></tr>"}</table></body></html>`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  a.download = 'SPEAKING INCIDENT ' + st.toUpperCase().replace(/[^A-Z0-9 ]/g, '') + '.html';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
