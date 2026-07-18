import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { ref, onValue } from 'firebase/database';
import {
  normClassIds, computeAttendance, computeClassScores, visibleNotifications,
  homeworkOfClass, latestAttendanceLink, attendanceColor, SCORE_TYPES, SCORE_META,
} from '../utils/contactBook';

// ============================================================
// SỔ LIÊN LẠC ONLINE, component DÙNG CHUNG cho Học viên + Phụ huynh.
// props:
//  - student: { id, name, classIds, lockedAt, reserve } (học viên cần xem)
//  - homeworkLocked: khóa mục Báo bài (học phí quá hạn, chỉ áp cổng học viên)
//  - attendanceHref / scoresHref: link "Xem chi tiết" (chỉ cổng học viên có)
// Mỗi lớp = 1 thẻ lớp; trong thẻ có 3 mục bấm sổ xuống / thu gọn:
//  1. Chuyên cần & Điểm danh  2. Điểm số theo loại  3. Báo bài
// ============================================================

const fmtDate = (d) => { try { return new Date(d).toLocaleDateString('vi-VN'); } catch { return d; } };

const ATT_BADGE = {
  present: <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded">Có mặt</span>,
  late:    <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded">Đi muộn</span>,
  excused: <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded">Có phép</span>,
};
const attBadge = (status) => ATT_BADGE[status] || <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded">Vắng</span>;

const Chevron = ({ open }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
    className={`w-4 h-4 shrink-0 transition-transform text-slate-400 ${open ? 'rotate-180' : ''}`}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
  </svg>
);

const IconLink = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
  </svg>
);

// Một MỤC trong thẻ lớp: header bấm để sổ xuống / thu gọn
const Section = ({ icon, title, sub, badge, open, onToggle, children }) => (
  <div className="border-t border-slate-100">
    <button type="button" onClick={onToggle}
      className="w-full flex items-center gap-3 px-4 md:px-5 py-3.5 text-left hover:bg-slate-50/70 transition-colors">
      <span className="text-lg leading-none">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold text-slate-800">{title}</span>
        {sub && <span className="block text-[11px] text-slate-400 mt-0.5 truncate">{sub}</span>}
      </span>
      {badge}
      <Chevron open={open} />
    </button>
    {open && <div className="px-4 md:px-5 pb-4 animate-fade-in">{children}</div>}
  </div>
);

