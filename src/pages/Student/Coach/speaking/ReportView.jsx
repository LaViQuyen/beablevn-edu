import React from 'react';
import { Link } from 'react-router-dom';
import { MdRich } from '../shared/mdText';
import { speak } from '../shared/speak';
import { ChunkChips, PartBadge } from './bits';
import { CRIT_NAMES, BAND_KEYS, BOTTLENECK_STAGES } from './constants';

/*
 * MÀN BÁO CÁO CUỐI PHIÊN: port #screenReport + renderReport() của speaking.html.
 * Khác gốc: bỏ nút "Xuất file kết quả (.docx)" (bản EDU không có action exportDocx;
 * kết quả đã được lưu tự động vào Lịch sử luyện tập nên không cần file rời).
 * Màu nhấn hl-blue / hl-green / hl-red của gốc chuyển thành class tailwind.
 */

const HL_BLUE = 'font-bold text-blue-700 bg-blue-50 px-0.5 rounded';
const HL_GREEN = 'font-bold text-primary-hover bg-primary-light px-0.5 rounded';
const HL_RED = 'font-bold text-red-700 bg-red-50 px-0.5 rounded';

// In đậm + gạch chân từ MỚI trong bản chỉnh sửa so với nguyên bản của học viên
// (Swain noticing the gap: làm khoảng cách hiển thị). Bản sửa khác quá xa
// (dưới 30% từ trùng) thì hiện thường, tránh gạch loạn cả câu.
const RevisedText = ({ original, revised }) => {
  const rev = String(revised || '');
  if (!rev) return null;
  const norm = (w) => String(w).toLowerCase().replace(/[^a-z0-9']/g, '');
  const origSet = new Set(
    String(original || '')
      .split(/\s+/)
      .map(norm)
      .filter(Boolean)
  );
  const parts = rev.split(/(\s+)/);
  let shared = 0;
  let total = 0;
  parts.forEach((w) => {
    const n = norm(w);
    if (!n) return;
    total += 1;
    if (origSet.has(n)) shared += 1;
  });
  if (!origSet.size || !total || shared / total < 0.3) return <>{rev}</>;
  return (
    <>
      {parts.map((w, i) => {
        const n = norm(w);
        return n && !origSet.has(n) ? (
          <b key={i} className="underline decoration-primary decoration-2 underline-offset-2">
            {w}
          </b>
        ) : (
          w
        );
      })}
    </>
  );
};

// Đổi ms thành "X phút Y giây" cho dòng đồng hồ lượng nói
const fmtTalk = (ms) => {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m} phút ${s % 60} giây` : `${s} giây`;
};

const ReportView = ({ report, studentName, modeLabel, targetBand, onRestart }) => {
  const d = report || {};
  const ov = Number(d.overall);
  const pq = (d.per_question || []).filter(Boolean);

  return (
    <div className="card card-body">
      <div className="text-center">
        <PartBadge>KẾT QUẢ</PartBadge>
      </div>
      <div className="text-center text-5xl font-extrabold text-primary my-3">
        {Number.isFinite(ov) ? `Band ${ov.toFixed(1)}` : 'Band –'}
      </div>
      <p className="text-center text-[13px] text-slate-500">
        {studentName || 'Học viên'} · {modeLabel} · Mục tiêu {targetBand} ·{' '}
        {new Date().toLocaleDateString('vi-VN')}
      </p>
      {Number(d._talkMs) >= 30000 && (
        <p className="text-center text-[13px] text-slate-600 bg-primary-subtle rounded-xl px-4 py-2.5 mt-2.5 leading-relaxed">
          🗣 Phiên này em đã nói thật sự <b className="text-primary">{fmtTalk(Number(d._talkMs))}</b>. Mỗi phút
          nói thật là một quân domino: luyện đủ nhiều thì tự tin, tự động và trôi chảy sẽ tự đổ theo.
        </p>
      )}

      <div className="overflow-x-auto mt-3">
        <table className="w-full border-collapse text-sm min-w-[480px]">
          <thead>
            <tr>
              <th className="border border-[#C9E2CF] bg-primary-light text-primary-hover px-2.5 py-2 text-left w-[32%]">
                Tiêu chí
              </th>
              <th className="border border-[#C9E2CF] bg-primary-light text-primary-hover px-2.5 py-2 text-left w-[14%]">
                Band
              </th>
              <th className="border border-[#C9E2CF] bg-primary-light text-primary-hover px-2.5 py-2 text-left">
                Nhận xét &amp; cách lên band
              </th>
            </tr>
          </thead>
          <tbody>
            {BAND_KEYS.map((k) => {
              const b = Number(d.bands && d.bands[k]);
              return (
                <tr key={k}>
                  <td className="border border-[#C9E2CF] px-2.5 py-2">
                    {CRIT_NAMES[k]} ({k})
                  </td>
                  <td className="border border-[#C9E2CF] px-2.5 py-2 text-center text-lg font-extrabold text-primary-hover">
                    {Number.isFinite(b) ? Math.floor(b) : '–'}
                  </td>
                  <td className="border border-[#C9E2CF] px-2.5 py-2 leading-relaxed">
                    <MdRich text={(d.per_criterion && d.per_criterion[k]) || ''} className={HL_BLUE} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <b className="block mt-4">Nhận xét của giám khảo</b>
      <div className="bg-[#F4F7F4] border-l-[3px] border-primary rounded-r-xl px-4 py-3 my-2.5 text-sm leading-relaxed">
        <MdRich text={d.examiner_comment_vi || ''} className={HL_BLUE} />
      </div>

      {/* Chẩn đoán điểm nghẽn theo 4 giai đoạn tạo lời nói (Levelt, tài liệu A.1):
          chẩn đúng giai đoạn thì luyện mới trúng đích */}
      {(() => {
        const bn = d.bottleneck;
        if (!bn || typeof bn !== 'object') return null;
        const idx = BOTTLENECK_STAGES.findIndex((st) => st.key === String(bn.stage || '').toLowerCase());
        if (idx === -1) return null;
        return (
          <div className="mt-3">
            <b>Điểm nghẽn chính của em</b>
            <div className="border border-[#C9E2CF] rounded-xl px-3.5 py-3 my-2">
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                {BOTTLENECK_STAGES.map((st, i) => (
                  <React.Fragment key={st.key}>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                        i === idx ? 'bg-primary text-white' : 'bg-primary-subtle text-slate-500'
                      }`}
                    >
                      {st.icon} {st.vi}
                    </span>
                    {i < BOTTLENECK_STAGES.length - 1 && <span className="text-slate-300 text-xs">→</span>}
                  </React.Fragment>
                ))}
              </div>
              {bn.why_vi ? (
                <p className="text-[13.5px] leading-relaxed my-1">
                  <MdRich text={bn.why_vi} className={HL_BLUE} />
                </p>
              ) : null}
              {bn.fix_vi ? (
                <p className="text-[13.5px] leading-relaxed my-1 text-primary-hover">
                  🎯 <MdRich text={bn.fix_vi} className={HL_GREEN} />
                </p>
              ) : null}
            </div>
          </div>
        );
      })()}

      {/* Túi cụm câu cả phiên (automaticity qua chunks, Lexical Approach) */}
      <ChunkChips
        chunks={d.chunk_bank}
        onSpeak={(t) => speak(t)}
        title="🎒 Túi cụm câu phiên này, bấm loa và nhại theo 2-3 lần"
      />

      <b className="block mt-3">Điểm mạnh</b>
      <ul className="list-disc ml-5 my-1.5 text-sm leading-relaxed">
        {(d.strengths || []).map((s, i) => (
          <li key={i}>
            <MdRich text={s} className={HL_GREEN} />
          </li>
        ))}
      </ul>

      <b className="block mt-3">Ưu tiên cải thiện 2 tuần tới</b>
      <ul className="list-disc ml-5 my-1.5 text-sm leading-relaxed">
        {(d.improvements || []).map((s, i) => (
          <li key={i}>
            <MdRich text={s} className={HL_RED} />
          </li>
        ))}
      </ul>

      {pq.length > 0 && (
        <div className="mt-4">
          <b>Phân tích từng câu &amp; hướng cải thiện (phương pháp Be Able VN)</b>
          <div className="mt-2">
            {pq.map((q, i) => (
              <div key={i} className="border border-[#C9E2CF] rounded-xl px-3.5 py-3 my-2 bg-white">
                <div className="font-semibold text-[13.5px] mb-1.5 leading-snug">
                  <span className="inline-block bg-primary text-white text-[10.5px] font-bold px-2 py-0.5 rounded-full mr-2 tracking-wide align-[1px]">
                    PART {q.part}
                  </span>
                  {q.question || ''}
                </div>
                {q.transcript ? (
                  <div className="bg-[#F4F6F4] border-l-[3px] border-slate-400 rounded-r-lg px-3 py-2 my-2 text-[13.5px] italic leading-relaxed">
                    <span className="block text-[10.5px] font-bold uppercase tracking-wide text-slate-500 not-italic mb-0.5">
                      🎙 Em đã nói
                    </span>
                    {q.transcript}
                  </div>
                ) : null}
                {q.good_vi ? (
                  <div className="text-[13.5px] text-primary-hover my-1 leading-relaxed">
                    ✓ <MdRich text={q.good_vi} className={HL_GREEN} />
                  </div>
                ) : null}
                {q.improve_vi ? (
                  <div className="text-[13.5px] my-1 leading-relaxed">
                    ↗ <MdRich text={q.improve_vi} className={HL_BLUE} />
                  </div>
                ) : null}
                {q.revised ? (
                  <div className="bg-primary-light border-l-[3px] border-primary-medium rounded-r-lg px-3 py-2 my-2 text-[13.5px] text-primary-hover font-semibold leading-relaxed">
                    <span className="block text-[10.5px] font-bold uppercase tracking-wide text-primary mb-0.5">
                      ✍ Chỉnh theo phương pháp Be Able VN (từ gạch chân là từ mới so với bản của em)
                    </span>
                    <RevisedText original={q.transcript} revised={q.revised} />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-center text-xs text-slate-400 mt-5">
        Kết quả phiên luyện đã được lưu tự động vào Lịch sử luyện tập.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center mt-3">
        <button type="button" onClick={onRestart} className="btn-primary btn-lg">
          Làm bài mới
        </button>
        <Link to="/student/resources" className="btn-outline btn-lg">
          Về Tài nguyên &amp; Luyện tập
        </Link>
      </div>
    </div>
  );
};

export default ReportView;
