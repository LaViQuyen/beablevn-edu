import React from 'react';

/*
 * TÀI NGUYÊN & LUYỆN TẬP — cổng học viên.
 * Khu tập hợp các CÔNG CỤ LUYỆN TẬP có AI chấm của Be Able VN (app "IELTS Coach").
 * Đây là LỐI VÀO: bấm card sẽ mở công cụ tương ứng ở tab mới.
 * Công cụ chạy stack riêng (Flask + Gemini) tại COACH_BASE — học viên đăng nhập bằng
 * tài khoản luyện tập được cấp (tạm thời tách với tài khoản EDU; sẽ gộp SSO sau).
 */

// Địa chỉ app IELTS Coach (gộp Speaking + Writing + Writing Intro Coach)
const COACH_BASE = 'https://ielts-coach.onrender.com';

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
const IconArrow = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M5 12h14" /><path d="M13 6l6 6-6 6" />
  </svg>
);

// Danh sách công cụ luyện tập (thêm bớt ở đây khi có công cụ mới)
const TOOLS = [
  {
    key: 'intro',
    path: '/intro',
    icon: IconPenIntro,
    tag: 'IELTS Writing Task 2 · Mở bài',
    title: 'Writing Intro Coach',
    desc: 'Luyện viết MỞ BÀI dạng "Discuss both views": leo từng cấu phần Hook → Paraphrase → Thesis, AI chấm 4 tiêu chí TR/CC/LR/GRA, đạt Band 7 mới mở phần sau.',
    badge: 'Mới',
    featured: true,
  },
  {
    key: 'writing',
    path: '/writing',
    icon: IconPen,
    tag: 'IELTS Writing Task 2',
    title: 'Writing Coach',
    desc: 'Luyện viết câu Nguyên nhân–Hệ quả, nâng band từng bước qua 7 bậc theo phương pháp Be Able. Lưu lại nhật ký luyện tập sau mỗi phiên.',
  },
  {
    key: 'speaking',
    path: '/speaking',
    icon: IconMic,
    tag: 'IELTS Speaking',
    title: 'Speaking Coach',
    desc: 'Luyện Speaking Part 1 · 2 · 3 như thi thật: AI chấm FC / LR / GRA / PR theo thang chuẩn, phân tích từng câu và gợi ý cải thiện.',
  },
];

const ToolCard = ({ tool }) => {
  const Icon = tool.icon;
  return (
    <a
      href={`${COACH_BASE}${tool.path}`}
      target="_blank"
      rel="noopener noreferrer"
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
      <h3 className="mt-1 text-lg font-extrabold text-[#2B6830]">{tool.title}</h3>
      <p className="mt-2 text-sm text-slate-500 leading-relaxed flex-1">{tool.desc}</p>
      <span className="mt-5 inline-flex items-center gap-2 self-start bg-[#2B6830] text-white rounded-xl px-4 py-2.5 text-sm font-bold shadow-sm group-hover:bg-[#1E5225] transition-colors">
        Mở công cụ
        <IconArrow className="w-4 h-4 transition-transform group-hover:translate-x-1" />
      </span>
    </a>
  );
};

const Resources = () => {
  return (
    <div className="space-y-6">
      {/* Tiêu đề trang */}
      <div>
        <h1 className="text-2xl font-extrabold text-[#2B6830]">Tài nguyên &amp; Luyện tập</h1>
        <p className="text-sm text-slate-500 mt-1">
          Các công cụ luyện tập có AI chấm của Be Able VN. Bấm vào một công cụ để mở và bắt đầu luyện.
        </p>
      </div>

      {/* Ghi chú đăng nhập */}
      <div className="bg-[#F2F8F4] border-l-4 border-[#2B6830] rounded-xl px-4 py-3 text-sm text-slate-600 leading-relaxed">
        <b className="text-[#2B6830]">Lưu ý:</b> Công cụ luyện tập mở ở tab mới và đăng nhập bằng{' '}
        <b>tài khoản luyện tập</b> được giáo viên cấp. Nếu chưa có, hãy liên hệ giáo viên của bạn.
      </div>

      {/* Lưới công cụ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {TOOLS.map((tool) => (
          <ToolCard key={tool.key} tool={tool} />
        ))}
      </div>
    </div>
  );
};

export default Resources;
