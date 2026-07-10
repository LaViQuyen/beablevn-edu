import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ref, onValue } from 'firebase/database';
import { db } from '../../../firebase';
import { useAuth } from '../../../context/AuthContext';
import { MdBold, MdRich } from './shared/mdText';
import { Card, Badge, SkeletonCard, EmptyState, FilterGroup } from '../../../components/UI';

/*
 * LỊCH SỬ LUYỆN TẬP, trang tổng hợp kết quả các phiên IELTS Coach.
 * Dữ liệu do SERVER ghi tại coachHistory/{uid}/{tool}/{pushId} (client chỉ đọc):
 *   speaking: {at, mode, targetBand, topic, overall, bands, report, drillStats}
 *   writing : {at, summary}   summary = phiên Writing Coach (topic, base, journey...)
 *   intro   : {at, summary}   summary = phiên Intro Coach (prompt, components...)
 * Mọi field đều CÓ THỂ THIẾU (nhiều mode, bản ghi cũ), nên render phòng thủ:
 * thiếu phần nào bỏ qua phần đó, không đặt giả định về schema.
 */

// ---------------------------------------------------------------------------
// Helpers phòng thủ
// ---------------------------------------------------------------------------

// RTDB có thể trả mảng thưa thành object {0:..,2:..}; chuẩn hoá về mảng sạch
const toList = (v) => {
  if (Array.isArray(v)) return v.filter(Boolean);
  if (v && typeof v === 'object') {
    return Object.keys(v)
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => v[k])
      .filter(Boolean);
  }
  return [];
};

const asObj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const fmtAt = (at) => {
  const n = Number(at);
  if (!Number.isFinite(n) || n <= 0) return '';
  try {
    return new Date(n).toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '';
  }
};

const clip = (s, max = 110) => {
  const t = String(s == null ? '' : s).trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

const CRIT_NAMES = {
  FC: 'Fluency & Coherence',
  LR: 'Lexical Resource',
  GRA: 'Grammatical Range & Accuracy',
  PR: 'Pronunciation',
};
const INTRO_CRIT = {
  TR: 'Task Response',
  CC: 'Coherence & Cohesion',
  LR: 'Lexical Resource',
  GRA: 'Grammar',
};
const MODE_LABELS = { practice: 'Luyện tập', exam: 'Thi thật', drill: 'Luyện Part 1' };
const WRITING_TOTAL_LEVELS = 7; // 7 bậc của Writing Coach
const INTRO_TOTAL_COMPONENTS = 3; // Hook, Paraphrase, Thesis

const TOOL_META = {
  speaking: { label: 'Speaking', badge: 'primary' },
  writing: { label: 'Writing', badge: 'green' },
  intro: { label: 'Mở bài', badge: 'amber' },
};

// Cấu phần intro "đạt" khi server chấm passed; bản ghi cũ thiếu cờ thì xét band >= 7
const introPassed = (c) =>
  !!c && (c.passed === true || (c.passed == null && (num(c.overall_band) || 0) >= 7));

// ---------------------------------------------------------------------------
// Icon nhỏ (stroke = currentColor)
// ---------------------------------------------------------------------------
const IconClock = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
  </svg>
);
const IconChevron = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

// ---------------------------------------------------------------------------
// Mảnh UI dùng chung trong trang
// ---------------------------------------------------------------------------
const SecTitle = ({ children }) => (
  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{children}</p>
);

const BandPill = ({ band, prefix = 'Band' }) => {
  if (band == null || band === '') return null;
  const n = num(band);
  const high = n != null && n >= 8;
  return (
    <span
      className={`inline-flex items-center shrink-0 px-2.5 py-1 rounded-full text-xs font-bold ${
        high ? 'bg-amber-100 text-amber-700' : 'bg-[#E8F4EC] text-[#2B6830]'
      }`}
    >
      {prefix} {n != null && !Number.isInteger(n) ? n.toFixed(1) : String(band)}
    </span>
  );
};

const BulletList = ({ items, highlight }) => (
  <ul className="space-y-1">
    {items.map((s, i) => (
      <li key={i} className="text-sm text-slate-600 leading-relaxed flex gap-2">
        <span className="text-[#2B6830] shrink-0">•</span>
        <span><MdRich text={String(s)} className={highlight} /></span>
      </li>
    ))}
  </ul>
);

