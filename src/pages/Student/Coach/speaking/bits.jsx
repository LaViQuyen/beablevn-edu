import React, { useEffect, useState } from 'react';
import { MdBold } from '../shared/mdText';
import { BUSY_MSGS, BUSY_ROTATE_MS, BAND_KEYS } from './constants';

/*
 * Mảnh UI nhỏ dùng chung cho Speaking Coach: port các khối busy/#fbitem/.chip
 * của speaking.html sang component, style bằng tailwind theo Design System EDU.
 */

// Overlay xử lý hệ thống, thông điệp BUSY_MSGS xoay vòng 1800ms như gốc
export const BusyOverlay = ({ show }) => {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!show) return undefined;
    setI(0);
    const id = setInterval(() => setI((v) => (v + 1) % BUSY_MSGS.length), BUSY_ROTATE_MS);
    return () => clearInterval(id);
  }, [show]);
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[99] bg-[#F7FAF7]/95 flex flex-col items-center justify-center text-center p-6">
      <div className="w-12 h-12 rounded-full border-4 border-[#E8F4EC] border-t-[#2B6830] animate-spin" />
      <p className="mt-4 font-bold text-[#1E5225] text-[15px] max-w-md">{BUSY_MSGS[i]}</p>
      <p className="mt-1.5 text-slate-500 text-sm">Vui lòng đợi trong giây lát…</p>
    </div>
  );
};

// Chip band FC / LR / GRA / PR (band hiển thị Math.floor như gốc)
export const BandChips = ({ bands }) => (
  <div className="flex flex-wrap gap-2 my-2.5">
    {BAND_KEYS.map((k) => {
      const b = Number(bands && bands[k]);
      return (
        <div key={k} className="bg-[#E8F4EC] rounded-xl px-3.5 py-2 text-center min-w-[54px]">
          <b className="block text-lg text-[#1E5225]">{Number.isFinite(b) ? Math.floor(b) : '–'}</b>
          <span className="text-[11px] font-bold text-slate-500">{k}</span>
        </div>
      );
    })}
  </div>
);

// Lỗi ngữ pháp/từ vựng: ❌ em nói → ✅ nên nói + giải thích
export const FbErrorItem = ({ e }) => (
  <div className="border-l-[3px] border-amber-600 bg-[#FFFAF2] rounded-r-xl px-3 py-2 my-2 text-sm">
    ❌ <b className="text-red-700">{e.you_said}</b> → ✅ <b className="text-[#1E5225]">{e.better}</b>
    <br />
    <span className="text-slate-500">
      <MdBold text={e.explain_vi} />
    </span>
  </div>
);

// Lỗi phát âm: 🔊 từ /IPA/, em phát âm ...
export const FbPronItem = ({ p }) => (
  <div className="border-l-[3px] border-red-600 bg-[#FDF3F2] rounded-r-xl px-3 py-2 my-2 text-sm">
    🔊 <b>{p.word}</b> {p.ipa}, em phát âm: <b className="text-red-700">{p.you_said}</b>
    <br />
    <span className="text-slate-500">
      <MdBold text={p.tip_vi} />
    </span>
  </div>
);

// Khối "Em đã nói:" (transcript nghiêng nền xám)
export const TranscriptBox = ({ children }) => (
  <div className="bg-[#F4F6F4] rounded-xl p-3 text-sm italic my-2">{children}</div>
);

// Hộp lỗi đỏ (port .err của gốc)
export const ErrBox = ({ msg }) =>
  msg ? (
    <div className="mt-3.5 bg-red-600 text-white text-[13.5px] font-semibold px-4 py-2.5 rounded-xl">{msg}</div>
  ) : null;

// Badge phần thi (port .partbadge)
export const PartBadge = ({ children }) => (
  <span className="inline-block bg-[#2B6830] text-white font-extrabold text-[13px] px-4 py-1.5 rounded-full tracking-wide">
    {children}
  </span>
);
