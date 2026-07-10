import React from 'react';

/*
 * Port của md() / mdRich() trong template gốc (speaking.html) sang JSX THUẦN.
 * Bản gốc build chuỗi HTML rồi innerHTML; ở React ta render node trực tiếp,
 * KHÔNG dangerouslySetInnerHTML (React tự escape, khỏi cần esc()).
 */

// md(): "**đậm**" thành <b>đậm</b>
export function MdBold({ text }) {
  const s = String(text == null ? '' : text);
  const parts = s.split(/\*\*(.+?)\*\*/g);
  return <>{parts.map((p, i) => (i % 2 === 1 ? <b key={i}>{p}</b> : p))}</>;
}

// mdRich(): tô màu cụm nhấn **...** hoặc *...*, dọn dấu * lẻ còn sót
export function MdRich({ text, className = 'text-[#2B6830] font-semibold' }) {
  const s = String(text == null ? '' : text);
  const re = /\*\*(.+?)\*\*|\*(.+?)\*/g; // nhánh ** đứng trước để ưu tiên như bản gốc
  const nodes = [];
  let last = 0;
  let m;
  let k = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) nodes.push(s.slice(last, m.index).replace(/\*/g, ''));
    nodes.push(
      <span key={k++} className={className}>
        {m[1] != null ? m[1] : m[2]}
      </span>
    );
    last = m.index + m[0].length;
  }
  nodes.push(s.slice(last).replace(/\*/g, ''));
  return <>{nodes}</>;
}
