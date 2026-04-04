// src/pages/student/StudentLogin.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore'; 
import { firestore as db } from "../../../firebase";
// --- HỆ THỐNG SVG ICONS TỐI GIẢN (Nét mảnh, màu #003366) ---
const SvgIcons = {
  Room: () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M3 21V9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12"></path><path d="M9 21v-6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6"></path></svg>,
  User: () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>,
  Alert: () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
};

export default function StudentLogin() {
  const [roomCode, setRoomCode] = useState('');
  const [studentId, setStudentId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(''); 
  const navigate = useNavigate();

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    if (!roomCode.trim() || !studentId.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      const roomCodeUpper = roomCode.trim().toUpperCase();
      const studentIdUpper = studentId.trim().toUpperCase(); 
      
      // Gọi lên Firebase kiểm tra mã phòng
      const roomRef = doc(db, "rooms", roomCodeUpper);
      const roomSnap = await getDoc(roomRef);

      if (roomSnap.exists()) {
        const roomData = roomSnap.data();
        
        // Tìm xem học sinh có trong danh sách phòng hay không
        const isStudentExist = roomData.students.some(s => s.studentId === studentIdUpper);
        
        if (isStudentExist) {
          // Lưu ID học sinh vào localStorage để các màn hình sau có thể dùng
          localStorage.setItem('currentStudentId', studentIdUpper);
          // Chuyển hướng vào trang làm bài
          navigate(`/student/room/${roomCodeUpper}`);
        } else {
          setError("Mã số học viên không có trong danh sách lớp này.");
        }
      } else {
        setError("Mã lớp (Room Code) không tồn tại.");
      }
    } catch (error) {
      console.error(error);
      setError("Lỗi kết nối mạng. Vui lòng thử lại sau.");
    }
    setIsLoading(false);
  };

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', padding: '16px', fontFamily: "'Josefin Sans', sans-serif" }}>
      <div style={{ backgroundColor: 'white', padding: '40px 30px', borderRadius: '24px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)', width: '100%', maxWidth: '400px', boxSizing: 'border-box' }}>
        
        {/* HEADER LOGO */}
        <div style={{ textAlign: 'center', marginBottom: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <img src="/BA LOGO.png" alt="BE ABLE VN Logo" style={{ height: '60px', objectFit: 'contain', marginBottom: '20px' }} />
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#003366', margin: '0 0 8px 0', letterSpacing: '1px' }}>HỌC VIÊN</h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0, fontWeight: '500' }}>Đăng nhập để vào lớp học</p>
        </div>

        {/* ERROR MESSAGE */}
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', backgroundColor: '#fef2f2', padding: '12px', borderRadius: '8px', border: '1px solid #fca5a5', fontSize: '13px', marginBottom: '20px', fontWeight: '600' }}>
            <SvgIcons.Alert /> {error}
          </div>
        )}

        <form onSubmit={handleJoinRoom}>
          {/* ROOM CODE INPUT */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', color: '#003366', textTransform: 'uppercase', marginBottom: '8px' }}>
              <SvgIcons.Room /> Mã lớp (Room Code)
            </label>
            <input 
              type="text" 
              placeholder="VD: IE0301" 
              value={roomCode} 
              onChange={(e) => setRoomCode(e.target.value)} 
              required 
              style={{ width: '100%', padding: '14px 16px', border: '1px solid #cbd5e1', borderRadius: '12px', outline: 'none', backgroundColor: '#f8fafc', fontSize: '15px', color: '#334155', fontWeight: '700', boxSizing: 'border-box', transition: 'all 0.2s', letterSpacing: '1px' }}
              onFocus={(e) => { e.target.style.borderColor = '#003366'; e.target.style.backgroundColor = 'white'; }} 
              onBlur={(e) => { e.target.style.borderColor = '#cbd5e1'; e.target.style.backgroundColor = '#f8fafc'; }}
            />
          </div>

          {/* STUDENT ID INPUT */}
          <div style={{ marginBottom: '30px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', color: '#003366', textTransform: 'uppercase', marginBottom: '8px' }}>
              <SvgIcons.User /> Mã số / Tên học viên
            </label>
            <input 
              type="text" 
              placeholder="VD: BAK010188" 
              value={studentId} 
              onChange={(e) => setStudentId(e.target.value)} 
              required 
              style={{ width: '100%', padding: '14px 16px', border: '1px solid #cbd5e1', borderRadius: '12px', outline: 'none', backgroundColor: '#f8fafc', fontSize: '15px', color: '#334155', fontWeight: '600', boxSizing: 'border-box', transition: 'all 0.2s' }}
              onFocus={(e) => { e.target.style.borderColor = '#003366'; e.target.style.backgroundColor = 'white'; }} 
              onBlur={(e) => { e.target.style.borderColor = '#cbd5e1'; e.target.style.backgroundColor = '#f8fafc'; }}
            />
          </div>

          {/* SUBMIT BUTTON */}
          <button 
            type="submit" 
            disabled={isLoading}
            style={{ width: '100%', backgroundColor: '#003366', color: 'white', fontWeight: '700', padding: '16px', borderRadius: '12px', border: 'none', cursor: isLoading ? 'wait' : 'pointer', fontSize: '15px', transition: 'all 0.2s', boxShadow: '0 4px 6px -1px rgba(0, 51, 102, 0.2)', opacity: isLoading ? 0.7 : 1 }}
            onMouseEnter={e => { if(!isLoading) e.currentTarget.style.transform = 'translateY(-2px)'}}
            onMouseLeave={e => { if(!isLoading) e.currentTarget.style.transform = 'translateY(0)'}}
          >
            {isLoading ? 'ĐANG XỬ LÝ...' : 'ĐĂNG NHẬP VÀO LỚP'}
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