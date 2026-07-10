/**
 * coach/postprocess.js
 * Hau xu ly ket qua cham cua COACH (port 1:1 tu 2SOL COACH SUITE):
 *   - forceWholeBands / enforceNoSpeech / enforceNoSpeechDrill / speakingOverall:
 *     tu tools/speaking/__init__.py
 *   - introGate (+ bandNum, roundHalfToEven): tu tools/intro/__init__.py
 *   - validateGeneratedTest / clampPart1Count / filterPart1Questions:
 *     logic kiem tra trong cac route generate-test / generate-part1 cua speaking
 *
 * Cac chuoi thong bao tieng Viet GIU NGUYEN BYTE voi ban Python (khong sua van phong).
 * CommonJS.
 */

"use strict";

// ---------------------------------------------------------------------------
// Helper mo phong ngu nghia Python (de port 1:1, vi JS truthiness/parse khac)
// ---------------------------------------------------------------------------

/**
 * bool() cua Python: khac JS o cho [] va {} rong la FALSY.
 * Dung moi khi nguon viet "x or y" / "if x" tren du lieu JSON.
 */
function pyBool(v) {
  if (v === null || v === undefined || v === false) return false;
  if (v === true) return true;
  if (typeof v === "number") return v !== 0; // luu y: NaN van truthy nhu Python
  if (typeof v === "string") return v.length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v).length > 0;
  return true;
}

/**
 * float() cua Python: nem loi voi null/undefined/chuoi rong/chuoi khong phai so
 * (JS Number() lai tra 0 hoac NaN im lang nen phai tu kiem).
 */
function pyFloat(v) {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0; // float(True) == 1.0
  if (typeof v === "string") {
    const s = v.trim();
    if (s === "") throw new Error("ValueError: could not convert string to float");
    if (/^[+-]?(infinity|inf)$/i.test(s)) return s[0] === "-" ? -Infinity : Infinity;
    if (/^[+-]?nan$/i.test(s)) return NaN;
    // Chan hex/octal/binary: Number("0x10")=16 nhung float("0x10") cua Python loi
    if (/^[+-]?0[xbo]/i.test(s)) throw new Error("ValueError: could not convert string to float");
    const n = Number(s);
    if (Number.isNaN(n)) throw new Error("ValueError: could not convert string to float");
    return n;
  }
  throw new Error("TypeError: float() argument must be a string or a number");
}

/**
 * int() cua Python cho gia tri tu JSON: so thi trunc ve 0; chuoi phai la SO NGUYEN
 * (int("7.5") nem ValueError, khac parseInt cua JS tra 7).
 */
function pyInt(v) {
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw new Error("OverflowError/ValueError: int()");
    return Math.trunc(v);
  }
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "string") {
    const s = v.trim();
    if (!/^[+-]?\d+$/.test(s)) throw new Error("ValueError: invalid literal for int()");
    return parseInt(s, 10);
  }
  throw new Error("TypeError: int() argument");
}

/**
 * round() cua Python (khong doi so ndigits): lam tron HALF-TO-EVEN
 * (banker's rounding). Vd round(13.5)=14, round(14.5)=14, round(12.5)=12.
 * Math.round cua JS lam tron half-up nen KHONG dung duoc truc tiep.
 */
function roundHalfToEven(x) {
  const floor = Math.floor(x);
  const diff = x - floor;
  if (diff < 0.5) return floor;
  if (diff > 0.5) return floor + 1;
  // dung giua: chon so CHAN gan nhat
  return floor % 2 === 0 ? floor : floor + 1;
}

/**
 * "%g" cua Python: toi da 6 chu so co nghia, bo so 0 thua va dau cham thua.
 * Vd formatG(7.0) = "7", formatG(6.5) = "6.5" (String(7.0) cua JS cung ra "7"
 * nhung can ham nay cho cac gia tri nhieu chu so de khop chinh xac).
 */
function formatG(x) {
  if (typeof x !== "number" || Number.isNaN(x)) return String(x);
  if (x === 0) return Object.is(x, -0) ? "-0" : "0";
  if (!Number.isFinite(x)) return x > 0 ? "inf" : "-inf";
  const exp = Math.floor(Math.log10(Math.abs(x)));
  if (exp < -4 || exp >= 6) {
    // dang mu: 1.23457e+06 (mantissa bo 0 thua, so mu >= 2 chu so)
    const parts = x.toExponential(5).split("e");
    let mant = parts[0];
    if (mant.indexOf(".") !== -1) mant = mant.replace(/0+$/, "").replace(/\.$/, "");
    const sign = parts[1][0] === "-" ? "-" : "+";
    let digits = parts[1].replace(/^[+-]/, "");
    if (digits.length < 2) digits = "0" + digits;
    return mant + "e" + sign + digits;
  }
  let s = x.toPrecision(6);
  if (s.indexOf("e") !== -1) s = Number(s).toString();
  if (s.indexOf(".") !== -1) s = s.replace(/0+$/, "").replace(/\.$/, "");
  return s;
}

