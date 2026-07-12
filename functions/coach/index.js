/**
 * coach/index.js
 * DISPATCHER Cloud Functions cho module IELTS COACH cua app 2SOL EDU.
 * Port 1:1 nghiep vu tu 2SOL COACH SUITE (Flask), moi tool MOT callable,
 * dispatch theo data.action, payload giu SNAKE_CASE y het Flask de frontend port 1:1:
 *   - coachSpeaking : tools/speaking/__init__.py (routes dong ~409-515)
 *   - coachWriting  : tools/writing/__init__.py  (routes dong ~247-307)
 *   - coachIntro    : tools/intro/__init__.py    (routes dong ~244-306)
 *   - coachTts      : giong giam khao (port /api/tts cua speaking, tang Edge TTS)
 *
 * Nguyen tac:
 *   - Key Gemini giu trong Secret Manager, KHONG bao gio xuong client.
 *   - Quota dem TRUOC khi goi model (dung semantics authcore.check_and_count
 *     cua nguon: dem truoc, khong hoan luot khi loi). Cac kiem tra du lieu vao
 *     (thieu audio, thieu sentence...) dat TRUOC quota nhu nguon, khong ton luot.
 *   - Message loi giu NGUYEN tieng Viet cua nguon, khong lo chu Gemini/AI/Google.
 *
 * CommonJS. KHONG initializeApp o day (functions/index.js goc da init);
 * KHONG goi admin.database() o top-level module (chi trong handler).
 */

"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

const { callGemini, extractJson } = require("./gemini");
const post = require("./postprocess");
const { checkAndCount } = require("./quota");
const { saveHistory } = require("./history");
const { synthMp3 } = require("./tts");
const speaking = require("./prompts/speaking");
const writing = require("./prompts/writing");
const intro = require("./prompts/intro");

// Khoa he thong: firebase functions:secrets:set GEMINI_API_KEY
const geminiKey = defineSecret("GEMINI_API_KEY");

// Callable goi Gemini: 300s vi call_gemini co the retry toi 3 lan x 2 model
const CALL_OPTS = {
  region: "asia-southeast1",
  secrets: [geminiKey],
  timeoutSeconds: 300,
  memory: "512MiB",
  maxInstances: 10,
};
// TTS khong dung key Gemini nen nhe va ngan hon
const TTS_OPTS = {
  region: "asia-southeast1",
  timeoutSeconds: 60,
  memory: "256MiB",
  maxInstances: 5,
};

// Model mac dinh khi RTDB chua co coachConfig/models
// (Bak chinh model truc tiep tren DB, khong can deploy lai)
const DEFAULT_MODELS = {
  fast: "gemini-3.5-flash",
  deep: "gemini-3.5-flash",
  fallback: "gemini-2.5-flash",
};

// Tran kich thuoc audio_b64 (chuoi base64): ~10MB, chan payload qua kho
const AUDIO_B64_MAX = 10 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Truthiness cua Python: None/""/0/[]/{} deu falsy (khac JS o object rong)
function pyTruthy(v) {
  if (v === null || v === undefined || v === false || v === "" || v === 0) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v).length > 0;
  return true;
}

// (v or dflt).strip() cua Python cho tham so chuoi tu client
function trimStr(v, dflt) {
  const base = pyTruthy(v) ? v : (dflt === undefined ? "" : dflt);
  return String(base).trim();
}

// int(v or dflt) cua Python, phong thu: gia tri hong thi dung mac dinh
// (thay vi de handler no 500 nhu Flask)
function toIntOr(v, dflt) {
  const base = pyTruthy(v) ? v : dflt;
  const n = Number(base);
  return Number.isFinite(n) ? Math.trunc(n) : dflt;
}

// RTDB khong nhan undefined: thay bang null cho cac field tuy chon cua record
function orNull(v) {
  return v === undefined ? null : v;
}

/**
 * Kiem tra dang nhap + vai tro. Chi nhan student/staff/admin
 * (role gan vao custom token boi issueToken cua index.js goc).
 */
