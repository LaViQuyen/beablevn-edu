import React, { useEffect, useState } from 'react';
import { MdBold } from '../shared/mdText';
import {
  BUSY_MSGS, BUSY_ROTATE_MS, BAND_KEYS,
  FILLER_PHRASES, SILENCE_RATIO_TIP, SOS_STRATEGIES,
} from './constants';

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
      <div className="w-12 h-12 rounded-full border-4 border-primary-light border-t-primary animate-spin" />
      <p className="mt-4 font-bold text-primary-hover text-[15px] max-w-md">{BUSY_MSGS[i]}</p>
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
        <div key={k} className="bg-primary-light rounded-xl px-3.5 py-2 text-center min-w-[54px]">
          <b className="block text-lg text-primary-hover">{Number.isFinite(b) ? Math.floor(b) : '–'}</b>
          <span className="text-[11px] font-bold text-slate-500">{k}</span>
        </div>
      );
    })}
  </div>
);

// Lỗi ngữ pháp/từ vựng: ❌ em nói → ✅ nên nói + giải thích
export const FbErrorItem = ({ e }) => (
  <div className="border-l-[3px] border-amber-600 bg-[#FFFAF2] rounded-r-xl px-3 py-2 my-2 text-sm">
    ❌ <b className="text-red-700">{e.you_said}</b> → ✅ <b className="text-primary-hover">{e.better}</b>
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
  <span className="inline-block bg-primary text-white font-extrabold text-[13px] px-4 py-1.5 rounded-full tracking-wide">
    {children}
  </span>
);

/* ============================================================
 * NÂNG CẤP SƯ PHẠM 07/2026 (tài liệu Teaching Speaking nội bộ)
 * ============================================================ */

// Transcript có tô lỗi tại chỗ (Swain: LÀM CHO KHOẢNG CÁCH HIỂN THỊ).
// Tìm cụm you_said (lỗi ngữ pháp, đỏ) và word (lỗi phát âm, cam) ngay trong
// transcript, không thấy thì bỏ qua trong im lặng (fuzzy match đơn giản).
export const HighlightTranscript = ({ text, errors, pron }) => {
  const s = String(text == null ? '' : text);
  const lower = s.toLowerCase();
  const marks = [];
  const addMarks = (needleRaw, kind) => {
    const needle = String(needleRaw || '').trim().toLowerCase();
    if (needle.length < 2) return;
    const start = lower.indexOf(needle);
    if (start === -1) return;
    marks.push({ start, end: start + needle.length, kind });
  };
  (errors || []).forEach((e) => addMarks(e && e.you_said, 'err'));
  (pron || []).forEach((p) => addMarks(p && p.word, 'pron'));
  marks.sort((a, b) => a.start - b.start);
  // Bỏ đoạn chồng lấn (giữ đoạn xuất hiện trước)
  const clean = [];
  let lastEnd = -1;
  marks.forEach((m) => {
    if (m.start >= lastEnd) {
      clean.push(m);
      lastEnd = m.end;
    }
  });
  if (!clean.length) {
    return <div className="bg-[#F4F6F4] rounded-xl p-3 text-sm italic my-2">{s}</div>;
  }
  const nodes = [];
  let pos = 0;
  clean.forEach((m, i) => {
    if (m.start > pos) nodes.push(s.slice(pos, m.start));
    const cls =
      m.kind === 'err'
        ? 'bg-red-50 text-red-700 underline decoration-red-400 decoration-2 underline-offset-2 rounded px-0.5 not-italic font-semibold'
        : 'bg-amber-50 text-amber-700 underline decoration-amber-400 decoration-2 underline-offset-2 rounded px-0.5 not-italic font-semibold';
    nodes.push(
      <mark key={i} className={cls}>
        {s.slice(m.start, m.end)}
      </mark>
    );
    pos = m.end;
  });
  nodes.push(s.slice(pos));
  return (
    <div className="bg-[#F4F6F4] rounded-xl p-3 text-sm italic my-2">
      {nodes}
      <span className="block not-italic text-[11px] text-slate-400 mt-1.5">
        Chỗ <span className="text-red-600 font-semibold">đỏ</span> là lỗi ngữ pháp/từ vựng, chỗ{' '}
        <span className="text-amber-600 font-semibold">cam</span> là từ phát âm chưa chuẩn.
      </span>
    </div>
  );
};

