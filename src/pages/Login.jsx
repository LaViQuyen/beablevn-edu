import React, { useState } from 'react';
import { db } from '../firebase';
import { ref, get } from 'firebase/database';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import bcrypt from 'bcryptjs';

const Login = () => {
  // Thêm State để quản lý Tab đang active
  const [activeTab, setActiveTab] = useState('student'); // 'student' hoặc 'teacher'
  
  const [formData, setFormData] = useState({ id: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const inputId = formData.id.trim();

    // 1. BẮT LỖI NGAY TỪ CỬA: Nếu là tab Học viên, bắt buộc ID phải là 8 chữ số
    if (activeTab === 'student') {
      if (!/^\d{8}$/.test(inputId)) {
        setError("Mã học viên không hợp lệ (Bắt buộc phải đúng 8 chữ số).");
        setLoading(false);
        return;
      }
    }

    try {
      // 2. Lấy dữ liệu người dùng từ Database
      const snapshot = await get(ref(db, 'users'));
      
      if (!snapshot.exists()) {
        setError("Hệ thống đang bảo trì (Database trống).");
        setLoading(false);
        return;
      }

      const users = snapshot.val();
      const userList = Object.entries(users).map(([key, value]) => ({ ...value, id: key }));

      // 3. Tìm kiếm người dùng (Ép kiểu String để tránh lỗi dữ liệu chữ/số)
      const foundUser = userList.find(u => 
        (String(u.username) === inputId) || 
        (String(u.loginId) === inputId) || 
        (String(u.email) === inputId) ||
        (String(u.studentCode) === inputId)
      );

      if (!foundUser) {
        setError("Sai tên đăng nhập hoặc mật khẩu.");
        setLoading(false);
        return;
      }

      // 4. KIỂM TRA PHÂN QUYỀN CHÉO (Bảo mật 2 lớp)
      if (activeTab === 'student' && foundUser.role !== 'student') {
        setError("Tài khoản này không phải là học viên.");
        setLoading(false);
        return;
      }
      if (activeTab === 'teacher' && foundUser.role === 'student') {
        setError("Tài khoản này không có quyền truy cập khu vực Giáo viên.");
        setLoading(false);
        return;
      }

      // 5. Kiểm tra mật khẩu
      let isValid = false;
      const storedPass = foundUser.password || "";
      
      if (storedPass.startsWith('$2')) {
          isValid = bcrypt.compareSync(formData.password, storedPass);
      } else {
          isValid = String(storedPass) === String(formData.password);
      }

      if (isValid) {
        // Đăng nhập thành công
        const { password, ...safeUser } = foundUser; 
        login(safeUser);
        
        // Điều hướng dựa trên vai trò
        if (foundUser.role === 'admin') navigate('/admin/staff');
        else if (foundUser.role === 'staff') navigate('/staff/classes');
        else navigate('/student/dashboard');
      } else {
        setError("Sai tên đăng nhập hoặc mật khẩu.");
      }

    } catch (err) {
      console.error(err);
      setError("Lỗi kết nối máy chủ. Vui lòng thử lại sau.");
    } finally {
      setLoading(false);
    }
  };

  // Hàm hỗ trợ chuyển đổi Tab (Reset lại form và thông báo lỗi)
  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    setError('');
    setFormData({ id: '', password: '' });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-100 animate-fade-in-up">
        
        {/* LOGO & TITLE */}
        <div className="text-center mb-6">
           <div className="w-20 h-20 bg-white rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-sm border border-slate-50">
            <img src="/BA LOGO.png" alt="Logo" className="w-14 h-14 object-contain" />
          </div>
          <h1 className="text-2xl font-extrabold text-[#003366]">BE ABLE VN</h1>
          <p className="text-slate-400 text-sm mt-1 font-medium">Hệ thống Quản lý Đào tạo</p>
        </div>

        {/* --- THANH CHUYỂN TAB --- */}
        <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
          <button
            type="button"
            onClick={() => handleTabSwitch('student')}
            className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all duration-200 ${
              activeTab === 'student' 
                ? 'bg-white text-[#003366] shadow-sm' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Học viên
          </button>
          <button
            type="button"
            onClick={() => handleTabSwitch('teacher')}
            className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all duration-200 ${
              activeTab === 'teacher' 
                ? 'bg-white text-[#003366] shadow-sm' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Giáo viên / Admin
          </button>
        </div>

        {/* THÔNG BÁO LỖI */}
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-6 flex items-center gap-2 border border-red-100 font-medium animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 shrink-0">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        {/* FORM ĐĂNG NHẬP */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-[#003366] uppercase mb-1.5 ml-1">
              {activeTab === 'student' ? 'Mã Học Viên (8 chữ số)' : 'Tên đăng nhập / Mã GV'}
            </label>
            <div className="relative">
              <input 
                type="text" 
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#003366] focus:border-transparent outline-none transition-all bg-white text-slate-700 font-medium" 
                placeholder={activeTab === 'student' ? "Ví dụ: 20260101" : "Ví dụ: admin, gv01"} 
                value={formData.id} 
                onChange={(e) => setFormData({...formData, id: e.target.value})} 
                required 
              />
              <span className="absolute left-3 top-3.5 text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#003366] uppercase mb-1.5 ml-1">Mật khẩu</label>
            <div className="relative">
              <input 
                type="password" 
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#003366] focus:border-transparent outline-none transition-all bg-white text-slate-700 font-medium" 
                placeholder="••••••••" 
                value={formData.password} 
                onChange={(e) => setFormData({...formData, password: e.target.value})} 
                required 
              />
              <span className="absolute left-3 top-3.5 text-slate-400">
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
              </span>
            </div>
          </div>

          <button 
            disabled={loading}
            className="w-full bg-[#003366] text-white font-bold py-3.5 rounded-xl hover:bg-[#002244] transition-all shadow-lg shadow-blue-900/10 active:scale-[0.98] disabled:opacity-70 flex justify-center items-center gap-2 mt-2"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>Đang xử lý...</span>
              </div>
            ) : (
              <span>Đăng Nhập</span>
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
            <p className="text-xs text-slate-400">© 2026 BE ABLE VN Education System</p>
        </div>

      </div>
    </div>
  );
};

export default Login;