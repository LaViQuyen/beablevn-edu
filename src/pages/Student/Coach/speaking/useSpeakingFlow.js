import { useEffect, useRef, useState } from 'react';
import { callCoach } from '../shared/coachApi';
import { speak, stopVoice } from '../shared/speak';
import useRecorder from '../shared/useRecorder';
import useExamGuard from '../shared/useExamGuard';
import downloadIncidentReport from './incidentReport';
import {
  ACKS,
  DRILL_INTRO,
  DRILL_SILENCE_MS,
  MAX_DRILL_ATTEMPTS,
  PART_INTRO,
  SILENCE_MS,
  answerTime,
  prepTime,
  speechFor,
} from './constants';

/*
 * BỘ MÁY VÒNG THI: port toàn bộ luồng renderQuestion/startPrep/startAnswer/
 * uploadAnswer/sendEval/sendDrillEval/renderDrillFeedback/finishTest của
 * speaking.html cho cả 3 chế độ practice | drill | exam. ExamRunner.jsx chỉ vẽ.
 *
 * Mọi trạng thái luồng (qi, attempt, evaluations, pending audio...) nằm trong
 * useRef vì được đọc/ghi từ callback bất đồng bộ (speak, timer, recorder).
 * genRef = "thế hệ" luồng: mỗi lần đổi câu / dọn dẹp thì tăng lên, callback cũ
 * so gen thấy lệch là tự bỏ, chống StrictMode double-mount và callback trễ.
 */