// ============ MỤC 1: CHUYÊN CẦN & ĐIỂM DANH ============
const AttendanceSection = ({ att, attLink, attendanceHref }) => {
  const { bar, text } = attendanceColor(att.rate);
  const [showAll, setShowAll] = useState(false);
  const history = showAll ? att.history : att.history.slice(0, 5);
  return (
    <div className="space-y-3">
      {/* Chỉ số chuyên cần */}
      <div className="bg-slate-50 rounded-xl border border-slate-100 p-3.5">
        <div className="flex items-end justify-between mb-2">
          <div>
            <p className="stat-label">Chuyên cần</p>
            <p className={`text-3xl font-extrabold leading-tight ${text}`}>{att.rate !== null ? `${att.rate}%` : '–'}</p>
          </div>
          <p className="text-xs text-slate-400 font-medium">{att.total} buổi đã điểm danh</p>
        </div>
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-700 ${bar}`} style={{ width: `${att.rate || 0}%` }} />
        </div>
        <div className="grid grid-cols-4 gap-2 mt-3 text-center">
          <div><div className="text-green-600 font-bold text-sm">{att.present}</div><div className="text-[10px] text-slate-400">Có mặt</div></div>
          <div><div className="text-orange-500 font-bold text-sm">{att.late}</div><div className="text-[10px] text-slate-400">Đi muộn</div></div>
          <div><div className="text-blue-500 font-bold text-sm">{att.excused}</div><div className="text-[10px] text-slate-400">Có phép</div></div>
          <div><div className="text-red-500 font-bold text-sm">{att.absent}</div><div className="text-[10px] text-slate-400">Vắng</div></div>
        </div>
      </div>

      {/* Link điểm danh do GV đăng (nếu có) + link trang chi tiết */}
      <div className="flex flex-wrap gap-2">
        {attLink && (
          <a href={attLink.linkUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary-light hover:bg-green-100 px-3.5 py-2 rounded-xl border border-green-100 transition-colors">
            <IconLink /> {attLink.title || 'Link điểm danh'}
          </a>
        )}
        {attendanceHref && (
          <Link to={attendanceHref}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 transition-colors">
            Xem trang điểm danh →
          </Link>
        )}
      </div>

      {/* Lịch sử gần nhất */}
      {att.history.length > 0 ? (
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Lịch sử gần nhất</p>
          <div className="space-y-1.5">
            {history.map((r, i) => (
              <div key={i} className="flex items-center justify-between text-xs bg-white border border-slate-100 rounded-lg px-3 py-2">
                <span className="text-slate-600 font-medium">{fmtDate(r.date)}</span>
                <span className="flex items-center gap-2">
                  {r.note && <span className="text-slate-400 italic max-w-[140px] truncate" title={r.note}>{r.note}</span>}
                  {attBadge(r.status)}
                </span>
              </div>
            ))}
          </div>
          {att.history.length > 5 && (
            <button type="button" onClick={() => setShowAll(!showAll)} className="mt-2 text-primary text-xs font-bold hover:underline">
              {showAll ? 'Thu gọn' : `Xem cả ${att.history.length} buổi`}
            </button>
          )}
        </div>
      ) : (
        <p className="text-xs text-slate-400 italic">Chưa có dữ liệu điểm danh.</p>
      )}
    </div>
  );
};

// ============ MỤC 2: ĐIỂM SỐ THEO TỪNG LOẠI ============
const ScoresSection = ({ scores, scoresHref }) => {
  const [openType, setOpenType] = useState(null);
  return (
    <div className="space-y-2.5">
      {/* Điểm tổng kết theo trọng số */}
      {scores.hasAnyGrade ? (
        <div className="flex items-center justify-between bg-gradient-to-r from-primary-subtle to-white rounded-xl border border-green-100 px-4 py-3">
          <div>
            <p className="stat-label" title="Assignment 10% + Formative 20% + MMT 30% + EOMT 40%">Điểm tổng kết</p>
            <p className="text-[10px] text-slate-400">Assignment 10% · Formative 20% · MMT 30% · EOMT 40%</p>
          </div>
          <p className="text-3xl font-extrabold text-primary tabular-nums">{scores.gpa.toFixed(2)}</p>
        </div>
      ) : (
        <p className="text-xs text-slate-400 italic">Chưa có cột điểm nào trong lớp này.</p>
      )}

      {/* 4 loại điểm, bấm để sổ danh sách cột điểm */}
      {SCORE_TYPES.map((type) => {
        const meta = SCORE_META[type];
        const { records, total, avg } = scores.byType[type];
        const open = openType === type;
        const summary = type === 'bonus' ? `Tổng: ${total}` : records.length ? `TB: ${avg.toFixed(1)}` : '–';
        return (
          <div key={type} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <button type="button" onClick={() => setOpenType(open ? null : type)}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-slate-50/70 transition-colors">
              <span>{meta.icon}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-xs font-bold text-slate-700">{meta.label}</span>
                <span className="block text-[10px] text-slate-400 truncate">{meta.meaning}</span>
              </span>
              <span className="text-xs font-bold px-2 py-1 rounded-lg border border-slate-200 bg-white whitespace-nowrap" style={{ color: meta.color }}>{summary}</span>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">{records.length}</span>
              <Chevron open={open} />
            </button>
            {open && (
              <div className="px-3.5 pb-3 space-y-1.5 animate-fade-in">
                {records.length ? records.slice(0, 15).map((r) => (
                  <div key={r.id} className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-xs">
                    <div className="flex justify-between items-center gap-2">
                      <span className="font-extrabold text-sm" style={{ color: meta.color }}>{r.score}</span>
                      <span className="flex items-center gap-1.5">
                        {r.examType && <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase">{r.examType}</span>}
                        {r.auto && <span className="bg-primary-light text-green-700 px-1.5 py-0.5 rounded text-[9px] font-bold">🤖 Tự động</span>}
                        <span className="text-slate-400 font-mono">{fmtDate(r.date)}</span>
                      </span>
                    </div>
                    {r.content && <p className="text-slate-500 mt-1 leading-relaxed">{r.content}</p>}
                  </div>
                )) : <p className="text-[11px] text-slate-400 italic py-1">Chưa có cột điểm.</p>}
                {records.length > 15 && <p className="text-[10px] text-slate-400 italic">Hiển thị 15 cột gần nhất / {records.length}.</p>}
              </div>
            )}
          </div>
        );
      })}

      {scoresHref && (
        <Link to={scoresHref} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 transition-colors">
          Xem bảng điểm đầy đủ (biểu đồ, xếp hạng) →
        </Link>
      )}
    </div>
  );
};

// ============ MỤC 3: BÁO BÀI ============
const HomeworkSection = ({ items, locked }) => {
  const [expandedId, setExpandedId] = useState(null);
  const [showAll, setShowAll] = useState(false);
  if (locked) {
    return (
      <div className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#94a3b8" className="w-5 h-5 shrink-0 mt-0.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 00-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
        <p className="text-xs text-slate-500 leading-relaxed">Mục Báo bài tạm khóa do học phí quá hạn. Vui lòng hoàn thành học phí để xem báo bài mới nhất.</p>
      </div>
    );
  }
  const list = showAll ? items : items.slice(0, 5);
  return items.length ? (
    <div className="space-y-2">
      {list.map((n) => {
        const isExpanded = expandedId === n.id;
        return (
          <div key={n.id} className="bg-white border border-slate-100 rounded-xl p-3.5 cursor-pointer hover:border-green-100 transition-colors"
            style={{ borderLeft: '3px solid #2B6830' }}
            onClick={() => setExpandedId(isExpanded ? null : n.id)}>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-primary-light text-green-700 text-[9px] font-bold px-2 py-0.5 rounded border border-green-100 uppercase">Báo bài</span>
              <span className="text-[10px] text-slate-400 font-mono ml-auto">{fmtDate(n.date)}</span>
            </div>
            <h4 className="font-bold text-xs text-slate-800 mb-1">{n.title}</h4>
            <div className={`quill-content text-xs text-slate-600 leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}
              dangerouslySetInnerHTML={{ __html: n.content }} />
            {n.attachmentUrl && isExpanded && (
              <a href={n.attachmentUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary bg-primary-light hover:bg-green-100 px-3 py-1.5 rounded-lg border border-green-100 transition-colors">
                📎 {n.attachmentTitle || n.attachmentName || 'Tệp đính kèm'}
              </a>
            )}
            {!isExpanded && (n.content || '').length > 100 && (
              <span className="text-[10px] text-green-600 font-semibold mt-1 inline-block">Xem thêm...</span>
            )}
          </div>
        );
      })}
      {items.length > 5 && (
        <button type="button" onClick={() => setShowAll(!showAll)} className="text-primary text-xs font-bold hover:underline">
          {showAll ? 'Thu gọn' : `Xem cả ${items.length} báo bài`}
        </button>
      )}
    </div>
  ) : (
    <p className="text-xs text-slate-400 italic">Chưa có báo bài nào cho lớp này.</p>
  );
};

