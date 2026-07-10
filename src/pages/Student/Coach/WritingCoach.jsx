import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, Toast } from '../../../components/UI';
import { useAuth } from '../../../context/AuthContext';
import { callCoach } from './shared/coachApi';
import { MdBold } from './shared/mdText';

/*
 * WRITING COACH: port từ tools/writing/templates/writing.html (Coach Suite Flask)
 * sang trang React trong app EDU. Luồng gốc GIỮ NGUYÊN:
 *   Chọn chủ đề → hỏi Socratic (tối đa 3 câu) → chốt 2 ý (nguyên nhân/hệ quả)
 *   → leo thang 7 bậc nâng band → màn tổng kết.
 * Khác bản gốc:
 *   - Bỏ login/mode/warmup riêng của tool (đã đăng nhập EDU; warmUp gọi ở CoachHome).
 *   - Bỏ nhập tên học viên (lấy từ tài khoản EDU khi lưu lịch sử).
 *   - Xuất file .docx → thay bằng saveSession: server lưu vào Lịch sử luyện tập.
 *   - Guard rời màn hình GIỮ (2 lần cảnh báo, lần 3 kết thúc) nhưng chỉ kích hoạt
 *     khi bấm "Bắt đầu luyện" (user gesture); máy không hỗ trợ fullscreen (mobile)
 *     thì không ép fullscreen, chỉ đếm vi phạm rời tab/ứng dụng.
 */

const TOPICS = [
  'Consumerism & spending habits', 'Social media & technology', 'Environment & pollution',
  'Education & schooling', 'Health & lifestyle', 'Work & employment', 'Crime & society',
  'Urbanisation & city life', 'Family & relationships', 'Advertising & media',
  'Globalisation & culture', 'Transport & traffic',
];

const STEP_ORDER = { topic: 0, socratic: 1, ideas: 2, ladder: 3, done: 4 };

// Màu nhãn 4 loại lỗi (giữ đúng bảng màu template gốc)
const ISSUE_COLORS = {
  semantics: '#6B3FA0',
  pragmatics: '#0B6E8A',
  grammar: '#1E5225',
  coherence: '#7A5C00',
};

