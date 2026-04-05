// src/pages/teacher/Launch.jsx
import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, updateDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { firestore as db } from "../../../firebase";
import { TeacherContext } from './TeacherContext';

// --- HỆ THỐNG SVG ICONS TỐI GIẢN (Nét mảnh, màu #003366) ---
const SvgIcons = {
  Quiz: () => <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>,
  Race: () => <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>,
  Review: () => <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>,
  Close: () => <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>,
  Back: () => <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>,
  Instant: () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>,
  Open: () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon></svg>,
  Teacher: () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>,
  Rocket: () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M13.5 22H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6.5"></path><path d="M22 17.5L18 22l-4.5-4.5"></path><line x1="18" y1="22" x2="18" y2="12"></line></svg>
};

// --- COMPONENT: CÔNG TẮC (TOGGLE SWITCH) ---
const Toggle = ({ label, checked, onChange, disabled, info }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid #f1f5f9' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: disabled ? '#94a3b8' : '#334155', fontSize: '15px', fontWeight: '500' }}>
      {label} 
      {info && <span style={{ color: '#0ea5e9', cursor: 'help', fontSize: '16px' }} title={info}>🛈</span>}
    </div>
    <div
      onClick={() => !disabled && onChange(!checked)}
      style={{
        width: '46px', height: '26px', borderRadius: '13px',
        backgroundColor: checked ? '#003366' : '#cbd5e1',
        position: 'relative', cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background-color 0.2s ease', opacity: disabled ? 0.6 : 1
      }}
    >
      <div style={{
        width: '22px', height: '22px', borderRadius: '50%', backgroundColor: 'white',
        position: 'absolute', top: '2px', left: checked ? '22px' : '2px',
        transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
      }} />
    </div>
  </div>
);

// --- COMPONENT: THẺ CHỌN PHƯƠNG THỨC LÀM BÀI ---
const MethodCard = ({ title, icon, description, active, onClick }) => (
  <div onClick={onClick} style={{
    border: active ? '2px solid #003366' : '1px solid #cbd5e1',
    borderRadius: '12px', padding: '20px', marginBottom: '15px', cursor: 'pointer',
    backgroundColor: active ? '#f0f9ff' : 'white', transition: 'all 0.2s ease'
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: active ? '10px' : '0' }}>
      <div style={{ color: active ? '#003366' : '#94a3b8', display: 'flex' }}>{icon}</div>
      <div style={{ flex: 1, fontSize: '16px', fontWeight: active ? '800' : '600', color: active ? '#003366' : '#475569' }}>{title}</div>
      <div style={{
        width: '20px', height: '20px', borderRadius: '50%',
        border: active ? '6px solid #003366' : '2px solid #cbd5e1',
        backgroundColor: 'white', transition: 'border 0.2s ease', flexShrink: 0
      }} />
    </div>
    {active && description && (
      <div style={{ color: '#475569', fontSize: '14px', lineHeight: '1.6', marginLeft: '35px' }}>{description}</div>
    )}
  </div>
);

