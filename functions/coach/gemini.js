/**
 * coach/gemini.js
 * Ha tang goi Gemini REST v1beta cho Cloud Functions (port 1:1 tu
 * tools/speaking/__init__.py cua 2SOL COACH SUITE, nhanh DIRECT: server giu key,
 * khong qua proxy). Kem extractJson port tu tools/speaking/prompts.py.
 *
 * CommonJS. Dung fetch global cua Node 18+ (Cloud Functions node 22).
 */

"use strict";

// URL REST cua Google Generative Language (giu nguyen ban Python:
// "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}")
const GEMINI_URL_BASE = "https://generativelanguage.googleapis.com/v1beta/models/";

// Ma loi TAM THOI (model ban/qua tai...) duoc phep thu lai, giong _TRANSIENT_CODES nguon
const TRANSIENT_CODES = [429, 500, 502, 503];

// Timeout moi request: 240 giay, giong urlopen(req, timeout=240) cua nguon.
// (Nguon la socket timeout, ban Node dung AbortController tinh tong thoi gian.)
const REQUEST_TIMEOUT_MS = 240 * 1000;

// time.sleep cua Python: ngu theo GIAY
function sleep(seconds) {
  return new Promise(function (resolve) {
    setTimeout(resolve, seconds * 1000);
  });
}

/**
 * Ap thinkingConfig theo TEN model (port _apply_thinking cua nguon):
 * Gemini 3.x dung thinkingLevel; Gemini 2.5 dung thinkingBudget.
 * Dat sai loai cho model se bi loi 400 nen phai chon theo ten model.
 * thinking: "low" | "high" | null (null/rong: khong dat gi ca)
 */
function applyThinking(genConfig, model, thinking) {
  if (!thinking) {
    return;
  }
  if (model.indexOf("gemini-3") !== -1) {
    genConfig.thinkingConfig = { thinkingLevel: thinking }; // "low" | "high"
  } else if (model.indexOf("2.5") !== -1) {
    genConfig.thinkingConfig = { thinkingBudget: thinking === "low" ? 0 : -1 };
  }
}

/**
 * Goi Gemini DUNG MOT lan voi 1 model (port _gemini_once, nhanh DIRECT).
 * Loi HTTP: nem Error co .status (ma HTTP) + .detail (trich body loi, cat 300 ky tu
 * nhu proxy route nguon) de tang tren map sang HttpsError. Loi khac (mang, timeout,
 * JSON hong): nem Error thuong, tang goi se retry nhu nhanh "except Exception" nguon.
 */
