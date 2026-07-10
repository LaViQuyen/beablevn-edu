import { useEffect, useRef, useState } from 'react';

/**
 * Hook thu âm: port logic startAnswer()/startVoiceWatch()/uploadAnswer() của speaking.html.
 *
 * - getUserMedia CHỈ chạy trong start() (gọi từ event handler, không chạy lúc mount).
 * - Chọn định dạng theo chuỗi isTypeSupported: webm/opus → ogg/opus → mp4 (như gốc,
 *   thêm mp4 làm phương án cuối cho WebView2/Safari).
 * - mediaRecorder.start(1000): gom dữ liệu mỗi 1 giây, không có tham số này một số
 *   môi trường chỉ "xả" dữ liệu 1 lần lúc stop và đôi khi mất trắng → blob rỗng.
 * - AnalyserNode đo im lặng + cộng dồn voicedMs (tổng thời gian THẬT SỰ có giọng nói):
 *   fftSize 512, tick 200ms, peak > 6 = có tiếng. Chỉ tự dừng khi ĐÃ từng nghe thấy
 *   giọng (everVoiced) và đã qua 1500ms đầu, máy đo hỏng thì không tự cắt.
 * - Blob → base64 bằng FileReader.readAsDataURL cắt prefix (không btoa spread).
 * - Cap 8MB base64: vượt quá trả lỗi rõ ràng qua onError.
 *
 * API: const { start, stop, abort, state } = useRecorder();
 *   start({ silenceMs, onAutoStop, onResult, onError }): Promise, reject khi mic bị chặn.
 *     silenceMs: số ms im lặng để TỰ dừng (null/0 = không tự dừng).
 *     onAutoStop(): báo UI ngay khi tự dừng vì im lặng (trước khi onResult chạy).
 *     onResult({ b64, mime, size, voicedMs, voiceMeterOk }): đúng 1 lần sau khi dừng.
 *     onError(Error): lỗi đọc dữ liệu / vượt cap.
 *   stop(): dừng chủ động (nút Xong / hết giờ), vẫn trả kết quả qua onResult.
 *   abort(): hủy bỏ, KHÔNG trả kết quả (đình chỉ thi / rời trang). Tự chạy khi unmount.
 */

const MAX_B64_CHARS = 8 * 1024 * 1024; // cap 8MB base64

export default function useRecorder() {
  const [state, setState] = useState('idle'); // 'idle' | 'recording'
  const recRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const ctxRef = useRef(null);
  const meterIdRef = useRef(null);
  const voicedRef = useRef(0);
  const meterOkRef = useRef(false);
  const optsRef = useRef({});

  const stopMeter = () => {
    if (meterIdRef.current) {
      clearInterval(meterIdRef.current);
      meterIdRef.current = null;
    }
    if (ctxRef.current) {
      try {
        ctxRef.current.close();
      } catch (e) {
        /* đã đóng */
      }
      ctxRef.current = null;
    }
  };

  const releaseStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const stop = () => {
    stopMeter();
    const rec = recRef.current;
    if (rec && rec.state !== 'inactive') rec.stop(); // onstop sẽ build kết quả
    releaseStream();
    setState('idle');
  };

  const abort = () => {
    stopMeter();
    const rec = recRef.current;
    if (rec && rec.state !== 'inactive') {
      rec.onstop = null; // hủy: không trả kết quả (như banTest của gốc)
      try {
        rec.stop();
      } catch (e) {
        /* bỏ qua */
      }
    }
    recRef.current = null;
    releaseStream();
    setState('idle');
  };

  const start = async (opts = {}) => {
    if (recRef.current && recRef.current.state !== 'inactive') return; // đang thu rồi
    optsRef.current = opts;
    voicedRef.current = 0;
    meterOkRef.current = false;

    // getUserMedia chỉ ở đây, caller bắt lỗi để báo "Không truy cập được micro."
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
        ? 'audio/ogg;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
    recRef.current = rec;
    chunksRef.current = [];
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
      const cb = optsRef.current;
      const meta = {
        mime: (rec.mimeType || 'audio/webm').split(';')[0],
        size: blob.size,
        voicedMs: Math.round(voicedRef.current),
        voiceMeterOk: meterOkRef.current,
      };
      const fr = new FileReader();
      fr.onloadend = () => {
        const b64 = String(fr.result || '').split(',')[1] || '';
        if (b64.length > MAX_B64_CHARS) {
          if (cb.onError) {
            cb.onError(
              new Error('Đoạn thu âm quá dài nên hệ thống không nhận được. Em bấm thu âm và trả lời gọn hơn nhé.')
            );
          }
          return;
        }
        if (cb.onResult) cb.onResult({ b64, ...meta });
      };
      fr.onerror = () => {
        if (cb.onError) cb.onError(new Error('Không đọc được dữ liệu thu âm. Em bấm thu âm lại giúp nhé.'));
      };
      fr.readAsDataURL(blob);
    };
    rec.start(1000);
    setState('recording');

    // Máy đo giọng nói (voicedMs) + tự dừng khi im lặng, port startVoiceWatch()
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      ctxRef.current = ctx;
      // Một số máy khởi tạo AudioContext ở trạng thái "suspended" do chính sách tự-phát
      //, khi đó analyser đọc toàn 128 (tưởng im lặng). resume() để nhận âm thanh thật.
      if (ctx.state === 'suspended') {
        try {
          ctx.resume();
        } catch (e) {
          /* bỏ qua */
        }
      }
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      const data = new Uint8Array(an.fftSize);
      meterOkRef.current = true;
      const begun = Date.now();
      let lastSound = Date.now();
      let lastTick = Date.now();
      let everVoiced = false;
      meterIdRef.current = setInterval(() => {
        an.getByteTimeDomainData(data);
        let peak = 0;
        for (let i = 0; i < data.length; i++) {
          const d = Math.abs(data[i] - 128);
          if (d > peak) peak = d;
        }
        const now = Date.now();
        if (peak > 6) {
          lastSound = now;
          everVoiced = true;
          voicedRef.current += now - lastTick; // cộng dồn thời gian có giọng
        }
        lastTick = now;
        const sil = optsRef.current.silenceMs;
        // CHỈ tự dừng khi: có ngưỡng im lặng, ĐÃ từng nghe thấy giọng thật, và đã im
        // hơn ngưỡng, máy đo suspended/hỏng thì để đồng hồ thường lo, tránh cắt ngang.
        if (sil && everVoiced && now - begun > 1500 && now - lastSound > sil) {
          if (optsRef.current.onAutoStop) optsRef.current.onAutoStop();
          stop();
        }
      }, 200);
    } catch (e) {
      meterOkRef.current = false;
    }
  };

  // Cleanup khi unmount: giải phóng mic/AudioContext/interval, không trả kết quả
  useEffect(
    () => () => {
      stopMeter();
      const rec = recRef.current;
      if (rec && rec.state !== 'inactive') {
        rec.onstop = null;
        try {
          rec.stop();
        } catch (e) {
          /* bỏ qua */
        }
      }
      releaseStream();
    },
    []
  );

  return { start, stop, abort, state };
}
