"use strict";
/**
 * PROMPTS: WRITING INTRO COACH (đặt PHÍA SERVER).
 *
 * "Bộ não sư phạm" của tool: luyện viết MỞ BÀI cho đề IELTS Writing Task 2 dạng
 * "Discuss both views and give your own opinion", theo phương pháp pragmatic-semantic
 * của Bak. Học viên leo qua 3 CẤU PHẦN của mở bài:
 *
 *   1. Hook / Background Statement
 *   2. Paraphrasing the Prompt (diễn đạt lại HAI quan điểm)
 *   3. Essay Objective / Thesis Statement
 *
 * Mỗi cấu phần được chấm theo 4 tiêu chí IELTS (TR / CC / LR / GRA). Đạt mức ổn
 * (band 7, không tiêu chí nào < 6.5) thì mở khóa cấu phần tiếp theo.
 *
 * Frontend chỉ gửi dữ liệu thô (đề bài, câu HV viết, cấu phần, trình độ); toàn bộ
 * prompt + thang chuẩn + bộ tiêu chí nằm ở đây để không lộ phương pháp ra trình duyệt.
 *
 * PORT 1:1 từ Python: tools/intro/prompts.py (COACH SUITE). Nội dung chuỗi prompt
 * phải GIỐNG HỆT BYTE với bản Python sau khi render, tuyệt đối không "cải thiện"
 * văn bản (kể cả em dash, khoảng trắng, xuống dòng trong DATA là cố ý giữ nguyên).
 * LƯU Ý KIỂU DỮ LIỆU: studentLevel / các tham số từ client phải giữ nguyên STRING
 * (vd "7.0") khi truyền vào builder, vì Python str(7.0) = "7.0" còn JS String(7.0) = "7".
 */

