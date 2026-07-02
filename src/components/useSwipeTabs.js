import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// ============================================================
// HOOK VUOT NGANG CHUYEN THE (mobile) - dung chung 3 layout.
// tabs: mang [{ key, to }] theo DUNG thu tu the tren bottom nav.
// Gan onTouchStart/onTouchEnd vao <main>; boc <Outlet/> bang
// <div key={slideKey} className={slideClass}> de co hieu ung truot.
// ============================================================
export function useSwipeTabs(tabs) {
  const location = useLocation();
  const navigate = useNavigate();
  const [dir, setDir] = useState('');
  const startRef = useRef(null);

  const onTouchStart = (e) => {
    // Chi bat tren man hinh hep (mobile); desktop co sidebar nen khong can
    if (window.innerWidth >= 768) { startRef.current = null; return; }
    // Bo qua khi cham vao vung tu cuon ngang / game / o nhap lieu / vung gan co data-noswipe
    if (e.target.closest('canvas, table, .overflow-x-auto, .overflow-auto, input, textarea, select, [data-noswipe]')) {
      startRef.current = null; return;
    }
    const t = e.touches[0];
    startRef.current = { x: t.clientX, y: t.clientY, at: Date.now() };
  };

  const onTouchEnd = (e) => {
    const s = startRef.current; startRef.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Date.now() - s.at > 600) return;                              // phai vuot dut khoat
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2) return; // phai la vuot NGANG ro rang
    const idx = tabs.findIndex((tb) => location.pathname.includes(tb.key));
    if (idx < 0) return;                                              // trang hien tai khong thuoc day the
    const next = dx < 0 ? idx + 1 : idx - 1;                          // vuot trai -> the sau; vuot phai -> the truoc
    if (next < 0 || next >= tabs.length) return;
    setDir(dx < 0 ? 'page-slide-right' : 'page-slide-left');          // the moi truot vao tu phia vuot toi
    navigate(tabs[next].to);
  };

  return { onTouchStart, onTouchEnd, slideKey: location.pathname, slideClass: dir || 'animate-fade-in-up' };
}