function requireAuth(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Vui lòng đăng nhập lại.");
  }
  const role = request.auth.token && request.auth.token.role;
  if (role !== "student" && role !== "staff" && role !== "admin") {
    throw new HttpsError("permission-denied", "Tài khoản không có quyền dùng công cụ này.");
  }
  return { uid: request.auth.uid, role: role };
}

/**
 * Doc model tu RTDB coachConfig/models {fast, deep, fallback}.
 * Thieu key nao dung mac dinh key do; loi doc DB thi dung nguyen bo mac dinh
 * (khong chan hoc vien vi loi ha tang).
 */
async function getModels() {
  const models = Object.assign({}, DEFAULT_MODELS);
  try {
    const snap = await admin.database().ref("coachConfig/models").get();
    const v = snap.val();
    if (v && typeof v === "object") {
      for (const k of ["fast", "deep", "fallback"]) {
        if (typeof v[k] === "string" && v[k].trim()) models[k] = v[k].trim();
      }
    }
  } catch (e) {
    // dung mac dinh
  }
  return models;
}

/**
 * Port gemini_error_response cua nguon sang HttpsError.
 * variant: "speaking" (speaking/__init__.py ~326-339, KHONG kem detail) |
 *          "writing"  (writing ~220-241 va intro ~210-230, CO kem detail,
 *                      cau 429 khac 1 chu "ít").
 * Message tieng Viet giu NGUYEN nguon; phan detail kem theo (variant writing)
 * ghi "[Mã <code>: ...]" thay cho "[Google ...]" de khong lo ten nha cung cap.
 */
function mapGeminiError(err, variant) {
  if (err instanceof HttpsError) return err; // phong thu: khong boc 2 lan
  const status = err && typeof err.status === "number" ? err.status : null;
  if (status === null) {
    // Nhanh "not HTTPError" cua nguon: loi mang/timeout/JSON hong
    const reason = err && err.message ? err.message : String(err);
    return new HttpsError("internal", "Không kết nối được hệ thống: " + reason);
  }
  let msg;
  if (status === 401) {
    msg = "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  } else if (status === 400 || status === 403) {
    msg = "Tài khoản không có quyền hoặc cấu hình sai. Kiểm tra lại.";
  } else if (status === 429) {
    msg = variant === "speaking"
      ? "Đã đạt giới hạn lượt dùng (hoặc hệ thống đang bận). Đợi ít rồi thử lại."
      : "Đã đạt giới hạn lượt dùng (hoặc hệ thống đang bận). Đợi rồi thử lại.";
  } else {
    msg = "Hệ thống tạm gián đoạn (mã " + status + "). Thử lại sau ít phút.";
  }
  if (variant !== "speaking" && err.detail) {
    // writing/intro cua nguon kem chi tiet upstream de chan doan nhanh
    msg += " [Mã " + status + ": " + String(err.detail).slice(0, 240) + "]";
  }
  let code;
  if (status === 429) code = "resource-exhausted";
  else if (status === 500 || status === 502 || status === 503) code = "unavailable";
  else if (status === 400 || status === 403) code = "failed-precondition";
  else code = "internal";
  return new HttpsError(code, msg);
}

// Bat buoc co audio_b64 + chan ghi am qua lon (kiem tra TRUOC quota, khong ton luot)
function requireAudio(d, missingMsg) {
  const audio = pyTruthy(d.audio_b64) ? d.audio_b64 : "";
  if (!audio) throw new HttpsError("invalid-argument", missingMsg);
  if (typeof audio === "string" && audio.length > AUDIO_B64_MAX) {
    throw new HttpsError("invalid-argument", "Đoạn ghi âm quá lớn. Hãy thu âm lại ngắn hơn.");
  }
  return audio;
}