// ---------------------------------------------------------------------------
// 3 CẤU PHẦN MỞ BÀI, phương pháp của Bak (khái niệm trước, cấu trúc sau)
//   goal       : mục tiêu cấu phần (đưa vào prompt chấm/giải thích)
//   focus      : chuẩn để Gemini chấm "đạt/chưa đạt" theo 4 tiêu chí (xem FOCUS bên dưới)
//   guide_vi   : giải thích khái niệm cho học viên (tĩnh, hiện trước khi viết)
//   how_to_vi  : hướng dẫn bắt tay viết
//   frame      : khung câu gợi ý (có chỗ trống, KHÔNG cho đáp án sẵn)
//   synonyms   : bảng từ đồng nghĩa chuẩn (chỉ cấu phần liên quan), mảng cặp [from, to]
//   warnings   : các lỗi sắc thái / ngữ pháp cần tránh (theo bài giảng)
// ---------------------------------------------------------------------------
const COMPONENTS = [
  {
    key: "hook",
    title: "Cấu phần 1 · Hook / Background Statement",
    target: "Band 7",
    goal: "viết MỘT câu dẫn nhập (background) giới thiệu chủ đề của đề ở mức khái " +
          "quát và khẳng định tầm quan trọng/tính thời sự — chưa nêu hai quan điểm, " +
          "chưa nêu quan điểm cá nhân.",
    guide_vi: "Hook chỉ đóng vai trò DẪN NHẬP: khẳng định chủ đề đang được quan tâm / " +
              "có giá trị. Giữ câu ngắn gọn nhưng đầy đủ. Đây CHƯA phải chỗ nêu hai " +
              "luồng quan điểm hay ý kiến của bạn.",
    how_to_vi: "Bắt đầu bằng chủ đề ở dạng khái quát (có thể danh-pháp-hóa: 'Ensuring " +
               "access to…', 'The growing reliance on…'), rồi khẳng định nó là một vấn " +
               "đề/xu hướng đáng chú ý hiện nay.",
    frame: "____ has become / remains a ____ issue that ____ .",
    synonyms: [],
    warnings: [
      "Tránh thừa: không thêm 'worldwide / all over the world' khi ý đã hàm chứa tính " +
      "toàn cầu (vd nói về một quyền con người) — chỉ dùng khi vị ngữ thực sự cần phạm " +
      "vi (vd 'vấn đề mà nhiều chính phủ phải đối mặt').",
      "Tránh cụm chung chung mơ hồ như 'for the government'.",
      "Chưa nêu hai quan điểm trái chiều ở câu này — để dành cho cấu phần 2.",
    ],
  },
  {
    key: "paraphrase",
    title: "Cấu phần 2 · Paraphrasing the Prompt (hai quan điểm)",
    target: "Band 7",
    goal: "diễn đạt lại CẢ HAI quan điểm của đề bằng từ/cấu trúc khác, giữ nguyên ý " +
          "cốt lõi, hai vế cân xứng.",
    guide_vi: "Paraphrase ĐÚNG NGHĨA = diễn giải lại Ý theo cách khác, KHÔNG phải đổi " +
              "vài chữ máy móc. Bạn phải hiểu nghĩa của đề rồi nói lại, không nhìn cấu " +
              "trúc để 'thay từ'. Dùng khung 'While some…, others…' và để mỗi bên có " +
              "lập luận (claim, có thể kèm lý do) cân xứng nhau.",
    how_to_vi: "Đọc kỹ hai quan điểm trong đề. Viết một câu ghép: vế 1 nói lại quan " +
               "điểm thứ nhất, vế 2 nói lại quan điểm thứ hai, dùng present participle " +
               "(viewing…, arguing…) để liên kết thay vì lặp 'because/since'.",
    frame: "While some ____ , others ____ .",
    synonyms: [
      ["view", "point of view · viewpoint · side"],
      ["opinion", "perspective"],
    ],
    warnings: [
      "KHÔNG dùng 'insight' ở mở bài: insight = hiểu sâu, tường tận gốc rễ — chỉ hợp " +
      "thân bài khi luận điểm đã phát triển chi tiết.",
      "KHÔNG dùng 'notion' để gọi hai quan điểm có lập luận: notion mang sắc thái một " +
      "ý niệm mơ hồ/chưa được chứng minh, không hợp với lập trường được tranh biện.",
      "Đừng chép nguyên cụm của đề — đó không phải paraphrase.",
    ],
  },
  {
    key: "thesis",
    title: "Cấu phần 3 · Essay Objective / Thesis Statement",
    target: "Band 7",
    goal: "tuyên bố nhiệm vụ bài viết (sẽ bàn cả hai phía) VÀ nêu quan điểm cá nhân; " +
          "band cao thì nêu lập trường CỤ THỂ.",
    guide_vi: "Câu này nêu bài sẽ examine/discuss CẢ HAI phía và đưa ra quan điểm của " +
              "bạn. Band 7 có thể nêu chung ('and give my own opinion'); band 8–9 nên " +
              "tiết lộ LẬP TRƯỜNG cụ thể ngay ('…before arguing that …') để cả bài nhất " +
              "quán.",
    how_to_vi: "Viết: 'This essay will examine both views …' rồi gắn phần quan điểm. " +
               "Nếu muốn band cao, thay 'give my opinion' bằng một lập trường rõ + lý do.",
    frame: "This essay will examine both ____ before ____ .",
    synonyms: [
      ["view", "point of view · viewpoint · side"],
      ["opinion", "perspective"],
    ],
    warnings: [
      "Determiner: ĐÚNG là 'both views / both sides / both points of view / both " +
      "viewpoints'. SAI: 'both points of views', 'both view of points'.",
      "Một người viết có MỘT lập trường → 'a personal perspective' (số ít), không " +
      "'personal perspectives'.",
      "Tránh 'delve into' ở mở bài (hàm ý đào sâu — quá mức cho phần giới thiệu); dùng " +
      "'examine / discuss both views'.",
      "Lập trường ở đây không được mâu thuẫn với hai quan điểm đã paraphrase.",
    ],
  },
];


// Phiên bản cho frontend: đủ phần hướng dẫn TĨNH (không lộ 'focus' chấm điểm).
// Giữ nguyên thứ tự key + tên field snake_case như bản Python (hợp đồng dữ liệu với client).
function componentsPublic() {
  const out = [];
  for (const c of COMPONENTS) {
    out.push({
      key: c.key, title: c.title, target: c.target,
      guide_vi: c.guide_vi, how_to_vi: c.how_to_vi,
      frame: c.frame,
      synonyms: c.synonyms.map(function (pair) { return { from: pair[0], to: pair[1] }; }),
      warnings: c.warnings,
    });
  }
  return out;
}


