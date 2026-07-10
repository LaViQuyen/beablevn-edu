/**
 * PROMPTS WRITING COACH (Writing Ladder), port 1:1 tu tools/writing/prompts.py cua COACH SUITE.
 *
 * Day la "bo nao su pham" cua tool: phuong phap nang band cau Nguyen nhan - He qua
 * cua Bak (danh phap hoa tiem tien). Dat server-side de KHONG lo phuong phap ra trinh
 * duyet va de sua phuong phap mot cho duy nhat.
 *
 * Frontend chi gui du lieu tho (chu de, cau tra loi, cau HV viet, so bac, trinh do);
 * moi prompt + thang bac nam o day.
 *
 * LUU Y PARITY: noi dung chuoi prompt phai GIONG HET BYTE ban Python sau khi render
 * (ke ca em dash, xuong dong, khoang trang). KHONG duoc "cai thien" van ban prompt.
 */
"use strict";

// ---------------------------------------------------------------------------
// THANG 7 BẬC NÂNG BAND — phương pháp của Bak
//   goal  : mục tiêu bậc (đưa vào prompt giải thích)
//   focus : chuẩn để Gemini chấm "đạt/chưa đạt"
//   tech  : giải thích NGẮN dự phòng (khi cần dùng tĩnh)
// (giu nguyen key order title/band/high/goal/tech/focus nhu ban Python)
// ---------------------------------------------------------------------------
const LEVELS = [
  {
    title: "Bậc 1 · Danh pháp hóa + mệnh đề hệ quả", band: "Band ~6", high: false,
    goal: "biến hành động thành cụm danh từ (nominalise) và dùng mệnh đề hệ quả 'resulting in...'",
    tech: "Biến hành động thành cụm danh từ ngắn (spend a lot of money -> Overspending), và biến hệ quả cuối thành mệnh đề present participle (resulting in...).",
    focus: "Câu phải: (1) bắt đầu bằng cụm danh từ đã nominalise cho NGUYÊN NHÂN thay vì 'young people do X'; (2) dùng một present participle clause (resulting in / leading to) cho HỆ QUẢ; (3) là CÂU HOÀN CHỈNH, không phải fragment.",
  },
  {
    title: "Bậc 2 · Hedging + sắc thái quan sát", band: "Band ~6.5", high: false,
    goal: "thêm sắc thái quan sát (has been reported to) và từ giảm nhẹ (may/can)",
    tech: "Thêm cấu trúc quan sát present perfect passive (has been reported to...) và hedging: 'may' cho ý tiêu cực, 'can' cho ý trung tính.",
    focus: "Câu giữ nominalise của bậc 1 VÀ thêm cấu trúc quan sát/hedging (has been reported to / may / can / tends to). Phải là câu hoàn chỉnh.",
  },
  {
    title: "Bậc 3 · Khái quát hóa + nhượng bộ", band: "Band ~7", high: false,
    goal: "thêm mệnh đề nhượng bộ (despite..., although...) đúc kết tính chất vấn đề",
    tech: "Thêm cụm/mệnh đề nhượng bộ (despite its prevalence, although common) để nhìn vấn đề nhiều chiều.",
    focus: "Câu có thêm mệnh đề/cụm nhượng bộ hợp lý (despite/although/albeit). Phải là câu hoàn chỉnh.",
  },
  {
    title: "Bậc 4 · Làm rõ ý mơ hồ", band: "Band ~7", high: false,
    goal: "cụ thể hóa danh từ chung chung (urgent situations -> emergencies, particularly...)",
    tech: "Soi cụm còn mơ hồ và làm rõ: thêm 'particularly/especially + ví dụ cụ thể', hoặc thay bằng từ chính xác hơn; rút gọn noun phrase dài.",
    focus: "Câu cụ thể hóa ít nhất một danh từ mơ hồ (thêm ví dụ cụ thể hoặc từ chính xác hơn). Phải là câu hoàn chỉnh.",
  },
  {
    title: "Bậc 5 · Word choice + cùng trường nghĩa", band: "Band ~7.5", high: false,
    goal: "nâng từ vựng học thuật và để các vế cùng trường nghĩa (expenditure <-> costs)",
    tech: "Nâng từ vựng học thuật (overspending -> excessive expenditure; cause -> a major driver) và để các vế dùng từ cùng trường nghĩa để tăng liên kết.",
    focus: "Câu nâng từ vựng học thuật rõ rệt VÀ các vế chia sẻ trường nghĩa nhất quán. Phải là câu hoàn chỉnh.",
  },
  {
    title: "Bậc 6 · Nâng cấp tinh + Referencing", band: "Band ~8", high: true,
    goal: "tinh chỉnh từ và dùng đại từ trỏ lại tác nhân (the youth -> them)",
    tech: "Tinh chỉnh word choice (reported to be -> identified as) và dùng referencing: vế hệ quả trỏ lại tác nhân bằng đại từ (them) để liên kết.",
    focus: "Câu có word choice mức band 8 VÀ dùng referencing (them/they/this trỏ về tác nhân đã nêu). Phải là câu hoàn chỉnh.",
  },
  {
    title: "Bậc 7 · Cân bằng tự nhiên", band: "Band ~8.5+", high: true,
    goal: "giảm danh pháp hóa ở vế phụ cho câu tự nhiên (despite its prevalence -> albeit popular)",
    tech: "Giảm nominalise ở mệnh đề phụ (despite its prevalence -> albeit popular) để câu vừa học thuật vừa tự nhiên; giữ nominalise ở vế chính.",
    focus: "Câu giảm danh pháp hóa ở mệnh đề phụ (cấu trúc rút gọn tự nhiên như 'albeit popular') trong khi vế chính vẫn học thuật. Phải là câu hoàn chỉnh.",
  },
];