// Danh sách lỗi cần chỉnh: phần tử có thể là string hoặc {type, problem, fix}
const IssueList = ({ issues }) => (
  <ul className="space-y-1.5">
    {issues.map((it, i) => {
      if (typeof it === 'string') {
        return (
          <li key={i} className="text-sm text-slate-600 leading-relaxed flex gap-2">
            <span className="text-red-500 shrink-0">•</span>
            <span>{it}</span>
          </li>
        );
      }
      const o = asObj(it);
      return (
        <li key={i} className="text-sm text-slate-600 leading-relaxed flex gap-2">
          <span className="text-red-500 shrink-0">•</span>
          <span>
            {o.type && (
              <b className="text-red-600 uppercase text-xs mr-1">[{String(o.type)}]</b>
            )}
            {o.problem && <span>{String(o.problem)} </span>}
            {o.fix && (
              <span>
                <b className="text-[#1E5225]">→ Sửa:</b> {String(o.fix)}
              </span>
            )}
          </span>
        </li>
      );
    })}
  </ul>
);

// ---------------------------------------------------------------------------
// CHI TIẾT: SPEAKING (report tổng kết cuối phiên + phân tích từng câu)
// ---------------------------------------------------------------------------
const SpeakingDetail = ({ rec }) => {
  const report = asObj(rec.report);
  const bands = asObj(rec.bands && Object.keys(asObj(rec.bands)).length ? rec.bands : report.bands);
  const perCrit = asObj(report.per_criterion);
  const perQ = toList(report.per_question);
  const strengths = toList(report.strengths);
  const improvements = toList(report.improvements);
  const drill = asObj(rec.drillStats);
  const critRows = ['FC', 'LR', 'GRA', 'PR'].filter(
    (k) => num(bands[k]) != null || perCrit[k]
  );
  const hasAnything =
    critRows.length || perQ.length || strengths.length || improvements.length ||
    report.examiner_comment_vi || drill.done != null;

  if (!hasAnything) {
    return <p className="text-sm text-slate-400">Phiên này chưa có dữ liệu chi tiết được lưu.</p>;
  }

  return (
    <div className="space-y-4">
      {drill.done != null && (
        <p className="text-sm text-slate-600 bg-[#F2F8F4] rounded-xl px-3 py-2">
          Em đã luyện <b className="text-[#2B6830]">{num(drill.done) ?? 0}</b> câu Part 1, trong đó{' '}
          <b className="text-[#2B6830]">{num(drill.cleanFirst) ?? 0}</b> câu nói đúng ngay lần đầu.
          Mỗi lần luyện lại là một bước tiến 💪
        </p>
      )}

      {report.examiner_comment_vi && (
        <div className="space-y-1.5">
          <SecTitle>Nhận xét của giám khảo</SecTitle>
          <p className="text-sm text-slate-600 leading-relaxed">
            <MdRich text={report.examiner_comment_vi} />
          </p>
        </div>
      )}

      {critRows.length > 0 && (
        <div className="space-y-1.5">
          <SecTitle>Band theo 4 tiêu chí</SecTitle>
          <div className="space-y-2">
            {critRows.map((k) => {
              const b = num(bands[k]);
              return (
                <div key={k} className="flex gap-3 items-start bg-slate-50 rounded-xl px-3 py-2">
                  <span className="shrink-0 w-9 h-9 rounded-lg bg-[#E8F4EC] text-[#2B6830] font-extrabold flex items-center justify-center">
                    {b != null ? Math.floor(b) : '?'}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#1E5225]">
                      {CRIT_NAMES[k]} ({k})
                    </p>
                    {perCrit[k] && (
                      <p className="text-sm text-slate-600 leading-relaxed">
                        <MdRich text={perCrit[k]} />
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {strengths.length > 0 && (
        <div className="space-y-1.5">
          <SecTitle>Điểm mạnh</SecTitle>
          <BulletList items={strengths} highlight="text-emerald-700 font-semibold" />
        </div>
      )}

      {improvements.length > 0 && (
        <div className="space-y-1.5">
          <SecTitle>Ưu tiên cải thiện</SecTitle>
          <BulletList items={improvements} highlight="text-red-600 font-semibold" />
        </div>
      )}

      {perQ.length > 0 && (
        <div className="space-y-2">
          <SecTitle>Phân tích từng câu</SecTitle>
          {perQ.map((q0, i) => {
            const q = asObj(q0);
            return (
              <div key={i} className="rounded-xl border border-slate-100 p-3 space-y-2">
                <p className="text-sm font-bold text-slate-700">
                  {q.part != null && (
                    <span className="inline-block text-[10px] font-bold bg-[#2B6830] text-white rounded px-1.5 py-0.5 mr-2 align-middle">
                      PART {String(q.part)}
                    </span>
                  )}
                  {q.question ? String(q.question) : ''}
                </p>
                {q.transcript && (
                  <div className="bg-slate-50 rounded-lg px-3 py-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">🎙 Em đã nói</p>
                    <p className="text-sm text-slate-600 italic leading-relaxed">{String(q.transcript)}</p>
                  </div>
                )}
                {q.good_vi && (
                  <p className="text-sm text-emerald-700 leading-relaxed">
                    ✓ <MdBold text={q.good_vi} />
                  </p>
                )}
                {q.improve_vi && (
                  <p className="text-sm text-slate-600 leading-relaxed">
                    ↗ <MdBold text={q.improve_vi} />
                  </p>
                )}
                {q.revised && (
                  <div className="bg-[#F2F8F4] rounded-lg px-3 py-2">
                    <p className="text-[10px] font-bold text-[#2B6830] uppercase tracking-wide">
                      ✍ Chỉnh theo phương pháp Be Able VN
                    </p>
                    <p className="text-sm text-[#1E5225] leading-relaxed">{String(q.revised)}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// CHI TIẾT: WRITING (hành trình nâng band 7 bậc)
// ---------------------------------------------------------------------------
const WritingDetail = ({ summary }) => {
  const s = asObj(summary);
  const journey = toList(s.journey);
  const hasIdeas = s.cause || s.effect || s.base;

  if (!journey.length && !hasIdeas) {
    return <p className="text-sm text-slate-400">Phiên này chưa có dữ liệu chi tiết được lưu.</p>;
  }

  return (
    <div className="space-y-4">
      {hasIdeas && (
        <div className="space-y-1.5">
          <SecTitle>Hai ý của em</SecTitle>
          <div className="text-sm text-slate-600 space-y-1 leading-relaxed">
            {s.cause && (
              <p><b className="text-[#1E5225]">Ý 1 · Nguyên nhân:</b> {String(s.cause)}</p>
            )}
            {s.effect && (
              <p><b className="text-[#1E5225]">Ý 2 · Hệ quả:</b> {String(s.effect)}</p>
            )}
            {s.base && (
              <p>
                <b className="text-[#1E5225]">Câu xuất phát (band ~5):</b>{' '}
                <i>{String(s.base)}</i>
              </p>
            )}
          </div>
        </div>
      )}

      {journey.length > 0 && (
        <div className="space-y-2">
          <SecTitle>Hành trình nâng band</SecTitle>
          {journey.map((st0, i) => {
            const st = asObj(st0);
            const fb = asObj(st.feedback);
            const sts = toList(fb.strengths);
            const iss = toList(fb.issues);
            return (
              <div key={i} className="rounded-xl border border-slate-100 p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <BandPill band={st.band} />
                  <span className="text-sm font-bold text-[#1E5225]">
                    {st.level_title ? String(st.level_title) : `Bậc ${i + 1}`}
                  </span>
                </div>
                {st.sentence && (
                  <p className="text-sm text-slate-700 italic leading-relaxed bg-slate-50 rounded-lg px-3 py-2">
                    {String(st.sentence)}
                  </p>
                )}
                {sts.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-[#1E5225]">Điểm tốt:</p>
                    <BulletList items={sts} highlight="text-emerald-700 font-semibold" />
                  </div>
                )}
                {iss.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-[#1E5225]">Cần chỉnh:</p>
                    <IssueList issues={iss} />
                  </div>
                )}
                {fb.model_sentence && (
                  <p className="text-sm text-slate-600 leading-relaxed">
                    <b className="text-[#1E5225]">Câu mẫu tham khảo:</b>{' '}
                    <i>{String(fb.model_sentence)}</i>
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// CHI TIẾT: INTRO (đề bài + 3 cấu phần Hook / Paraphrase / Thesis)
// ---------------------------------------------------------------------------
const IntroDetail = ({ summary }) => {
  const s = asObj(summary);
  const prompt = asObj(s.prompt);
  const comps = toList(s.components);

  if (!comps.length && !prompt.prompt_en) {
    return <p className="text-sm text-slate-400">Phiên này chưa có dữ liệu chi tiết được lưu.</p>;
  }

  return (
    <div className="space-y-4">
      {(prompt.prompt_en || prompt.prompt_vi) && (
        <div className="space-y-1.5">
          <SecTitle>Đề bài</SecTitle>
          {prompt.prompt_en && (
            <p className="text-sm text-slate-700 italic leading-relaxed bg-slate-50 rounded-lg px-3 py-2">
              {String(prompt.prompt_en)}
            </p>
          )}
          {prompt.prompt_vi && (
            <p className="text-xs text-slate-400 leading-relaxed">Dịch: {String(prompt.prompt_vi)}</p>
          )}
          {(prompt.view1_en || prompt.view2_en) && (
            <div className="text-sm text-slate-600 space-y-0.5">
              {prompt.view1_en && (
                <p><b className="text-[#1E5225]">Quan điểm 1:</b> {String(prompt.view1_en)}</p>
              )}
              {prompt.view2_en && (
                <p><b className="text-[#1E5225]">Quan điểm 2:</b> {String(prompt.view2_en)}</p>
              )}
            </div>
          )}
        </div>
      )}

      {comps.map((c0, i) => {
        const c = asObj(c0);
        const crit = asObj(c.criteria);
        const sts = toList(c.strengths);
        const iss = toList(c.issues);
        const ex = asObj(c.exemplars);
        const critKeys = ['TR', 'CC', 'LR', 'GRA'].filter((k) => asObj(crit[k]).band != null || asObj(crit[k]).comment);
        const passed = introPassed(c);
        return (
          <div key={i} className="rounded-xl border border-slate-100 p-3 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <BandPill band={c.overall_band} />
              <span className="text-sm font-bold text-[#1E5225]">
                {c.title ? String(c.title) : `Cấu phần ${i + 1}`}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  passed ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                }`}
              >
                {passed ? '✓ Đạt Band 7' : 'Chưa đạt Band 7'}
              </span>
            </div>
            {c.sentence && (
              <p className="text-sm text-slate-700 italic leading-relaxed bg-slate-50 rounded-lg px-3 py-2">
                {String(c.sentence)}
              </p>
            )}
            {critKeys.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-bold text-[#1E5225]">Band theo 4 tiêu chí:</p>
                {critKeys.map((k) => {
                  const o = asObj(crit[k]);
                  return (
                    <p key={k} className="text-sm text-slate-600 leading-relaxed">
                      <b className="text-[#2B6830]">
                        {INTRO_CRIT[k]} ({k}){o.band != null ? ` · Band ${String(o.band)}` : ''}:
                      </b>{' '}
                      {o.comment ? String(o.comment) : ''}
                    </p>
                  );
                })}
              </div>
            )}
            {sts.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-bold text-[#1E5225]">Điểm tốt:</p>
                <BulletList items={sts} highlight="text-emerald-700 font-semibold" />
              </div>
            )}
            {iss.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-bold text-[#1E5225]">Cần chỉnh:</p>
                <IssueList issues={iss} />
              </div>
            )}
            {(ex.band7 || ex.band8 || ex.band9) && (
              <div className="space-y-1 bg-[#F2F8F4] rounded-lg px-3 py-2">
                <p className="text-xs font-bold text-[#2B6830]">Câu mẫu nâng band:</p>
                {[['band7', 'Band 7'], ['band8', 'Band 8'], ['band9', 'Band 9']].map(([key, lbl]) => {
                  const e = asObj(ex[key]);
                  if (!e.sentence) return null;
                  return (
                    <div key={key} className="text-sm text-slate-600 leading-relaxed">
                      <b className="text-[#2B6830]">{lbl}:</b> <i>{String(e.sentence)}</i>
                      {e.note && <p className="text-xs text-slate-400">→ {String(e.note)}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// MỘT BẢN GHI: header tóm tắt (bấm mở/đóng) + phần chi tiết
// ---------------------------------------------------------------------------
const HistoryItem = ({ item, open, onToggle }) => {
  const { tool, rec, at } = item;
  const meta = TOOL_META[tool] || { label: tool, badge: 'slate' };
  const when = fmtAt(at);

  // Dòng tiêu đề + pill band bên phải, tuỳ công cụ
  let title = '';
  let sub = null;
  let pill = null;

  if (tool === 'speaking') {
    const report = asObj(rec.report);
    const bands = asObj(rec.bands && Object.keys(asObj(rec.bands)).length ? rec.bands : report.bands);
    const overall = num(rec.overall) ?? num(report.overall);
    const modeLabel =
      MODE_LABELS[rec.mode] || (rec.mode ? String(rec.mode) : 'Speaking');
    title = modeLabel + (rec.topic ? ` · ${clip(rec.topic, 60)}` : '');
    if (overall != null) pill = <BandPill band={overall} />;
    const bandChips = ['FC', 'LR', 'GRA', 'PR']
      .map((k) => ({ k, b: num(bands[k]) }))
      .filter((x) => x.b != null);
    const drill = asObj(rec.drillStats);
    sub = (
      <div className="flex items-center gap-1.5 flex-wrap">
        {bandChips.map(({ k, b }) => (
          <span key={k} className="text-[11px] font-bold bg-[#E8F4EC] text-[#2B6830] px-2 py-0.5 rounded-md">
            {k} {Math.floor(b)}
          </span>
        ))}
        {drill.done != null && (
          <span className="text-xs text-slate-500">
            Luyện {num(drill.done) ?? 0} câu, {num(drill.cleanFirst) ?? 0} câu đúng ngay lần đầu
          </span>
        )}
        {rec.targetBand && (
          <span className="text-xs text-slate-400">Mục tiêu {String(rec.targetBand)}</span>
        )}
      </div>
    );
  } else if (tool === 'writing') {
    const s = asObj(rec.summary);
    const journey = toList(s.journey);
    const done = journey.length;
    const total = Math.max(WRITING_TOTAL_LEVELS, done);
    title = s.topic ? clip(s.topic, 90) : 'Câu Nguyên nhân, Hệ quả';
    const lastBand = done ? asObj(journey[done - 1]).band : null;
    if (lastBand != null) pill = <BandPill band={lastBand} />;
    sub = (
      <span className="text-xs text-slate-500">
        Đạt <b className="text-[#2B6830]">{done}/{total}</b> bậc nâng band
        {s.student_level ? ` · Trình độ ước lượng ${String(s.student_level)}` : ''}
      </span>
    );
  } else {
    const s = asObj(rec.summary);
    const comps = toList(s.components);
    const passedCount = comps.filter(introPassed).length;
    const total = Math.max(INTRO_TOTAL_COMPONENTS, comps.length);
    const prompt = asObj(s.prompt);
    title = prompt.prompt_en ? clip(prompt.prompt_en, 90) : 'Mở bài Discuss both views';
    const vals = comps.map((c) => num(asObj(c).overall_band)).filter((n) => n != null && n > 0);
    const overall = vals.length
      ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 2) / 2
      : null;
    if (overall != null) pill = <BandPill band={overall} />;
    sub = (
      <span className="text-xs text-slate-500">
        <b className="text-[#2B6830]">{passedCount}/{total}</b> cấu phần đạt Band 7
      </span>
    );
  }

  return (
    <Card padding={false} className={open ? 'ring-1 ring-[#2B6830]/15' : ''}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left p-4 md:p-5 flex items-start gap-3"
        aria-expanded={open}
      >
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge color={meta.badge}>{meta.label}</Badge>
            {when && <span className="text-xs text-slate-400">{when}</span>}
          </div>
          <p className="text-sm font-bold text-slate-700 leading-snug">{title}</p>
          {sub}
        </div>
        <div className="flex items-center gap-2 shrink-0 pt-0.5">
          {pill}
          <IconChevron
            className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </button>
      {open && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-4 md:px-5 md:pb-5">
          {tool === 'speaking' && <SpeakingDetail rec={rec} />}
          {tool === 'writing' && <WritingDetail summary={rec.summary} />}
          {tool === 'intro' && <IntroDetail summary={rec.summary} />}
        </div>
      )}
    </Card>
  );
};

// ---------------------------------------------------------------------------
// TRANG CHÍNH
// ---------------------------------------------------------------------------
const CoachHistory = () => {
  const { currentUser } = useAuth();
  const [hist, setHist] = useState(null); // null = đang tải
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    if (!currentUser?.id) return undefined;
    const histRef = ref(db, `coachHistory/${currentUser.id}`);
    const off = onValue(
      histRef,
      (snap) => {
        setHist(snap.val() || {});
        setError('');
      },
      () => {
        setHist({});
        setError('Không tải được lịch sử, em thử tải lại trang giúp nhé.');
      }
    );
    return () => off();
  }, [currentUser?.id]);

  // Gộp 3 tool thành một danh sách, mới nhất trước
  const items = useMemo(() => {
    const out = [];
    const src = asObj(hist);
    ['speaking', 'writing', 'intro'].forEach((tool) => {
      const recs = asObj(src[tool]);
      Object.keys(recs).forEach((pushId) => {
        const rec = recs[pushId];
        if (!rec || typeof rec !== 'object') return;
        out.push({ id: `${tool}:${pushId}`, tool, at: Number(rec.at) || 0, rec });
      });
    });
    out.sort((a, b) => b.at - a.at);
    return out;
  }, [hist]);

  const counts = useMemo(() => {
    const c = { all: items.length, speaking: 0, writing: 0, intro: 0 };
    items.forEach((it) => {
      c[it.tool] = (c[it.tool] || 0) + 1;
    });
    return c;
  }, [items]);

  const shown = filter === 'all' ? items : items.filter((it) => it.tool === filter);
  const loading = hist === null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="page-title">Lịch sử luyện tập</h1>
          <p className="page-sub">
            Kết quả các phiên luyện của em, được lưu tự động sau mỗi phiên. Bấm vào một phiên để xem chi tiết.
          </p>
        </div>
        <Link
          to="/student/resources"
          className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-[#2B6830] shadow-sm hover:bg-[#F2F8F4] transition-colors"
        >
          ← Công cụ
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="overflow-x-auto -mx-1 px-1">
        <FilterGroup
          value={filter}
          onChange={setFilter}
          options={[
            { id: 'all', label: `Tất cả (${counts.all})` },
            { id: 'speaking', label: `Speaking (${counts.speaking})` },
            { id: 'writing', label: `Writing (${counts.writing})` },
            { id: 'intro', label: `Mở bài (${counts.intro})` },
          ]}
        />
      </div>

      {loading ? (
        <div className="space-y-4">
          <SkeletonCard rows={2} />
          <SkeletonCard rows={2} />
          <SkeletonCard rows={2} />
        </div>
      ) : shown.length === 0 ? (
        <EmptyState
          icon={<IconClock className="w-12 h-12" />}
          title={
            filter === 'all'
              ? 'Em chưa có phiên luyện nào được lưu.'
              : 'Em chưa có phiên luyện nào của công cụ này.'
          }
          subtitle="Kết quả sẽ được lưu tự động sau mỗi phiên luyện hoàn chỉnh."
          action={
            <Link
              to="/student/resources"
              className="inline-flex items-center gap-2 bg-[#2B6830] text-white rounded-xl px-4 py-2.5 text-sm font-bold shadow-sm hover:bg-[#1E5225] transition-colors"
            >
              Vào luyện ngay
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {shown.map((item) => (
            <HistoryItem
              key={item.id}
              item={item}
              open={openId === item.id}
              onToggle={() => setOpenId((cur) => (cur === item.id ? null : item.id))}
            />
          ))}
          <p className="text-xs text-slate-400 text-center pt-1">
            Hệ thống giữ tối đa 50 phiên gần nhất cho mỗi công cụ.
          </p>
        </div>
      )}
    </div>
  );
};

export default CoachHistory;