export default function useSpeakingFlow({
  mode,
  queue,
  targetBand,
  topicLabel,
  studentName,
  onReport,
  onDrillDone,
  onBanned,
  showToast,
}) {
  // ---- state hiển thị ----
  const [qi, setQi] = useState(0);
  const [partIntro, setPartIntro] = useState(null);
  const [timer, setTimer] = useState({ left: null, label: '' });
  const [btns, setBtns] = useState({}); // { record: label|false, stop, resend, speakAgain }
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState(null); // response evaluate (chỉ Luyện tập)
  const [drillFb, setDrillFb] = useState(null); // { d, passed, capReached, attempt, isLast }
  const [busy, setBusy] = useState(false);
  const [finishRetry, setFinishRetry] = useState(false);
  const [elapsed, setElapsed] = useState('00:00');

  // ---- trạng thái luồng (mutable, đọc từ callback) ----
  const genRef = useRef(0);
  const qiRef = useRef(0);
  const attemptRef = useRef(1);
  const lastFeedbackRef = useRef(null);
  const drillPrevRef = useRef(null);
  const drillModelRef = useRef('');
  const drillStatsRef = useRef({ done: 0, cleanFirst: 0 });
  const evaluationsRef = useRef([]);
  const pendingAudioRef = useRef(null);
  const timerIdRef = useRef(null);
  const frozenRef = useRef(false);
  const begunRef = useRef(false);

  const recorder = useRecorder();

  // ---- Giám sát gian lận (chỉ Thi thật), đình chỉ = port banTest() ----
  function banTest(violLog, violations) {
    genRef.current += 1;
    frozenRef.current = true;
    stopTimer();
    stopVoice();
    recorder.abort();
    setBusy(false);
    downloadIncidentReport(studentName, evaluationsRef.current, violLog, violations);
    exitFullscreenQuiet();
    onBanned();
  }
  const guard = useExamGuard({
    getWhere: () => {
      const it = queue[qiRef.current] || {};
      return 'Part ' + (it.part || '?') + ' câu ' + (it.n || '?');
    },
    onBan: banTest,
  });

  function exitFullscreenQuiet() {
    try {
      if (document.fullscreenElement) {
        const p = document.exitFullscreen();
        if (p && p.catch) p.catch(() => {});
      }
    } catch (e) {
      /* bỏ qua */
    }
  }

  // ---- Đồng hồ đếm (tạm dừng khi overlay cảnh báo mở, như gốc) ----
  function stopTimer() {
    if (timerIdRef.current) {
      clearInterval(timerIdRef.current);
      timerIdRef.current = null;
    }
  }
  function runTimer(sec, label, onDone) {
    stopTimer();
    setTimer({ left: sec, label });
    const gen = genRef.current;
    let left = sec;
    timerIdRef.current = setInterval(() => {
      if (gen !== genRef.current) {
        stopTimer();
        return;
      }
      if (guard.overlayOpenRef.current) return;
      left -= 1;
      setTimer({ left, label });
      if (left <= 0) {
        stopTimer();
        onDone();
      }
    }, 1000);
  }

  // ---- Hiện câu hỏi ----
  function renderQuestion(i) {
    genRef.current += 1;
    const gen = genRef.current;
    const item = queue[i];
    qiRef.current = i;
    setQi(i);
    attemptRef.current = 1;
    lastFeedbackRef.current = null;
    drillPrevRef.current = null;
    setFeedback(null);
    setDrillFb(null);
    setError('');
    setFinishRetry(false);
    setBtns({});
    setTimer({ left: prepTime(item, mode), label: '🔊 Giám khảo đang đọc câu hỏi...' });
    const readQuestion = () =>
      speak(speechFor(item), () => {
        if (gen === genRef.current) startPrep(item);
      });
    if (mode === 'drill') {
      // Luyện Part 1: chỉ giới thiệu MỘT lần ở câu đầu, sau đó đọc thẳng câu hỏi
      if (i === 0) {
        setPartIntro(DRILL_INTRO.vi);
        speak(DRILL_INTRO.en, () => {
          if (gen === genRef.current) readQuestion();
        });
      } else {
        setPartIntro(null);
        readQuestion();
      }
      return;
    }
    const isNewPart = i === 0 || queue[i - 1].part !== item.part;
    if (isNewPart) {
      setPartIntro(PART_INTRO[item.part].vi);
      speak(PART_INTRO[item.part].en, () => {
        if (gen === genRef.current) readQuestion();
      });
    } else {
      setPartIntro(null);
      readQuestion();
    }
  }

  function startPrep(item) {
    setBtns({ record: '🎤 Nói ngay', speakAgain: true });
    const prep = prepTime(item, mode);
    runTimer(prep, `Chuẩn bị (${prep} giây), hết giờ sẽ tự động thu âm`, () => startAnswer());
  }

  function speakAgainNow() {
    const it = queue[qiRef.current];
    if (it) speak(speechFor(it));
  }

  // ---- Thu âm ----
  async function startAnswer() {
    const item = queue[qiRef.current];
    stopTimer();
    stopVoice();
    const gen = genRef.current;
    // Tự kết thúc khi im lặng: Luyện Part 1 im >3s; Thi thật (Part 1&3) im >5s
    const silenceMs = mode === 'drill' ? DRILL_SILENCE_MS : mode === 'exam' && item.part !== 2 ? SILENCE_MS : null;
    setError('');
    try {
      await recorder.start({
        silenceMs,
        onAutoStop: () => {
          if (gen !== genRef.current) return;
          stopTimer();
          setBtns({});
          setTimer((t) => ({
            ...t,
            label:
              mode === 'drill'
                ? '⏹ Đã ngừng hơn 3 giây, kết thúc câu trả lời.'
                : '⏭ Đã dừng hơn 5 giây, chuyển câu tiếp theo.',
          }));
        },
        onResult: (res) => {
          if (gen !== genRef.current) return;
          stopTimer();
          handleAudio(res);
        },
        onError: (e) => {
          if (gen !== genRef.current) return;
          stopTimer();
          setError(e.message);
          setBtns({ record: '🎤 Thu âm lại' });
        },
      });
    } catch (e) {
      setError('Không truy cập được micro.');
      setBtns({ record: '🎤 Nói ngay', speakAgain: true });
      return;
    }
    if (gen !== genRef.current) {
      recorder.abort();
      return;
    }
    setBtns({ stop: true });
    runTimer(answerTime(item, mode), 'Đang thu âm: nói to, rõ ràng', () => recorder.stop());
  }

  function stopAnswer() {
    stopTimer();
    setBtns({});
    recorder.stop(); // onResult sẽ chạy handleAudio
  }

  // ---- Nhận audio → quyết định chấm (port uploadAnswer) ----
  function handleAudio({ b64, mime, size, voicedMs, voiceMeterOk }) {
    const item = queue[qiRef.current];
    const hasData = size >= 1000; // thực sự có dữ liệu âm thanh
    const spoke = voiceMeterOk ? voicedMs >= 500 : hasData; // có ít nhất ~0.5s giọng nói
    if (!hasData || !spoke) {
      if (mode === 'exam') {
        // Thi thật: không nói → ghi nhận trống & đi tiếp, không chặn
        evaluationsRef.current.push({
          part: item.part, question: item.q, attempt: attemptRef.current,
          bands: null, transcript_excerpt: '', note: 'no_answer',
        });
        advance();
        return;
      }
      // Luyện tập & Luyện Part 1: KHÔNG chấm khi không có giọng nói; thu lại (không tính lần thử)
      setError('Chưa nghe thấy giọng nói của em, bấm Thu âm và trả lời lại nhé.');
      setBtns({ record: '🎤 Thu âm lại' });
      return;
    }
    speak(ACKS[Math.floor(Math.random() * ACKS.length)]);
    pendingAudioRef.current = { b64, mime, voicedMs: voiceMeterOk ? Math.round(voicedMs) : null };
    if (mode === 'drill') sendDrillEval();
    else sendEval();
  }

  // ---- Gửi chấm (Luyện tập & Thi thật) ----
  async function sendEval() {
    const pa = pendingAudioRef.current;
    if (!pa) return;
    const item = queue[qiRef.current];
    const gen = genRef.current;
    setBtns({});
    setBusy(true);
    setError('');
    try {
      const d = await callCoach('speaking', 'evaluate', {
        audio_b64: pa.b64, mime: pa.mime,
        part: item.part, question: item.q, cue_card: item.cue || null,
        target_band: targetBand, attempt: attemptRef.current,
        voiced_ms: pa.voicedMs, // thời lượng giọng nói thực đo được (null nếu máy đo hỏng)
        prev_feedback: attemptRef.current === 2 ? lastFeedbackRef.current : null,
      });
      if (gen !== genRef.current) return;
      evaluationsRef.current.push({
        part: item.part, question: item.q, attempt: attemptRef.current,
        bands: d.bands, errors: d.errors, pronunciation: d.pronunciation,
        improved: d.improved, transcript_excerpt: (d.transcript || '').slice(0, 1500),
      });
      pendingAudioRef.current = null;
      setBusy(false);
      if (mode === 'exam') {
        // Thi thật: KHÔNG hiện feedback, đi thẳng câu tiếp / tổng kết
        advance();
      } else {
        lastFeedbackRef.current = { errors: d.errors, pronunciation: d.pronunciation, retry_focus: d.retry_focus };
        setFeedback({ ...d, _attempt: attemptRef.current });
      }
    } catch (e) {
      if (gen !== genRef.current) return;
      setBusy(false);
      if (e.code === 'functions/resource-exhausted') showToast(e.message);
      if (mode === 'exam') {
        // Thi thật: lỗi chấm 1 câu KHÔNG được chặn thi, ghi nhận trống & đi tiếp
        evaluationsRef.current.push({
          part: item.part, question: item.q, attempt: attemptRef.current,
          bands: null, transcript_excerpt: '', note: 'eval_failed',
        });
        pendingAudioRef.current = null;
        advance();
        return;
      }
      setError(e.message);
      setBtns({ resend: true, record: '🎤 Thu âm lại' });
    }
  }

  function retryAnswer() {
    attemptRef.current = 2;
    setFeedback(null);
    setBtns({});
    setTimer((t) => ({ ...t, label: "🔊 Giám khảo: Let's try that again..." }));
    const gen = genRef.current;
    speak("Alright, let's try that again, please.", () => {
      if (gen === genRef.current) startAnswer();
    });
  }

  // ---- Luyện Part 1: gửi chấm + vòng nói lại ----
  async function sendDrillEval() {
    const pa = pendingAudioRef.current;
    if (!pa) return;
    const item = queue[qiRef.current];
    const gen = genRef.current;
    setBtns({});
    setBusy(true);
    setError('');
    try {
      const d = await callCoach('speaking', 'drillEvaluate', {
        audio_b64: pa.b64, mime: pa.mime,
        question: item.q, target_band: targetBand, attempt: attemptRef.current,
        // Từ lần 2: gửi lỗi đã chỉ ở lần trước để giám khảo bám đúng + nới dần
        prev_errors: drillPrevRef.current ? drillPrevRef.current.grammar_errors : null,
        prev_pron: drillPrevRef.current ? drillPrevRef.current.pronunciation : null,
      });
      if (gen !== genRef.current) return;
      pendingAudioRef.current = null;
      setBusy(false);
      renderDrillFeedback(d);
    } catch (e) {
      if (gen !== genRef.current) return;
      setBusy(false);
      if (e.code === 'functions/resource-exhausted') showToast(e.message);
      setError(e.message);
      setBtns({ record: '🎤 Thu âm lại' });
    }
  }

  function renderDrillFeedback(d) {
    const item = queue[qiRef.current];
    // Im lặng / quá ngắn: báo nói lại, KHÔNG tính vào số lần thử
    if (d.no_speech) {
      setDrillFb(null);
      setError(d.no_speech);
      setBtns({ record: '🎤 Nói lại' });
      return;
    }
    const grammar = d.grammar_errors || [];
    const pron = d.pronunciation || [];
    // "Đạt" = model báo passed, hoặc không còn lỗi ngữ pháp/phát âm nào
    const passed = !!d.passed || (grammar.length === 0 && pron.length === 0);
    const capReached = attemptRef.current >= MAX_DRILL_ATTEMPTS;
    drillPrevRef.current = { grammar_errors: grammar, pronunciation: pron };
    drillModelRef.current = d.model_answer || '';
    if (passed) {
      drillStatsRef.current.done += 1;
      if (attemptRef.current === 1) drillStatsRef.current.cleanFirst += 1;
      speak("Well done. That was clear. Let's move on.");
    } else if (capReached) {
      // Hết trần số lần → nới ra, cho qua kèm ghi chú (tránh kẹt mãi)
      drillStatsRef.current.done += 1;
      if (d.coach_script_en) speak(d.coach_script_en);
    } else if (d.coach_script_en) {
      speak(d.coach_script_en);
    }
    if (passed || capReached) {
      // Ghi lại kết quả câu này để cuối phiên lưu lịch sử qua finalReport
      evaluationsRef.current.push({
        part: 1, question: item.q, attempt: attemptRef.current, passed,
        transcript_excerpt: (d.transcript || '').slice(0, 1500),
      });
    }
    setBtns({});
    setDrillFb({ d, passed, capReached, attempt: attemptRef.current, isLast: qiRef.current === queue.length - 1 });
  }

  function hearModel() {
    if (drillModelRef.current) speak(drillModelRef.current);
  }

  function drillRetry() {
    attemptRef.current += 1; // tính thêm một lần thử
    setDrillFb(null);
    setBtns({});
    setTimer((t) => ({ ...t, label: "🔊 Giám khảo: Let's try that again..." }));
    const gen = genRef.current;
    speak("Alright, let's try that again.", () => {
      if (gen === genRef.current) startAnswer();
    });
  }

  // ---- Câu tiếp / kết thúc ----
  function advance() {
    if (qiRef.current === queue.length - 1) {
      if (mode === 'drill') finishDrill();
      else finishTest();
      return;
    }
    renderQuestion(qiRef.current + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function finishDrill() {
    frozenRef.current = true;
    genRef.current += 1;
    stopTimer();
    stopVoice();
    const stats = { ...drillStatsRef.current, total: queue.length };
    // Server tự lưu lịch sử phiên qua finalReport → gọi nền, không chặn màn hoàn thành
    callCoach('speaking', 'finalReport', {
      evaluations: evaluationsRef.current,
      target_band: targetBand,
      meta: { mode: 'drill', topic: topicLabel || '', drillStats: stats },
    }).catch(() => {});
    speak("Great job. You've finished this Part One practice set.");
    onDrillDone(stats);
    window.scrollTo({ top: 0 });
  }

  async function finishTest() {
    if (mode === 'exam') guard.end(); // hết bài → tắt giám sát gian lận
    exitFullscreenQuiet();
    frozenRef.current = true;
    genRef.current += 1;
    stopTimer();
    setFeedback(null);
    setDrillFb(null);
    setBtns({});
    setFinishRetry(false);
    setError('');
    setBusy(true);
    speak('Thank you. That is the end of the speaking test.');
    try {
      const d = await callCoach('speaking', 'finalReport', {
        evaluations: evaluationsRef.current,
        target_band: targetBand,
        meta: { mode, topic: topicLabel || '' },
      });
      setBusy(false);
      onReport(d);
    } catch (e) {
      setBusy(false);
      if (e.code === 'functions/resource-exhausted') showToast(e.message);
      setError('Tổng kết lỗi: ' + e.message);
      setFinishRetry(true);
    }
  }

  // ---- Khởi động luồng + cleanup (StrictMode-safe nhờ begunRef reset + genRef) ----
  useEffect(() => {
    if (!begunRef.current) {
      begunRef.current = true;
      if (mode === 'exam') guard.begin(); // bật giám sát; chặn ngay nếu chưa fullscreen
      renderQuestion(0);
    }
    return () => {
      begunRef.current = false;
      genRef.current += 1;
      stopTimer();
      stopVoice();
      if (mode === 'exam') guard.end();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Đồng hồ tổng thời gian làm bài (đóng băng khi đã sang tổng kết, như gốc)
  useEffect(() => {
    const startedAt = Date.now();
    const iv = setInterval(() => {
      if (frozenRef.current) return;
      const s = Math.floor((Date.now() - startedAt) / 1000);
      setElapsed(String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'));
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  return {
    // trạng thái hiển thị + hành động (gắn vào nút)
    qi, partIntro, timer, btns, error, feedback, drillFb, busy, finishRetry, elapsed, guard,
    startAnswer, stopAnswer, sendEval, retryAnswer, drillRetry, hearModel, advance, finishTest, speakAgainNow,
  };
}
