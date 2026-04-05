// src/pages/teacher/TeacherLogin.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// --- HỆ THỐNG SVG ICONS TỐI GIẢN (Nét mảnh, màu #003366) ---
const SvgIcons = {
  User: () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>,
  Lock: () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>,
  Alert: () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
};

export default function TeacherLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(''); 
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    setError(''); 
    
    // Giả lập xác thực (có thể thay bằng Firebase Auth sau này)
    if (email === 'helpdesk@beablevn.com' && password === 'BAVNbavn$67896789#') {
      // BỔ SUNG: Lưu trạng thái đăng nhập thành công vào Local Storage
      localStorage.setItem('teacherAuth', 'true');
      navigate('/teacher');
    } else {
      setError("Email hoặc mật khẩu không chính xác.");
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', padding: '16px', fontFamily: "'Josefin Sans', sans-serif" }}>
      <div style={{ backgroundColor: 'white', padding: '40px 30px', borderRadius: '24px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)', width: '100%', maxWidth: '400px', boxSizing: 'border-box' }}>
        
        {/* HEADER LOGO */}
        <div style={{ textAlign: 'center', marginBottom: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <img src="/BA LOGO.png" alt="BE ABLE VN Logo" style={{ height: '60px', objectFit: 'contain', marginBottom: '20px' }} />
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#003366', margin: '0 0 8px 0', letterSpacing: '1px' }}>GIÁO VIÊN</h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0, fontWeight: '500' }}>Đăng nhập để quản lý hệ thống</p>
        </div>

        {/* ERROR MESSAGE */}
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', backgroundColor: '#fef2f2', padding: '12px', borderRadius: '8px', border: '1px solid #fca5a5', fontSize: '13px', marginBottom: '20px', fontWeight: '600' }}>
            <SvgIcons.Alert /> {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          {/* EMAIL INPUT */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', color: '#003366', textTransform: 'uppercase', marginBottom: '8px' }}>
              <SvgIcons.User /> Email hoặc ID
            </label>
            <input 
              type="text" 
              placeholder="helpdesk@beablevn.com" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              style={{ width: '100%', padding: '14px 16px', border: '1px solid #cbd5e1', borderRadius: '12px', outline: 'none', backgroundColor: '#f8fafc', fontSize: '15px', color: '#334155', fontWeight: '600', boxSizing: 'border-box', transition: 'all 0.2s' }}
              onFocus={(e) => { e.target.style.borderColor = '#003366'; e.target.style.backgroundColor = 'white'; }} 
              onBlur={(e) => { e.target.style.borderColor = '#cbd5e1'; e.target.style.backgroundColor = '#f8fafc'; }}
            />
          </div>

          {/* PASSWORD INPUT */}
          <div style={{ marginBottom: '30px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', color: '#003366', textTransform: 'uppercase', marginBottom: '8px' }}>
              <SvgIcons.Lock /> Mật khẩu
            </label>
            <input 
              type="password" 
              placeholder="••••••••" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              style={{ width: '100%', padding: '14px 16px', border: '1px solid #cbd5e1', borderRadius: '12px', outline: 'none', backgroundColor: '#f8fafc', fontSize: '15px', color: '#334155', fontWeight: '600', boxSizing: 'border-box', transition: 'all 0.2s' }}
              onFocus={(e) => { e.target.style.borderColor = '#003366'; e.target.style.backgroundColor = 'white'; }} 
              onBlur={(e) => { e.target.style.borderColor = '#cbd5e1'; e.target.style.backgroundColor = '#f8fafc'; }}
            />
          </div>

          {/* SUBMIT BUTTON */}
          <button 
            type="submit" 
            style={{ width: '100%', backgroundColor: '#003366', color: 'white', fontWeight: '700', padding: '16px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontSize: '15px', transition: 'all 0.2s', boxShadow: '0 4px 6px -1px rgba(0, 51, 102, 0.2)' }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            ĐĂNG NHẬP
          </button>
        </form>
        
        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '13px', fontWeight: '600', cursor: 'pointer', textDecoration: 'underline' }}>
            Quay lại Trang chủ
          </button>
        </div>
      </div>
    </div>
  );
}