// Chuẩn riêng dùng để CHẤM (không gửi xuống frontend)
const FOCUS = {
  hook:
    "Đây là câu DẪN NHẬP (background). ĐẠT khi: (1) là câu hoàn chỉnh; (2) giới thiệu chủ " +
    "đề của đề ở mức khái quát và khẳng định tầm quan trọng/tính thời sự; (3) KHÔNG nêu " +
    "hai quan điểm trái chiều, KHÔNG nêu quan điểm cá nhân; (4) không rườm rà thừa (vd " +
    "'worldwide' khi đã hàm ý toàn cầu, 'for the government' chung chung); (5) word choice " +
    "chính xác, không lỗi LR ngớ ngẩn.",
  paraphrase:
    "Đây là câu PARAPHRASE HAI QUAN ĐIỂM. ĐẠT khi: (1) thể hiện ĐÚNG và ĐỦ cả hai quan " +
    "điểm của đề (không bỏ sót, không bóp méo); (2) là paraphrase thực chất — diễn giải " +
    "lại ý bằng từ/cấu trúc khác, KHÔNG chép nguyên cụm của đề; (3) hai vế cân xứng, nối " +
    "mạch lạc (While some…, others…); (4) từ vựng chính xác (view↔viewpoint/side, " +
    "opinion↔perspective; tránh insight/notion sai sắc thái); (5) ngữ pháp đúng.",
  thesis:
    "Đây là câu ESSAY OBJECTIVE / THESIS. ĐẠT khi: (1) nêu rõ bài sẽ bàn/đánh giá CẢ HAI " +
    "phía; (2) nêu QUAN ĐIỂM CÁ NHÂN (band 7 nêu chung; band 8–9 nêu lập trường cụ thể " +
    "kiểu '…before arguing that…'); (3) determiner đúng (both views/both sides/both points " +
    "of view — KHÔNG 'both points of views'); (4) một lập trường nhất quán ('a personal " +
    "perspective' số ít); (5) tránh từ quá đà cho mở bài (delve into, insight); KHÔNG mâu " +
    "thuẫn với câu paraphrase đã có.",
};


// ---------------------------------------------------------------------------
// RUBRIC chung, nhúng vào mọi prompt chấm/sinh
// (bắt đầu và kết thúc bằng newline, giống triple-quoted string của Python)
// ---------------------------------------------------------------------------
const RUBRIC = `
Bạn là giám khảo IELTS Writing kiêm chuyên gia ngôn ngữ học, đang kèm học viên Việt Nam viết MỞ BÀI cho đề Writing Task 2 dạng "Discuss both views and give your own opinion". Bạn dạy theo lăng kính PRAGMATICS (diễn đạt có tự nhiên, hợp văn phong học thuật, đúng sắc thái không) và SEMANTICS (từ có đúng nghĩa, đúng trường nghĩa không) — không chỉ soi ngữ pháp.

Bốn tiêu chí IELTS (áp cho riêng cấu phần đang luyện):
- TR (Task Response): cấu phần này có hoàn thành đúng nhiệm vụ của nó trong mở bài không (hook dẫn nhập đúng vai; paraphrase đủ & trung thực hai quan điểm; thesis nêu rõ sẽ bàn cả hai phía + quan điểm cá nhân).
- CC (Coherence & Cohesion): ý mạch lạc, liên kết tốt, không vòng vo; hai vế (nếu có) cân xứng và nối mượt.
- LR (Lexical Resource): từ vựng chính xác, đúng sắc thái, đủ học thuật, KHÔNG lỗi dùng từ ngớ ngẩn. Band 8–9 tuyệt đối không mắc lỗi từ vựng cơ bản.
- GRA (Grammatical Range & Accuracy): đa dạng và chính xác cấu trúc; đúng determiner, mạo từ, giới từ.

Thang band tham chiếu cho MỘT cấu phần mở bài:
- Band 5–6: truyền đạt được ý nhưng từ phổ thông/lủng củng, có thể lỗi collocation hoặc "kể chuyện".
- Band 6.5–7: rõ ý, đúng vai cấu phần, paraphrase thực chất, ít lỗi; từ vựng tương đối học thuật.
- Band 7.5–8: word choice chính xác & cùng trường nghĩa, cấu trúc kiểm soát tốt, có chiều sâu (nhượng bộ/claim-reason), referencing tốt.
- Band 8.5–9: tự nhiên, idiomatic, nén chặt mà không gượng; lập trường rõ và nhất quán.

QUY TẮC BẮT BUỘC:
1. Mọi "câu mẫu"/"ví dụ" PHẢI là CÂU HOÀN CHỈNH (chủ ngữ + động từ chính, kết bằng dấu chấm). TUYỆT ĐỐI không trả về fragment.
2. Giải thích bằng TIẾNG VIỆT: cụ thể, dễ hiểu, khích lệ, không phán xét; trích đúng từ/cụm của học viên khi chỉ lỗi.
3. Điều chỉnh độ khó ngôn ngữ giải thích theo TRÌNH ĐỘ học viên: trình độ thấp thì dùng từ đơn giản, giải thích mọi thuật ngữ.
4. Chỉ trả về JSON hợp lệ, không kèm văn bản ngoài JSON, không bọc trong \`\`\`.
`;


