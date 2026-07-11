import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { callCoach } from './shared/coachApi';
import { MdBold } from './shared/mdText';
import { Button, Toast, ConfirmModal } from '../../../components/UI';

/*
 * WRITING INTRO COACH: port từ tools/intro/templates/intro.html (Coach Suite Flask)
 * sang trang React trong app EDU.
 *
 * Luồng gốc giữ nguyên: nhập tên + chọn trình độ → sinh đề "Discuss both views"
 * → leo 3 cấu phần Hook → Paraphrase → Thesis, mỗi câu chấm 4 tiêu chí TR/CC/LR/GRA,
 * đạt Band 7 mới mở phần sau → màn hoàn thành.
 *
 * Khác bản gốc:
 *  - BỎ màn login + /api/mode + /api/warmup: học viên đã đăng nhập app EDU.
 *  - Xuất .docx (/api/export-history) thay bằng 'saveSession' lưu vào Lịch sử luyện tập.
 *  - alert()/confirm() thay bằng Toast/ConfirmModal của design system.
 *  - Giữ giám sát toàn màn hình (2 lần nhắc, lần 3 khoá phiên); vì chạy trong SPA
 *    nên khi khoá đưa về màn hình Bắt đầu thay cho window.close().
 */

const LEVELS = ['5.0', '5.5', '6.0', '6.5', '7.0', '7.5'];
const FALLBACK_LABELS = ['Hook', 'Paraphrase', 'Thesis'];
const CRIT_ORDER = ['TR', 'CC', 'LR', 'GRA'];

const ISSUE_COLORS = {
  coherence: '#7A5C00',
  grammar: '#1E5225',
  semantics: '#6B3FA0',
  pragmatics: '#0B6E8A',
  lexical: '#9A6A2B',
  task: '#0B6E8A',
};

function shortLabel(t) {
  if (/Hook/i.test(t)) return '1 · Hook';
  if (/Paraphras/i.test(t)) return '2 · Paraphrase';
  if (/Thesis/i.test(t)) return '3 · Thesis';
  return t;
}

function critColor(band) {
  const n = parseFloat(band) || 0;
  if (n >= 8) return '#B8860B';
  if (n >= 7) return '#2B6830';
  if (n >= 6) return '#3D8B47';
  return '#9A6A2B';
}

function issueColor(ty) {
  return ISSUE_COLORS[ty] || '#C0392B';
}

/* ---------- toàn màn hình (port nguyên hàm của bản gốc) ---------- */
function isFs() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}
function enterFullscreen() {
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
  if (req) {
    try {
      return Promise.resolve(req.call(el)).catch(() => {});
    } catch (_) {
      /* trình duyệt không hỗ trợ thì thôi */
    }
  }
  return Promise.resolve();
}
function exitFullscreen() {
  if (document.fullscreenElement) {
    const ex = document.exitFullscreen || document.webkitExitFullscreen;
    if (ex) {
      try {
        ex.call(document);
      } catch (_) {
        /* bỏ qua */
      }
    }
  }
}

/* ---------- các khối hiển thị tĩnh ---------- */

// Đề bài + hai quan điểm
const PromptBox = ({ p }) => {
  if (!p) return null;
  return (
    <div className="bg-primary-subtle border border-[#C9E2CF] rounded-xl p-4 md:p-5">
      <p className="text-[11px] font-bold text-primary uppercase tracking-wide">
        Đề bài · IELTS Writing Task 2
      </p>
      <p className="mt-1.5 text-[15px] md:text-base font-bold text-primary-hover leading-relaxed">
        {p.prompt_en}
      </p>
      {p.prompt_vi && (
        <p className="mt-2 text-[13px] text-slate-500 leading-relaxed">{p.prompt_vi}</p>
      )}
      {(p.view1_en || p.view2_en) && (
        <div className="mt-3 flex flex-col sm:flex-row gap-2.5">
          <div className="flex-1 bg-white border border-[#C9E2CF] rounded-lg px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Quan điểm 1</p>
            <p className="text-[13px] mt-0.5 leading-relaxed">{p.view1_en}</p>
          </div>
          <div className="flex-1 bg-white border border-[#C9E2CF] rounded-lg px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Quan điểm 2</p>
            <p className="text-[13px] mt-0.5 leading-relaxed">{p.view2_en}</p>
          </div>
        </div>
      )}
    </div>
  );
};

