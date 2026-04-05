import React, { createContext, useContext, useState, useEffect } from "react";

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

  // 2. Hàm Đăng nhập: Lưu vào State và LocalStorage
  const login = (userData) => {
    setCurrentUser(userData);
    localStorage.setItem('currentUser', JSON.stringify(userData));
  };

  // 3. Hàm Đăng xuất: Xóa khỏi State và LocalStorage
  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
  };

  // Helper lấy Role nhanh
  const userRole = currentUser?.role || null;
  const userData = currentUser;

  const value = { currentUser, userRole, userData, login, logout, loading };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}