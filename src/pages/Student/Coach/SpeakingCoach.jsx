import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { Input, Select, Toast } from '../../../components/UI';
import { callCoach } from './shared/coachApi';
import { speak, stopVoice, unlockAudio } from './shared/speak';
import { BAND_OPTIONS, DEFAULT_BAND, DRILL_COUNT } from './speaking/constants';
import { ErrBox, PartBadge } from './speaking/bits';
import ExamRunner from './speaking/ExamRunner';
import ReportView from './speaking/ReportView';

/*
 * SPEAKING COACH: port speaking.html (Flask COACH SUITE) vào app EDU.
 * 3 chế độ: Luyện tập (feedback + nói lại) · Luyện Part 1 (sửa tới khi đúng)
 * · Thi thật (ẩn điểm, giám sát gian lận, band tổng cuối).
 *
 * Khác bản gốc:
 * - BỎ màn đăng nhập / api mode / warmup riêng: học viên đã đăng nhập EDU,
 *   danh tính lấy từ useAuth, backend nhận diện qua Firebase Auth.
 * - BỎ ô nhập Tên / Ghi chú-Lớp: tên lấy từ tài khoản đang đăng nhập.
 * - BỎ xuất .docx: kết quả được server lưu tự động vào Lịch sử luyện tập.
 * - Gọi API qua callCoach thay vì fetch /speaking/api/*.
 */

const TABS = [
  { id: 'practice', label: 'Luyện tập', small: 'cả 3 phần · chấm từng câu' },
  { id: 'drill', label: 'Luyện Part 1', small: '3s chuẩn bị · 15s nói · sửa tới khi đúng' },
  { id: 'exam', label: 'Thi thật', small: 'không hiện điểm · band tổng ở cuối' },
];

const START_LABEL = {
  practice: 'Bắt đầu Luyện tập',
  drill: 'Bắt đầu Luyện Part 1',
  exam: 'Bắt đầu Thi thật',
};

// Port buildQueue(): xếp hàng đợi câu hỏi từ đề server trả về
function buildQueue(test, mode) {
  const queue = [];
  if (mode === 'drill') {
    const qs = test.questions || [];
    qs.forEach((q, i) => queue.push({ part: 1, q, n: i + 1, total: qs.length }));
    return queue;
  }
  const p1 = test.part1 || [];
  const p3 = test.part3 || [];
  p1.forEach((q, i) => queue.push({ part: 1, q, n: i + 1, total: p1.length }));
  if (test.part2) queue.push({ part: 2, q: test.part2.topic, cue: test.part2, n: 1, total: 1 });
  p3.forEach((q, i) => queue.push({ part: 3, q, n: i + 1, total: p3.length }));
  return queue;
}

// Đoạn nhấn xanh/đỏ trong khối hướng dẫn (port .hl / .hlr)
const Hl = ({ children }) => (
  <span className="bg-[#E8F4EC] text-[#1E5225] font-bold px-1 rounded">{children}</span>
);
const Hlr = ({ children }) => (
  <span className="bg-red-50 text-red-700 font-bold px-1 rounded">{children}</span>
);

const GuideLine = ({ children }) => (
  <p className="relative pl-4 my-2 leading-relaxed before:content-['–'] before:absolute before:left-0 before:text-[#3D8B47] before:font-bold">
    {children}
  </p>
);