// Hướng dẫn tĩnh của cấu phần: khái niệm, cách làm, khung, từ đồng nghĩa, cảnh báo
const ComponentGuide = ({ c }) => {
  if (!c) return null;
  return (
    <div>
      <div className="bg-primary-light border-l-4 border-primary rounded-lg px-4 py-3 text-sm leading-relaxed">
        <p>
          <b>Khái niệm:</b> {c.guide_vi}
        </p>
        <p className="mt-2">
          <b>Cách làm:</b> {c.how_to_vi}
        </p>
        {c.frame && (
          <div className="mt-2.5 bg-white border border-dashed border-[#C9E2CF] rounded-lg px-3 py-2 font-mono text-[13px] text-primary-hover overflow-x-auto whitespace-nowrap">
            Khung gợi ý: {c.frame}
          </div>
        )}
      </div>
      {c.synonyms && c.synonyms.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-bold text-primary-hover">Từ đồng nghĩa nên dùng</p>
          <div className="overflow-x-auto mt-1.5">
            <table className="w-full text-[13px] border-collapse">
              <tbody>
                {c.synonyms.map((s, i) => (
                  <tr key={i}>
                    <td className="border border-[#C9E2CF] bg-primary-subtle font-bold text-primary-hover px-2.5 py-1.5 w-1/3">
                      {s.from}
                    </td>
                    <td className="border border-[#C9E2CF] px-2.5 py-1.5">{s.to}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {c.warnings && c.warnings.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {c.warnings.map((w, i) => (
            <li
              key={i}
              className="text-[13px] leading-relaxed bg-[#FFF7ED] border-l-[3px] border-[#B45309] rounded-md px-2.5 py-1.5"
            >
              ⚠️ {w}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// Bộ câu mẫu Band 7/8/9
const ExemplarList = ({ data }) => (
  <div className="mt-3">
    <h4 className="text-[13px] font-bold text-primary-hover uppercase tracking-wide">
      Câu mẫu nâng band cho cấu phần này
    </h4>
    {[
      ['band7', 'Band 7'],
      ['band8', 'Band 8'],
      ['band9', 'Band 9'],
    ].map(([k, lbl]) => {
      const e = (data && data[k]) || {};
      return (
        <div key={k} className="bg-primary-subtle border border-[#C9E2CF] rounded-xl px-3.5 py-3 mt-2">
          <p className="text-[11px] font-extrabold text-primary uppercase">{lbl}</p>
          <p className="text-sm italic text-primary-hover mt-1 leading-relaxed">{e.sentence || ''}</p>
          {e.note && <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">→ {e.note}</p>}
        </div>
      );
    })}
  </div>
);

const Spinner = ({ className = '' }) => (
  <span
    className={`inline-block w-4 h-4 border-[3px] border-primary-medium border-t-transparent rounded-full animate-spin align-middle ${className}`}
  />
);

const IntroCoach = () => {
  const { currentUser } = useAuth();

  // ---------- state phiên (cục bộ trong page) ----------
  const [screen, setScreen] = useState('start'); // 'start' | 'coach' | 'done'
  const [components, setComponents] = useState([]); // getComponents: hướng dẫn tĩnh 3 cấu phần
  const [studentName, setStudentName] = useState(currentUser?.name || '');
  const [studentLevel, setStudentLevel] = useState('6.0');
  const [promptObj, setPromptObj] = useState(null);
  const [compIdx, setCompIdx] = useState(0);
  const [results, setResults] = useState([]); // theo index cấu phần, kèm attempts
  const [sentence, setSentence] = useState('');
  const [fb, setFb] = useState(null); // {data, sentence} | {error}
  const [exemplars, setExemplars] = useState(null); // null | 'loading' | {data} | {error}
  const [starting, setStarting] = useState(false);
  const [grading, setGrading] = useState(false);
  const [changingPrompt, setChangingPrompt] = useState(false);
  const [confirmNewPrompt, setConfirmNewPrompt] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // null | 'saving' | 'done' | 'error'
  const [guardOverlay, setGuardOverlay] = useState(null); // {kind:'warn', n} | {kind:'lock'}
  const [toast, setToast] = useState(null);

  // mutable cho listener toàn cục + chống gọi lặp (StrictMode-safe)
  const guardRef = useRef({ on: false, strikes: 0, lastAt: 0 });
  const usedTopicsRef = useRef([]); // 8 chủ đề gần nhất để server tránh lặp đề
  const loadedRef = useRef(false);
  const savedRef = useRef(false);
  const toastTimerRef = useRef(null);
  const writeRef = useRef(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 4200);
  };
  useEffect(
    () => () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    },
    []
  );

  // Tải hướng dẫn tĩnh 3 cấu phần một lần khi mở trang (không tốn lượt)
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    callCoach('intro', 'getComponents', {})
      .then((data) => {
        const list = Array.isArray(data) ? data : (data && data.components) || [];
        if (list.length) setComponents(list);
      })
      .catch(() => {}); // sẽ thử lại khi bấm Bắt đầu
  }, []);

  // Giám sát toàn màn hình: 2 lần nhắc, lần 3 khoá phiên (port nguyên logic gốc)
  useEffect(() => {
    const g = guardRef.current;
    const registerLeave = () => {
      if (!g.on) return;
      const now = Date.now();
      if (now - g.lastAt < 800) return;
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
    const onFsChange = () => {
      if (g.on && !isFs()) registerLeave();
    };
    const onVis = () => {
      if (g.on && document.hidden) registerLeave();
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
      document.removeEventListener('visibilitychange', onVis);
      g.on = false;
      exitFullscreen(); // rời trang giữa phiên thì trả lại màn hình thường
    };
  }, []);

  // Đổi màn hình thì cuộn lên đầu (đúng hành vi show() của bản gốc)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [screen]);

  /* ---------- gọi API ---------- */

  const fetchPrompt = async () => {
    const r = await callCoach('intro', 'newPrompt', { usedTopics: usedTopicsRef.current });
    setPromptObj(r);
    if (r && r.topic_short) {
      usedTopicsRef.current = [...usedTopicsRef.current, r.topic_short].slice(-8);
    }
    return r;
  };

  const resetRound = () => {
    setCompIdx(0);
    setResults([]);
    setSentence('');
    setFb(null);
    setExemplars(null);
  };

  const handleStart = async () => {
    setStarting(true);
    try {
      // hướng dẫn tĩnh chưa có (mạng lỗi lúc mở trang) thì lấy lại
      if (!components.length) {
        const data = await callCoach('intro', 'getComponents', {});
        const list = Array.isArray(data) ? data : (data && data.components) || [];
        if (!list.length) throw new Error('Chưa tải được nội dung hướng dẫn, em thử lại giúp nhé.');
        setComponents(list);
      }
      await fetchPrompt();
      resetRound();
      setSaveStatus(null);
      savedRef.current = false;
      await enterFullscreen(); // trong chuỗi xử lý click, đúng hành vi gốc
      const g = guardRef.current;
      g.on = true;
      g.strikes = 0;
      g.lastAt = 0;
      setScreen('coach');
    } catch (e) {
      if (e.code === 'functions/resource-exhausted') showToast(e.message, 'error');
      else showToast('Không tạo được đề: ' + e.message, 'error');
    }
    setStarting(false);
  };

  const handleNewPrompt = async () => {
    setConfirmNewPrompt(false);
    setChangingPrompt(true);
    try {
      await fetchPrompt();
      resetRound();
    } catch (e) {
      if (e.code === 'functions/resource-exhausted') showToast(e.message, 'error');
      else showToast('Không lấy được đề mới: ' + e.message, 'error');
    }
    setChangingPrompt(false);
  };

  // các cấu phần đã viết trước đó (kiểm tra tính nhất quán khi chấm)
  const prevComponents = () => {
    const o = {};
    results.forEach((r) => {
      if (r) o[r.key] = r.sentence;
    });
    return o;
  };

  const handleGrade = async () => {
    const s = sentence.trim();
    if (!s) {
      showToast('Hãy viết câu của bạn trước.', 'warning');
      return;
    }
    const c = components[compIdx];
    if (!c) return;
    setGrading(true);
    try {
      const r = await callCoach('intro', 'grade', {
        component: c.key,
        sentence: s,
        studentLevel,
        prompt: promptObj,
        prevComponents: prevComponents(),
      });
      setExemplars(null);
      setFb({ data: r, sentence: s });
      // lưu kết quả cấu phần (luôn cập nhật bản mới nhất) + đếm số lần chấm
      setResults((prev) => {
        const next = [...prev];
        const attempts = ((next[compIdx] && next[compIdx].attempts) || 0) + 1;
        next[compIdx] = {
          key: c.key,
          title: c.title,
          sentence: s,
          overall_band: r.overall_band,
          criteria: r.criteria,
          strengths: r.strengths,
          issues: r.issues,
          model_sentence: r.model_sentence,
          exemplars: null,
          passed: !!r.passed,
          attempts,
        };
        return next;
      });
    } catch (e) {
      if (e.code === 'functions/resource-exhausted') showToast(e.message, 'error');
      else setFb({ error: e.message });
    }
    setGrading(false);
  };

  const handleExemplars = async () => {
    const c = components[compIdx];
    const cur = results[compIdx] || {};
    if (!c) return;
    setExemplars('loading');
    try {
      const r = await callCoach('intro', 'exemplars', {
        component: c.key,
        prompt: promptObj,
        sentence: cur.sentence || '',
      });
      setExemplars({ data: r });
      setResults((prev) => {
        const next = [...prev];
        if (next[compIdx]) next[compIdx] = { ...next[compIdx], exemplars: r };
        return next;
      });
    } catch (e) {
      if (e.code === 'functions/resource-exhausted') showToast(e.message, 'error');
      setExemplars({ error: e.message });
    }
  };

  const handleRetry = () => {
    setFb(null);
    setExemplars(null);
    if (writeRef.current) writeRef.current.focus();
  };

  const handleNextComp = () => {
    setCompIdx((i) => i + 1);
    setSentence('');
    setFb(null);
    setExemplars(null);
  };

  // Lưu phiên vào Lịch sử luyện tập (server tự ghi theo tài khoản EDU)
  const doSave = async (resArr) => {
    setSaveStatus('saving');
    try {
      const comps = {};
      resArr.forEach((r) => {
        if (!r) return;
        comps[r.key] = {
          sentence: r.sentence,
          criteria: r.criteria || null,
          overall: r.overall_band || '',
          passed: !!r.passed,
          attempts: r.attempts || 1,
        };
      });
      await callCoach('intro', 'saveSession', {
        summary: {
          studentName: studentName.trim(),
          studentLevel,
          prompt: promptObj,
          components: comps,
          finishedAt: new Date().toISOString(),
        },
      });
      setSaveStatus('done');
    } catch (e) {
      setSaveStatus('error');
      if (e.code === 'functions/resource-exhausted') showToast(e.message, 'error');
    }
  };

  const handleFinish = () => {
    const g = guardRef.current;
    g.on = false;
    exitFullscreen();
    setScreen('done');
    if (!savedRef.current) {
      savedRef.current = true;
      doSave(results);
    }
  };

  const handleAgain = () => {
    resetRound();
    setPromptObj(null);
    setSaveStatus(null);
    savedRef.current = false;
    setScreen('start');
  };

  // Bị khoá vì thoát quá số lần: về màn hình bắt đầu (SPA không tự đóng tab được)
  const handleLockReset = () => {
    setGuardOverlay(null);
    handleAgain();
  };

  /* ---------- dữ liệu render ---------- */
  const curComp = components[compIdx] || { title: 'Cấu phần', target: 'Band 7' };
  const stepLabels = components.length
    ? components.map((c) => shortLabel(c.title))
    : FALLBACK_LABELS;
  const fbData = fb && fb.data;
  const passed = !!(fbData && fbData.passed);
  const crit = (fbData && fbData.criteria) || {};
  const finalIntro = results
    .filter(Boolean)
    .map((r) => r.sentence)
    .join(' ');

  return (
    <div className="max-w-3xl mx-auto pb-10">
      {toast && <Toast message={toast.message} type={toast.type} />}

      {/* xác nhận đổi đề (thay confirm() của bản gốc) */}
      {confirmNewPrompt && (
        <ConfirmModal
          title="Đổi sang đề mới?"
          message="Tiến trình các cấu phần hiện tại sẽ làm lại từ đầu."
          confirmLabel="Đổi đề"
          cancelLabel="Ở lại"
          variant="primary"
          onConfirm={handleNewPrompt}
          onCancel={() => setConfirmNewPrompt(false)}
        />
      )}

      {/* overlay bận khi chờ chấm */}
      {grading && (
        <div className="fixed inset-0 z-50 bg-primary-hover/95 flex items-center justify-center p-6 text-center">
          <div>
            <div className="w-11 h-11 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
            <p className="mt-4 text-white font-bold text-base">Đang đối chiếu thang điểm chuẩn...</p>
            <p className="mt-1 text-white/75 text-sm">Đang chấm...</p>
          </div>
        </div>
      )}

      {/* overlay giám sát toàn màn hình */}
      {guardOverlay && (
        <div className="fixed inset-0 z-[60] bg-primary-hover/[.97] text-white flex items-center justify-center p-6 text-center">
          <div className="max-w-md">
            {guardOverlay.kind === 'warn' ? (
              <>
                <h3 className="text-2xl font-extrabold">⚠️ Bạn đã thoát ra ngoài</h3>
                <div className="text-[42px] font-extrabold my-2">{guardOverlay.n}/2</div>
                <p className="text-[15px] leading-relaxed opacity-95 mb-5">
                  Trong lúc luyện tập, vui lòng giữ <b>toàn màn hình</b> để tập trung.
                  <br />
                  Thoát ra ngoài <b>lần thứ 3</b> sẽ kết thúc phiên.
                </p>
                <Button
                  size="lg"
                  className="!bg-white !text-primary hover:!bg-primary-light"
                  onClick={async () => {
                    await enterFullscreen();
                    setGuardOverlay(null);
                  }}
                >
                  Quay lại toàn màn hình
                </Button>
              </>
            ) : (
              <>
                <h3 className="text-2xl font-extrabold">🔒 Phiên luyện tập đã kết thúc</h3>
                <p className="text-[15px] leading-relaxed opacity-95 my-4">
                  Bạn đã thoát ra ngoài quá số lần cho phép (3 lần).
                  <br />
                  Hãy bắt đầu một phiên mới.
                </p>
                <Button
                  size="lg"
                  className="!bg-white !text-primary hover:!bg-primary-light"
                  onClick={handleLockReset}
                >
                  Về màn hình bắt đầu
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* header: nút về trang Công cụ + hero */}
      <div className="flex items-center justify-between">
        <Link
          to="/student/resources"
          className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline py-2"
        >
          ← Công cụ
        </Link>
      </div>
      <div className="text-center mt-1 mb-4 px-2">
        <h1 className="text-xl md:text-2xl font-extrabold text-primary uppercase tracking-wide">
          Writing Intro Coach
        </h1>
        <p className="text-[13px] md:text-sm text-slate-500 mt-1.5 leading-relaxed">
          Luyện viết MỞ BÀI từng cấu phần · Chấm 4 tiêu chí TR/CC/LR/GRA · IELTS Writing Task 2 ·
          Discuss both views
        </p>
      </div>

      {/* stepper 3 cấu phần */}
      <div className="flex gap-2 mb-4 px-1">
        {stepLabels.map((lab, i) => {
          const done = screen === 'done' || i < compIdx;
          const active = screen !== 'done' && i === compIdx;
          return (
            <div key={lab} className="flex-1 text-center">
              <div
                className={`h-1.5 rounded-full transition-colors ${
                  done ? 'bg-primary' : active ? 'bg-[#B8860B]' : 'bg-[#C9E2CF]'
                }`}
              />
              <div
                className={`mt-1.5 text-[11px] font-semibold whitespace-nowrap ${
                  done ? 'text-primary' : active ? 'text-[#B8860B]' : 'text-slate-400'
                }`}
              >
                {lab}
              </div>
            </div>
          );
        })}
      </div>

      {/* ============ BẮT ĐẦU ============ */}
      {screen === 'start' && (
        <section className="card card-body">
          <h2 className="section-title">Bắt đầu</h2>
          <label className="block text-[13px] font-semibold text-primary-hover mt-4 mb-1.5" htmlFor="introStudentName">
            Tên học viên (để ghi vào lịch sử luyện tập)
          </label>
          <input
            id="introStudentName"
            type="text"
            className="input-base"
            placeholder="VD: Nguyen Van A"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
          />
          <p className="block text-[13px] font-semibold text-primary-hover mt-4 mb-1.5">
            Trình độ hiện tại của bạn (để góp ý đúng mức)
          </p>
          <div className="flex flex-wrap gap-2">
            {LEVELS.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setStudentLevel(l)}
                className={`px-4 py-2.5 rounded-full text-[13px] font-semibold border-[1.5px] transition-colors ${
                  l === studentLevel
                    ? 'bg-primary text-white border-primary'
                    : 'bg-primary-subtle text-primary-hover border-[#C9E2CF] hover:bg-primary-light hover:border-primary'
                }`}
              >
                Band {l}
              </button>
            ))}
          </div>
          <div className="mt-4 bg-primary-subtle border-l-4 border-[#B8860B] rounded-lg px-4 py-3 text-sm leading-relaxed">
            <b>Cách học:</b> Mỗi lần bắt đầu, hệ thống cho một <b>đề ngẫu nhiên</b>. Bạn viết lần
            lượt <b>Hook → Paraphrase → Thesis</b>. Mỗi câu được chấm 4 tiêu chí; <b>đạt Band 7</b>{' '}
            mới mở phần tiếp theo. Cứ viết lại đến khi ổn nhé.
          </div>
          <div className="mt-3 bg-primary-light border-l-4 border-primary rounded-lg px-4 py-3 text-sm leading-relaxed">
            <b>Lưu ý:</b> Khi bấm "Bắt đầu", tool sẽ mở <b>toàn màn hình</b> để bạn tập trung.
            Thoát ra ngoài quá 2 lần sẽ kết thúc phiên.
          </div>
          <div className="mt-5">
            <Button size="lg" className="w-full sm:w-auto" loading={starting} onClick={handleStart}>
              {starting ? 'Đang tạo đề...' : 'Bắt đầu luyện →'}
            </Button>
          </div>
        </section>
      )}

      {/* ============ LUYỆN TẬP ============ */}
      {screen === 'coach' && (
        <section className="card card-body">
          <PromptBox p={promptObj} />

          <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
            <h2 className="section-title">{curComp.title}</h2>
            <span className="bg-primary text-white text-[13px] font-bold px-3 py-1 rounded-full whitespace-nowrap">
              Mục tiêu {curComp.target || 'Band 7'}
            </span>
          </div>
          <div className="mt-3">
            <ComponentGuide c={components[compIdx]} />
          </div>

          <label className="block text-[13px] font-semibold text-primary-hover mt-5 mb-1.5" htmlFor="introWriteBox">
            Viết câu của bạn cho cấu phần này (tiếng Anh)
          </label>
          <textarea
            id="introWriteBox"
            ref={writeRef}
            rows={4}
            className="input-base min-h-[100px] leading-relaxed resize-y"
            placeholder="Viết câu tiếng Anh của bạn ở đây..."
            value={sentence}
            onChange={(e) => setSentence(e.target.value)}
          />
          <div className="mt-3 flex items-center gap-2.5 flex-wrap">
            <Button size="lg" onClick={handleGrade} disabled={grading || changingPrompt}>
              Chấm &amp; Góp ý
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => setConfirmNewPrompt(true)}
              disabled={grading || changingPrompt}
            >
              {changingPrompt ? '↻ Đang lấy đề...' : '↻ Đề khác'}
            </Button>
          </div>

          {/* -------- phản hồi chấm -------- */}
          {fb && (
            <div className="mt-5 border-t border-dashed border-[#C9E2CF] pt-4">
              {fb.error ? (
                <div className="bg-[#FCEEE8] border-l-4 border-[#C0392B] rounded-lg px-4 py-3 text-sm leading-relaxed">
                  {fb.error}
                </div>
              ) : (
                <>
                  <p className="text-xl font-extrabold text-primary-hover">
                    Overall Band: {fbData.overall_band || '–'}
                  </p>

                  <div className="mt-3">
                    <h4 className="text-[13px] font-bold text-primary-hover uppercase tracking-wide mb-1.5">
                      4 tiêu chí
                    </h4>
                    {CRIT_ORDER.map((k) => {
                      const o = crit[k] || {};
                      return (
                        <div key={k} className="flex items-start gap-2.5 my-2">
                          <div className="w-11 shrink-0 font-extrabold text-primary-hover text-[13px] pt-0.5">
                            {k}
                          </div>
                          <span
                            className="shrink-0 text-xs font-bold px-2.5 py-0.5 rounded-full text-white whitespace-nowrap"
                            style={{ background: critColor(o.band) }}
                          >
                            {o.band || '–'}
                          </span>
                          <div className="flex-1 text-[13.5px] leading-relaxed text-slate-700">
                            <MdBold text={o.comment || ''} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {fbData.strengths && fbData.strengths.length > 0 && (
                    <div className="mt-3">
                      <h4 className="text-[13px] font-bold text-primary-hover uppercase tracking-wide mb-1.5">
                        ✓ Điểm tốt
                      </h4>
                      {fbData.strengths.map((s, i) => (
                        <div key={i} className="bg-primary-light rounded-lg px-3 py-2.5 my-1.5 text-sm leading-relaxed">
                          <MdBold text={s} />
                        </div>
                      ))}
                    </div>
                  )}

                  {fbData.issues && fbData.issues.length > 0 && (
                    <div className="mt-3">
                      <h4 className="text-[13px] font-bold text-primary-hover uppercase tracking-wide mb-1.5">
                        Cần chỉnh
                      </h4>
                      {fbData.issues.map((iss, i) => {
                        const ty = (iss.type || 'pragmatics').toLowerCase();
                        return (
                          <div key={i} className="bg-[#FCEEE8] rounded-lg px-3 py-2.5 my-1.5 text-sm leading-relaxed">
                            <span
                              className="inline-block text-[11px] font-bold uppercase text-white px-2 py-0.5 rounded-md mr-1.5"
                              style={{ background: issueColor(ty) }}
                            >
                              {ty}
                            </span>
                            <MdBold text={iss.problem} />
                            <br />
                            <b>→ Sửa:</b> <MdBold text={iss.fix} />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {fbData.model_sentence && (
                    <div className="mt-3">
                      <h4 className="text-[13px] font-bold text-primary-hover uppercase tracking-wide mb-1.5">
                        Câu mẫu tham khảo (~B7.5)
                      </h4>
                      <div className="bg-white border-[1.5px] border-primary rounded-lg px-3.5 py-3 text-[15px] italic leading-relaxed">
                        {fbData.model_sentence}
                      </div>
                    </div>
                  )}

                  {fbData.next_hint && (
                    <div className="mt-3 bg-primary-light border-l-4 border-primary rounded-lg px-4 py-3 text-sm leading-relaxed">
                      <b>Đi xa hơn:</b> <MdBold text={fbData.next_hint} />
                    </div>
                  )}

                  <div
                    className={`mt-4 rounded-xl px-4 py-3 text-white font-bold text-center ${
                      passed ? 'bg-primary' : 'bg-[#9A6A2B]'
                    }`}
                  >
                    {passed
                      ? '✓ Đạt Band 7 cho cấu phần này!'
                      : 'Gần đạt rồi, chỉnh thêm theo góp ý rồi chấm lại nhé.'}
                  </div>

                  {/* câu mẫu B7/8/9 (chỉ mở khi đạt) */}
                  {exemplars === 'loading' && (
                    <div className="flex items-center gap-2 text-slate-500 text-sm py-3">
                      <Spinner /> Đang lấy câu mẫu...
                    </div>
                  )}
                  {exemplars && exemplars.error && (
                    <div className="mt-3 bg-[#FCEEE8] border-l-4 border-[#C0392B] rounded-lg px-4 py-3 text-sm leading-relaxed">
                      {exemplars.error}
                    </div>
                  )}
                  {exemplars && exemplars.data && <ExemplarList data={exemplars.data} />}

                  <div className="mt-4 flex items-center gap-2.5 flex-wrap">
                    {passed ? (
                      <>
                        {!(exemplars && exemplars.data) && (
                          <Button
                            variant="outline"
                            size="lg"
                            onClick={handleExemplars}
                            disabled={exemplars === 'loading'}
                          >
                            Xem câu mẫu Band 7/8/9
                          </Button>
                        )}
                        {compIdx < components.length - 1 ? (
                          <Button size="lg" onClick={handleNextComp}>
                            Sang cấu phần tiếp theo →
                          </Button>
                        ) : (
                          <Button size="lg" onClick={handleFinish}>
                            Xem tổng kết 🎉
                          </Button>
                        )}
                        <Button variant="outline" size="lg" onClick={handleRetry}>
                          Viết lại
                        </Button>
                      </>
                    ) : (
                      <Button size="lg" onClick={handleRetry}>
                        Viết lại
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      )}

      {/* ============ HOÀN THÀNH ============ */}
      {screen === 'done' && (
        <section className="card card-body">
          <h2 className="section-title">🎉 Hoàn thành mở bài!</h2>
          <p className="text-[13px] text-slate-500 mt-1">
            Mở bài hoàn chỉnh của bạn (ghép 3 cấu phần đã đạt):
          </p>
          <div className="my-3 bg-white border-[1.5px] border-primary rounded-lg px-3.5 py-3 text-[15px] italic leading-relaxed">
            {finalIntro}
          </div>
          <div className="space-y-2.5">
            {results.filter(Boolean).map((r) => (
              <div
                key={r.key}
                className="bg-primary-light border-l-4 border-primary rounded-lg px-4 py-3 text-sm leading-relaxed"
              >
                <span
                  className={`inline-block text-white text-[13px] font-bold px-3 py-0.5 rounded-full mr-2 ${
                    parseFloat(r.overall_band) >= 8 ? 'bg-[#B8860B]' : 'bg-primary'
                  }`}
                >
                  Band {r.overall_band}
                </span>
                <i>{r.sentence}</i>
                <p className="text-xs text-slate-500 mt-1">{r.title}</p>
              </div>
            ))}
          </div>

          {/* lưu lịch sử (thay cho xuất file .docx của bản gốc) */}
          <div className="mt-4 bg-primary-subtle border-l-4 border-[#B8860B] rounded-lg px-4 py-3 text-sm leading-relaxed">
            <b>Lưu lại buổi học:</b> Kết quả phiên luyện (đề bài, từng cấu phần kèm band 4 tiêu chí)
            được lưu tự động vào <b>Lịch sử luyện tập</b> của em.
          </div>
          <div className="mt-3 text-sm">
            {saveStatus === 'saving' && (
              <span className="inline-flex items-center gap-2 text-slate-500">
                <Spinner /> Đang lưu kết quả vào Lịch sử luyện tập...
              </span>
            )}
            {saveStatus === 'done' && (
              <span className="text-primary font-semibold">
                ✓ Đã lưu vào Lịch sử luyện tập.{' '}
                <Link to="/student/resources/history" className="underline font-bold">
                  Xem lịch sử
                </Link>
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="inline-flex items-center gap-2 text-[#C0392B] font-semibold flex-wrap">
                Chưa lưu được kết quả.
                <Button variant="outline" size="sm" onClick={() => doSave(results)}>
                  Lưu lại
                </Button>
              </span>
            )}
          </div>

          <div className="mt-5 flex items-center gap-2.5 flex-wrap">
            <Button size="lg" onClick={handleAgain}>
              Luyện đề khác
            </Button>
            <Link to="/student/resources" className="btn-outline">
              ← Công cụ
            </Link>
          </div>
        </section>
      )}

      <p className="text-center text-[11px] text-slate-400 mt-6 leading-relaxed px-4">
        2SOL · Writing Intro Coach, công cụ luyện viết nội bộ. Phương pháp luyện mở bài theo lăng
        kính pragmatic–semantic do Be Able VN biên soạn.
      </p>
    </div>
  );
};

export default IntroCoach;