// ---------------------------------------------------------------------------
// 1. SPEAKING COACH (port tools/speaking/__init__.py)
// ---------------------------------------------------------------------------
exports.coachSpeaking = onCall(CALL_OPTS, async (request) => {
  const { uid, role } = requireAuth(request);
  const d = request.data || {};
  const action = d.action;

  // Danh thuc function khi mo trang (mien phi, khong quota)
  if (action === "ping") return { ok: true };

  // ---- Sinh bo de Part 1-2-3 (port /api/generate-test, nguon ~409-422) ----
  if (action === "generateTest") {
    await checkAndCount(uid, role, "speaking");
    const models = await getModels();
    const topic = trimStr(d.topic);
    const targetBand = trimStr(d.target_band, "6.0");
    let data;
    try {
      data = extractJson(await callGemini(
        [{ text: speaking.buildTestPrompt(topic, targetBand) }],
        { temperature: 1.0, model: models.fast, thinking: "low" },
        geminiKey.value(), models));
    } catch (e) {
      throw mapGeminiError(e, "speaking");
    }
    // Thieu cau truc de (nguon tra HTTP 502 cung message nay)
    if (!post.validateGeneratedTest(data)) {
      throw new HttpsError("internal", "Tạo đề chưa đủ cấu trúc, bấm Bắt đầu lại.");
    }
    return data;
  }

  // ---- Sinh bo cau hoi Part 1 cho che do Luyen (port /api/generate-part1, ~425-444) ----
  if (action === "generatePart1") {
    await checkAndCount(uid, role, "speaking");
    const models = await getModels();
    const topic = trimStr(d.topic);
    const targetBand = trimStr(d.target_band, "6.0");
    const n = post.clampPart1Count(d.count); // kep 5-10, mac dinh 7 nhu nguon
    let data;
    try {
      data = extractJson(await callGemini(
        [{ text: speaking.buildPart1SetPrompt(topic, targetBand, n) }],
        { temperature: 1.0, model: models.fast, thinking: "low" },
        geminiKey.value(), models));
    } catch (e) {
      throw mapGeminiError(e, "speaking");
    }
    const qs = post.filterPart1Questions(data);
    if (qs.length < 4) {
      throw new HttpsError("internal", "Tạo câu hỏi chưa đủ, bấm Bắt đầu lại.");
    }
    return { topic_title: data.topic_title || topic || "Part 1", questions: qs };
  }

  // ---- Cham 1 cau tra loi co audio (port /api/evaluate, ~471-493) ----
  if (action === "evaluate") {
    const audioB64 = requireAudio(d, "Không nhận được audio. Kiểm tra micro rồi thu lại.");
    await checkAndCount(uid, role, "speaking");
    const models = await getModels();
    const prompt = speaking.buildEvaluatePrompt(
      toIntOr(d.part, 1),
      trimStr(d.question),
      d.cue_card,
      trimStr(d.target_band, "6.0"),
      toIntOr(d.attempt, 1),
      d.prev_feedback,
      d.voiced_ms, // thoi luong giong noi thuc do o trinh duyet (co the thieu)
      d.pauses_over_2s, // so lan ngung >2s + lan ngung lau nhat (nang cap 07/2026,
      d.longest_pause_ms // giup cham FC co bang chung; client cu khong gui thi la undefined)
    );
    // Audio dat TRUOC prompt: nhac model bam vao am thanh, khong suy dien tu cau hoi
    const parts = [
      { inline_data: { mime_type: d.mime || "audio/webm", data: audioB64 } },
      { text: prompt },
    ];
    let data;
    try {
      data = extractJson(await callGemini(
        parts,
        { temperature: 0.2, model: models.deep, thinking: "low" },
        geminiKey.value(), models));
    } catch (e) {
      throw mapGeminiError(e, "speaking");
    }
    return post.enforceNoSpeech(post.forceWholeBands(data));
  }

  // ---- Cham 1 cau Part 1 che do Luyen (port /api/drill-evaluate, ~447-468) ----
  if (action === "drillEvaluate") {
    const audioB64 = requireAudio(d, "Không nhận được audio. Kiểm tra micro rồi nói lại.");
    await checkAndCount(uid, role, "speaking");
    const models = await getModels();
    const prompt = speaking.buildDrillPrompt(
      trimStr(d.question),
      trimStr(d.target_band, "6.0"),
      toIntOr(d.attempt, 1),
      d.prev_errors,
      d.prev_pron
    );
    const parts = [
      { inline_data: { mime_type: d.mime || "audio/webm", data: audioB64 } },
      { text: prompt },
    ];
    let data;
    try {
      data = extractJson(await callGemini(
        parts,
        { temperature: 0.2, model: models.deep, thinking: "low" },
        geminiKey.value(), models));
    } catch (e) {
      throw mapGeminiError(e, "speaking");
    }
    return post.enforceNoSpeechDrill(data);
  }

  // ---- Tong ket cuoi phien (port /api/final-report, ~496-515) + luu lich su ----
  if (action === "finalReport") {
    const evaluations = pyTruthy(d.evaluations) ? d.evaluations : [];
    if (!pyTruthy(evaluations)) {
      throw new HttpsError("invalid-argument", "Chưa có dữ liệu bài làm để tổng kết.");
    }
    await checkAndCount(uid, role, "speaking");
    const models = await getModels();
    const targetBand = trimStr(d.target_band, "6.0");
    let data;
    try {
      data = extractJson(await callGemini(
        [{ text: speaking.buildFinalPrompt(evaluations, targetBand) }],
        { temperature: 0.2, model: models.deep, thinking: "low" },
        geminiKey.value(), models));
    } catch (e) {
      throw mapGeminiError(e, "speaking");
    }
    post.forceWholeBands(data);
    // Server tu tinh lai overall tu 4 band (bọc try nhu nguon: thieu band thi bo qua)
    try {
      data.overall = post.speakingOverall(data.bands);
    } catch (e) {
      // "except Exception: pass" cua nguon
    }
    // Luu lich su phien: loi luu KHONG duoc lam hong response tra ve hoc vien
    try {
      const meta = (d.meta && typeof d.meta === "object") ? d.meta : {};
      await saveHistory(uid, "speaking", {
        mode: meta.mode || "practice",
        targetBand: orNull(d.target_band),
        topic: meta.topic || "",
        overall: orNull(data.overall),
        bands: orNull(data.bands),
        report: data,
        drillStats: orNull(meta.drillStats),
        // Tong ms hoc vien THAT SU noi trong phien (client do bang voice meter),
        // phuc vu theo doi luong noi thuc theo thoi gian (nang cap 07/2026)
        talkMs: orNull(meta.talkMs),
      });
    } catch (e) {
      console.warn("coachSpeaking: luu lich su that bai:", e && e.message);
    }
    return data;
  }

  throw new HttpsError("invalid-argument", "Hành động không hợp lệ.");
});

