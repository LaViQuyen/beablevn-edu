// src/pages/teacher/LiveResults.jsx
import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, doc, updateDoc, addDoc, getDocs, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from "../../../firebase";
import { TeacherContext } from './TeacherDashboard';

// --- HỆ THỐNG SVG ICONS TỐI GIẢN ---
const SvgIcons = {
  Pause: () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>,
  Play: () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>,
  Stop: () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>,
  Users: () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>,
  ChevronLeft: () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"></polyline></svg>,
  ChevronRight: () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>
};

const Toggle = ({ label, checked, onChange }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => onChange(!checked)}>
    <div style={{ width: '36px', height: '20px', borderRadius: '10px', backgroundColor: checked ? '#003366' : '#cbd5e1', position: 'relative', transition: 'all 0.2s' }}>
      <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'white', position: 'absolute', top: '2px', left: checked ? '18px' : '2px', transition: 'all 0.2s' }} />
    </div>
    <span style={{ fontSize: '14px', color: '#334155', fontWeight: '600' }}>{label}</span>
  </div>
);

const formatTime = (isoString) => {
  if (!isoString) return '--:--';
  const d = new Date(isoString);
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
};

export default function LiveResults() {
  const navigate = useNavigate();
  const { activeRoom } = useContext(TeacherContext);
  
  const [sessionInfo, setSessionInfo] = useState(null);
  const [quizData, setQuizData] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [roster, setRoster] = useState([]);
  const [isPaused, setIsPaused] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const [showNames, setShowNames] = useState(true);
  const [showResponses, setShowResponses] = useState(true);
  const [showResults, setShowResults] = useState(true);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!activeRoom) return;

    const roomUnsub = onSnapshot(doc(db, "rooms", activeRoom), async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setRoster(data.students || []);
        
        const activeSess = data.activeSession || null;
        setSessionInfo(activeSess);

        if (activeSess && activeSess.quizId && (!quizData || quizData.id !== activeSess.quizId)) {
          const qSnap = await getDoc(doc(db, "quizzes", activeSess.quizId));
          if (qSnap.exists()) setQuizData({ id: qSnap.id, ...qSnap.data() });
        }
      }
    });

    const subUnsub = onSnapshot(collection(db, `rooms/${activeRoom}/submissions`), (snap) => {
      setSubmissions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { roomUnsub(); subUnsub(); };
  }, [activeRoom]);

  const evaluateAnswer = (question, studentAnswer) => {
    if (!studentAnswer) return false;
    const ans = String(studentAnswer).trim().toLowerCase();

    if (question.type === 'MCQ') {
      const correctStr = (question.correctOptions || []).sort().map(i => String.fromCharCode(65 + i)).join(', ').toLowerCase();
      return ans === correctStr;
    }
    if (['EVALUATION', 'MATCHING'].includes(question.type)) {
      const correctStr = String(question.correctOption || question.correctMatch || '').trim().toLowerCase();
      return ans === correctStr;
    }
    if (question.type === 'SAQ') {
      const correctOpts = (question.correctText || '').split(',').map(s => s.trim().toLowerCase());
      return correctOpts.includes(ans);
    }
    if (question.type.startsWith('GAP_FILL')) {
       let allCorrect = true;
       const items = question.type === 'GAP_FILL_PARAGRAPH' ? question.gaps : question.labels;
       if (!items || items.length === 0) return false;

       items.forEach(item => {
         const correctAnsArray = (item.answerString || '').split(',').map(s => s.trim().toLowerCase());
         const regex = new RegExp(`\\[${item.id}\\]:\\s*([^|]+)`);
         const match = studentAnswer.match(regex);
         if (match) {
           const stAns = match[1].trim().toLowerCase();
           if (!correctAnsArray.includes(stAns)) allCorrect = false;
         } else {
           allCorrect = false;
         }
       });
       return allCorrect;
    }
    return false;
  };

  const handleFinishActivity = async () => {
    if (!window.confirm("Bạn có chắc muốn kết thúc bài tập này? Kết quả sẽ được lưu vào Reports.")) return;
    if (!activeRoom || !sessionInfo || !quizData) return;

    try {
      const questionsToSave = quizData.questions.map(q => ({ 
        id: q.id, type: q.type, text: q.text,
        options: q.options || [], correctOptions: q.correctOptions || [], correctOption: q.correctOption || '',
        correctMatch: q.correctMatch || '', correctText: q.correctText || '',
        gaps: q.gaps || [], labels: q.labels || [], explanation: q.explanation || ''
      }));
      
      const processedSubmissions = roster.map(student => {
        const sub = submissions.find(s => s.studentId === student.studentId || s.id === student.studentId);
        const evaluatedAnswers = {};
        let correctCount = 0;

        quizData.questions.forEach(q => {
          const stAns = sub?.answers?.[q.id] || '';
          const isCorrect = evaluateAnswer(q, stAns);
          if (isCorrect) correctCount++;
          evaluatedAnswers[q.id] = { answer: stAns, isCorrect };
        });

        const score = Math.round((correctCount / quizData.questions.length) * 100) || 0;
        return { ...student, answers: evaluatedAnswers, score, submitted: !!sub?.submittedAt, sessions: sub?.sessions || [] };
      });

      const reportData = {
        name: sessionInfo.quizTitle || "Untitled Activity",
        date: new Date().toISOString(),
        room: activeRoom,
        type: sessionInfo.mode || "Quiz",
        totalStudents: roster.length,
        questions: questionsToSave,
        submissions: processedSubmissions
      };

      await addDoc(collection(db, "reports"), reportData);

      const subDocs = await getDocs(collection(db, `rooms/${activeRoom}/submissions`));
      for (const subDoc of subDocs.docs) await deleteDoc(doc(db, `rooms/${activeRoom}/submissions`, subDoc.id));

      await updateDoc(doc(db, "rooms", activeRoom), { activeSession: null });

      alert("Đã lưu kết quả thành công vào Reports!");
      navigate('/teacher/reports');
    } catch (error) {
      console.error("Lỗi khi lưu Report:", error);
      alert("Có lỗi xảy ra khi kết thúc Activity.");
    }
  };

  const currentQIndex = sessionInfo?.currentQuestionIndex || 0;
  const handleNextQ = async () => {
    if (currentQIndex < quizData.questions.length - 1) {
      await updateDoc(doc(db, "rooms", activeRoom), { "activeSession.currentQuestionIndex": currentQIndex + 1 });
    }
  };
  const handlePrevQ = async () => {
    if (currentQIndex > 0) {
      await updateDoc(doc(db, "rooms", activeRoom), { "activeSession.currentQuestionIndex": currentQIndex - 1 });
    }
  };

  if (!activeRoom) return <div style={{ padding: '60px', textAlign: 'center', color: '#64748b', fontSize: '15px' }}>Vui lòng chọn lớp học (Room) ở thanh công cụ phía trên.</div>;
  if (!sessionInfo) return <div style={{ padding: '60px', textAlign: 'center', color: '#64748b', fontSize: '15px' }}>Lớp <span style={{ color: '#003366', fontWeight: '700' }}>{activeRoom}</span> hiện không có hoạt động nào. Hãy vào thẻ Launch để phát bài.</div>;
  if (!quizData) return <div style={{ padding: '60px', textAlign: 'center', color: '#64748b', fontSize: '15px' }}>Đang tải dữ liệu bài kiểm tra...</div>;

  const isTeacherPaced = sessionInfo.mode === 'Teacher Paced';
  const isOneAttempt = sessionInfo.settings?.oneAttempt;

  return (
    <div style={{ padding: isMobile ? '15px' : '30px', minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: "'Josefin Sans', sans-serif" }}>
      
      {/* HEADER & CONTROLS */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', marginBottom: '30px', backgroundColor: 'white', padding: isMobile ? '16px' : '24px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', gap: '15px' }}>
        <div>
          <h2 style={{ color: '#003366', margin: 0, fontWeight: '800', fontSize: isMobile ? '20px' : '24px', textTransform: 'uppercase' }}>{sessionInfo.quizTitle}</h2>
          <p style={{ color: '#64748b', margin: '8px 0 0 0', fontSize: '14px', fontWeight: '500' }}>Room: <span style={{ color: '#e67e22', fontWeight: '700' }}>{activeRoom}</span> • Mode: <span style={{ fontWeight: '600', color: '#334155' }}>{sessionInfo.mode}</span></p>
        </div>
        
        <div style={{ display: 'flex', gap: '10px', width: isMobile ? '100%' : 'auto', flexWrap: 'wrap' }}>
          <button style={{ flex: isMobile ? '1 1 100%' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: 'white', color: '#003366', border: '1px solid #cbd5e1', padding: '12px 20px', borderRadius: '100px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s' }}>
            <SvgIcons.Users /> Invite
          </button>
          <button onClick={() => setIsPaused(!isPaused)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: isPaused ? '#fef3c7' : '#f1f5f9', color: isPaused ? '#d97706' : '#334155', border: 'none', padding: '12px 20px', borderRadius: '100px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s' }}>
            {isPaused ? <><SvgIcons.Play /> Resume</> : <><SvgIcons.Pause /> Pause</>}
          </button>
          <button onClick={handleFinishActivity} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: '#003366', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '100px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(0,51,102,0.2)', transition: 'all 0.2s' }}>
            <SvgIcons.Stop /> Finish
          </button>
        </div>
      </div>

      {/* TEACHER PACED CONTROLS */}
      {isTeacherPaced && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', marginBottom: '24px', backgroundColor: 'white', padding: '16px', borderRadius: '100px', border: '1px solid #cbd5e1', width: 'fit-content', margin: '0 auto 24px auto' }}>
          <button onClick={handlePrevQ} disabled={currentQIndex === 0} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: currentQIndex === 0 ? '#cbd5e1' : '#003366', fontWeight: '700', cursor: currentQIndex === 0 ? 'not-allowed' : 'pointer' }}>
            <SvgIcons.ChevronLeft /> Prev
          </button>
          <span style={{ fontWeight: '800', color: '#003366', fontSize: '15px' }}>Question {currentQIndex + 1} / {quizData.questions.length}</span>
          <button onClick={handleNextQ} disabled={currentQIndex === quizData.questions.length - 1} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: currentQIndex === quizData.questions.length - 1 ? '#cbd5e1' : '#003366', fontWeight: '700', cursor: currentQIndex === quizData.questions.length - 1 ? 'not-allowed' : 'pointer' }}>
            Next <SvgIcons.ChevronRight />
          </button>
        </div>
      )}

      {/* TOGGLES */}
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '24px', padding: '0 5px' }}>
        <Toggle label="Show Names" checked={showNames} onChange={setShowNames} />
        <Toggle label="Show Responses" checked={showResponses} onChange={setShowResponses} />
        <Toggle label="Show Results" checked={showResults} onChange={setShowResults} />
      </div>

      {/* LIVE MATRIX MATRIX */}
      <div style={{ width: '100%', overflowX: 'auto', backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        <table style={{ minWidth: isMobile ? '600px' : '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
              <th style={{ padding: '16px 20px', textAlign: 'left', color: '#475569', width: '240px', position: 'sticky', left: 0, backgroundColor: '#f8fafc', zIndex: 10 }}>Name</th>
              <th style={{ padding: '16px', color: '#475569', width: '100px' }}>Score</th>
              {quizData.questions.map((q, idx) => (
                <th key={q.id} style={{ padding: '16px', color: (isTeacherPaced && currentQIndex === idx) ? '#0ea5e9' : '#003366', fontWeight: '800', borderBottom: (isTeacherPaced && currentQIndex === idx) ? '3px solid #0ea5e9' : 'none' }}>
                  Q{idx + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roster.length === 0 ? (
              <tr><td colSpan={quizData.questions.length + 2} style={{ padding: '40px', color: '#94a3b8' }}>Chưa có học viên nào trong danh sách lớp.</td></tr>
            ) : (
              roster.map((student, index) => {
                const sub = submissions.find(s => s.id === student.studentId || s.studentId === student.studentId);
                const isFinished = sub && sub.submittedAt;

                let correctCount = 0;
                if (sub) {
                  quizData.questions.forEach(q => {
                    if (evaluateAnswer(q, sub.answers?.[q.id])) correctCount++;
                  });
                }
                const score = sub ? Math.round((correctCount / quizData.questions.length) * 100) : 0;

                return (
                  <tr key={index} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f0f9ff'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}>
                    <td style={{ padding: '16px 20px', textAlign: 'left', position: 'sticky', left: 0, backgroundColor: 'inherit', zIndex: 5, borderRight: '1px solid #f1f5f9', verticalAlign: 'top' }}>
                      <div style={{ fontWeight: '700', color: '#003366', marginBottom: '8px' }}>
                        {showNames ? `${student.lastName} ${student.firstName}` : '••••••••'}
                      </div>
                      
                      {/* LỊCH SỬ ĐĂNG NHẬP / SESSION HISTORY */}
                      {sub?.sessions && sub.sessions.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                          {sub.sessions.map((sess, i) => (
                            <div key={i} style={{ fontSize: '12px', color: '#64748b', padding: '8px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                              <div style={{ fontWeight: '700', color: '#334155', marginBottom: '4px' }}>Đợt {i+1}</div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                                <div><span style={{ color: '#94a3b8' }}>Vào:</span> {formatTime(sess.loginTime)}</div>
                                <div><span style={{ color: '#94a3b8' }}>Ra:</span> {sess.exitTime ? formatTime(sess.exitTime) : '--:--'}</div>
                              </div>
                              <div style={{ color: '#0ea5e9', fontWeight: '800', marginTop: '6px', borderTop: '1px dashed #cbd5e1', paddingTop: '4px' }}>
                                {isOneAttempt 
                                  ? `Đã làm: ${sess.completedCount} câu` 
                                  : `Điểm: ${sess.score}%`}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    
                    <td style={{ padding: '16px', fontWeight: '800', color: sub ? (isFinished ? '#059669' : '#e67e22') : '#94a3b8', verticalAlign: 'top' }}>
                      {sub ? `${score}%` : '-'}
                      {sub && !isFinished && !isTeacherPaced && <div style={{ fontSize: '11px', color: '#e67e22', fontWeight: '600', marginTop: '4px' }}>Đang làm...</div>}
                    </td>
                    
                    {quizData.questions.map((q, idx) => {
                      const ans = sub?.answers ? sub.answers[q.id] : null;
                      const isCorrect = evaluateAnswer(q, ans);
                      
                      let cellBg = 'transparent';
                      let cellColor = '#334155';
                      let cellText = '';

                      if (ans) {
                        cellText = showResponses ? ans : '✓';
                        if (showResults) {
                          cellBg = isCorrect ? '#dcfce7' : '#fee2e2'; 
                          cellColor = isCorrect ? '#15803d' : '#b91c1c';
                        }
                      }

                      return (
                        <td key={idx} style={{ padding: '10px', backgroundColor: (isTeacherPaced && currentQIndex === idx) ? '#f0f9ff' : 'transparent', verticalAlign: 'top' }}>
                          <div style={{ backgroundColor: cellBg, color: cellColor, padding: '8px', borderRadius: '8px', fontWeight: '600', minHeight: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: (ans && !showResults) ? '1px solid #cbd5e1' : 'none', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px', margin: '0 auto' }} title={ans}>
                            {cellText}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}