import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Giám sát gian lận + ép toàn màn hình (chỉ chế độ Thi thật), port từ speaking.html:
 * - requestFullscreen CHỈ gọi từ user gesture (nút Bắt đầu / nút trên overlay).
 * - visibilitychange (tab ẩn) và blur (delay 400ms rồi kiểm tra document.hasFocus()
 *   để lọc blur giả do cuộn/phát âm thanh) → tính 1 vi phạm.
 * - Grace 2s sau khi vào bài / sau mỗi thao tác overlay (blur giả do app đổi cảnh).
 * - Dedupe 3s: blur + visibilitychange thường bắn đôi, chỉ tính 1.
 * - Vi phạm lần 1: overlay cảnh báo (kind 'warn', đang chờ xác nhận thì không đếm chồng).
 *   Lần 2: gọi onBan(violLog), component dừng bài và hiện màn đình chỉ.
 * - Thoát fullscreen giữa bài → overlay chặn (kind 'fs', chuyển tab lúc này VẪN tính
 *   vi phạm). Kiểm cả định kỳ 3s như gốc.
 * - Toàn bộ trạng thái cho listener toàn cục nằm trong useRef; listener/interval
 *   gắn trong effect có cleanup đầy đủ.
 *
 * API:
 *   const guard = useExamGuard({ getWhere, onBan });
 *   guard.begin() / guard.end()      bật/tắt giám sát (begin đặt grace 2s + enforce ngay)
 *   guard.goFullscreen()             gọi từ user gesture
 *   guard.confirmOverlay()           nút trên overlay: đóng + vào lại fullscreen
 *   guard.overlay                    null | { kind:'warn'|'fs', violKind }
 *   guard.overlayOpenRef             ref cho đồng hồ tạm dừng khi overlay mở
 *   guard.bannedRef, guard.violLogRef
 */

export default function useExamGuard({ getWhere, onBan } = {}) {
  const [active, setActive] = useState(false);
  const [overlay, setOverlay] = useState(null);

  const activeRef = useRef(false);
  const bannedRef = useRef(false);
  const violationsRef = useRef(0);
  const lastViolRef = useRef(0);
  const violLogRef = useRef([]);
  const graceUntilRef = useRef(0);
  const overlayOpenRef = useRef(false);
  const overlayKindRef = useRef(null);
  const pendingTimeoutsRef = useRef(new Set());

  // Callback luôn tươi cho listener toàn cục
  const cbRef = useRef({ getWhere, onBan });
  cbRef.current = { getWhere, onBan };

  const grace = () => {
    graceUntilRef.current = Date.now() + 2000;
  };

  const showOverlay = (kind, violKind) => {
    overlayOpenRef.current = true;
    overlayKindRef.current = kind;
    setOverlay({ kind, violKind: violKind || '' });
  };

  const hideOverlay = useCallback(() => {
    overlayOpenRef.current = false;
    overlayKindRef.current = null;
    setOverlay(null);
    grace();
  }, []);

  const goFullscreen = useCallback(() => {
    grace();
    if (!document.fullscreenElement) {
      try {
        const p = document.documentElement.requestFullscreen();
        if (p && p.catch) p.catch(() => {});
      } catch (e) {
        /* trình duyệt từ chối, overlay 'fs' sẽ nhắc lại */
      }
    }
  }, []);

  const enforceFullscreen = () => {
    if (activeRef.current && !bannedRef.current && !overlayOpenRef.current && !document.fullscreenElement) {
      showOverlay('fs');
    }
  };

  const ban = () => {
    bannedRef.current = true;
    activeRef.current = false;
    setActive(false);
    overlayOpenRef.current = false;
    overlayKindRef.current = null;
    setOverlay(null);
    if (cbRef.current.onBan) cbRef.current.onBan(violLogRef.current.slice(), violationsRef.current);
  };

  const violation = (kind) => {
    if (!activeRef.current || bannedRef.current) return;
    if (Date.now() < graceUntilRef.current) return; // blur giả do app vừa đổi cảnh
    if (overlayOpenRef.current && overlayKindRef.current === 'warn') return; // đang chờ xác nhận
    const now = Date.now();
    if (now - lastViolRef.current < 3000) return; // blur + visibilitychange bắn đôi
    lastViolRef.current = now;
    violationsRef.current += 1;
    violLogRef.current.push({
      time: new Date().toLocaleTimeString('vi-VN'),
      kind,
      where: cbRef.current.getWhere ? cbRef.current.getWhere() : '',
    });
    if (violationsRef.current === 1) showOverlay('warn', kind);
    else ban();
  };

  useEffect(() => {
    if (!active) return undefined;
    const timeouts = pendingTimeoutsRef.current;
    const onVis = () => {
      if (document.hidden) violation('chuyển tab / thu nhỏ cửa sổ');
    };
    // blur rất nhạy → đợi 400ms rồi kiểm tra cửa sổ có THẬT SỰ mất focus không
    const onBlur = () => {
      const id = setTimeout(() => {
        timeouts.delete(id);
        if (!document.hasFocus() && !document.hidden) violation('rời khỏi cửa sổ thi');
      }, 400);
      timeouts.add(id);
    };
    const onFs = () => enforceFullscreen();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onBlur);
    document.addEventListener('fullscreenchange', onFs);
    const iv = setInterval(enforceFullscreen, 3000);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('fullscreenchange', onFs);
      clearInterval(iv);
      timeouts.forEach((id) => clearTimeout(id));
      timeouts.clear();
    };
    // violation/enforceFullscreen chỉ đụng ref nên không cần vào deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const begin = useCallback(() => {
    bannedRef.current = false;
    violationsRef.current = 0;
    lastViolRef.current = 0;
    violLogRef.current = [];
    grace();
    activeRef.current = true;
    setActive(true);
    // Chặn ngay nếu chưa fullscreen (gốc: examActive = true; enforceFullscreen())
    const id = setTimeout(() => {
      pendingTimeoutsRef.current.delete(id);
      enforceFullscreen();
    }, 0);
    pendingTimeoutsRef.current.add(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const end = useCallback(() => {
    activeRef.current = false;
    setActive(false);
  }, []);

  const confirmOverlay = useCallback(() => {
    hideOverlay();
    goFullscreen();
  }, [hideOverlay, goFullscreen]);

  return {
    overlay,
    overlayOpenRef,
    bannedRef,
    violLogRef,
    begin,
    end,
    goFullscreen,
    confirmOverlay,
  };
}