// ---------------------------------------------------------------------------
// Các builder prompt
// ---------------------------------------------------------------------------

// Sinh đề mới. usedTopics: mảng nhãn chủ đề đã dùng (chỉ lấy 8 nhãn cuối để tránh lặp).
function buildNewpromptPrompt(usedTopics) {
  let avoid = "";
  // Python: if used_topics (None hoặc list rỗng đều bỏ qua)
  if (usedTopics && usedTopics.length) {
    avoid = "\nTRÁNH lặp lại các chủ đề đã dùng: " + usedTopics.slice(-8).join("; ") + ".";
  }
  return RUBRIC + `
Nhiệm vụ: tạo NGẪU NHIÊN một đề IELTS Writing Task 2 ĐÚNG dạng "Discuss both views and give your own opinion", với HAI quan điểm TRÁI CHIỀU rõ ràng, chủ đề đời thường thường gặp (giáo dục, môi trường, công nghệ, công việc, sức khỏe, xã hội, đô thị, gia đình...).
Đề phải tự nhiên như đề thi thật, độ dài vừa phải, hai phía cân xứng và đều có lý.
Trả JSON:
{"prompt_en":"đề đầy đủ bằng tiếng Anh, KẾT THÚC bằng đúng câu 'Discuss both views and give your own opinion.'",
 "prompt_vi":"dịch nghĩa toàn bộ đề sang tiếng Việt",
 "view1_en":"quan điểm thứ nhất, một mệnh đề ngắn tiếng Anh",
 "view1_vi":"dịch quan điểm 1",
 "view2_en":"quan điểm thứ hai (trái chiều), một mệnh đề ngắn tiếng Anh",
 "view2_vi":"dịch quan điểm 2",
 "topic_short":"nhãn chủ đề ngắn 2-4 từ tiếng Việt (để ghi log)"}` + avoid;
}


// Khối mô tả đề bài nhúng vào prompt chấm/sinh mẫu.
// Mô phỏng dict.get(key, ""): field thiếu (undefined) thì thay bằng chuỗi rỗng.
function _promptBlock(p) {
  const obj = p || {};
  const get = function (k) { return obj[k] === undefined ? "" : obj[k]; };
  return "Đề bài (EN): " + get("prompt_en") + "\n" +
         "Quan điểm 1: " + get("view1_en") + "\n" +
         "Quan điểm 2: " + get("view2_en");
}