// ---------------------------------------------------------------------------
// 2. WRITING COACH, thang 7 bac (port tools/writing/__init__.py)
// Nguon dung call_gemini(max_tokens=4096) + luon tat thinking, nen moi action
// duoi day deu truyen maxTokens 4096 + thinking "low".
// ---------------------------------------------------------------------------
exports.coachWriting = onCall(CALL_OPTS, async (request) => {
  const { uid, role } = requireAuth(request);
  const d = request.data || {};
  const action = d.action;

  if (action === "ping") return { ok: true };

  // Thang bac cong khai cho frontend (mien phi, port /api/levels)
  if (action === "getLevels") return writing.levelsPublic();

  // ---- Dan dat Socratic tim y (port /api/next-question, nguon ~247-259) ----
  if (action === "nextQuestion") {
    await checkAndCount(uid, role, "writing");
    const models = await getModels();
    const topic = trimStr(d.topic);
    const qa = Array.isArray(d.qa) ? d.qa : [];
    const qCount = toIntOr(d.qCount, 0); // phai la SO NGUYEN (builder so sanh === 0)
    try {
      return extractJson(await callGemini(
        [{ text: writing.buildSocraticPrompt(topic, qa, qCount) }],
        { temperature: 0.7, model: models.fast, maxTokens: 4096, thinking: "low" },
        geminiKey.value(), models));
    } catch (e) {
      throw mapGeminiError(e, "writing");
    }
  }

  // ---- Chot nguyen nhan/he qua + cau goc band 5 (port /api/extract-ideas, ~262-273) ----
  if (action === "extractIdeas") {
    await checkAndCount(uid, role, "writing");
    const models = await getModels();
    const topic = trimStr(d.topic);
    const qa = Array.isArray(d.qa) ? d.qa : [];
    try {
      return extractJson(await callGemini(
        [{ text: writing.buildExtractPrompt(topic, qa) }],
        { temperature: 0.4, model: models.fast, maxTokens: 4096, thinking: "low" },
        geminiKey.value(), models));
    } catch (e) {
      throw mapGeminiError(e, "writing");
    }
  }

  // ---- Giai thich ky thuat cua mot bac (port /api/level-intro, ~276-288) ----
  if (action === "levelIntro") {
    await checkAndCount(uid, role, "writing");
    const models = await getModels();
    const idx = Math.max(0, Math.min(toIntOr(d.levelIdx, 0), writing.LEVELS.length - 1));
    // studentLevel giu nguyen STRING tu client (str(7.0) Python = "7.0", String JS = "7")
    const studentLevel = pyTruthy(d.studentLevel) ? d.studentLevel : "5.5";
    try {
      return extractJson(await callGemini(
        [{ text: writing.buildLevelIntroPrompt(idx, studentLevel, d.cause || "", d.effect || "") }],
        { temperature: 0.5, model: models.fast, maxTokens: 4096, thinking: "low" },
        geminiKey.value(), models));
    } catch (e) {
      throw mapGeminiError(e, "writing");
    }
  }

  // ---- Cham cau hoc vien theo focus cua bac (port /api/grade, ~291-307) ----
  if (action === "grade") {
    const idx = Math.max(0, Math.min(toIntOr(d.levelIdx, 0), writing.LEVELS.length - 1));
    const sentence = trimStr(d.sentence);
    if (!sentence) {
      throw new HttpsError("invalid-argument", "Chưa có câu để chấm.");
    }
    await checkAndCount(uid, role, "writing");
    const models = await getModels();
    const studentLevel = pyTruthy(d.studentLevel) ? d.studentLevel : "5.5";
    try {
      return extractJson(await callGemini(
        [{ text: writing.buildGradePrompt(idx, studentLevel, d.cause || "", d.effect || "", d.base || "", sentence) }],
        { temperature: 0.2, model: models.deep, maxTokens: 4096, thinking: "low" },
        geminiKey.value(), models));
    } catch (e) {
      throw mapGeminiError(e, "writing");
    }
  }

  // ---- Luu tom tat phien vao lich su (mien phi, thay cho export-history cua nguon) ----
  if (action === "saveSession") {
    await saveHistory(uid, "writing", { summary: d.summary || {} });
    return { ok: true };
  }

  throw new HttpsError("invalid-argument", "Hành động không hợp lệ.");
});