const SpeakingCoach = () => {
  const { currentUser } = useAuth();
  const studentName = currentUser?.name || currentUser?.fullName || 'Học viên';

  const [mode, setMode] = useState('practice');
  const [topic, setTopic] = useState('');
  const [band, setBand] = useState(DEFAULT_BAND);
  const [screen, setScreen] = useState('setup'); // setup | exam | drillDone | report | ban
  const [session, setSession] = useState(null); // { mode, queue, topicLabel }
  const [report, setReport] = useState(null);
  const [drillStats, setDrillStats] = useState(null);
  const [starting, setStarting] = useState(false);
  const [setupErr, setSetupErr] = useState('');
  const [micStatus, setMicStatus] = useState('');
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'warning') => setToast({ msg, type });

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  // Rời trang giữa chừng: tắt giọng giám khảo còn phát
  useEffect(() => () => stopVoice(), []);

  // Port testMic(): chỉ chạy trong click handler
  const testMic = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((t) => t.stop());
      setMicStatus('✅ Micro hoạt động tốt');
    } catch (e) {
      setMicStatus('❌ Không truy cập được micro, kiểm tra quyền trình duyệt');
    }
  };

  // Port testVoice()
  const testVoice = () => {
    unlockAudio();
    setMicStatus('🔊 Đang tải giọng và đọc thử... (cần internet)');
    speak('Hello! This is your examiner speaking. If you can hear me clearly, we are ready to begin.', () => {
      setMicStatus('✅ Đã đọc xong. Không nghe thấy → kiểm tra loa/volume.');
    });
  };

  // Port startTest(): sinh đề rồi vào vòng thi
  const handleStart = async () => {
    setSetupErr('');
    unlockAudio(); // mở khóa autoplay 1 lần, ngay trong thao tác bấm nút
    if (mode === 'exam' && !document.fullscreenElement) {
      // PHẢI gọi ngay trong click, trình duyệt chỉ cho fullscreen khi có thao tác người dùng
      try {
        const p = document.documentElement.requestFullscreen();
        if (p && p.catch) p.catch(() => {});
      } catch (e) {
        /* exam guard sẽ chặn lại nếu chưa vào được fullscreen */
      }
    }
    setStarting(true);
    try {
      const base = { topic: topic.trim(), target_band: band };
      const d =
        mode === 'drill'
          ? await callCoach('speaking', 'generatePart1', { ...base, count: DRILL_COUNT })
          : await callCoach('speaking', 'generateTest', base);
      const queue = buildQueue(d, mode);
      if (!queue.length) throw new Error('Tạo đề chưa đủ cấu trúc, bấm Bắt đầu lại.');
      setReport(null);
      setDrillStats(null);
      setSession({
        mode,
        queue,
        topicLabel: mode === 'drill' ? d.topic_title || topic.trim() : topic.trim(),
      });
      setScreen('exam');
      window.scrollTo({ top: 0 });
    } catch (e) {
      if (e.code === 'functions/resource-exhausted') showToast(e.message);
      setSetupErr(e.message);
    } finally {
      setStarting(false);
    }
  };

  const resetAll = () => {
    stopVoice();
    setSession(null);
    setReport(null);
    setDrillStats(null);
    setSetupErr('');
    setMicStatus('');
    setScreen('setup');
    window.scrollTo({ top: 0 });
  };

  const handleReport = (d) => {
    setReport(d);
    setScreen('report');
    window.scrollTo({ top: 0 });
  };
  const handleDrillDone = (stats) => {
    setDrillStats(stats);
    setScreen('drillDone');
  };
  const handleBanned = () => {
    setScreen('ban');
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="space-y-5">
      {toast && <Toast message={toast.msg} type={toast.type} />}

      {/* Hero + nút về khu công cụ */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="page-title uppercase">Speaking Coach</h1>
          <p className="page-sub max-w-xl leading-relaxed">
            Luyện Speaking Part 1 · 2 · 3 như thi thật: giám khảo đọc đề, chấm FC / LR / GRA / PR theo thang
            điểm chuẩn và sửa từng lỗi.
          </p>
        </div>
        {screen !== 'exam' && (
          <Link
            to="/student/resources"
            className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-[#2B6830] shadow-sm hover:bg-[#F2F8F4] transition-colors"
          >
            ← Tài nguyên &amp; Luyện tập
          </Link>
        )}
      </div>

      {/* ============ MÀN 1: THIẾT LẬP ============ */}
      {screen === 'setup' && (
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setMode(t.id)}
                className={`rounded-xl px-2 py-3 text-center font-bold text-sm border-[1.5px] transition-all ${
                  mode === t.id
                    ? 'bg-[#2B6830] text-white border-[#2B6830]'
                    : 'bg-white text-[#1E5225] border-[#C9E2CF] hover:bg-[#F2F8F4]'
                }`}
              >
                {t.label}
                <small
                  className={`block font-normal text-[11px] mt-0.5 leading-tight ${
                    mode === t.id ? 'text-[#dfeede]' : 'text-slate-400'
                  }`}
                >
                  {t.small}
                </small>
              </button>
            ))}
          </div>

          <div className="card card-body space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select label="Band mục tiêu" value={band} onChange={(e) => setBand(e.target.value)}>
                {BAND_OPTIONS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </Select>
              <Input
                label="Chủ đề muốn luyện (bỏ trống = bốc ngẫu nhiên như thi thật)"
                placeholder="VD: Travel, Technology, Food..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={testMic} className="btn-outline">
                🎤 Kiểm tra micro
              </button>
              <button type="button" onClick={testVoice} className="btn-outline">
                🔊 Test giọng giám khảo
              </button>
            </div>
            {micStatus && <p className="text-[12.5px] text-slate-500">{micStatus}</p>}

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={handleStart}
                disabled={starting}
                className="btn-primary btn-lg w-full sm:w-auto"
              >
                {starting && (
                  <span className="inline-block w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                )}
                {START_LABEL[mode]}
              </button>
              {starting && <p className="text-sm text-slate-500 mt-2.5">Đang chuẩn bị đề...</p>}
            </div>
            <ErrBox msg={setupErr} />
          </div>

          {/* Khối hướng dẫn, port #modeHelp */}
          <div className="card card-body text-[13px] text-slate-500">
            <div className="font-bold text-[#1E5225] text-xs uppercase tracking-wide mb-2.5">Cách hoạt động</div>
            <GuideLine>
              Giám khảo sẽ <b className="text-[#1E5225]">đọc câu hỏi thành tiếng</b>, nhớ bật loa hoặc tai nghe.{' '}
              <b className="text-[#1E5225]">Nên dùng Microsoft Edge</b> để giọng đọc tự nhiên nhất.
            </GuideLine>
            <GuideLine>
              Mỗi câu có thời gian chuẩn bị rồi <b className="text-[#1E5225]">tự động thu âm</b>: Part 1 – 15 giây
              / 40 giây · Part 2 – 1 phút / 2 phút · Part 3 – 15 giây / 60 giây.
            </GuideLine>
            {mode === 'practice' && (
              <GuideLine>
                Chế độ <b className="text-[#1E5225]">Luyện tập</b>: sau mỗi câu hiện lỗi ngữ pháp, từ vựng, phát âm
                kèm <b className="text-[#1E5225]">gợi ý theo phương pháp Be Able</b>, em được{' '}
                <b className="text-[#1E5225]">nói lại 1 lần</b> để sửa.
              </GuideLine>
            )}
            {mode === 'drill' && (
              <GuideLine>
                Chế độ <b className="text-[#1E5225]">Luyện Part 1</b>: hệ thống ra một bộ{' '}
                <b className="text-[#1E5225]">6–8 câu Part 1</b>. Mỗi câu em có{' '}
                <b className="text-[#1E5225]">3 giây chuẩn bị</b> rồi <b className="text-[#1E5225]">15 giây trả lời</b>;
                đang nói mà <b className="text-[#1E5225]">ngừng quá 3 giây</b> sẽ tự kết thúc. Sau đó giám khảo{' '}
                <b className="text-[#1E5225]">chỉ lỗi ngữ pháp và phát âm</b>, đọc mẫu câu đúng để em nghe theo; em{' '}
                <b className="text-[#1E5225]">nói lại đến khi không còn lỗi</b> mới sang câu tiếp (tối đa 4 lần/câu).
              </GuideLine>
            )}
            {mode === 'exam' && (
              <GuideLine>
                Chế độ <b className="text-[#1E5225]">Thi thật</b>: trả lời liên tục cả 3 phần,{' '}
                <Hl>không hiện điểm giữa chừng</Hl>, band tổng và phân tích từng câu chỉ hiện ở cuối.{' '}
                <Hlr>Quy định:</Hlr> bài chạy <b className="text-[#1E5225]">toàn màn hình</b>; rời màn hình lần 1 bị
                cảnh báo, <Hlr>lần 2 bị đình chỉ</Hlr> và biên bản tự tải về.
              </GuideLine>
            )}
          </div>
        </div>
      )}

      {/* ============ MÀN 2: THI ============ */}
      {screen === 'exam' && session && (
        <ExamRunner
          mode={session.mode}
          queue={session.queue}
          targetBand={band}
          topicLabel={session.topicLabel}
          studentName={studentName}
          onReport={handleReport}
          onDrillDone={handleDrillDone}
          onBanned={handleBanned}
          showToast={showToast}
        />
      )}

      {/* ============ MÀN: HOÀN THÀNH LUYỆN PART 1 ============ */}
      {screen === 'drillDone' && drillStats && (
        <div className="max-w-2xl mx-auto">
          <div className="card card-body text-center">
            <PartBadge>HOÀN THÀNH PART 1</PartBadge>
            <div className="text-5xl my-3">🎉</div>
            <p className="text-base font-bold text-[#2B6830] my-1.5">Em đã luyện xong bộ câu Part 1!</p>
            <p className="text-sm text-slate-500 leading-relaxed my-2">
              Em đã luyện <b>{drillStats.total}</b> câu Part 1, trong đó <b>{drillStats.cleanFirst}</b> câu nói
              đúng ngay lần đầu. Mỗi lần luyện lại là một bước tiến 💪
            </p>
            <div className="mt-3">
              <button type="button" onClick={resetAll} className="btn-primary btn-lg">
                Luyện bộ mới
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ MÀN 3: BÁO CÁO ============ */}
      {screen === 'report' && report && (
        <div className="max-w-3xl mx-auto">
          <ReportView
            report={report}
            studentName={studentName}
            modeLabel={session?.mode === 'exam' ? 'Thi thật' : 'Luyện tập'}
            targetBand={band}
            onRestart={resetAll}
          />
        </div>
      )}

      {/* ============ MÀN 4: ĐÌNH CHỈ (chỉ Thi thật) ============ */}
      {screen === 'ban' && (
        <div className="max-w-2xl mx-auto">
          <div className="card card-body text-center">
            <h2 className="text-red-600 text-2xl font-extrabold">🚫 BÀI THI BỊ ĐÌNH CHỈ</h2>
            <p className="my-3.5 text-[15px] leading-relaxed">
              Đã rời khỏi màn hình thi lần thứ 2 sau khi được cảnh báo.
              <br />
              Trong kỳ thi thật, hành vi này dẫn đến hủy kết quả thi.
            </p>
            <p className="text-sm text-slate-500">
              Biên bản kèm bài làm đã được <b>tự động tải về máy</b>.
            </p>
            <div className="mt-4">
              <button type="button" onClick={resetAll} className="btn-outline btn-lg">
                Về trang đầu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SpeakingCoach;
