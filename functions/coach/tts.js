/**
 * Giọng giám khảo cho IELTS Coach: Microsoft Edge TTS (msedge-tts, KHÔNG chính thức).
 * Port từ tools/speaking/__init__.py của COACH SUITE: giọng en-GB-SoniaNeural, rate -5%,
 * bảng phiên âm TTS_SPOKEN để máy đọc "IELTS" liền một từ thay vì spell từng chữ.
 * Server chỉ có MỘT tầng (edge); lỗi thì THROW để callable trả "unavailable",
 * client tự rớt về giọng trình duyệt (webSpeak), đúng kiến trúc fallback của bản gốc.
 */
const { MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts");

const TTS_VOICE = "en-GB-SoniaNeural";
const TTS_RATE = "-5%"; // chậm 5% cho rõ ràng, đúng nhịp giám khảo

// Giữ nguyên bảng phiên âm của nguồn (regex word-boundary, không phân biệt hoa thường)
const TTS_SPOKEN = [
  [/\bIELTS\b/gi, "Eye-elts"],
  [/\bTOEIC\b/gi, "Toh-ick"],
  [/\bCEFR\b/gi, "Say-eff-arr"],
];

function spokenText(text) {
  let out = text;
  for (const [pat, rep] of TTS_SPOKEN) out = out.replace(pat, rep);
  return out;
}

const SYNTH_TIMEOUT_MS = 20000;

async function synthMp3(rawText) {
  const text = spokenText(String(rawText || "").trim());
  if (!text) throw new Error("Thiếu text.");

  // Tạo instance mới mỗi lần gọi: an toàn trong môi trường serverless,
  // tránh websocket cũ chết ngầm giữa các invocation
  const tts = new MsEdgeTTS();
  await tts.setMetadata(TTS_VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

  const { audioStream } = tts.toStream(text, { rate: TTS_RATE });
  const chunks = [];
  const buf = await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("TTS quá thời gian.")),
      SYNTH_TIMEOUT_MS
    );
    audioStream.on("data", (c) => chunks.push(c));
    audioStream.on("end", () => {
      clearTimeout(timer);
      resolve(Buffer.concat(chunks));
    });
    audioStream.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
  });
  if (!buf || buf.length === 0) throw new Error("TTS trả dữ liệu rỗng.");
  return buf;
}

module.exports = { synthMp3, spokenText, TTS_VOICE, TTS_RATE };
