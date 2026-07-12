import React from 'react';
import { MdBold } from '../shared/mdText';
import { ChunkChips, FbErrorItem, FbPronItem, FluencyBar, HighlightTranscript } from './bits';
import { MAX_DRILL_ATTEMPTS } from './constants';

/*
 * Thẻ feedback chế độ LUYỆN PART 1: port #drillCard + renderDrillFeedback()
 * của speaking.html. Nhận kết quả đã phân loại từ ExamRunner:
 *   fb = { d, passed, capReached, attempt, isLast, fluency }
 * (d = response drillEvaluate: praise_vi, transcript, grammar_errors,
 *  pronunciation, model_answer, coach_script_en, passed, chunks)
 * Nâng cấp 07/2026: transcript tô lỗi tại chỗ, nghe lại giọng mình,
 * thước đo trôi chảy, chips cụm bỏ túi (tài liệu Teaching Speaking).
 */

const DrillPanel = ({ fb, onRetry, onNext, onHearModel, onPlayMine, hasMine, onSpeakChunk }) => {
  if (!fb) return null;
  const { d, passed, capReached, attempt, isLast, fluency } = fb;
  const grammar = d.grammar_errors || [];
  const pron = d.pronunciation || [];

  return (
    <div className="card card-body mt-4">
      {d.praise_vi ? (
        <p className="text-primary-hover font-semibold text-sm my-2">
          🌟 <MdBold text={d.praise_vi} />
        </p>
      ) : null}
      <FluencyBar stats={fluency} />
      <b className="text-[13px]">Em đã nói:</b>
      <HighlightTranscript text={d.transcript || ''} errors={grammar} pron={pron} />
      {hasMine && (
        <div className="flex flex-wrap items-center gap-2 my-1">
          <button
            type="button"
            onClick={onPlayMine}
            className="bg-white text-primary border-[1.5px] border-primary rounded-xl px-3.5 py-1.5 text-[12.5px] font-semibold hover:bg-primary-light transition-colors"
          >
            🎧 Nghe lại em nói
          </button>
          <span className="text-[11.5px] text-slate-400">
            Nghe mình trước, nghe mẫu sau, tự tìm 1 điểm khác nhau rồi mới nói lại.
          </span>
        </div>
      )}

      <div>
        {grammar.map((e, i) => (
          <FbErrorItem key={i} e={e} />
        ))}
      </div>
      <div>
        {pron.map((p, i) => (
          <FbPronItem key={i} p={p} />
        ))}
      </div>

      {d.model_answer ? (
        <div className="bg-primary-light rounded-xl p-3 text-sm my-2">
          <span className="block text-primary font-bold text-[11px] uppercase tracking-wide mb-1">
            ✍ Câu đúng để nói theo
          </span>
          <span>{d.model_answer}</span>
          <div>
            <button
              type="button"
              onClick={onHearModel}
              className="mt-2 bg-white text-primary border-[1.5px] border-primary rounded-xl px-3.5 py-1.5 text-[12.5px] font-semibold hover:bg-primary-light transition-colors"
            >
              🔊 Nghe đọc mẫu
            </button>
          </div>
        </div>
      ) : null}
      <ChunkChips chunks={d.chunks} onSpeak={onSpeakChunk} />

      {/* Kết luận: đạt / hết trần số lần / nói lại */}
      <div className="bg-[#FFF8E6] border border-amber-600 rounded-xl p-3 my-2.5 text-sm font-semibold">
        {passed ? (
          <>
            ✅ <b>Tốt! Câu này đã rõ ràng, không còn lỗi đáng kể.</b>
          </>
        ) : capReached ? (
          <>
            📌 <b>Em đã luyện câu này {MAX_DRILL_ATTEMPTS} lần.</b> Vẫn còn vài điểm cần luyện thêm, ghi nhớ mẫu
            câu đúng ở trên rồi sang câu tiếp nhé.
          </>
        ) : (
          <>
            🔁 <b>Nói lại cho đúng</b> theo mẫu giám khảo vừa đọc (lần {attempt}/{MAX_DRILL_ATTEMPTS}).
          </>
        )}
      </div>

      <div className="text-center flex flex-col sm:flex-row gap-3 justify-center mt-3">
        {!passed && !capReached ? (
          <button type="button" onClick={onRetry} className="btn-primary btn-lg">
            🎤 Đã hiểu · Nói lại
          </button>
        ) : (
          <button type="button" onClick={onNext} className="btn-primary btn-lg">
            {isLast ? 'Hoàn thành 🏁' : 'Câu tiếp theo →'}
          </button>
        )}
      </div>
    </div>
  );
};

export default DrillPanel;