// ---------------------------------------------------------------------------
// 3. WRITING INTRO COACH, 3 cau phan mo bai (port tools/intro/__init__.py)
// Nguon dung chung call_gemini voi writing (max_tokens=4096, thinking low).
// ---------------------------------------------------------------------------
exports.coachIntro = onCall(CALL_OPTS, async (request) => {
  const { uid, role } = requireAuth(request);
  const d = request.data || {};
  const action = d.action;

  if (action === "ping") return { ok: true };

  // 3 cau phan cong khai cho frontend (mien phi, port /api/components)
  if (action === "getComponents") return intro.componentsPublic();

  // ---- Sinh de moi (port /api/new-prompt, nguon ~244-254) ----
  if (action === "newPrompt") {
    await checkAndCount(uid, role, "intro");
    const models = await getModels();
    const used = Array.isArray(d.usedTopics) ? d.usedTopics : [];
    try {
      return extractJson(await callGemini(
        [{ text: intro.buildNewpromptPrompt(used) }],
        { temperature: 1.0, model: models.fast, maxTokens: 4096, thinking: "low" },
        geminiKey.value(), models));
    } catch (e) {
      throw mapGeminiError(e, "writing");
    }
  }

  // ---- Cham 1 cau cua 1 cau phan (port /api/grade, ~257-289) ----
  if (action === "grade") {
    let compKey = trimStr(d.component, "hook");
    const sentence = trimStr(d.sentence);
    const promptObj = pyTruthy(d.prompt) ? d.prompt : {};
    const prev = pyTruthy(d.prevComponents) ? d.prevComponents : {};
    if (!sentence) {
      throw new HttpsError("invalid-argument", "Chưa có câu để chấm.");
    }
    if (!Object.prototype.hasOwnProperty.call(intro.FOCUS, compKey)) compKey = "hook";
    await checkAndCount(uid, role, "intro");
    const models = await getModels();
    const studentLevel = pyTruthy(d.studentLevel) ? d.studentLevel : "6.0";
    let data;
    try {
      data = extractJson(await callGemini(
        [{ text: intro.buildGradePrompt(compKey, studentLevel, promptObj, sentence, prev) }],
        { temperature: 0.2, model: models.deep, maxTokens: 4096, thinking: "low" },
        geminiKey.value(), models));
    } catch (e) {
      throw mapGeminiError(e, "writing");
    }
    // Cong DAT tinh SERVER-SIDE (port nguyen block nguon ~276-289, khong de model
    // tu y cho qua): introGate tinh overall/passed tu criteria + overall_band.
    // Nguon chi ghi de overall_band khi co band > 0 trong criteria (nhanh nums),
    // nen o day cung CHI gan khi gate co key overall_band.
    const gate = post.introGate(data.criteria, data.overall_band);
    data.passed = gate.passed;
    if (Object.prototype.hasOwnProperty.call(gate, "overall_band")) {
      data.overall_band = gate.overall_band;
    }
    return data;
  }

  // ---- 3 cau mau Band 7/8/9 (port /api/exemplars, ~292-306) ----
  if (action === "exemplars") {
    await checkAndCount(uid, role, "intro");
    const models = await getModels();
    let compKey = trimStr(d.component, "hook");
    if (!Object.prototype.hasOwnProperty.call(intro.FOCUS, compKey)) compKey = "hook";
    const promptObj = pyTruthy(d.prompt) ? d.prompt : {};
    const sentence = trimStr(d.sentence);
    try {
      return extractJson(await callGemini(
        [{ text: intro.buildExemplarsPrompt(compKey, promptObj, sentence) }],
        { temperature: 0.45, model: models.fast, maxTokens: 4096, thinking: "low" },
        geminiKey.value(), models));
    } catch (e) {
      throw mapGeminiError(e, "writing");
    }
  }

  // ---- Luu tom tat phien vao lich su (mien phi) ----
  if (action === "saveSession") {
    await saveHistory(uid, "intro", { summary: d.summary || {} });
    return { ok: true };
  }

  throw new HttpsError("invalid-argument", "Hành động không hợp lệ.");
});