// ============ THẺ LỚP ============
const ClassCard = ({ cls, student, attendanceData, scoresData, visibleNotis, homeworkLocked, hideAttendanceLink, attendanceHref, scoresHref }) => {
  const [openSection, setOpenSection] = useState('attendance'); // mở sẵn mục chuyên cần
  const att = useMemo(() => computeAttendance(attendanceData, cls.id, student.id), [attendanceData, cls.id, student.id]);
  const scores = useMemo(() => computeClassScores(scoresData, cls.id, student.id), [scoresData, cls.id, student.id]);
  const homework = useMemo(() => homeworkOfClass(visibleNotis, cls.id), [visibleNotis, cls.id]);
  const attLink = useMemo(() => latestAttendanceLink(visibleNotis, cls.id), [visibleNotis, cls.id]);
  const { text } = attendanceColor(att.rate);
  const toggle = (key) => setOpenSection((prev) => (prev === key ? null : key));

  return (
    <div className="card-std overflow-hidden">
      {/* Header thẻ lớp */}
      <div className="p-4 md:p-5 bg-gradient-to-r from-primary-subtle to-white">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-primary text-base truncate">{cls.name}</h3>
              <span className="bg-white text-primary text-[10px] font-bold px-2 py-0.5 rounded-full border border-green-100 uppercase tracking-wide">{cls.room || 'Online'}</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              GV: <span className="font-semibold text-slate-600">{cls.teacherName || 'Đang cập nhật'}</span>
              {cls.schedule ? <> · {cls.schedule}</> : null}
              {cls.startTime && cls.endTime ? <> · {cls.startTime}–{cls.endTime}</> : null}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className={`text-2xl font-extrabold leading-tight ${text}`}>{att.rate !== null ? `${att.rate}%` : '–'}</p>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Chuyên cần</p>
          </div>
        </div>
      </div>

      {/* 3 mục sổ xuống / thu gọn */}
      <Section icon="🗓️" title="Chuyên cần & Điểm danh" sub={`${att.total} buổi · ${att.absent} vắng`}
        badge={att.rate !== null && att.rate < 70 ? <span className="text-[9px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">Thấp</span> : null}
        open={openSection === 'attendance'} onToggle={() => toggle('attendance')}>
        {/* attLink là một notification dạng link: ẩn khi học phí Quá hạn (đồng bộ khóa Thông báo)
            và ẩn TUYỆT ĐỐI ở cổng Phụ huynh (điểm danh là việc của HỌC VIÊN, PH không bấm thay con) */}
        <AttendanceSection att={att} attLink={homeworkLocked || hideAttendanceLink ? null : attLink} attendanceHref={attendanceHref} />
      </Section>

      <Section icon="🏅" title="Điểm số theo từng loại" sub={scores.hasAnyGrade ? `Điểm tổng kết ${scores.gpa.toFixed(2)}` : 'Chưa có cột điểm'}
        open={openSection === 'scores'} onToggle={() => toggle('scores')}>
        <ScoresSection scores={scores} scoresHref={scoresHref} />
      </Section>

      <Section icon="📚" title="Báo bài" sub={homeworkLocked ? 'Tạm khóa' : `${homework.length} báo bài`}
        badge={!homeworkLocked && homework.length > 0 ? <span className="text-[9px] font-bold text-primary bg-primary-light border border-green-100 px-1.5 py-0.5 rounded-full">{homework.length}</span> : null}
        open={openSection === 'homework'} onToggle={() => toggle('homework')}>
        <HomeworkSection items={homework} locked={homeworkLocked} />
      </Section>
    </div>
  );
};