// --- TRANG CHÍNH: LAUNCH ---
export default function Launch() {
  const navigate = useNavigate();
  const { activeRoom } = useContext(TeacherContext);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  const [quizzes, setQuizzes] = useState([]);
  const [step, setStep] = useState('MENU');
  const [selectedQuizId, setSelectedQuizId] = useState('');

  // --- CÁC STATE CẤU HÌNH BÀI THI ---
  const [deliveryMethod, setDeliveryMethod] = useState('Instant Feedback');
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleAnswers, setShuffleAnswers] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showFinalScore, setShowFinalScore] = useState(false);
  const [oneAttempt, setOneAttempt] = useState(true);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const fetchQuizzes = async () => {
      const qSnap = await getDocs(collection(db, "quizzes"));
      setQuizzes(qSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(q => !q.isDeleted));
    };
    fetchQuizzes();
  }, []);

  const handleLaunchActivity = async () => {
    if (!activeRoom) {
      alert("Vui lòng chọn Lớp học (Room) ở góc phải màn hình trước khi Launch!"); return;
    }
    try {
      const roomSnap = await getDoc(doc(db, "rooms", activeRoom));
      if (roomSnap.data()?.activeSession) {
        if(!window.confirm(`Lớp ${activeRoom} đang có một hoạt động diễn ra. Bạn có chắc muốn dừng bài cũ và chạy bài mới này không?`)) return;
      }

      // QUAN TRỌNG: Xóa sạch toàn bộ lịch sử (submissions) của bài cũ để không tính dồn
      const subDocs = await getDocs(collection(db, `rooms/${activeRoom}/submissions`));
      for (const subDoc of subDocs.docs) {
        await deleteDoc(doc(db, `rooms/${activeRoom}/submissions`, subDoc.id));
      }

      const quizData = quizzes.find(q => q.id === selectedQuizId);

      // Cập nhật session lên Firebase với startTime mới tinh
      await updateDoc(doc(db, "rooms", activeRoom), {
        activeSession: {
          quizId: selectedQuizId,
          quizTitle: quizData.title,
          mode: deliveryMethod,
          settings: { shuffleQuestions, shuffleAnswers, showFeedback, showFinalScore, oneAttempt },
          currentQuestionIndex: deliveryMethod === 'Teacher Paced' ? 0 : null,
          status: 'active',
          startTime: new Date().toISOString()
        }
      });
      navigate('/staff/assignments/live');
    } catch (error) {
      console.error("Lỗi khởi chạy:", error);
      alert("Lỗi kết nối. Không thể khởi chạy bài tập.");
    }
  };

  const selectedQuizData = quizzes.find(q => q.id === selectedQuizId);

  return (
    <div style={{ padding: isMobile ? '15px' : '30px', backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: "'Josefin Sans', sans-serif", position: 'relative' }}>
      
      {/* TIÊU ĐỀ ĐỒNG BỘ CANH LỀ TRÁI */}
      <h2 style={{ color: '#003366', margin: '0 0 24px 0', fontSize: isMobile ? '24px' : '28px', fontWeight: '800' }}>Launch</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '20px' }}>
        {/* CARD 1: BÀI KIỂM TRA */}
        <button 
          onClick={() => setStep('SELECT_QUIZ')} 
          style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', cursor: 'pointer', transition: 'all 0.2s ease', color: '#003366', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', width: '100%' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#003366'; e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0,51,102,0.1)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.05)'; }}
        >
          <SvgIcons.Quiz />
          <span style={{ fontWeight: '800', fontSize: '18px' }}>Bài kiểm tra</span>
        </button>

        {/* CARD 2: THI ĐUA */}
        <button 
          style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', cursor: 'pointer', transition: 'all 0.2s ease', color: '#003366', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', width: '100%' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#003366'; e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0,51,102,0.1)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.05)'; }}
        >
          <SvgIcons.Race />
          <span style={{ fontWeight: '800', fontSize: '18px' }}>Thi đua</span>
        </button>

        {/* CARD 3: ÔN TẬP NHANH */}
        <button 
          style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', cursor: 'pointer', transition: 'all 0.2s ease', color: '#003366', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', width: '100%' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#003366'; e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0,51,102,0.1)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.05)'; }}
        >
          <SvgIcons.Review />
          <span style={{ fontWeight: '800', fontSize: '18px' }}>Ôn tập nhanh</span>
        </button>
      </div>

      {/* --- MODAL HIỂN THỊ CÁC BƯỚC CẤU HÌNH --- */}
      {step !== 'MENU' && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)', padding: '15px', boxSizing: 'border-box' }}>
          
          {/* BƯỚC 1: CHỌN BÀI TẬP TỪ THƯ VIỆN */}
          {step === 'SELECT_QUIZ' && (
            <div style={{ backgroundColor: 'white', padding: isMobile ? '20px' : '30px', borderRadius: '20px', width: '100%', maxWidth: '700px', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '20px' }}>
                <h2 style={{ color: '#003366', margin: 0, fontWeight: '800', fontSize: isMobile ? '20px' : '24px' }}>Chọn bài tập từ Thư viện</h2>
                <button onClick={() => setStep('MENU')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', padding: '4px', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#ef4444'} onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}>
                  <SvgIcons.Close />
                </button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {quizzes.length === 0 ? <p style={{ color: '#94a3b8', textAlign: 'center', padding: '30px 0', fontSize: '15px' }}>Thư viện chưa có bài tập nào.</p> : quizzes.map(q => (
                  <div 
                    key={q.id} 
                    onClick={() => { setSelectedQuizId(q.id); setStep('CONFIG'); }}
                    style={{ padding: '16px 20px', border: '1px solid #cbd5e1', borderRadius: '12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.2s' }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f0f9ff'; e.currentTarget.style.borderColor = '#003366'; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                  >
                    <div style={{ fontWeight: '700', color: '#003366', fontSize: '16px' }}>{q.title}</div>
                    <div style={{ color: '#64748b', fontSize: '13px', backgroundColor: '#f8fafc', padding: '6px 12px', borderRadius: '100px', fontWeight: '600', border: '1px solid #e2e8f0' }}>{q.questions?.length || 0} câu hỏi</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* BƯỚC 2: CẤU HÌNH VÀ PHÁT BÀI */}
          {step === 'CONFIG' && (
            <div style={{ backgroundColor: 'white', borderRadius: '24px', width: '100%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: isMobile ? '16px 20px' : '24px 30px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc', borderRadius: '24px 24px 0 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button onClick={() => setStep('SELECT_QUIZ')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#003366', display: 'flex', alignItems: 'center', padding: '4px' }}>
                    <SvgIcons.Back />
                  </button>
                  <h2 style={{ color: '#003366', margin: 0, fontSize: isMobile ? '16px' : '20px', fontWeight: '800', textTransform: 'uppercase' }}>{selectedQuizData?.title}</h2>
                </div>
                <button onClick={() => setStep('MENU')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#ef4444'} onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}>
                  <SvgIcons.Close />
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '25px' : '40px', padding: isMobile ? '20px' : '30px' }}>
                
                {/* CỘT PHƯƠNG THỨC */}
                <div>
                  <h3 style={{ fontSize: '14px', color: '#64748b', marginTop: 0, marginBottom: '15px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>Delivery Method</h3>
                  
                  <MethodCard 
                    title="Instant Feedback" 
                    icon={<SvgIcons.Instant />} 
                    active={deliveryMethod === 'Instant Feedback'} 
                    onClick={() => { setDeliveryMethod('Instant Feedback'); setShuffleQuestions(false); setShuffleAnswers(false); setOneAttempt(true); }}
                    description="Học viên làm câu hỏi theo thứ tự và không thể đổi đáp án. Nhận phản hồi ngay."
                  />
                  <MethodCard 
                    title="Open Navigation" 
                    icon={<SvgIcons.Open />} 
                    active={deliveryMethod === 'Open Navigation'} 
                    onClick={() => { setDeliveryMethod('Open Navigation'); setShowFeedback(false); setOneAttempt(false); }}
                    description="Học viên tự do chuyển giữa các câu hỏi và thay đổi đáp án trước khi nộp bài."
                  />
                  <MethodCard 
                    title="Teacher Paced" 
                    icon={<SvgIcons.Teacher />} 
                    active={deliveryMethod === 'Teacher Paced'} 
                    onClick={() => { setDeliveryMethod('Teacher Paced'); setShuffleQuestions(false); }}
                    description="Giáo viên điều khiển tiến trình làm bài, hiển thị từng câu hỏi một cho cả lớp."
                  />
                </div>

                {/* CỘT CÀI ĐẶT TÙY CHỌN */}
                <div>
                  <h3 style={{ fontSize: '14px', color: '#64748b', marginTop: 0, marginBottom: '15px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>Settings</h3>
                  
                  <Toggle label="Require Names" checked={true} disabled={true} />
                  <Toggle label="Shuffle Questions" checked={shuffleQuestions} onChange={setShuffleQuestions} disabled={deliveryMethod === 'Teacher Paced'} info="Vô hiệu hóa khi ở chế độ Teacher Paced" />
                  <Toggle label="Shuffle Answers" checked={shuffleAnswers} onChange={setShuffleAnswers} />
                  <Toggle label="Show Question Feedback" checked={showFeedback} onChange={setShowFeedback} disabled={deliveryMethod === 'Open Navigation'} />
                  <Toggle label="Show Final Score" checked={showFinalScore} onChange={setShowFinalScore} />
                  <Toggle label="One Attempt" checked={oneAttempt} onChange={setOneAttempt} info="Học viên chỉ được gửi bài 1 lần duy nhất." />
                </div>
              </div>

              {/* NÚT LAUNCH CUỐI MODAL */}
              <div style={{ padding: '20px 30px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#f8fafc', borderRadius: '0 0 24px 24px' }}>
                <button 
                  onClick={handleLaunchActivity} 
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: isMobile ? '100%' : 'auto', backgroundColor: '#003366', color: 'white', padding: '14px 32px', fontSize: '15px', fontWeight: '700', borderRadius: '100px', border: 'none', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(0,51,102,0.2)', transition: 'all 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <SvgIcons.Rocket /> Launch
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}