// ---------------------------------------------------------------------------
// 4. TTS, giong giam khao (port /api/tts cua speaking; server chi co tang Edge,
// loi thi tra "unavailable" de client tu rot ve giong trinh duyet webSpeak)
// ---------------------------------------------------------------------------
exports.coachTts = onCall(TTS_OPTS, async (request) => {
  const { uid, role } = requireAuth(request);
  const d = request.data || {};

  const text = trimStr(d.text);
  if (!text) {
    // nguon: 400 "Thiếu text." (kiem tra truoc, khong ton luot)
    throw new HttpsError("invalid-argument", "Thiếu text.");
  }

  // Cong tat tu xa: coachConfig/ttsEnabled === false thi tat giong doc
  let ttsOff = false;
  try {
    const snap = await admin.database().ref("coachConfig/ttsEnabled").get();
    ttsOff = snap.val() === false;
  } catch (e) {
    // loi doc config: coi nhu dang bat, khong chan hoc vien
  }
  if (ttsOff) {
    throw new HttpsError("unavailable", "Giọng đọc đang tắt.");
  }

  await checkAndCount(uid, role, "tts");

  let buf;
  try {
    buf = await synthMp3(d.text);
  } catch (e) {
    // Moi loi synth deu tra unavailable de client tu rot ve giong trinh duyet
    throw new HttpsError("unavailable", "Giọng đọc tạm gián đoạn.");
  }
  return { audioB64: buf.toString("base64"), mime: "audio/mpeg" };
});