// ---------------------------------------------------------------------------
// SPEAKING: port tu tools/speaking/__init__.py
// ---------------------------------------------------------------------------

/**
 * Ep band NGUYEN cho tung tieu chi FC/LR/GRA/PR (port force_whole_bands).
 * int(float(x)) cua Python = trunc ve 0. Gia tri thieu/khong hop le thi
 * GIU NGUYEN (nguon bat KeyError/TypeError/ValueError roi pass).
 */
function forceWholeBands(data) {
  const bands = data && data.bands;
  // isinstance(bands, dict) cua nguon: object thuong, khong phai mang
  if (bands !== null && typeof bands === "object" && !Array.isArray(bands)) {
    const keys = ["FC", "LR", "GRA", "PR"];
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      try {
        if (!(k in bands)) throw new Error("KeyError: " + k);
        bands[k] = Math.trunc(pyFloat(bands[k]));
      } catch (e) {
        // giu nguyen gia tri cu, giong "except ...: pass" cua nguon
      }
    }
  }
  return data;
}

// Cac chuoi thong bao: GIONG HET BYTE ban Python (khong duoc sua)
const NO_SPEECH_MSG = "Không nghe thấy giọng nói. Hãy bấm thu âm và trả lời lại.";
const NO_SPEECH_RETRY_FOCUS = "Nói lại to và rõ, ít nhất vài câu hoàn chỉnh.";
const NO_SPEECH_DRILL_MSG = "Không nghe thấy giọng nói. Hãy bấm nói lại và trả lời to, rõ.";

/**
 * Chong bia (port enforce_no_speech): neu KHONG nghe thay giong noi thi tuyet doi
 * khong cho diem/nhan xet lot ra man hinh hoc vien. Tin tin hieu 'no_speech'
 * cua model HOAC transcript rong. Muta data va tra lai data (nhu nguon).
 */
function enforceNoSpeech(data) {
  // (data.get("transcript") or "").strip()
  const t = pyBool(data.transcript) ? data.transcript : "";
  const transcript = (typeof t === "string" ? t : String(t)).trim();
  const noSpeech = data.no_speech;
  // bool(no_speech) if not isinstance(no_speech, str) else bool(no_speech.strip())
  const hasNoSpeech =
    typeof noSpeech === "string" ? noSpeech.trim().length > 0 : pyBool(noSpeech);
  if (hasNoSpeech || transcript === "") {
    data.no_speech =
      typeof noSpeech === "string" && noSpeech.trim() ? noSpeech : NO_SPEECH_MSG;
    data.transcript = "";
    data.bands = { FC: 0, LR: 0, GRA: 0, PR: 0 };
    data.thin = true;
    data.developed = false;
    data.errors = [];
    data.pronunciation = [];
    data.praise = "";
    data.upgrade = "";
    data.need_retry = true;
    data.retry_focus = NO_SPEECH_RETRY_FOCUS;
  }
  return data;
}

/**
 * Nhu enforceNoSpeech nhung cho che do LUYEN PART 1 (port enforce_no_speech_drill):
 * im lang/qua ngan thi KHONG cho 'passed', don sach loi/mau de frontend hien
 * thong bao noi lai.
 */
function enforceNoSpeechDrill(data) {
  const t = pyBool(data.transcript) ? data.transcript : "";
  const transcript = (typeof t === "string" ? t : String(t)).trim();
  const noSpeech = data.no_speech;
  const hasNoSpeech =
    typeof noSpeech === "string" ? noSpeech.trim().length > 0 : pyBool(noSpeech);
  if (hasNoSpeech || transcript === "") {
    data.no_speech =
      typeof noSpeech === "string" && noSpeech.trim() ? noSpeech : NO_SPEECH_DRILL_MSG;
    data.transcript = "";
    data.passed = false;
    data.grammar_errors = [];
    data.pronunciation = [];
    data.model_answer = "";
    data.coach_script_en = "";
    data.praise_vi = "";
  }
  return data;
}

/**
 * Cong thuc overall cua route /api/final-report (port DUNG dong nguon):
 *   vals = [float(b[k]) for k in ("FC", "LR", "GRA", "PR")]
 *   overall = int((sum(vals) / 4.0) * 2) / 2.0
 * int() cua Python = trunc ve 0 (Math.trunc). Thieu band hoac gia tri khong
 * doi duoc sang so thi NEM LOI, tang tren tu try/catch va bo qua nhu route nguon.
 */
function speakingOverall(bands) {
  const b = pyBool(bands) ? bands : {}; // data.get("bands") or {}
  const keys = ["FC", "LR", "GRA", "PR"];
  let sum = 0;
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (!(k in b)) throw new Error("KeyError: " + k); // float(b[k]) voi key thieu
    sum += pyFloat(b[k]);
  }
  return Math.trunc((sum / 4.0) * 2) / 2.0;
}

// ---------------------------------------------------------------------------
// INTRO: port tu tools/intro/__init__.py
// ---------------------------------------------------------------------------

