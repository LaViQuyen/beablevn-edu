import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { db, auth } from "../firebase";
import { ref, onValue } from "firebase/database";
import { onAuthStateChanged, signOut } from "firebase/auth";
const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  // 1. Khởi tạo User từ localStorage (để giữ đăng nhập khi F5)
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('currentUser');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (error) {
      console.error("Lỗi đọc user từ storage:", error);
      return null;
    }
  });

  const [loading, setLoading] = useState(false);
  // Chặn render nội dung cho tới khi phiên Firebase được xác định xong.
  // Tránh việc component (vd nhắc bảo lưu, dashboard) đọc DB bằng get() NGAY khi mount
  // trong lúc auth còn null (chưa phục hồi phiên) → bị Rules từ chối (Permission denied).
  // Nếu chưa từng đăng nhập (không có currentUser trong storage) thì khỏi chờ, render ngay.
  const [authReady, setAuthReady] = useState(() => !localStorage.getItem('currentUser'));
  // Đánh dấu vừa đăng nhập tương tác → không tự đăng xuất trong lúc phiên Firebase đang thiết lập.
  const justLoggedIn = useRef(false);

  // PHIÊN FIREBASE AUTH THẬT (cấp qua custom token, mang claim vai trò để Rules phân quyền).
  // - Khi F5: Firebase tự phục hồi phiên (refresh token) → giữ đăng nhập bình thường.
  // - Nếu có currentUser cũ trong localStorage NHƯNG không có phiên Firebase
  //   (tài khoản đăng nhập từ TRƯỚC bản vá bảo mật) → buộc đăng xuất 1 lần để
  //   đăng nhập lại qua luồng mới, nếu không mọi thao tác đọc/ghi sẽ bị Rules từ chối.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      if (!fbUser && !justLoggedIn.current) {
        if (localStorage.getItem('currentUser')) {
          localStorage.removeItem('currentUser');
          setCurrentUser(null);
        }
      }
      setAuthReady(true); // phiên đã xác định (có/không) → cho phép render, mọi read sau đó có auth hợp lệ
    });
    return () => unsub();
  }, []);

  useEffect(() => {
      if (!currentUser?.id) return; // Nếu chưa đăng nhập thì bỏ qua

      const userRef = ref(db, `users/${currentUser.id}`);
      const unsubscribe = onValue(userRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          // Cập nhật lại state và đè LocalStorage mới nhất ngay lập tức.
          // Bỏ trường password (hash) khỏi state/localStorage cho an toàn.
          const { password, ...safe } = data;
          const updatedUser = { id: currentUser.id, ...safe };
          setCurrentUser(updatedUser);
          localStorage.setItem('currentUser', JSON.stringify(updatedUser));
        }
      });

      // Hủy lắng nghe khi thoát app hoặc đăng xuất
      return () => unsubscribe();
    }, [currentUser?.id])
  // 2. Hàm Đăng nhập: Lưu vào State và LocalStorage.
  //    LƯU Ý: gọi SAU khi signInWithCustomToken thành công (xem Login.jsx).
  const login = (userData) => {
    justLoggedIn.current = true;
    setCurrentUser(userData);
    localStorage.setItem('currentUser', JSON.stringify(userData));
  };

  // 3. Hàm Đăng xuất: Xóa State + LocalStorage và kết thúc phiên Firebase.
  const logout = async () => {
    justLoggedIn.current = false;
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
    try { await signOut(auth); } catch (_) {}
  };

  // Helper lấy Role nhanh
  const userRole = currentUser?.role || null;
  const userData = currentUser;

  const value = { currentUser, userRole, userData, login, logout, loading };

  return (
    <AuthContext.Provider value={value}>
      {authReady ? children : (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2B6830', fontWeight: 600 }}>
          Đang tải...
        </div>
      )}
    </AuthContext.Provider>
  );
}