import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ref, onValue } from 'firebase/database';
import { db } from '../../../firebase';
import { useAuth } from '../../../context/AuthContext';
import { warmUp, vnToday } from './shared/coachApi';

/*
 * TÀI NGUYÊN & LUYỆN TẬP, cổng vào module IELTS Coach TÍCH HỢP.
 * Thay trang Resources cũ (link ra web ngoài): 3 công cụ giờ chạy ngay trong app,
 * dùng tài khoản EDU, có giới hạn lượt mỗi ngày và lịch sử luyện lưu lại tự động.
 */

const DEFAULT_LIMITS = { speaking: 80, writing: 40, intro: 40 };

// Bộ icon nhỏ (stroke = currentColor để ăn theo màu thẻ)
const IconPenIntro = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h10" />
  </svg>
);
const IconPen = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);
const IconMic = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v1a7 7 0 0 0 14 0v-1" /><line x1="12" y1="18" x2="12" y2="22" />
  </svg>
);
const IconClock = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
  </svg>
);
const IconArrow = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M5 12h14" /><path d="M13 6l6 6-6 6" />
  </svg>
);

// Danh sách công cụ (path là route NỘI BỘ trong app)
const TOOLS = [
  {
    key: 'speaking',
    path: '/student/resources/speaking',
    icon: IconMic,
    tag: 'IELTS Speaking',
    title: 'Speaking Coach',
    desc: 'Luyện Speaking Part 1 · 2 · 3 như thi thật: giám khảo đọc đề, chấm FC / LR / GRA / PR theo thang chuẩn. Có chế độ Luyện Part 1 sửa từng câu tới khi nói đúng.',
    badge: 'Mới',
    featured: true,
  },
  {
    key: 'writing',
    path: '/student/resources/writing',
    icon: IconPen,
    tag: 'IELTS Writing Task 2',
    title: 'Writing Coach',
    desc: 'Luyện viết câu Nguyên nhân–Hệ quả, nâng band từng bước qua 7 bậc theo phương pháp Be Able. Lịch sử luyện tập được lưu lại tự động.',
  },
  {
    key: 'intro',
    path: '/student/resources/intro',
    icon: IconPenIntro,
    tag: 'IELTS Writing Task 2 · Mở bài',
    title: 'Writing Intro Coach',
    desc: 'Luyện viết MỞ BÀI dạng "Discuss both views": leo từng cấu phần Hook → Paraphrase → Thesis, chấm 4 tiêu chí TR/CC/LR/GRA, đạt Band 7 mới mở phần sau.',
  },
];

const ToolCard = ({ tool, left, limit }) => {
  const Icon = tool.icon;
  const outOfTurns = typeof left === 'number' && left <= 0;
  return (
    <Link
      to={tool.path}
      className={`group flex flex-col bg-white rounded-2xl border p-6 transition-all hover:-translate-y-0.5 hover:shadow-lg ${
        tool.featured ? 'border-[#2B6830]/40 shadow-md ring-1 ring-[#2B6830]/10' : 'border-slate-200 shadow-sm'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="w-12 h-12 rounded-xl bg-[#E8F4EC] text-[#2B6830] flex items-center justify-center group-hover:bg-[#2B6830] group-hover:text-white transition-colors">
          <Icon className="w-6 h-6" />
        </div>
        {tool.badge && (
          <span className="text-[10px] font-bold bg-[#E8F4EC] text-[#2B6830] px-2 py-0.5 rounded-full border border-green-100 uppercase tracking-wide">
            {tool.badge}
          </span>
        )}
      </div>
      <p className="mt-4 text-[11px] font-bold text-[#3D8B47] uppercase tracking-wide">{tool.tag}</p>
      <h3 className="mt-1 section-title">{tool.title}</h3>
      <p className="mt-2 text-sm text-slate-500 leading-relaxed flex-1">{tool.desc}</p>
      <div className="mt-4 flex items-center justify-between">
        <span className="inline-flex items-center gap-2 bg-[#2B6830] text-white rounded-xl px-4 py-2.5 text-sm font-bold shadow-sm group-hover:bg-[#1E5225] transition-colors">
          Vào luyện
          <IconArrow className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </span>
        {typeof left === 'number' && (
          <span className={`text-xs font-semibold ${outOfTurns ? 'text-red-500' : 'text-slate-400'}`}>
            {outOfTurns ? 'Hết lượt hôm nay' : `Còn ${left}/${limit} lượt`}
          </span>
        )}
      </div>
    </Link>
  );
};

const CoachHome = () => {
  const { currentUser } = useAuth();
  const [usage, setUsage] = useState({});
  const [limits, setLimits] = useState(DEFAULT_LIMITS);
  const warmedRef = useRef(false);

  // Đánh thức functions một lần khi mở trang (cold start), StrictMode-safe
  useEffect(() => {
    if (warmedRef.current) return;
    warmedRef.current = true;
    warmUp();
  }, []);

  // Lượt đã dùng hôm nay + trần lượt (realtime)
  useEffect(() => {
    if (!currentUser?.id) return undefined;
    const usageRef = ref(db, `coachUsage/${currentUser.id}/${vnToday()}`);
    const limitRef = ref(db, 'coachConfig/limits');
    const off1 = onValue(usageRef, (snap) => setUsage(snap.val() || {}), () => {});
    const off2 = onValue(
      limitRef,
      (snap) => setLimits({ ...DEFAULT_LIMITS, ...(snap.val() || {}) }),
      () => {}
    );
    return () => {
      off1();
      off2();
    };
  }, [currentUser?.id]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="page-title">Tài nguyên &amp; Luyện tập</h1>
          <p className="page-sub">
            Các công cụ luyện IELTS của Be Able VN, chạy ngay trong app bằng tài khoản của em.
          </p>
        </div>
        <Link
          to="/student/resources/history"
          className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-[#2B6830] shadow-sm hover:bg-[#F2F8F4] transition-colors"
        >
          <IconClock className="w-4 h-4" />
          Lịch sử luyện tập
        </Link>
      </div>

      <div className="bg-[#F2F8F4] border-l-4 border-[#2B6830] rounded-xl px-4 py-3 text-sm text-slate-600 leading-relaxed">
        <b className="text-[#2B6830]">Lưu ý:</b> Mỗi công cụ có <b>giới hạn lượt mỗi ngày</b> (một lần
        chấm hoặc sinh đề tính một lượt). Kết quả các phiên luyện được lưu tự động vào{' '}
        <b>Lịch sử luyện tập</b>.
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {TOOLS.map((tool) => {
          const limit = Number(limits[tool.key]) || DEFAULT_LIMITS[tool.key];
          const used = Number(usage[tool.key]) || 0;
          return (
            <ToolCard
              key={tool.key}
              tool={tool}
              left={Math.max(0, limit - used)}
              limit={limit}
            />
          );
        })}
      </div>
    </div>
  );
};

export default CoachHome;