// Chấm một câu của học viên cho một cấu phần.
// prevComponents: object {key: câu đã ĐẠT} để kiểm tra tính nhất quán (thesis không mâu thuẫn paraphrase).
function buildGradePrompt(compKey, studentLevel, promptObj, sentence, prevComponents) {
  const comp = COMPONENTS.find(function (c) { return c.key === compKey; }) || COMPONENTS[0];
  let prevTxt = "(chưa có)";
  // Python: if prev_components (dict rỗng là falsy); lọc bỏ value rỗng, giữ thứ tự chèn key
  if (prevComponents && Object.keys(prevComponents).length) {
    prevTxt = Object.entries(prevComponents)
      .filter(function (kv) { return kv[1]; })
      .map(function (kv) { return "- " + kv[0] + ": " + kv[1]; })
      .join("\n");
  }
  const focusTxt = FOCUS[compKey];
  if (focusTxt === undefined) {
    // Python: FOCUS[comp_key] ném KeyError khi key lạ, mô phỏng bằng throw
    throw new Error("FOCUS không có key: " + compKey);
  }
  return RUBRIC + `
Học viên đang luyện CẤU PHẦN: "${comp.title}" — mục tiêu: ${comp.goal}
Trình độ học viên (tự đánh giá hoặc ước lượng): band ${studentLevel}.
Chuẩn ĐẠT của cấu phần này: ${focusTxt}

${_promptBlock(promptObj)}

Các cấu phần học viên đã viết ĐẠT trước đó (để kiểm tra tính nhất quán, nhất là thesis không được mâu thuẫn paraphrase):
${prevTxt}

CÂU HỌC VIÊN VIẾT (cho cấu phần này): "${sentence}"

Hãy chấm câu trên theo 4 tiêu chí, RIÊNG cho vai trò của cấu phần này (đừng trừ điểm vì nó "chưa phải cả mở bài"). Trả JSON:
{"criteria":{
   "TR":{"band":"vd 7.0","comment":"nhận xét ngắn tiếng Việt, cụ thể"},
   "CC":{"band":"...","comment":"..."},
   "LR":{"band":"...","comment":"..."},
   "GRA":{"band":"...","comment":"..."}},
 "overall_band":"trung bình hợp lý của 4 tiêu chí, vd 7.0",
 "strengths":["điểm tốt cụ thể, tiếng Việt"],
 "issues":[{"type":"semantics|pragmatics|lexical|grammar|coherence|task","problem":"chỉ rõ từ/cụm của học viên và TẠI SAO chưa ổn","fix":"cách sửa cụ thể"}],
 "model_sentence":"MỘT câu hoàn chỉnh đạt ~band 7.5 cho ĐÚNG cấu phần này, xây từ chính đề và nội dung của học viên (không phải fragment)",
 "next_hint":"một gợi ý ngắn để câu tốt hơn nữa"}
Giải thích phải khớp trình độ band ${studentLevel}. Chấm NGHIÊM, không lạm phát điểm: phân vân thì cho band thấp hơn; câu cụt/sai vai cấu phần thì TR và overall phải thấp.`;
}


// Sinh 3 câu mẫu Band 7/8/9 cho đúng cấu phần, bám đề và hướng câu học viên đã viết.
function buildExemplarsPrompt(compKey, promptObj, studentSentence) {
  const comp = COMPONENTS.find(function (c) { return c.key === compKey; }) || COMPONENTS[0];
  return RUBRIC + `
Nhiệm vụ: cho ĐÚNG cấu phần "${comp.title}" của mở bài, viết BA phiên bản mẫu ở Band 7, Band 8, Band 9 dựa trên CHÍNH đề bài dưới đây (và tham khảo ý câu học viên đã viết để bám sát hướng của bạn ấy). Mỗi bản là MỘT câu hoàn chỉnh, chỉ cho cấu phần này (không viết cả mở bài).
Mỗi bản kèm 1 ghi chú tiếng Việt NGẮN nêu rõ ĐIỀU GÌ làm nó cao hơn bản dưới (word choice/cấu trúc/pragmatics-semantics).

${_promptBlock(promptObj)}
Câu học viên vừa viết: "${studentSentence}"

Trả JSON:
{"band7":{"sentence":"...","note":"..."},
 "band8":{"sentence":"...","note":"..."},
 "band9":{"sentence":"...","note":"..."}}`;
}


// ---------------------------------------------------------------------------
// Bóc JSON từ output của Gemini (kể cả khi bị bọc trong code fence json)
// ---------------------------------------------------------------------------
function extractJson(text) {
  let s = (text || "").trim();
  s = s.replace(/^```(json)?/i, "").trim();
  s = s.replace(/```$/, "").trim();
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a >= 0 && b >= 0) {
    s = s.slice(a, b + 1);
  }
  return JSON.parse(s);
}


module.exports = {
  COMPONENTS,
  FOCUS,
  componentsPublic,
  buildNewpromptPrompt,
  buildGradePrompt,
  buildExemplarsPrompt,
  extractJson,
};