// Thước đo dòng nói (tài liệu A.3: trôi chảy = dừng ĐÚNG CÁCH, không phải không dừng).
// stats = { voicedMs, durationMs, pausesOver2s, longestPauseMs } | null (máy đo hỏng → ẩn).
export const FluencyBar = ({ stats, onSpeakFiller }) => {
  if (!stats || !stats.durationMs || stats.durationMs < 3000) return null;
  const voiced = Math.min(stats.voicedMs, stats.durationMs);
  const ratio = Math.max(0, Math.min(1, voiced / stats.durationMs));
  const secs = (ms) => Math.round(ms / 1000);
  const silenceRatio = 1 - ratio;
  const showTip = silenceRatio > SILENCE_RATIO_TIP && stats.durationMs > 8000;
  return (
    <div className="bg-primary-subtle border border-[#C9E2CF] rounded-xl px-3.5 py-2.5 my-2">
      <div className="flex items-center justify-between text-[12px] text-slate-500 mb-1.5">
        <span>
          🗣 Nói <b className="text-primary-hover">~{secs(voiced)}s</b> / im lặng ~{secs(stats.durationMs - voiced)}s
          {stats.pausesOver2s > 0 && (
            <>
              {' '}· ngừng dài <b className="text-primary-hover">{stats.pausesOver2s} lần</b>
              {stats.longestPauseMs >= 2000 ? ` (lâu nhất ~${secs(stats.longestPauseMs)}s)` : ''}
            </>
          )}
        </span>
        <span className="text-slate-400">ước tính</span>
      </div>
      <div className="h-2 bg-slate-200 rounded overflow-hidden">
        <div className="h-2 bg-primary-medium rounded" style={{ width: `${Math.round(ratio * 100)}%` }} />
      </div>
      {showTip && (
        <p className="text-[12.5px] text-slate-600 mt-2 leading-relaxed">
          💡 Im lặng hơi nhiều. Cần thời gian nghĩ thì <b>câu giờ bằng từ chêm</b> thay vì im:{' '}
          {FILLER_PHRASES.map((f, i) => (
            <i key={i} className="text-primary-hover">
              {f}
              {i < FILLER_PHRASES.length - 1 ? ' · ' : ''}
            </i>
          ))}
          {onSpeakFiller && (
            <button
              type="button"
              onClick={onSpeakFiller}
              className="ml-1.5 text-primary font-semibold underline underline-offset-2"
            >
              🔊 Nghe mẫu
            </button>
          )}
        </p>
      )}
    </div>
  );
};

// Túi chunks bỏ túi (A.3 automaticity, Lexical Approach): chip cụm câu + nút loa
// để nhại theo. chunks = [{chunk, use_when_vi}], dedupe theo text, tối đa 8.
export const ChunkChips = ({ chunks, onSpeak, title }) => {
  const list = [];
  const seen = new Set();
  (Array.isArray(chunks) ? chunks : []).forEach((c) => {
    const t = c && typeof c.chunk === 'string' ? c.chunk.trim() : '';
    if (!t || seen.has(t.toLowerCase()) || list.length >= 8) return;
    seen.add(t.toLowerCase());
    list.push({ chunk: t, use: c.use_when_vi || '' });
  });
  if (!list.length) return null;
  return (
    <div className="my-2.5">
      <div className="font-bold text-primary-hover text-xs uppercase tracking-wide mb-1.5">
        {title || '🎒 Cụm bỏ túi, bấm loa và nhại theo 2-3 lần'}
      </div>
      <div className="flex flex-wrap gap-2">
        {list.map((c, i) => (
          <div key={i} className="bg-primary-subtle border border-[#C9E2CF] rounded-xl px-3 py-1.5 max-w-full">
            <button
              type="button"
              onClick={() => onSpeak && onSpeak(c.chunk)}
              className="text-[13px] font-semibold text-primary-hover"
              title={c.use}
            >
              🔊 {c.chunk}
            </button>
            {c.use ? <span className="block text-[11px] text-slate-500 leading-snug">{c.use}</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
};

// Phao chiến lược giao tiếp (B.2): mặc định ĐÓNG, học viên tự bấm mở khi cần
// (dạy lúc cần, không rải hint). KHÔNG render ở chế độ Thi thật.
export const SosPanel = () => {
  const [open, setOpen] = useState(false);
  return (
    <div className="my-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[12.5px] font-semibold text-primary underline underline-offset-2"
      >
        {open ? '🛟 Đóng phao chiến lược' : '🛟 Bí từ? Mở phao chiến lược'}
      </button>
      {open && (
        <div className="bg-primary-subtle border border-[#C9E2CF] rounded-xl px-3.5 py-3 mt-2 text-[12.5px] leading-relaxed">
          <p className="text-slate-500 mb-1.5">
            Khi bí từ hoặc bí ý, đừng im lặng. Xoay xở để giữ dòng nói (giám khảo đánh giá cao):
          </p>
          {SOS_STRATEGIES.map((st, i) => (
            <div key={i} className="my-1">
              <b className="text-primary-hover">{st.name}:</b> <i>{st.phrase}</i>
              <span className="text-slate-500"> · {st.when}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
