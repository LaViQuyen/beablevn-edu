import { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { ref, onValue } from 'firebase/database';

// ============================================================
// Hook nạp danh sách CON của phụ huynh đang đăng nhập.
// Nguồn liên kết: parentLinks/{parentUid}/{studentId}: true
// Hồ sơ con đọc realtime từ users/{studentId} (Rules đã mở quyền
// đọc per-child cho phụ huynh được liên kết).
// loading chỉ tắt khi MỌI con đã nhận snapshot đầu tiên (kể cả lỗi),
// tránh flash màn "chưa liên kết" trong lúc hồ sơ con đang tải.
// ============================================================
export const useChildren = (parentId) => {
  const [childIds, setChildIds] = useState(null); // null = chưa nạp xong link
  const [childMap, setChildMap] = useState({});   // { sid: userRecord }
  const [loadedIds, setLoadedIds] = useState({}); // { sid: true } đã nhận snapshot đầu

  // 1. Theo dõi danh sách liên kết
  useEffect(() => {
    if (!parentId) return;
    const unsub = onValue(ref(db, `parentLinks/${parentId}`), (snap) => {
      setChildIds(Object.keys(snap.val() || {}));
    });
    return () => unsub();
  }, [parentId]);

  // 2. Theo dõi hồ sơ từng con (name, classIds, lockedAt, reserve... realtime)
  useEffect(() => {
    if (!childIds || !childIds.length) { setChildMap({}); setLoadedIds({}); return; }
    setLoadedIds({});
    const markLoaded = (sid) => setLoadedIds((prev) => (prev[sid] ? prev : { ...prev, [sid]: true }));
    const unsubs = childIds.map((sid) =>
      onValue(ref(db, `users/${sid}`), (snap) => {
        const val = snap.val();
        setChildMap((prev) => {
          const next = { ...prev };
          if (val) {
            const { password, ...safe } = val; // không giữ hash trong state
            next[sid] = { id: sid, ...safe };
          } else {
            delete next[sid]; // con đã bị xóa khỏi hệ thống → gỡ khỏi danh sách
          }
          return next;
        });
        markLoaded(sid);
      }, () => {
        // permission-denied (link vừa bị gỡ) → coi như đã nạp để không treo loading
        markLoaded(sid);
      })
    );
    return () => unsubs.forEach((u) => u());
  }, [(childIds || []).join(',')]);

  const children = (childIds || []).map((sid) => childMap[sid]).filter(Boolean);
  const loading = childIds === null || (childIds.length > 0 && childIds.some((sid) => !loadedIds[sid]));
  return { children, loading };
};

export default useChildren;