// Phiên bản tối giản cho frontend (chỉ tiêu đề + band để hiển thị; KHÔNG lộ focus/goal).
function levelsPublic() {
  return LEVELS.map((L) => ({ title: L.title, band: L.band, high: L.high }));
}

// ---------------------------------------------------------------------------
// RUBRIC chung — nhúng vào mọi prompt
// (bat dau va ket thuc bang "\n" giong het triple-quoted string cua Python)
// ---------------------------------------------------------------------------
const RUBRIC = `
Bạn là giám khảo IELTS Writing kiêm chuyên gia ngôn ngữ học, đang dạy học viên Việt Nam nâng MỘT câu Nguyên nhân–Hệ quả lên band cao theo phương pháp danh pháp hóa tiệm tiến.
Thang band tham chiếu cho một câu cause-effect:
- Band 5: hai mệnh đề đơn nối bằng so/consequently, từ phổ thông, có thể lỗi collocation.
- Band 6: có nominalise + present participle clause; có thể còn từ chế gượng.
- Band 6.5–7: thêm hedging/quan sát, nhượng bộ, làm rõ ý mơ hồ.
- Band 7.5: word choice học thuật + cùng trường nghĩa giữa các vế.
- Band 8: referencing tốt, từ tinh, ngữ pháp kiểm soát cao.
- Band 8.5–9: tự nhiên, không lạm dụng nominalise, idiomatic chuẩn.
Khi góp ý PHẢI soi tầng PRAGMATICS (diễn đạt có tự nhiên/hợp văn học thuật không) và SEMANTICS (từ có đúng nghĩa, đúng trường nghĩa không) — không chỉ ngữ pháp.

QUY TẮC BẮT BUỘC:
1. Mọi "câu mẫu"/"ví dụ" trả về PHẢI là CÂU HOÀN CHỈNH (có chủ ngữ + động từ chính, kết bằng dấu chấm). TUYỆT ĐỐI không trả về fragment/mệnh đề cụt.
2. Giải thích bằng TIẾNG VIỆT, cụ thể, khích lệ, không phán xét; trích đúng từ/cụm của học viên khi chỉ lỗi.
3. PHẢI điều chỉnh độ khó của ngôn ngữ giải thích theo TRÌNH ĐỘ học viên: nếu thấp (band ~5), dùng từ đơn giản, ví dụ gần gũi, giải thích mọi thuật ngữ; tránh thuật ngữ cao cấp không giải thích.
4. Chỉ trả về JSON hợp lệ, không kèm văn bản ngoài JSON, không bọc trong \`\`\`.
`;

// ---------------------------------------------------------------------------
// Các builder prompt
// ---------------------------------------------------------------------------

// Ghep lich su hoi thoai; mo phong dung Python _convo (x.get("q","") -> key thieu thanh "")
function convo(qa) {
  if (!qa || qa.length === 0) return "(chưa có)";
  return qa
    .map((x, i) => {
      const q = x.q === undefined ? "" : x.q;
      const a = x.a === undefined ? "" : x.a;
      return `Hỏi ${i + 1}: ${q}\nĐáp ${i + 1}: ${a}`;
    })
    .join("\n");
}

// next-question: dan dat Socratic. qCount PHAI la so nguyen (parity voi %d cua Python).
function buildSocraticPrompt(topic, qa, qCount) {
  const task = qCount === 0 ? "tạo CÂU HỎI 1" : "đánh giá câu trả lời mới nhất rồi hỏi tiếp hoặc dừng";
  return RUBRIC + `
Nhiệm vụ: dẫn dắt học viên kiểu Socratic để tìm ra MỘT cặp nguyên nhân–hệ quả CỤ THỂ.
QUAN TRỌNG: mỗi lần CHỈ hỏi MỘT câu hỏi đơn, NGẮN, hỏi ĐÚNG MỘT điều (không gộp nhiều câu, không hỏi nhiều khía cạnh cùng lúc). Học viên không được rối.
Kèm theo mỗi câu hỏi: một gợi ý cách trả lời ngắn, và MỘT câu trả lời ví dụ MẪU là CÂU HOÀN CHỈNH.
Trả JSON:
{"specific_enough": boolean,
 "question_en":"một câu hỏi tiếng Anh ngắn, hỏi đúng một điều",
 "question_vi":"dịch ngắn tiếng Việt",
 "guide_vi":"1 câu gợi ý học viên nên trả lời theo hướng nào",
 "example_answer":"một CÂU trả lời mẫu hoàn chỉnh bằng tiếng Anh (chủ ngữ + động từ, kết dấu chấm)"}
Câu 1 hỏi vấn đề/nguyên nhân chính. Câu sau đào sâu dựa câu trả lời trước. specific_enough=true khi đã rõ một nguyên nhân cụ thể + một hệ quả cụ thể (thường sau 2–3 lượt).

Chủ đề: ${topic}
Số câu đã hỏi: ${qCount}
Lịch sử:
${convo(qa)}

Hãy ${task}.`;
}

