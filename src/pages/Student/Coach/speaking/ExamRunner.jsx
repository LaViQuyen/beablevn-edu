import React, { useEffect, useRef } from 'react';
import { MdBold } from '../shared/mdText';
import useSpeakingFlow from './useSpeakingFlow';
import { BandChips, BusyOverlay, ErrBox, FbErrorItem, FbPronItem, PartBadge, TranscriptBox } from './bits';
import DrillPanel from './DrillPanel';

/*
 * VÒNG THI (VIEW): port màn #screenExam + #fbCard + #overlay của speaking.html.
 * Toàn bộ logic luồng nằm trong useSpeakingFlow (cùng thư mục); file này chỉ vẽ
 * và nối nút bấm với hành động của hook.
 */

const fmt = (sec) => {
  if (sec == null) return '--:--';
  const s = Math.max(0, Number(sec) || 0);
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
};

const ExamRunner = (props) => {
  const { mode, queue } = props;
  const flow = useSpeakingFlow(props);
  const { qi, partIntro, timer, btns, error, feedback, drillFb, busy, finishRetry, elapsed, guard } = flow;
  const fbScrollRef = useRef(null);

  // Cuộn tới thẻ feedback khi vừa có kết quả (port scrollIntoView của gốc)
  useEffect(() => {
    if ((feedback || drillFb) && fbScrollRef.current) {
      fbScrollRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [feedback, drillFb]);

  const item = queue[qi];
  if (!item) return null;
  const progress = Math.round((qi / queue.length) * 100);
  const isLast = qi === queue.length - 1;
  const methodTips = feedback ? (feedback.method_tips || []).filter(Boolean) : [];

  return (
    <div className="max-w-3xl mx-auto">
      {/* Thanh tiến độ */}
      <div className="h-1.5 bg-[#E3EDE5] rounded overflow-hidden mb-3.5">
        <div className="h-1.5 bg-[#3D8B47] rounded transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      <div className="card card-body">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <PartBadge>{mode === 'drill' ? 'LUYỆN PART 1' : `PART ${item.part}`}</PartBadge>
            <span className="text-slate-500 text-[13px] ml-2.5">
              Câu {item.n}/{item.total}
            </span>
          </div>
          <span className="text-slate-500 text-[13px]">⏱ {elapsed}</span>
        </div>

        {partIntro && (
          <div className="bg-[#E8F4EC] rounded-xl px-3.5 py-2.5 mt-2.5 text-[13px] text-[#1E5225]">{partIntro}</div>
        )}

        {item.part === 2 ? (
          <>
            <div className="text-lg md:text-xl font-bold mt-4 mb-1.5 leading-snug">Part 2 · Cue card</div>
            <div className="bg-[#E8F4EC] border border-[#C9E2CF] rounded-xl px-4 py-3.5 my-3 text-[15px] md:text-base leading-relaxed">
              <b>
                <MdBold text={item.cue.topic} />
              </b>
              <br />
              You should say:
              <ul className="list-disc ml-6 my-2">
                {(item.cue.bullets || []).map((b, i) => (
                  <li key={i}>
                    <MdBold text={b} />
                  </li>
                ))}
              </ul>
              <i>
                <MdBold text={item.cue.closing} />
              </i>
            </div>
          </>
        ) : (
          <div className="text-lg md:text-[21px] font-bold mt-4 mb-1.5 leading-snug">
            <MdBold text={item.q} />
          </div>
        )}

        <div
          className={`text-center text-5xl font-extrabold my-2.5 ${
            timer.left != null && timer.left <= 10 ? 'text-red-600' : 'text-[#2B6830]'
          }`}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {fmt(timer.left)}
        </div>
        <p className="text-center text-slate-500 text-[13px] mb-2.5 min-h-[20px]">{timer.label}</p>

        <div className="flex flex-col sm:flex-row flex-wrap gap-3 justify-center items-center">
          {btns.record && (
            <button type="button" onClick={flow.startAnswer} className="btn-primary btn-lg w-full sm:w-auto">
              {btns.record}
            </button>
          )}
          {btns.stop && (
            <button type="button" onClick={flow.stopAnswer} className="btn-primary btn-lg w-full sm:w-auto">
              <span className="inline-block w-3 h-3 rounded-full bg-red-400 animate-pulse" />
              Xong
            </button>
          )}
          {btns.resend && (
            <button type="button" onClick={flow.sendEval} className="btn-primary btn-lg w-full sm:w-auto">
              🔄 Gửi chấm lại
            </button>
          )}
          {btns.speakAgain && (
            <button type="button" onClick={flow.speakAgainNow} className="btn-outline btn-sm">
              🔊 Đọc lại câu hỏi
            </button>
          )}
        </div>

        <ErrBox msg={error} />

        {finishRetry && (
          <div className="text-center mt-3.5">
            <button type="button" onClick={flow.finishTest} className="btn-primary btn-lg">
              🔄 Thử tổng kết lại
            </button>
          </div>
        )}
      </div>

      <div ref={fbScrollRef}>
        {/* Feedback (chỉ chế độ Luyện tập), port #fbCard + renderFeedback() */}
        {feedback && (
          <div className="card card-body mt-4">
            <BandChips bands={feedback.bands} />
            {feedback.praise ? (
              <p className="text-[#1E5225] font-semibold text-sm my-2">
                <MdBold text={feedback.praise} />
              </p>
            ) : null}
            <b className="text-[13px]">Em đã nói:</b>
            <TranscriptBox>{feedback.no_speech ? `(${feedback.no_speech})` : feedback.transcript || ''}</TranscriptBox>
            <div>
              {(feedback.errors || []).map((e, i) => (
                <FbErrorItem key={i} e={e} />
              ))}
            </div>
            <div>
              {(feedback.pronunciation || []).map((p, i) => (
                <FbPronItem key={i} p={p} />
              ))}
            </div>
            {feedback.upgrade ? (
              <div className="bg-[#E8F4EC] rounded-xl p-3 text-sm my-2">
                💡 <b>Câu mẫu hay hơn:</b> <MdBold text={feedback.upgrade} />
              </div>
            ) : null}
            {methodTips.length > 0 && (
              <div className="bg-[#F2F8F4] border border-[#C9E2CF] border-l-[3px] border-l-[#3D8B47] rounded-r-xl px-3.5 py-3 my-2.5 text-sm">
                <div className="font-bold text-[#1E5225] text-xs uppercase tracking-wide mb-1.5">
                  📐 Theo phương pháp Be Able · Part {item.part}
                </div>
                {methodTips.map((t, i) => (
                  <div key={i} className="my-1 leading-relaxed">
                    ▸ <MdBold text={t} />
                  </div>
                ))}
              </div>
            )}
            {feedback._attempt === 2 ? (
              <div className="bg-[#FFF8E6] border border-amber-600 rounded-xl p-3 my-2.5 text-sm font-semibold">
                {feedback.improved ? '✅ ' : '📌 '}
                <MdBold text={feedback.retry_comment || 'Đã ghi nhận lần nói lại.'} />
              </div>
            ) : feedback.need_retry && feedback.retry_focus ? (
              <div className="bg-[#FFF8E6] border border-amber-600 rounded-xl p-3 my-2.5 text-sm font-semibold">
                🔁 <b>Nói lại để sửa:</b> <MdBold text={feedback.retry_focus} />
              </div>
            ) : null}
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-3">
              {feedback._attempt !== 2 && feedback.need_retry && feedback.retry_focus ? (
                <button type="button" onClick={flow.retryAnswer} className="btn-primary btn-lg">
                  🔁 Nói lại câu này
                </button>
              ) : null}
              <button type="button" onClick={flow.advance} className="btn-outline btn-lg">
                {isLast ? 'Hoàn thành, xem kết quả 🏁' : 'Câu tiếp theo →'}
              </button>
            </div>
          </div>
        )}

        {/* Feedback (chỉ chế độ Luyện Part 1) */}
        <DrillPanel fb={drillFb} onRetry={flow.drillRetry} onNext={flow.advance} onHearModel={flow.hearModel} />
      </div>

      <BusyOverlay show={busy} />

      {/* Overlay cảnh báo / yêu cầu toàn màn hình (chỉ chế độ Thi thật) */}
      {guard.overlay && (
        <div className="fixed inset-0 bg-black/80 z-[9999] flex items-start justify-center p-4">
          <div className="bg-white max-w-md w-full mt-[16vh] rounded-2xl p-7 text-center">
            {guard.overlay.kind === 'fs' ? (
              <>
                <h2 className="text-xl font-extrabold text-red-600">🖥 Cần mở toàn màn hình</h2>
                <p className="my-4 text-sm leading-relaxed text-slate-700">
                  Bài thi phải chạy ở chế độ <b>toàn màn hình</b> để đảm bảo công bằng như phòng thi thật.
                </p>
                <button type="button" onClick={guard.confirmOverlay} className="btn-primary btn-lg">
                  Mở toàn màn hình &amp; tiếp tục
                </button>
              </>
            ) : (
              <>
                <h2 className="text-xl font-extrabold text-red-600">⚠️ Cảnh báo vi phạm quy chế thi</h2>
                <p className="my-4 text-sm leading-relaxed text-slate-700">
                  Hệ thống phát hiện vừa <b>rời khỏi màn hình thi</b> ({guard.overlay.violKind}).
                  <br />
                  <b className="text-red-600">Nếu tái diễn lần thứ 2, bài thi sẽ bị ĐÌNH CHỈ</b> và biên bản được
                  tải về.
                </p>
                <button type="button" onClick={guard.confirmOverlay} className="btn-primary btn-lg">
                  Tôi hiểu, quay lại bài thi
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamRunner;