/**
 * _band_num cua intro: "band" dang '7.0' / 'Band 6.5' / so -> float dau tien
 * tim thay trong chuoi; khong co so -> 0.0.
 */
function bandNum(v) {
  const s = String(pyBool(v) ? v : ""); // str(v or "")
  const m = s.match(/\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : 0.0;
}

/**
 * Cong DAT tinh SERVER-SIDE cua Intro (port block trong route /api/grade cua
 * intro/__init__.py, khong de model tu y cho qua):
 *   nums    = band cua TR/CC/LR/GRA (chi giu gia tri > 0)
 *   avg     = round(sum/len * 2) / 2  voi round() la HALF-TO-EVEN cua Python
 *   overall = overall_band cua model neu > 0, nguoc lai lay avg
 *   passed  = overall >= 7.0 va min(nums) >= 6.5
 *   (nums rong: passed = overall >= 7.0, khong dat overall_band)
 *
 * @param {Object} criteria    object {TR:{band},CC:{band},LR:{band},GRA:{band}}
 * @param {*}      overallBand data.overall_band model tra ve (tuy chon)
 * @returns {{overall:number, passed:boolean, overall_band:(string|undefined)}}
 *          overall_band la chuoi "%g" nhu nguon, CHI co khi tinh duoc tu nums
 */
function introGate(criteria, overallBand) {
  const crit = pyBool(criteria) ? criteria : {}; // data.get("criteria") or {}
  const keys = ["TR", "CC", "LR", "GRA"];
  let nums = keys.map(function (k) {
    const c = pyBool(crit[k]) ? crit[k] : {}; // (crit.get(k) or {})
    return bandNum(c.band);
  });
  nums = nums.filter(function (n) {
    return n > 0;
  });
  let overall = bandNum(overallBand);
  const result = {};
  if (nums.length) {
    // lam tron ve NUA band, half-to-even nhu round() cua Python
    const avg = roundHalfToEven((nums.reduce(function (a, x) { return a + x; }, 0) / nums.length) * 2) / 2;
    if (overall <= 0) overall = avg;
    result.overall_band = formatG(overall); // ("%g" % overall) cua nguon
    result.passed = Boolean(overall >= 7.0 && Math.min.apply(null, nums) >= 6.5);
  } else {
    result.passed = Boolean(overall >= 7.0);
  }
  result.overall = overall;
  return result;
}

// ---------------------------------------------------------------------------
// Kiem tra cau truc de (port logic trong route cua speaking/__init__.py)
// ---------------------------------------------------------------------------

/**
 * Kiem tra cau truc de generate-test (port dieu kien trong /api/generate-test):
 * DU cau truc khi part1 co >= 4 cau, part2 co topic truthy, part3 co >= 4 cau.
 * Tra true neu DAT (nguon: dieu kien nguoc lai thi tra loi
 * "Tạo đề chưa đủ cấu trúc, bấm Bắt đầu lại." voi HTTP 502).
 */
function validateGeneratedTest(data) {
  const part1 = pyBool(data.part1) ? data.part1 : [];
  const part2 = pyBool(data.part2) ? data.part2 : {};
  const part3 = pyBool(data.part3) ? data.part3 : [];
  const bad = part1.length < 4 || !pyBool(part2.topic) || part3.length < 4;
  return !bad;
}

/**
 * Kep so cau Part 1 trong khoang hop ly 5-10 (port /api/generate-part1):
 *   try: n = int(d.get("count") or 7) except (TypeError, ValueError): n = 7
 *   n = max(5, min(10, n))
 * Luu y: int("7.5") cua Python nem ValueError nen "7.5" -> 7 (khong phai 7 do parse).
 */
function clampPart1Count(count) {
  let n;
  try {
    n = pyInt(pyBool(count) ? count : 7);
  } catch (e) {
    n = 7;
  }
  return Math.max(5, Math.min(10, n));
}

/**
 * Loc cau hoi Part 1 hop le (port /api/generate-part1):
 *   qs = [q for q in (data.get("questions") or []) if isinstance(q, str) and q.strip()]
 * Route nguon yeu cau len(qs) >= 4 moi dat; caller tu kiem tra do dai.
 */
function filterPart1Questions(data) {
  const qs = Array.isArray(data.questions) ? data.questions : [];
  return qs.filter(function (q) {
    return typeof q === "string" && q.trim() !== "";
  });
}

module.exports = {
  forceWholeBands: forceWholeBands,
  enforceNoSpeech: enforceNoSpeech,
  enforceNoSpeechDrill: enforceNoSpeechDrill,
  speakingOverall: speakingOverall,
  introGate: introGate,
  validateGeneratedTest: validateGeneratedTest,
  clampPart1Count: clampPart1Count,
  filterPart1Questions: filterPart1Questions,
  // helpers (export de tai su dung/test)
  roundHalfToEven: roundHalfToEven,
  bandNum: bandNum,
  formatG: formatG,
};