// ============ COMPONENT CHÍNH ============
const ContactBook = ({ student, homeworkLocked = false, hideAttendanceLink = false, attendanceHref = null, scoresHref = null }) => {
  const [classes, setClasses] = useState({});
  const [attendanceData, setAttendanceData] = useState({});
  const [scoresData, setScoresData] = useState({});
  const [notiList, setNotiList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let loaded = { classes: false, att: false, scores: false, notis: false };
    const done = () => { if (Object.values(loaded).every(Boolean)) setLoading(false); };
    const unsubs = [
      onValue(ref(db, 'classes'), (s) => { setClasses(s.val() || {}); loaded.classes = true; done(); }),
      onValue(ref(db, 'attendance'), (s) => { setAttendanceData(s.val() || {}); loaded.att = true; done(); }),
      onValue(ref(db, 'scores'), (s) => { setScoresData(s.val() || {}); loaded.scores = true; done(); }),
      onValue(ref(db, 'notifications'), (s) => {
        const data = s.val() || {};
        setNotiList(Object.entries(data).map(([id, val]) => ({ id, ...val })));
        loaded.notis = true; done();
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const myClassIds = normClassIds(student?.classIds);
  const myClasses = myClassIds.map((id) => (classes[id] ? { id, ...classes[id] } : null)).filter(Boolean);
  const visibleNotis = useMemo(() => visibleNotifications(notiList, student), [notiList, student]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="card-std p-5 animate-pulse space-y-3">
            <div className="h-5 bg-slate-100 rounded w-40" />
            <div className="h-3 bg-slate-100 rounded w-64" />
            <div className="h-10 bg-slate-100 rounded w-full" />
            <div className="h-10 bg-slate-100 rounded w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (!myClasses.length) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-dashed border-slate-200 text-center">
        <p className="text-slate-400 text-sm font-medium">{student?.name || 'Học viên'} chưa được gán vào lớp học nào.</p>
        <p className="text-slate-300 text-xs mt-1">Liên hệ trung tâm để được hỗ trợ.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {myClasses.map((cls) => (
        <ClassCard key={cls.id} cls={cls} student={student}
          attendanceData={attendanceData} scoresData={scoresData} visibleNotis={visibleNotis}
          homeworkLocked={homeworkLocked} hideAttendanceLink={hideAttendanceLink}
          attendanceHref={attendanceHref} scoresHref={scoresHref} />
      ))}
    </div>
  );
};

export default ContactBook;