// Chuẩn hóa câu để chống nộp y nguyên (giống _norm của bản gốc)
const norm = (x) => (x || '')
  .toLowerCase()
  .replace(/[.,;:!?'"“”‘’]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

/* ---------- fullscreen helpers (giống bản gốc, thêm kiểm tra hỗ trợ) ---------- */
const fsSupported = () => {
  const el = document.documentElement;
  return !!(el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen);
};
const enterFullscreen = () => {
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
  if (req) {
    try {
      return Promise.resolve(req.call(el)).catch(() => {});
    } catch (_) { /* trình duyệt từ chối thì thôi */ }
  }
  return Promise.resolve();
};
const exitFullscreen = () => {
  if (document.fullscreenElement || document.webkitFullscreenElement) {
    const ex = document.exitFullscreen || document.webkitExitFullscreen;
    if (ex) {
      try { ex.call(document); } catch (_) { /* bỏ qua */ }
    }
  }
};
const isFs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);

/* ---------- UI phụ ---------- */
const Spin = () => (
  <span className="inline-block w-4 h-4 border-[3px] border-[#3D8B47] border-t-transparent rounded-full animate-spin shrink-0" />
);
const Loading = ({ text }) => (
  <span className="inline-flex items-center gap-2 text-slate-500 text-sm">
    <Spin />
    {text}
  </span>
);

const CALLOUT_TONES = {
  green: 'bg-[#E8F4EC] border-[#2B6830]',
  warn: 'bg-[#FCEEE8] border-[#C0392B]',
  gold: 'bg-[#F2F8F4] border-[#B8860B]',
};
const Callout = ({ tone = 'green', className = '', children }) => (
  <div className={`border-l-4 rounded-lg px-4 py-3 text-[14.5px] leading-relaxed ${CALLOUT_TONES[tone] || CALLOUT_TONES.green} ${className}`}>
    {children}
  </div>
);

const FieldLabel = ({ children, className = '' }) => (
  <label className={`block text-[13px] font-semibold text-[#1E5225] mb-1.5 ${className}`}>{children}</label>
);

const BandPill = ({ children, gold = false }) => (
  <span className={`inline-block text-[13px] font-bold text-white px-3 py-1 rounded-full whitespace-nowrap ${gold ? 'bg-[#B8860B]' : 'bg-[#2B6830]'}`}>
    {children}
  </span>
);

const WritingCoach = () => {
  const { currentUser } = useAuth();

  /* ---------- state phiên (cục bộ, mất khi rời trang như bản gốc) ---------- */
  const [screen, setScreen] = useState('topic'); // topic|socratic|ideas|ladder|done
  const [toast, setToast] = useState(null);

  // Bước 1: chủ đề
  const [selTopic, setSelTopic] = useState('');
  const [customTopic, setCustomTopic] = useState('');
  const [starting, setStarting] = useState(false);
  const [topic, setTopic] = useState('');

  // Thang bậc (chỉ để hiển thị, lấy từ server như /api/levels bản gốc)
  const [levels, setLevels] = useState([]);
  const levelsOnceRef = useRef(false);

  // Bước 2: Socratic
  const [qa, setQa] = useState([]);
  const [qCount, setQCount] = useState(0);
  const [curQ, setCurQ] = useState(null); // {en, vi, guide, example}
  const [answer, setAnswer] = useState('');
  const [qLoading, setQLoading] = useState(false);
  const [socErr, setSocErr] = useState('');
  const ansRef = useRef(null);

  // Bước 3: hai ý
  const [cause, setCause] = useState('');
  const [effect, setEffect] = useState('');
  const [base, setBase] = useState('');
  const [studentLevel, setStudentLevel] = useState('5.5');
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [ideasErr, setIdeasErr] = useState('');

  // Bước 4: thang nâng band
  const [levelIdx, setLevelIdx] = useState(0);
  const [journey, setJourney] = useState([]);
  const [sentence, setSentence] = useState('');
  const [gradeLoading, setGradeLoading] = useState(false);
  const [feedback, setFeedback] = useState(null); // {lazy:true} | {error} | {r, sentence}
  const [intro, setIntro] = useState({ loading: false, error: '', data: null });
  const introCacheRef = useRef({}); // cache hướng dẫn theo "bậc@trình độ" như bản gốc
  const writeRef = useRef(null);

  // Bước 5: lưu lịch sử
  const [saveState, setSaveState] = useState('idle'); // idle|saving|ok|error
  const [saveErr, setSaveErr] = useState('');
  const summaryRef = useRef(null);

  // Guard rời màn hình: mutable state trong ref vì listener là toàn cục
  const guardRef = useRef({ on: false, usedFs: false, strikes: 0, lastAt: 0 });
  const [guardOverlay, setGuardOverlay] = useState(null); // {kind:'warn', n} | {kind:'lock'}

  const effectiveTopic = (customTopic.trim() || selTopic).trim();
  const totalLevels = levels.length || 7;
  const L = levels[levelIdx] || { title: `Bậc ${levelIdx + 1}`, band: '', high: false };
  const prevSentence = journey.length ? (journey[journey.length - 1]?.sentence || base) : base;

  /* ---------- effects ---------- */

  // Toast tự ẩn
  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  // Nạp thang bậc một lần khi mở trang (StrictMode-safe bằng ref guard)
  useEffect(() => {
    if (levelsOnceRef.current) return;
    levelsOnceRef.current = true;
    callCoach('writing', 'getLevels', {})
      .then((r) => {
        const arr = Array.isArray(r) ? r : (r && Array.isArray(r.levels) ? r.levels : []);
        if (arr.length) setLevels(arr);
      })
      .catch(() => {}); // im lặng; sẽ thử lại khi bấm Bắt đầu
  }, []);

  // Listener giám sát rời màn hình: gắn 1 lần, chỉ hoạt động khi guardRef.on
  useEffect(() => {
    let blurTimer = null;
    const registerLeave = () => {
      const g = guardRef.current;
      if (!g.on) return;
      const now = Date.now();
      if (now - g.lastAt < 1200) return; // chống đếm trùng (blur + visibility bắn đôi)
      g.lastAt = now;
      g.strikes += 1;
      if (g.strikes >= 3) {
        g.on = false;
        exitFullscreen();
        setGuardOverlay({ kind: 'lock' });
      } else {
        setGuardOverlay({ kind: 'warn', n: g.strikes });
      }
    };
    // Rời fullscreen chỉ tính khi phiên này có ép fullscreen (desktop)
    const onFsChange = () => {
      if (guardRef.current.on && guardRef.current.usedFs && !isFs()) registerLeave();
    };
    // Thu nhỏ cửa sổ / ẩn tab / chuyển app trên mobile
    const onVis = () => {
      if (guardRef.current.on && document.hidden) registerLeave();
    };
    // Alt-tab: chờ 400ms rồi kiểm tra thật sự mất focus
    const onBlur = () => {
      if (blurTimer) clearTimeout(blurTimer);
      blurTimer = setTimeout(() => {
        if (guardRef.current.on && !document.hasFocus() && !document.hidden) registerLeave();
      }, 400);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onBlur);
      if (blurTimer) clearTimeout(blurTimer);
      guardRef.current.on = false;
      exitFullscreen();
    };
  }, []);

  // Cuộn lên đầu khi đổi màn hình (giống show() của bản gốc)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [screen]);

  // Focus ô trả lời khi có câu hỏi mới
  useEffect(() => {
    if (screen === 'socratic' && curQ) ansRef.current?.focus();
  }, [screen, curQ]);

  /* ---------- helpers gọi API ---------- */

  const fetchLevels = async () => {
    const r = await callCoach('writing', 'getLevels', {});
    const arr = Array.isArray(r) ? r : (r && Array.isArray(r.levels) ? r.levels : []);
    if (arr.length) setLevels(arr);
    return arr;
  };

  const toastQuota = (e) => {
    if (e && e.code === 'functions/resource-exhausted') {
      setToast({ message: e.message, type: 'error' });
    }
  };

  /* ---------- Bước 2: Socratic ---------- */

  const askNext = async (t, qaList, count) => {
    setQLoading(true);
    setSocErr('');
    try {
      const r = await callCoach('writing', 'nextQuestion', { topic: t, qa: qaList, qCount: count });
      if ((r.specific_enough && count >= 1) || count >= 3) {
        await doExtract(t, qaList);
        return;
      }
      setCurQ({
        en: r.question_en || '',
        vi: r.question_vi || '',
        guide: r.guide_vi || '',
        example: r.example_answer || '',
      });
      setQCount(count + 1);
      setAnswer('');
    } catch (e) {
      toastQuota(e);
      setSocErr(e.message);
    } finally {
      setQLoading(false);
    }
  };

  const sendAnswer = async () => {
    const a = answer.trim();
    if (!a) {
      setToast({ message: 'Hãy viết câu trả lời trước.', type: 'warning' });
      return;
    }
    if (!curQ || qLoading) return;
    const newQa = [...qa, { q: curQ.en, a }];
    setQa(newQa);
    setCurQ(null); // hộp câu hỏi chuyển sang trạng thái "Đang phân tích câu trả lời..."
    await askNext(topic, newQa, qCount);
  };

  /* ---------- Bước 3: trích ý ---------- */

  const doExtract = async (t, qaList) => {
    setScreen('ideas');
    setIdeasLoading(true);
    setIdeasErr('');
    try {
      const r = await callCoach('writing', 'extractIdeas', { topic: t, qa: qaList });
      setCause(r.cause || '');
      setEffect(r.effect || '');
      setBase(r.base_sentence || '');
      if (r.student_level) {
        const n = String(r.student_level).replace(/[^0-9.]/g, '');
        setStudentLevel(n || '5.5');
      }
    } catch (e) {
      toastQuota(e);
      setIdeasErr(e.message);
    }
    setIdeasLoading(false);
  };

  /* ---------- Bước 4: thang nâng band ---------- */

  const loadIntro = async (idx, lvl) => {
    const key = `${idx}@${lvl}`;
    const cached = introCacheRef.current[key];
    if (cached) {
      setIntro({ loading: false, error: '', data: cached });
      return;
    }
    setIntro({ loading: true, error: '', data: null });
    try {
      const r = await callCoach('writing', 'levelIntro', {
        levelIdx: idx, studentLevel: lvl, cause, effect,
      });
      introCacheRef.current[key] = r;
      setIntro({ loading: false, error: '', data: r });
    } catch (e) {
      toastQuota(e);
      setIntro({ loading: false, error: e.message, data: null });
    }
  };

  const startLadder = () => {
    setLevelIdx(0);
    setJourney([]);
    introCacheRef.current = {};
    setSentence('');
    setFeedback(null);
    setScreen('ladder');
    loadIntro(0, studentLevel);
  };

  const gradeSentence = async () => {
    const s = sentence.trim();
    if (!s) {
      setToast({ message: 'Hãy viết câu của bạn.', type: 'warning' });
      return;
    }
    // Chống lười: KHÔNG cho nộp y nguyên câu xuất phát / câu gốc (giống bản gốc)
    if (norm(s) === norm(prevSentence) || norm(s) === norm(base)) {
      setFeedback({ lazy: true });
      writeRef.current?.focus();
      return;
    }
    setGradeLoading(true);
    try {
      const r = await callCoach('writing', 'grade', {
        levelIdx, studentLevel, cause, effect, base, sentence: s,
      });
      if (r.band_estimate) {
        const n = String(r.band_estimate).replace(/[^0-9.]/g, '');
        if (n) setStudentLevel(n);
      }
      if (r.passed) {
        setJourney((old) => {
          const nj = [...old];
          nj[levelIdx] = { level_title: L.title, band: r.band_estimate, sentence: s, passed: true };
          return nj;
        });
      }
      setFeedback({ r, sentence: s });
    } catch (e) {
      toastQuota(e);
      setFeedback({ error: e.message });
    }
    setGradeLoading(false);
  };

  const retryLevel = () => {
    setFeedback(null);
    writeRef.current?.focus();
  };

  const goNextLevel = () => {
    const ni = levelIdx + 1;
    setLevelIdx(ni);
    setSentence('');
    setFeedback(null);
    loadIntro(ni, studentLevel);
  };

  const useModelAndNext = () => {
    const r = feedback?.r;
    if (!r) return;
    const nj = [...journey];
    nj[levelIdx] = {
      level_title: L.title,
      band: r.band_estimate || '(mẫu)',
      sentence: r.model_sentence,
      passed: false,
    };
    setJourney(nj);
    if (levelIdx < totalLevels - 1) {
      setLevelIdx(levelIdx + 1);
      setSentence('');
      setFeedback(null);
      loadIntro(levelIdx + 1, studentLevel);
    } else {
      finishSession(nj);
    }
  };

  /* ---------- Bước 5: tổng kết + lưu lịch sử ---------- */

  const doSave = async (summary) => {
    setSaveState('saving');
    setSaveErr('');
    try {
      await callCoach('writing', 'saveSession', { summary });
      setSaveState('ok');
    } catch (e) {
      toastQuota(e);
      setSaveState('error');
      setSaveErr(e.message);
    }
  };

  const finishSession = (finalJourney) => {
    guardRef.current.on = false;
    setGuardOverlay(null);
    exitFullscreen();
    setScreen('done');
    const ladder = finalJourney
      .map((j, i) => (j ? {
        level: i + 1,
        title: j.level_title || '',
        sentence: j.sentence || '',
        band: j.band == null ? '' : String(j.band),
        passed: !!j.passed,
      } : null))
      .filter(Boolean);
    const summary = {
      studentName: currentUser?.name || '',
      topic,
      studentLevel,
      cause,
      effect,
      base,
      ladder,
      reachedLevel: ladder.length ? ladder[ladder.length - 1].level : 0,
      finishedAt: new Date().toISOString(),
    };
    summaryRef.current = summary;
    doSave(summary);
  };

  const resetSession = () => {
    guardRef.current.on = false;
    setGuardOverlay(null);
    exitFullscreen();
    setScreen('topic');
    setSelTopic('');
    setCustomTopic('');
    setTopic('');
    setQa([]);
    setQCount(0);
    setCurQ(null);
    setAnswer('');
    setSocErr('');
    setCause('');
    setEffect('');
    setBase('');
    setStudentLevel('5.5');
    setIdeasLoading(false);
    setIdeasErr('');
    setLevelIdx(0);
    setJourney([]);
    setSentence('');
    setFeedback(null);
    setIntro({ loading: false, error: '', data: null });
    introCacheRef.current = {};
    setSaveState('idle');
    setSaveErr('');
  };

  /* ---------- Bước 1: bắt đầu (user gesture -> mới ép fullscreen) ---------- */

  const startPractice = async () => {
    const t = effectiveTopic;
    if (!t || starting) return;
    const useFs = fsSupported(); // mobile không có API thì bỏ qua, chỉ đếm rời tab
    if (useFs) enterFullscreen(); // gọi ngay trong gesture, không await trước đó
    setStarting(true);
    let lv = levels;
    if (!lv.length) {
      try { lv = await fetchLevels(); } catch (_) { lv = []; }
    }
    if (!lv.length) {
      setStarting(false);
      exitFullscreen();
      setToast({ message: 'Chưa kết nối được hệ thống. Em thử lại sau ít phút nhé.', type: 'error' });
      return;
    }
    guardRef.current = { on: true, usedFs: useFs, strikes: 0, lastAt: 0 };
    setTopic(t);
    setQa([]);
    setQCount(0);
    setCurQ(null);
    setAnswer('');
    setSocErr('');
    setStudentLevel('5.5');
    setJourney([]);
    setSentence('');
    setFeedback(null);
    introCacheRef.current = {};
    setSaveState('idle');
    setSaveErr('');
    setScreen('socratic');
    setStarting(false);
    await askNext(t, [], 0);
  };

  const resumeFromWarn = () => {
    if (guardRef.current.usedFs) enterFullscreen(); // user gesture
    setGuardOverlay(null);
  };

  /* ---------- render ---------- */

  const stepCur = STEP_ORDER[screen] || 0;

  return (
    <div className="max-w-3xl mx-auto">
      {toast && <Toast message={toast.message} type={toast.type} />}

      {/* Nút về màn chọn công cụ */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link
          to="/student/resources"
          className="inline-flex items-center gap-1.5 bg-[#E8F4EC] border-[1.5px] border-[#C9E2CF] text-[#2B6830] rounded-xl px-3.5 py-2 text-sm font-bold hover:bg-[#dceee2] transition-colors"
        >
          ← Công cụ
        </Link>
      </div>

      {/* Hero */}
      <div className="text-center mt-4 mb-1 px-2">
        <h1 className="text-[22px] md:text-[25px] font-extrabold text-[#2B6830] uppercase tracking-wide">
          Writing Coach
        </h1>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed">
          Luyện viết câu Nguyên nhân–Hệ quả · Nâng band từng bước · IELTS Writing Task 2
        </p>
      </div>

      {/* Stepper 5 chấm */}
      <div className="flex gap-1.5 my-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`flex-1 h-1.5 rounded-full transition-colors ${
              i < stepCur ? 'bg-[#2B6830]' : i === stepCur ? 'bg-[#B8860B]' : 'bg-[#C9E2CF]'
            }`}
          />
        ))}
      </div>

      {/* ============ BƯỚC 1: CHỌN CHỦ ĐỀ ============ */}
      {screen === 'topic' && (
        <Card className="mb-4">
          <h2 className="text-lg font-bold text-[#1E5225]">Bước 1 · Bắt đầu</h2>
          <p className="text-[13.5px] text-slate-500 leading-relaxed mt-2">
            Chọn một chủ đề thường gặp trong IELTS Writing Task 2, hoặc tự nhập chủ đề / câu hỏi đề bài.
          </p>
          <div className="flex flex-wrap gap-2.5 mt-3">
            {TOPICS.map((t) => {
              const sel = selTopic === t && !customTopic.trim();
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setSelTopic(t); setCustomTopic(''); }}
                  className={`px-4 py-2.5 rounded-full text-[13.5px] font-semibold border-[1.5px] transition-colors ${
                    sel
                      ? 'bg-[#2B6830] text-white border-[#2B6830]'
                      : 'bg-[#F2F8F4] text-[#1E5225] border-[#C9E2CF] hover:bg-[#E8F4EC] hover:border-[#2B6830]'
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
          <FieldLabel className="mt-4">Hoặc tự nhập chủ đề</FieldLabel>
          <input
            type="text"
            className="input-base"
            placeholder="VD: Many people work from home nowadays..."
            value={customTopic}
            onChange={(e) => {
              setCustomTopic(e.target.value);
              if (e.target.value.trim()) setSelTopic('');
            }}
          />
          <Callout tone="gold" className="mt-4">
            <b>Lưu ý:</b> Trong lúc luyện tập, hãy <b>tập trung trong cửa sổ</b>, đừng chuyển sang
            ứng dụng hoặc tab khác. Rời ra ngoài <b>3 lần</b> sẽ kết thúc phiên luyện tập.
          </Callout>
          <div className="mt-4">
            <Button size="lg" onClick={startPractice} disabled={!effectiveTopic} loading={starting}>
              Bắt đầu luyện →
            </Button>
          </div>
        </Card>
      )}

      {/* ============ BƯỚC 2: HỎI SOCRATIC ============ */}
      {screen === 'socratic' && (
        <Card className="mb-4">
          <h2 className="text-lg font-bold text-[#1E5225]">Bước 2 · Xác định vấn đề cụ thể</h2>
          <p className="text-[13.5px] text-slate-500 leading-relaxed mt-1">
            Trả lời <b>từng câu hỏi một</b>. Mỗi câu chỉ hỏi một điều, cứ trả lời ngắn gọn theo
            gợi ý bên dưới câu hỏi.
          </p>

          {/* Chat log các lượt đã trả lời */}
          {qa.length > 0 && (
            <div className="mt-3">
              {qa.map((x, i) => (
                <div key={i} className="my-1.5 text-sm leading-relaxed">
                  <div><b className="text-[#1E5225]">Q{i + 1}:</b> {x.q}</div>
                  <div className="text-slate-600">↳ {x.a}</div>
                </div>
              ))}
            </div>
          )}

          {/* Hộp câu hỏi hiện tại */}
          <div className="bg-[#F2F8F4] border border-[#C9E2CF] rounded-xl p-4 mt-3 mb-3.5">
            {socErr ? (
              <div>
                <Callout tone="warn">{socErr}</Callout>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2.5"
                  onClick={() => askNext(topic, qa, qCount)}
                >
                  Thử lại
                </Button>
              </div>
            ) : (!curQ || qLoading) ? (
              <Loading text={qCount === 0 ? 'Đang tạo câu hỏi đầu tiên...' : 'Đang phân tích câu trả lời...'} />
            ) : (
              <>
                <div className="text-xs font-bold uppercase tracking-wide text-[#2B6830]">
                  Câu hỏi {qCount}/3
                </div>
                <div className="text-[17px] font-bold text-[#1E5225] mt-1">❓ {curQ.en}</div>
                <div className="text-[13.5px] text-slate-500 mt-1">{curQ.vi}</div>
                <div className="bg-white border border-dashed border-[#C9E2CF] rounded-lg px-3 py-2.5 mt-3 text-[13.5px] leading-relaxed">
                  <div>
                    <span className="font-bold text-[#2B6830]">Gợi ý:</span>{' '}
                    <MdBold text={curQ.guide} />
                  </div>
                  <div className="mt-1.5">
                    <span className="font-bold text-[#2B6830]">Ví dụ trả lời:</span>{' '}
                    <i className="text-[#1E5225]">{curQ.example}</i>
                  </div>
                </div>
              </>
            )}
          </div>

          <FieldLabel>Câu trả lời của bạn</FieldLabel>
          <textarea
            ref={ansRef}
            rows={4}
            className="input-base min-h-[92px] leading-relaxed resize-y"
            placeholder="Viết bằng tiếng Anh (khuyến khích) hoặc tiếng Việt..."
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2.5 mt-3">
            <Button onClick={sendAnswer} disabled={qLoading || !curQ}>Gửi câu trả lời →</Button>
            {qLoading && <Loading text="Đang phân tích..." />}
          </div>
        </Card>
      )}

      {/* ============ BƯỚC 3: PHÂN LOẠI Ý ============ */}
      {screen === 'ideas' && (
        <Card className="mb-4">
          <h2 className="text-lg font-bold text-[#1E5225]">Bước 3 · Hai ý của bạn</h2>
          <p className="text-[13.5px] text-slate-500 leading-relaxed mt-1">
            Đây là vấn đề bạn sẽ viết, gồm <b>nguyên nhân (Ý 1)</b> dẫn đến <b>hệ quả (Ý 2)</b>:
          </p>
          <div className="flex flex-col md:flex-row gap-3 items-stretch my-3.5">
            <div className="flex-1 bg-[#F2F8F4] border border-[#C9E2CF] rounded-xl px-4 py-3.5">
              <div className="text-xs font-bold uppercase tracking-wide text-[#2B6830]">Ý 1 · Nguyên nhân</div>
              <div className="mt-1.5 text-[14.5px] leading-relaxed">
                {ideasLoading ? 'Đang tổng hợp...' : ideasErr ? `Lỗi: ${ideasErr}` : (cause || '–')}
              </div>
            </div>
            <div className="grid place-items-center text-2xl text-[#2B6830] font-extrabold rotate-90 md:rotate-0">→</div>
            <div className="flex-1 bg-[#F2F8F4] border border-[#C9E2CF] rounded-xl px-4 py-3.5">
              <div className="text-xs font-bold uppercase tracking-wide text-[#2B6830]">Ý 2 · Hệ quả</div>
              <div className="mt-1.5 text-[14.5px] leading-relaxed">
                {ideasLoading ? '...' : (effect || '–')}
              </div>
            </div>
          </div>
          {ideasErr && (
            <Button
              variant="outline"
              size="sm"
              className="mb-3"
              onClick={() => doExtract(topic, qa)}
            >
              Thử lại
            </Button>
          )}
          <Callout>
            <b>Câu xuất phát (band ~5):</b>
            <br />
            <span className="italic">{ideasLoading ? '–' : (base || '–')}</span>
            <div className="text-xs text-slate-500 mt-1.5">
              Đây là cách viết đơn giản, "kể chuyện". Nhiệm vụ của bạn: leo thang từng bước để biến
              nó thành câu band cao.
            </div>
          </Callout>
          <div className="mt-4">
            <Button size="lg" onClick={startLadder} disabled={ideasLoading || !!ideasErr || !base}>
              Bắt đầu leo thang →
            </Button>
          </div>
        </Card>
      )}

      {/* ============ BƯỚC 4: THANG NÂNG BAND ============ */}
      {screen === 'ladder' && (
        <Card className="mb-4">
          <div className="flex items-center justify-between gap-2.5 mb-2 flex-wrap">
            <h2 className="text-lg font-bold text-[#1E5225]">{L.title}</h2>
            <BandPill gold={!!L.high}>{L.band}</BandPill>
          </div>

          {/* Hướng dẫn kỹ thuật của bậc */}
          {intro.loading && (
            <Callout>
              <Loading text="Đang chuẩn bị hướng dẫn phù hợp trình độ của bạn..." />
            </Callout>
          )}
          {intro.error && (
            <Callout tone="warn">
              Không tải được hướng dẫn: {intro.error}
              <div className="mt-2">
                <Button variant="outline" size="sm" onClick={() => loadIntro(levelIdx, studentLevel)}>
                  Tải lại hướng dẫn
                </Button>
              </div>
            </Callout>
          )}
          {intro.data && (
            <Callout>
              <b>Kỹ thuật:</b> <MdBold text={intro.data.explain_vi || ''} />
              <div className="mt-2">
                <b>Ví dụ (câu hoàn chỉnh):</b>{' '}
                <i>{intro.data.example_full_sentence || ''}</i>
              </div>
              <div className="mt-1.5">
                <b>Cách làm:</b> <MdBold text={intro.data.how_to_vi || ''} />
              </div>
            </Callout>
          )}

          <Callout tone="gold" className="mt-3">
            <div className="text-xs font-bold text-[#1E5225]">NHẮC LẠI HAI Ý CỦA BẠN</div>
            <div className="text-sm mt-1">
              <b>Ý 1:</b> {cause} &nbsp;→&nbsp; <b>Ý 2:</b> {effect}
            </div>
          </Callout>

          <Callout className="mt-3">
            <div className="text-xs font-bold text-[#1E5225]">
              CÂU XUẤT PHÁT CỦA BẬC NÀY: hãy BIẾN ĐỔI câu này, đừng nộp y nguyên
            </div>
            <div className="italic mt-1">{prevSentence || '–'}</div>
          </Callout>

          <FieldLabel className="mt-4">Tự viết lại câu theo kỹ thuật của bậc này</FieldLabel>
          <textarea
            ref={writeRef}
            rows={4}
            className="input-base min-h-[92px] leading-relaxed resize-y"
            placeholder="Gõ câu tiếng Anh của BẠN ở đây, biến đổi câu xuất phát theo kỹ thuật, đừng chép y nguyên..."
            value={sentence}
            onChange={(e) => setSentence(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2.5 mt-3">
            <Button onClick={gradeSentence} disabled={gradeLoading}>Chấm &amp; Góp ý</Button>
            {gradeLoading && <Loading text="Đang chấm..." />}
          </div>

          {/* Feedback */}
          {feedback && feedback.lazy && (
            <Callout tone="warn" className="mt-4">
              <b>Bạn chưa viết lại.</b> Hãy <b>biến đổi câu xuất phát</b> theo kỹ thuật của bậc này
              rồi mới chấm, không nộp y nguyên câu trước hoặc câu mẫu.
            </Callout>
          )}
          {feedback && feedback.error && (
            <Callout tone="warn" className="mt-4">{feedback.error}</Callout>
          )}
          {feedback && feedback.r && (
            <div className="mt-4 border-t border-dashed border-[#C9E2CF] pt-4">
              <div className="text-xl font-extrabold text-[#1E5225]">
                Band ước lượng: {feedback.r.band_estimate || '–'}
              </div>
              {Array.isArray(feedback.r.strengths) && feedback.r.strengths.length > 0 && (
                <div className="my-3">
                  <h4 className="text-xs font-bold uppercase tracking-wide text-[#1E5225] mb-1.5">✓ Điểm tốt</h4>
                  {feedback.r.strengths.map((s, i) => (
                    <div key={i} className="bg-[#E8F4EC] rounded-lg px-3 py-2.5 my-1.5 text-sm leading-relaxed">
                      <MdBold text={s} />
                    </div>
                  ))}
                </div>
              )}
              {Array.isArray(feedback.r.issues) && feedback.r.issues.length > 0 && (
                <div className="my-3">
                  <h4 className="text-xs font-bold uppercase tracking-wide text-[#1E5225] mb-1.5">Cần chỉnh</h4>
                  {feedback.r.issues.map((it, i) => {
                    const ty = String(it.type || 'pragmatics').toLowerCase();
                    return (
                      <div key={i} className="bg-[#FCEEE8] rounded-lg px-3 py-2.5 my-1.5 text-sm leading-relaxed">
                        <span
                          className="inline-block text-[11px] font-bold uppercase text-white px-2 py-0.5 rounded-md mr-1.5"
                          style={{ background: ISSUE_COLORS[ty] || '#C0392B' }}
                        >
                          {ty}
                        </span>
                        <MdBold text={it.problem} />
                        <br />
                        <b>→ Sửa:</b> <MdBold text={it.fix} />
                      </div>
                    );
                  })}
                </div>
              )}
              {feedback.r.model_sentence && (
                <div className="my-3">
                  <h4 className="text-xs font-bold uppercase tracking-wide text-[#1E5225] mb-1.5">Câu mẫu tham khảo</h4>
                  <div className="bg-white border-[1.5px] border-[#2B6830] rounded-lg px-3.5 py-3 text-[15px] italic leading-relaxed">
                    {feedback.r.model_sentence}
                  </div>
                </div>
              )}
              {feedback.r.next_hint && (
                <Callout className="my-3">
                  <b>Gợi ý đi xa hơn:</b> <MdBold text={feedback.r.next_hint} />
                </Callout>
              )}
              <div
                className={`rounded-xl px-4 py-3 font-bold text-center text-white mt-3.5 ${
                  feedback.r.passed ? 'bg-[#2B6830]' : 'bg-[#9A6A2B]'
                }`}
              >
                {feedback.r.passed ? '✓ Đạt yêu cầu bậc này!' : 'Gần đúng rồi, chỉnh thêm theo góp ý nhé.'}
              </div>
              <div className="flex flex-wrap gap-2.5 mt-3.5">
                {feedback.r.passed ? (
                  levelIdx < totalLevels - 1 ? (
                    <>
                      <Button onClick={goNextLevel}>Lên bậc tiếp theo →</Button>
                      <Button variant="outline" onClick={retryLevel}>Viết lại bậc này</Button>
                    </>
                  ) : (
                    <Button onClick={() => finishSession(journey)}>Xem tổng kết 🎉</Button>
                  )
                ) : (
                  <>
                    <Button onClick={retryLevel}>Viết lại</Button>
                    <Button variant="outline" onClick={useModelAndNext}>Dùng câu mẫu &amp; lên bậc</Button>
                  </>
                )}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ============ BƯỚC 5: HOÀN THÀNH ============ */}
      {screen === 'done' && (
        <Card className="mb-4">
          <h2 className="text-lg font-bold text-[#1E5225]">🎉 Hoàn thành thang nâng band!</h2>
          <p className="text-[13.5px] text-slate-500 mt-1">
            Hành trình câu của bạn, từ band 5 đến band 8+:
          </p>
          <div className="mt-3 space-y-2.5">
            <Callout>
              <span className="inline-block text-[13px] font-bold text-white px-3 py-1 rounded-full bg-[#9A6A2B]">
                Band ~5
              </span>{' '}
              <i>{base}</i>
            </Callout>
            {journey.filter(Boolean).map((j, i) => (
              <Callout key={i}>
                <BandPill gold={!!(j.band && parseFloat(j.band) >= 8)}>Band {j.band}</BandPill>{' '}
                <i>{j.sentence}</i>
                <div className="text-xs text-slate-500 mt-1">{j.level_title}</div>
              </Callout>
            ))}
          </div>
          <Callout tone="gold" className="mt-4">
            <b>Lưu lại buổi học:</b> Phiên luyện của em được lưu tự động vào{' '}
            <b>Lịch sử luyện tập</b> trong app.
          </Callout>
          <div className="flex flex-wrap items-center gap-2.5 mt-3 min-h-[32px]">
            {saveState === 'saving' && <Loading text="Đang lưu lịch sử luyện tập..." />}
            {saveState === 'ok' && (
              <>
                <span className="text-sm font-semibold text-[#2B6830]">✓ Đã lưu vào Lịch sử luyện tập.</span>
                <Link
                  to="/student/resources/history"
                  className="text-sm font-bold text-[#2B6830] underline underline-offset-2"
                >
                  Xem lịch sử
                </Link>
              </>
            )}
            {saveState === 'error' && (
              <>
                <span className="text-sm text-red-600">✗ {saveErr}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => summaryRef.current && doSave(summaryRef.current)}
                >
                  Lưu lại
                </Button>
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-2.5 mt-4">
            <Button variant="outline" onClick={resetSession}>Luyện chủ đề khác</Button>
          </div>
        </Card>
      )}

      {/* ============ OVERLAY GIÁM SÁT RỜI MÀN HÌNH ============ */}
      {guardOverlay && (
        <div className="fixed inset-0 z-[100] bg-[#1E5225]/[0.97] text-white flex items-center justify-center p-6 text-center">
          <div className="max-w-md">
            {guardOverlay.kind === 'warn' ? (
              <>
                <h3 className="text-2xl font-bold">⚠️ Bạn đã rời khỏi màn hình luyện tập</h3>
                <div className="text-[42px] font-extrabold my-2.5">{guardOverlay.n}/2</div>
                <p className="text-[15px] leading-relaxed opacity-95 mb-4">
                  Hãy <b>tập trung vào bài luyện tập</b>, đừng chuyển sang ứng dụng hoặc tab khác.
                  <br />
                  Rời ra ngoài <b>lần thứ 3</b> sẽ kết thúc phiên.
                </p>
                <button
                  type="button"
                  onClick={resumeFromWarn}
                  className="bg-white text-[#2B6830] font-bold rounded-xl px-6 py-3 text-sm hover:bg-[#E8F4EC] transition-colors active:scale-[0.98]"
                >
                  Quay lại luyện tập
                </button>
              </>
            ) : (
              <>
                <h3 className="text-2xl font-bold">🔒 Phiên luyện tập đã kết thúc</h3>
                <p className="text-[15px] leading-relaxed opacity-95 my-4">
                  Bạn đã thoát ra ngoài quá số lần cho phép (3 lần).
                  <br />
                  Hãy bắt đầu lại một phiên mới nhé.
                </p>
                <button
                  type="button"
                  onClick={resetSession}
                  className="bg-white text-[#2B6830] font-bold rounded-xl px-6 py-3 text-sm hover:bg-[#E8F4EC] transition-colors active:scale-[0.98]"
                >
                  Bắt đầu phiên mới
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WritingCoach;