async function geminiOnce(useModel, baseConfig, parts, thinking, apiKey) {
  const genConfig = Object.assign({}, baseConfig); // dict(base_config)
  applyThinking(genConfig, useModel, thinking);
  if (!apiKey) {
    // Giong RuntimeError("Chưa có khoá hệ thống.") cua nguon
    throw new Error("Chưa có khoá hệ thống.");
  }
  const url = GEMINI_URL_BASE + useModel + ":generateContent?key=" + apiKey;
  const body = { contents: [{ parts: parts }], generationConfig: genConfig };

  const controller = new AbortController();
  const timer = setTimeout(function () {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    // Tuong duong urllib.error.HTTPError: giu NGUYEN ma HTTP de tang tren
    // tu quyet dinh retry/fallback (vd 503 "high demand")
    let detail = "";
    try {
      detail = String(await res.text()).slice(0, 300);
    } catch (e) {
      // khong doc duoc body loi thi bo qua, van giu ma HTTP
    }
    const err = new Error("[Google " + res.status + "] " + detail);
    err.status = res.status;
    err.detail = detail;
    throw err;
  }

  const out = await res.json();
  // Truy xuat giong out["candidates"][0]["content"]["parts"][0]["text"] cua nguon.
  // Thieu tang nao se nem TypeError, duoc coi nhu loi tam va retry (nhu KeyError Python).
  const text = out["candidates"][0]["content"]["parts"][0]["text"];
  if (text === undefined) {
    // Mo phong KeyError("text") cua Python (JS tra undefined thay vi nem loi)
    throw new TypeError("Phản hồi model thiếu trường 'text'.");
  }
  return text;
}

/**
 * Goi Gemini co CHONG QUA TAI (port call_gemini cua nguon, nhanh DIRECT).
 * Gap loi tam thoi (429/500/502/503) thi tu thu lai co cho (sleep 1s * (attempt+1));
 * model chinh van ban sau 3 lan thi rot sang model fallback (on dinh hon).
 * Loi HTTP KHONG tam thoi (vd 400/401/403) thi break luon, khong thu fallback.
 *
 * @param {Array}  parts  Mang Gemini parts DUNG SAN tu ngoai,
 *                        vd [{inline_data:{mime_type,data}},{text}] hoac [{text}]
 * @param {Object} opts   {temperature=0.3, maxTokens=8192, model, useDeep, thinking}
 *                        - model: chi dinh thang ten model (uu tien cao nhat, nhu tham so
 *                          `model` cua nguon); khong co thi lay theo useDeep
 *                        - useDeep: true -> models.deep (cham/tong ket), false -> models.fast
 *                        - thinking: "low" | "high" | null (nhu tham so `thinking` nguon)
 * @param {string} apiKey Khoa Gemini giu PHIA SERVER (khong bao gio xuong client)
 * @param {Object} models {fast, deep, fallback}
 * @returns {Promise<string>} text tho model tra ve (dua qua extractJson de lay object)
 * @throws Error co .status (ma HTTP cuoi) + .detail neu loi HTTP; Error thuong neu loi khac
 */
async function callGemini(parts, opts, apiKey, models) {
  opts = opts || {};
  models = models || {};
  const temperature = opts.temperature === undefined ? 0.3 : opts.temperature;
  const maxTokens = opts.maxTokens === undefined ? 8192 : opts.maxTokens;
  const thinking = opts.thinking || null;

  // Giong base_config cua nguon: luon ep tra JSON
  const baseConfig = {
    temperature: temperature,
    responseMimeType: "application/json",
    maxOutputTokens: maxTokens,
  };

  // primary = model or MODEL_FAST (nguon); ban Node them useDeep de chon deep/fast
  const primary = opts.model || (opts.useDeep ? models.deep : models.fast);
  const fallback = String(models.fallback || "").trim();
  const modelList = [primary];
  if (fallback && fallback !== primary) {
    modelList.push(fallback);
  }

  let last = null;
  for (let mi = 0; mi < modelList.length; mi++) {
    const m = modelList[mi];
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await geminiOnce(m, baseConfig, parts, thinking, apiKey);
      } catch (e) {
        last = e;
        if (typeof e.status === "number") {
          // Nhanh "except urllib.error.HTTPError" cua nguon
          if (TRANSIENT_CODES.indexOf(e.status) !== -1 && attempt < 2) {
            await sleep(1.0 * (attempt + 1));
            continue;
          }
          break;
        }
        // Nhanh "except Exception" cua nguon (mang, timeout, JSON hong...)
        if (attempt < 2) {
          await sleep(1.0);
          continue;
        }
        break;
      }
    }
    // Loi HTTP KHONG tam thoi thi dung han, khong thu model fallback (giong nguon)
    if (last && typeof last.status === "number" && TRANSIENT_CODES.indexOf(last.status) === -1) {
      break;
    }
  }
  throw last; // "raise last" cua nguon: nem dung loi cuoi cung
}

/**
 * Tim chi so dau '}' DONG object JSON dau tien trong chuoi bat dau bang '{'
 * (quet can bang ngoac, co xu ly chuoi va escape). Tra -1 neu khong can bang.
 * Dung de mo phong json.JSONDecoder().raw_decode cua Python: boc DUNG object
 * dau tien, bo qua moi du lieu thua phia sau.
 */
function firstObjectEnd(s) {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) {
        esc = false;
      } else if (c === "\\") {
        esc = true;
      } else if (c === '"') {
        inStr = false;
      }
      continue;
    }
    if (c === '"') {
      inStr = true;
    } else if (c === "{") {
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }
  return -1;
}

/**
 * Boc JSON tu text model tra ve (port NGUYEN extract_json cua speaking/prompts.py):
 * (1) boc ```json fence neu co (non-greedy, lay fence dau tien);
 * (2) tim '{' dau tien roi doc DUNG object JSON dau tien, bo qua du lieu thua
 *     phia sau (model doi khi tra them text/JSON thu 2);
 * (3) du phong: cat toi dau '}' cuoi cung roi parse.
 * Nem Error("AI không trả về JSON") neu khong tim thay object (giong ValueError nguon).
 */
function extractJson(raw) {
  raw = String(raw == null ? "" : raw).trim();
  // re.search(r"```(?:json)?\s*(.*?)```", raw, re.S) cua nguon
  const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) {
    raw = m[1].trim();
  }
  const start = raw.indexOf("{");
  if (start === -1) {
    throw new Error("AI không trả về JSON");
  }
  // Mo phong raw_decode: lay dung object can bang dau tien roi parse
  const sliced = raw.slice(start);
  const end0 = firstObjectEnd(sliced);
  if (end0 !== -1) {
    try {
      return JSON.parse(sliced.slice(0, end0 + 1));
    } catch (e) {
      // roi xuong nhanh du phong nhu "except json.JSONDecodeError" cua nguon
    }
  }
  const end = raw.lastIndexOf("}"); // du phong: cat toi dau } cuoi cung
  if (end === -1) {
    throw new Error("AI không trả về JSON");
  }
  return JSON.parse(raw.slice(start, end + 1));
}

module.exports = {
  callGemini: callGemini,
  extractJson: extractJson,
  applyThinking: applyThinking,
  TRANSIENT_CODES: TRANSIENT_CODES,
  REQUEST_TIMEOUT_MS: REQUEST_TIMEOUT_MS,
};
