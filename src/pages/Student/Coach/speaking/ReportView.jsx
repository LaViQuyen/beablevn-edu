import React from 'react';
import { Link } from 'react-router-dom';
import { MdRich } from '../shared/mdText';
import { PartBadge } from './bits';
import { CRIT_NAMES, BAND_KEYS } from './constants';

/*
 * MÀN BÁO CÁO CUỐI PHIÊN: port #screenReport + renderReport() của speaking.html.
 * Khác gốc: bỏ nút "Xuất file kết quả (.docx)" (bản EDU không có action exportDocx;
 * kết quả đã được lưu tự động vào Lịch sử luyện tập nên không cần file rời).
 * Màu nhấn hl-blue / hl-green / hl-red của gốc chuyển thành class tailwind.
 */

const HL_BLUE = 'font-bold text-blue-700 bg-blue-50 px-0.5 rounded';
const HL_GREEN = 'font-bold text-[#1E5225] bg-[#E8F4EC] px-0.5 rounded';
const HL_RED = 'font-bold text-red-700 bg-red-50 px-0.5 rounded';

const ReportView = ({ report, studentName, modeLabel, targetBand, onRestart }) => {
  const d = report || {};
  const ov = Number(d.overall);
  const pq = (d.per_question || []).filter(Boolean);

  return (
    <div className="card card-body">
      <div className="text-center">
        <PartBadge>KẾT QUẢ</PartBadge>
      </div>
      <div className="text-center text-5xl font-extrabold text-[#2B6830] my-3">
        {Number.isFinite(ov) ? `Band ${ov.toFixed(1)}` : 'Band –'}
      </div>
      <p className="text-center text-[13px] text-slate-500">
        {studentName || 'Học viên'} · {modeLabel} · Mục tiêu {targetBand} ·{' '}
        {new Date().toLocaleDateString('vi-VN')}
      </p>

      <div className="overflow-x-auto mt-3">
        <table className="w-full border-collapse text-sm min-w-[480px]">
          <thead>
            <tr>
              <th className="border border-[#C9E2CF] bg-[#E8F4EC] text-[#1E5225] px-2.5 py-2 text-left w-[32%]">
                Tiêu chí
              </th>
              <th className="border border-[#C9E2CF] bg-[#E8F4EC] text-[#1E5225] px-2.5 py-2 text-left w-[14%]">
                Band
              </th>
              <th className="border border-[#C9E2CF] bg-[#E8F4EC] text-[#1E5225] px-2.5 py-2 text-left">
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
                  <td className="border border-[#C9E2CF] px-2.5 py-2 text-center text-lg font-extrabold text-[#1E5225]">
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
      <div className="bg-[#F4F7F4] border-l-[3px] border-[#2B6830] rounded-r-xl px-4 py-3 my-2.5 text-sm leading-relaxed">
        <MdRich text={d.examiner_comment_vi || ''} className={HL_BLUE} />
      </div>

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
                  <span className="inline-block bg-[#2B6830] text-white text-[10.5px] font-bold px-2 py-0.5 rounded-full mr-2 tracking-wide align-[1px]">
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
                  <div className="text-[13.5px] text-[#1E5225] my-1 leading-relaxed">
                    ✓ <MdRich text={q.good_vi} className={HL_GREEN} />
                  </div>
                ) : null}
                {q.improve_vi ? (
                  <div className="text-[13.5px] my-1 leading-relaxed">
                    ↗ <MdRich text={q.improve_vi} className={HL_BLUE} />
                  </div>
                ) : null}
                {q.revised ? (
                  <div className="bg-[#E8F4EC] border-l-[3px] border-[#3D8B47] rounded-r-lg px-3 py-2 my-2 text-[13.5px] text-[#1E5225] font-semibold leading-relaxed">
                    <span className="block text-[10.5px] font-bold uppercase tracking-wide text-[#2B6830] mb-0.5">
                      ✍ Chỉnh theo phương pháp Be Able VN
                    </span>
                    {q.revised}
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