// extract-ideas: chot nguyen nhan/he qua + cau goc band 5 + uoc luong trinh do
function buildExtractPrompt(topic, qa) {
  return RUBRIC + `
Nhiệm vụ: từ hội thoại, chốt MỘT nguyên nhân cụ thể và MỘT hệ quả cụ thể, viết câu gốc band 5, và ƯỚC LƯỢNG trình độ tiếng Anh của học viên dựa trên ý tưởng và cách hành văn của họ.
Trả JSON:
{"cause":"mệnh đề tiếng Anh ngắn mô tả nguyên nhân",
 "effect":"mệnh đề tiếng Anh ngắn mô tả hệ quả",
 "base_sentence":"một CÂU HOÀN CHỈNH band 5 nối hai ý bằng so/consequently (chủ ngữ + động từ, kết dấu chấm)",
 "student_level":"ước lượng band, vd 5.0 / 5.5 / 6.0 / 6.5"}

Chủ đề: ${topic}
Hội thoại:
${convo(qa)}`;
}

// level-intro: giai thich ky thuat cua mot bac. studentLevel giu nguyen STRING tu client.
function buildLevelIntroPrompt(levelIdx, studentLevel, cause, effect) {
  const L = LEVELS[levelIdx];
  return RUBRIC + `
Nhiệm vụ: giải thích kỹ thuật của một BẬC nâng band cho học viên, BẰNG NGÔN NGỮ PHÙ HỢP TRÌNH ĐỘ của họ.
Mục tiêu của bậc: ${L.goal}.
Trả JSON:
{"explain_vi":"giải thích kỹ thuật ngắn gọn (2-3 câu), độ khó ngôn ngữ khớp trình độ học viên",
 "example_full_sentence":"MỘT câu tiếng Anh HOÀN CHỈNH minh họa kỹ thuật, xây từ chính nguyên nhân/hệ quả của học viên (chủ ngữ + động từ, kết dấu chấm)",
 "how_to_vi":"1-2 câu chỉ học viên cách bắt tay viết"}

Trình độ học viên: band ${studentLevel}
Nguyên nhân: ${cause}
Hệ quả: ${effect}
Bậc: ${L.title}`;
}

// grade: cham cau hoc vien theo focus cua bac. studentLevel giu nguyen STRING tu client.
function buildGradePrompt(levelIdx, studentLevel, cause, effect, base, sentence) {
  const L = LEVELS[levelIdx];
  return RUBRIC + `
Học viên đang ở BẬC: "${L.title}" — mục tiêu ${L.band}. Trình độ học viên: band ${studentLevel}.
Yêu cầu kỹ thuật của bậc: ${L.focus}
Chấm câu của học viên. Trả JSON:
{"band_estimate":"vd 6.5",
 "passed": boolean,
 "strengths":["điểm tốt cụ thể, tiếng Việt"],
 "issues":[{"type":"semantics|pragmatics|grammar|coherence","problem":"chỉ rõ từ/cụm và tại sao","fix":"cách sửa cụ thể"}],
 "model_sentence":"một CÂU HOÀN CHỈNH đạt đúng bậc này, xây từ nội dung của học viên (chủ ngữ + động từ, kết dấu chấm — KHÔNG được là fragment)",
 "next_hint":"gợi ý 1 câu để tốt hơn"}
Giải thích phải khớp trình độ band ${studentLevel}: nếu thấp thì dùng từ đơn giản, giải thích thuật ngữ.

NGUYÊN NHÂN: ${cause}
HỆ QUẢ: ${effect}
Câu gốc band 5: ${base}
CÂU HỌC VIÊN VIẾT: "${sentence}"`;
}

// ---------------------------------------------------------------------------
// Bóc JSON từ output của Gemini (kể cả khi bị bọc ```json ... ```)
// ---------------------------------------------------------------------------
function extractJson(text) {
  let s = (text || "").trim();
  s = s.replace(/^```(json)?/i, "").trim();
  s = s.replace(/```$/, "").trim();
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a >= 0 && b >= 0) s = s.slice(a, b + 1);
  return JSON.parse(s);
}

module.exports = {
  LEVELS,
  RUBRIC,
  levelsPublic,
  buildSocraticPrompt,
  buildExtractPrompt,
  buildLevelIntroPrompt,
  buildGradePrompt,
  extractJson,
};
