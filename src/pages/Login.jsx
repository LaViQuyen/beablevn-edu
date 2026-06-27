import React, { useState, useEffect } from 'react';
import { auth, functions } from '../firebase';
import { signInWithCustomToken } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Alert, Button } from '../components/UI';

const REMEMBER_KEY = 'bavn_remember_id';

const Login = () => {
  const [formData, setFormData] = useState({ id: '', password: '' });
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    const savedId = localStorage.getItem(REMEMBER_KEY);
    if (savedId) { setFormData(prev => ({ ...prev, id: savedId })); setRememberMe(true); }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    const inputId = formData.id.trim();
    try {
      // XÁC THỰC PHÍA SERVER: function issueToken kiểm tra mật khẩu (admin SDK) và
      // cấp Firebase custom token mang claim vai trò. Client KHÔNG còn đọc cả node `users`
      // (tránh lộ hash) và KHÔNG còn so mật khẩu phía client.
      const issueToken = httpsCallable(functions, 'issueToken');
      const res = await issueToken({ loginId: inputId, password: formData.password });
      const { token, user } = res.data || {};
      if (!token || !user) { setError("Sai tên đăng nhập hoặc mật khẩu."); setLoading(false); return; }

      // Mở phiên Firebase Auth THẬT → từ đây Rules nhận diện được vai trò.
      await signInWithCustomToken(auth, token);

      if (rememberMe) localStorage.setItem(REMEMBER_KEY, inputId);
      else localStorage.removeItem(REMEMBER_KEY);

      login(user); // user đã được loại bỏ password ở server
      if (user.role === 'admin') navigate('/admin/dashboard');
      else if (user.role === 'staff') navigate('/staff/classes');
      else navigate('/student/dashboard');
    } catch (err) {
      // HttpsError chuyển message qua err.message; lỗi mạng/khác → thông báo chung
      const code = err?.code || '';
      if (code === 'functions/unauthenticated' || code === 'functions/invalid-argument') {
        setError("Sai tên đăng nhập hoặc mật khẩu.");
      } else if (code === 'functions/permission-denied') {
        setError(err.message || "Tài khoản đã bị khóa. Liên hệ trung tâm.");
      } else {
        setError("Lỗi kết nối máy chủ. Vui lòng thử lại.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-[#E8F4EC] p-4 font-sans">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-100">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-white rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-sm border border-slate-100">
            <img src="/BA LOGO.png" alt="Logo" className="w-14 h-14 object-contain" />
          </div>
          <h1 className="text-2xl font-extrabold text-[#2B6830]">BE ABLE VN</h1>
          <p className="text-slate-400 text-sm mt-1 font-medium">Hệ thống Quản lý Đào tạo</p>
        </div>

        {/* Error alert */}
        {error && <Alert type="error" className="mb-5">{error}</Alert>}

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ID field */}
          <div>
            <label className="text-xs font-bold text-[#2B6830] uppercase tracking-wider block mb-1.5 ml-1">
              Tên đăng nhập / Mã HV
            </label>
            <div className="relative">
              <input
                type="text" autoComplete="username" autoFocus required
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#2B6830]/10 focus:border-[#2B6830] outline-none transition-all bg-white text-slate-700 font-medium placeholder:text-slate-400"
                placeholder="VD: 20230240 hoặc gv01"
                value={formData.id}
                onChange={e => { setFormData({...formData, id: e.target.value}); setError(''); }}
              />
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#94a3b8" className="w-5 h-5 absolute left-3 top-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
          </div>

          {/* Password field */}
          <div>
            <label className="text-xs font-bold text-[#2B6830] uppercase tracking-wider block mb-1.5 ml-1">
              Mật khẩu
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'} autoComplete="current-password" required
                className="w-full pl-10 pr-11 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#2B6830]/10 focus:border-[#2B6830] outline-none transition-all bg-white text-slate-700 font-medium placeholder:text-slate-400"
                placeholder="••••••••"
                value={formData.password}
                onChange={e => { setFormData({...formData, password: e.target.value}); setError(''); }}
              />
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#94a3b8" className="w-5 h-5 absolute left-3 top-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              <button
                type="button" tabIndex={-1}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Remember me */}
          <label className="flex items-center gap-2.5 cursor-pointer group">
            <input type="checkbox" className="w-4 h-4 accent-[#2B6830] rounded" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} />
            <span className="text-sm text-slate-500 group-hover:text-slate-700 transition-colors select-none">Nhớ tên đăng nhập</span>
          </label>

          {/* Submit — dùng Button component */}
          <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full justify-center shadow-lg shadow-green-900/10">
            {loading ? 'Đang xác thực...' : 'Đăng Nhập'}
          </Button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-xs text-slate-400">© 2026 BE ABLE VN Education System</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
