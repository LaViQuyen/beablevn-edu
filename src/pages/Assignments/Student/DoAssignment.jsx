// src/pages/Assignments/Student/DoAssignment.jsx
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { firestore as db } from "../../../firebase";
import { useAuth } from '../../../context/AuthContext';

// --- HỆ THỐNG SVG ICONS TỐI GIẢN ---
const SvgIcons = {
  Submit: () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>,
  Wait: () => <svg width="48" height="48" fill="none" stroke="#003366" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>,
  Check: () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>,
  CheckBig: () => <svg width="48" height="48" fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>,
  Passage: () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>,
  Info: () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>,
  Lock: () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>,
  User: () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>,
  Quiz: () => <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>,
  Book: () => <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>,
  Flip: () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"></polyline><polyline points="23 20 23 14 17 14"></polyline><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path></svg>,
  Back: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" /></svg>
};

export default function DoAssignment() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { currentUser, userData } = useAuth();
  
  // Tự động lấy studentId từ hệ thống Edu (Ưu tiên mã học viên, nếu không có thì lấy loginId/email)
  const studentId = userData?.studentCode || userData?.loginId || currentUser?.email?.split('@')[0] || currentUser?.uid || "Unknown";

  // States chung
  const [view, setView] = useState('DASHBOARD'); // DASHBOARD, QUIZ, VOCAB_HOME, VOCAB_FLASHCARDS, VOCAB_LEARN, VOCAB_MATCH
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [roomData, setRoomData] = useState(null);

  // Quiz States
  const [quiz, setQuiz] = useState(null);
  const [shuffledQuiz, setShuffledQuiz] = useState(null);
  const [sessionInfo, setSessionInfo] = useState(null);
  const [localAnswers, setLocalAnswers] = useState({});
  const [lockedQuestions, setLockedQuestions] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const sessionsRef = useRef([]);

  // Vocab States
  const [vocabSet, setVocabSet] = useState(null);
  const [vocabCardIndex, setVocabCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [learnQ, setLearnQ] = useState(null);
  const [learnStats, setLearnStats] = useState({ correct: 0, total: 0 });
  const [matchItems, setMatchItems] = useState([]);
  const [matchSelected, setMatchSelected] = useState(null);
  const [matchStartTime, setMatchStartTime] = useState(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Lắng nghe Room
  useEffect(() => {
    const roomRef = doc(db, "rooms", roomId);
    const unsubscribe = onSnapshot(roomRef, async (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setRoomData(data);

        // Load Quiz
        const activeSession = data.activeSession;
        if (activeSession && activeSession.status === 'active') {
          setSessionInfo(activeSession);
          const quizSnap = await getDoc(doc(db, "quizzes", activeSession.quizId));
          if (quizSnap.exists()) {
            setQuiz({ id: activeSession.quizId, ...quizSnap.data() });
          }
        } else {
          setQuiz(null);
          setSessionInfo(null);
          setShuffledQuiz(null);
        }

        // Load Vocab
        if (data.assignedVocabId) {
          const vocabSnap = await getDoc(doc(db, "vocab_sets", data.assignedVocabId));
          if (vocabSnap.exists()) {
            setVocabSet({ id: vocabSnap.id, ...vocabSnap.data() });
          }
        } else {
          setVocabSet(null);
        }
      }
    });
    return () => unsubscribe();
  }, [roomId]);

  // ==========================================
  // LOGIC QUIZ (Giữ nguyên không thay đổi)
  // ==========================================
  useEffect(() => {
    if (sessionInfo?.startTime) {
      setIsInitialized(false); setLocalAnswers({}); setLockedQuestions({});
      setCurrentSessionId(null); setIsSubmitted(false); sessionsRef.current = [];
    }
  }, [sessionInfo?.startTime]);

  useEffect(() => {
    if (!quiz || !sessionInfo) { setShuffledQuiz(null); return; }
    if (shuffledQuiz && shuffledQuiz.id === quiz.id) return;

    const shuffleArray = (array) => {
      const newArr = [...array];
      for (let i = newArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
      }
      return newArr;
    };

    let processedQuestions = [...(quiz.questions || [])];
    processedQuestions = processedQuestions.map(q => {
      let displayOptions = (q.options || []).map((text, originalIndex) => ({ text, originalIndex }));
      if (sessionInfo?.settings?.shuffleAnswers && q.type === 'MCQ') {
        displayOptions = shuffleArray(displayOptions);
      }
      return { ...q, displayOptions };
    });

    if (sessionInfo?.settings?.shuffleQuestions) {
      const sections = quiz.sections && quiz.sections.length > 0 ? quiz.sections : [{ id: 'default' }];
      let finalQuestions = [];
      sections.forEach(sec => {
        let secQs = processedQuestions.filter(q => q.sectionId === sec.id || (!q.sectionId && sec.id === 'default'));
        secQs = shuffleArray(secQs);
        finalQuestions = finalQuestions.concat(secQs);
      });
      processedQuestions = finalQuestions;
    }
    setShuffledQuiz({ ...quiz, questions: processedQuestions });
  }, [quiz, sessionInfo, shuffledQuiz]);

  useEffect(() => {
    if (!shuffledQuiz || !sessionInfo || isInitialized) return;
    const initSession = async () => {
      const subRef = doc(db, `rooms/${roomId}/submissions`, studentId);
      const subSnap = await getDoc(subRef);
      let prevRaw = {}; let existingSessions = []; let isSub = false;

      if (subSnap.exists()) {
        const data = subSnap.data();
        isSub = !!data.submittedAt;
        existingSessions = data.sessions || [];
        if (!isSub) {
          if (sessionInfo.settings?.oneAttempt) {
            prevRaw = data.rawAnswers || {};
            const locks = {};
            Object.keys(prevRaw).forEach(k => {
              const ans = prevRaw[k];
              if (Array.isArray(ans) && ans.length > 0) locks[k] = true;
              else if (typeof ans === 'object' && Object.keys(ans).length > 0) locks[k] = true;
              else if (typeof ans === 'string' && ans.trim() !== '') locks[k] = true;
            });
            setLockedQuestions(locks);
          } else { prevRaw = {}; }
        } else { prevRaw = data.rawAnswers || {}; }
      }

      if (!isSub) {
        const newSessionId = Date.now().toString();
        const newSession = { sessionId: newSessionId, loginTime: new Date().toISOString(), exitTime: new Date().toISOString(), completedCount: Object.keys(prevRaw).length, score: 0 };
        existingSessions.push(newSession);
        setCurrentSessionId(newSessionId);
        sessionsRef.current = existingSessions;
        await setDoc(subRef, { studentId, studentName: studentId, rawAnswers: prevRaw, answers: {}, sessions: existingSessions, lastUpdated: new Date().toISOString() }, { merge: true });
      }
      setLocalAnswers(prevRaw); setIsSubmitted(isSub); setIsInitialized(true);
    };
    initSession();
  }, [shuffledQuiz, sessionInfo, isInitialized, roomId, studentId]);

  const evaluateAnswer = (question, studentAnswer) => {
    if (!studentAnswer) return false;
    const ans = String(studentAnswer).trim().toLowerCase();
    if (question.type === 'MCQ') return ans === (question.correctOptions || []).sort().map(i => String.fromCharCode(65 + i)).join(', ').toLowerCase();
    if (['EVALUATION', 'MATCHING'].includes(question.type)) return ans === String(question.correctOption || question.correctMatch || '').trim().toLowerCase();
    if (question.type === 'SAQ') return (question.correctText || '').split(',').map(s => s.trim().toLowerCase()).includes(ans);
    if (question.type.startsWith('GAP_FILL')) {
      let allCorrect = true;
      const items = question.type === 'GAP_FILL_PARAGRAPH' ? question.gaps : question.labels;
      if (!items || items.length === 0) return false;
      items.forEach(item => {
        const correctAnsArray = (item.answerString || '').split(',').map(s => s.trim().toLowerCase());
        const match = studentAnswer.match(new RegExp(`\\[${item.id}\\]:\\s*([^|]+)`));
        if (match && !correctAnsArray.includes(match[1].trim().toLowerCase())) allCorrect = false;
        else if (!match) allCorrect = false;
      });
      return allCorrect;
    }
    return false;
  };

  const getCorrectAnswerDisplayForStudent = (q) => {
    if (q.type === 'MCQ') {
      if (!q.displayOptions) return '';
      const correctLetters = [];
      q.displayOptions.forEach((opt, index) => { if ((q.correctOptions || []).includes(opt.originalIndex)) correctLetters.push(String.fromCharCode(65 + index)); });
      return correctLetters.join(', ');
    }
    if (['EVALUATION', 'MATCHING'].includes(q.type)) return q.correctOption || q.correctMatch || '';
    if (q.type === 'SAQ') return q.correctText || '';
    if (q.type.startsWith('GAP_FILL')) {
      const items = q.type === 'GAP_FILL_PARAGRAPH' ? q.gaps : q.labels;
      if (!items || items.length === 0) return '';
      return items.map(item => `[${item.id}]: ${item.answerString}`).join(' | ');
    }
    return '';
  };

  const handleSimpleAnswer = (qId, value) => { if (!lockedQuestions[qId]) setLocalAnswers(prev => ({ ...prev, [qId]: value })); };
  const handleToggleMCQ = (qId, originalIdx) => {
    if (lockedQuestions[qId]) return;
    setLocalAnswers(prev => {
      const current = prev[qId] || [];
      return current.includes(originalIdx) ? { ...prev, [qId]: current.filter(i => i !== originalIdx) } : { ...prev, [qId]: [...current, originalIdx].sort((a, b) => a - b) };
    });
  };
  const handleGapFillChange = (qId, gapId, value) => { if (!lockedQuestions[qId]) setLocalAnswers(prev => ({ ...prev, [qId]: { ...(prev[qId] || {}), [gapId]: value } })); };

  const handleLockQuestion = (qId) => {
    if (!localAnswers[qId] || (Array.isArray(localAnswers[qId]) && localAnswers[qId].length === 0) || (typeof localAnswers[qId] === 'object' && !Array.isArray(localAnswers[qId]) && Object.keys(localAnswers[qId]).length === 0)) {
      return alert("Vui lòng chọn hoặc nhập đáp án trước khi chốt!");
    }
    setLockedQuestions(prev => ({ ...prev, [qId]: true }));
  };

  useEffect(() => {
    if (!shuffledQuiz || !isInitialized || !currentSessionId || isSubmitted || view !== 'QUIZ') return;
    const syncAnswers = async () => {
      const formattedAnswers = {}; let completedCount = 0;
      shuffledQuiz.questions.forEach(q => {
        const ans = localAnswers[q.id];
        if (ans === undefined || ans === null) return;
        let isEmpty = true;
        if (q.type === 'MCQ') {
          formattedAnswers[q.id] = ans.map(i => String.fromCharCode(65 + i)).join(', ');
          if (ans.length > 0) isEmpty = false;
        } else if (q.type === 'GAP_FILL_PARAGRAPH' || q.type === 'GAP_FILL_DIAGRAM') {
          const parts = [];
          Object.keys(ans).sort((a, b) => parseInt(a) - parseInt(b)).forEach(k => {
            if (ans[k] && ans[k].trim() !== '') isEmpty = false;
            parts.push(`[${k}]: ${ans[k]}`);
          });
          formattedAnswers[q.id] = parts.join(' | ');
        } else {
          formattedAnswers[q.id] = ans;
          if (ans.trim() !== '') isEmpty = false;
        }
        if (!isEmpty) completedCount++;
      });

      let correctCount = 0;
      shuffledQuiz.questions.forEach(q => { if (evaluateAnswer(q, formattedAnswers[q.id])) correctCount++; });
      const currentScore = Math.round((correctCount / shuffledQuiz.questions.length) * 100) || 0;

      const updatedSessions = [...sessionsRef.current];
      const idx = updatedSessions.findIndex(s => s.sessionId === currentSessionId);
      if (idx >= 0) {
        updatedSessions[idx].exitTime = new Date().toISOString();
        updatedSessions[idx].completedCount = completedCount;
        updatedSessions[idx].score = currentScore;
      }
      sessionsRef.current = updatedSessions;

      try {
        await setDoc(doc(db, `rooms/${roomId}/submissions`, studentId), { studentId, studentName: userData?.name || studentId, rawAnswers: localAnswers, answers: formattedAnswers, sessions: updatedSessions, lastUpdated: new Date().toISOString() }, { merge: true });
      } catch (error) { console.error(error); }
    };
    const timeoutId = setTimeout(() => { syncAnswers(); }, 800);
    return () => clearTimeout(timeoutId);
  }, [localAnswers, shuffledQuiz, isInitialized, currentSessionId, isSubmitted, roomId, studentId, view, userData]);

  const handleQuizSubmit = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn nộp bài không?")) return;
    const formattedAnswers = {};
    if (shuffledQuiz && shuffledQuiz.questions) {
      shuffledQuiz.questions.forEach(q => {
        const ans = localAnswers[q.id];
        if (ans === undefined || ans === null) { formattedAnswers[q.id] = ''; return; }
        if (q.type === 'MCQ') formattedAnswers[q.id] = ans.map(i => String.fromCharCode(65 + i)).join(', ');
        else if (q.type === 'GAP_FILL_PARAGRAPH' || q.type === 'GAP_FILL_DIAGRAM') {
          const parts = []; Object.keys(ans).sort((a, b) => parseInt(a) - parseInt(b)).forEach(k => parts.push(`[${k}]: ${ans[k]}`));
          formattedAnswers[q.id] = parts.join(' | ');
        } else formattedAnswers[q.id] = ans;
      });
    }
    try {
      await setDoc(doc(db, `rooms/${roomId}/submissions`, studentId), { studentId, studentName: userData?.name || studentId, answers: formattedAnswers, submittedAt: new Date().toISOString(), score: 0 }, { merge: true });
      setIsSubmitted(true);
    } catch (error) { alert("Lỗi nộp bài."); }
  };

  // ==========================================
  // LOGIC VOCABULARY (Giữ nguyên không thay đổi)
  // ==========================================
  const saveVocabReport = async (updateData) => {
    try {
      const ref = doc(db, `rooms/${roomId}/vocab_submissions`, studentId);
      await setDoc(ref, { lastActive: new Date().toISOString(), ...updateData }, { merge: true });
    } catch (err) { console.log(err); }
  };

  const initLearnMode = () => {
    if (!vocabSet || vocabSet.cards.length === 0) return;
    const cards = [...vocabSet.cards].sort(() => 0.5 - Math.random());
    const target = cards[0];
    let opts = [target.term];
    while (opts.length < 4 && opts.length < vocabSet.cards.length) {
      const randTerm = vocabSet.cards[Math.floor(Math.random() * vocabSet.cards.length)].term;
      if (!opts.includes(randTerm)) opts.push(randTerm);
    }
    opts.sort(() => 0.5 - Math.random());
    setLearnQ({ card: target, options: opts });
  };

  const handleLearnAnswer = (selectedTerm) => {
    const isCorrect = selectedTerm === learnQ.card.term;
    const newStats = { correct: learnStats.correct + (isCorrect ? 1 : 0), total: learnStats.total + 1 };
    setLearnStats(newStats);
    saveVocabReport({ learnCorrect: newStats.correct, learnTotal: newStats.total });
    if (isCorrect) {
      setTimeout(() => initLearnMode(), 800);
    } else {
      alert(`Sai rồi! Đáp án đúng là: ${learnQ.card.term}`);
      initLearnMode();
    }
  };

  const initMatchMode = () => {
    if (!vocabSet) return;
    const pairs = vocabSet.cards.slice(0, 6);
    let items = [];
    pairs.forEach(c => {
      items.push({ id: `t_${c.id}`, text: c.term, type: 'term', cardId: c.id, matched: false });
      items.push({ id: `d_${c.id}`, text: c.definition, type: 'def', cardId: c.id, matched: false });
    });
    setMatchItems(items.sort(() => 0.5 - Math.random()));
    setMatchSelected(null);
    setMatchStartTime(Date.now());
  };

  const handleMatchClick = (item) => {
    if (item.matched) return;
    if (!matchSelected) { setMatchSelected(item); return; }
    if (matchSelected.id === item.id) { setMatchSelected(null); return; }

    if (matchSelected.cardId === item.cardId && matchSelected.type !== item.type) {
      const newItems = matchItems.map(i => i.cardId === item.cardId ? { ...i, matched: true } : i);
      setMatchItems(newItems);
      setMatchSelected(null);

      if (newItems.every(i => i.matched)) {
        const timeTaken = Math.round((Date.now() - matchStartTime) / 1000);
        alert(`Hoàn thành trong ${timeTaken} giây!`);
        saveVocabReport({ bestMatchTime: timeTaken });
      }
    } else {
      setMatchSelected(null);
    }
  };

  // ==========================================
  // RENDERS ĐƯỢC CHUẨN HÓA (DÙNG TAILWIND CSS CỦA EDU)
  // ==========================================

  // Header Tiêu đề chuyên dụng cho trang này (Thay thế cái appHeader cồng kềnh cũ)
  const renderPageHeader = (titleText, showBack = false, backAction = null) => (
    <div className="mb-6 animate-fade-in-up">
      {showBack ? (
        <button onClick={backAction} className="flex items-center gap-2 text-slate-500 hover:text-[#003366] font-bold text-sm mb-3 transition-colors">
          <SvgIcons.Back /> Quay lại
        </button>
      ) : (
        <button onClick={() => navigate('/student/dashboard')} className="flex items-center gap-2 text-slate-500 hover:text-[#003366] font-bold text-sm mb-3 transition-colors">
          <SvgIcons.Back /> Thoát phòng (Về Dashboard)
        </button>
      )}
      <h2 className="text-2xl md:text-3xl font-extrabold text-[#003366] uppercase">{titleText}</h2>
    </div>
  );

  // 1. DASHBOARD CHỜ PHÁT BÀI
  if (view === 'DASHBOARD') {
    if (!quiz && !vocabSet) {
      return (
        <div className="flex flex-col h-full animate-fade-in-up">
          {renderPageHeader(`Phòng học: ${roomId}`)}
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white rounded-2xl border border-slate-100 shadow-sm mt-4">
            <div className="mb-6 animate-pulse"><SvgIcons.Wait /></div>
            <h2 className="font-extrabold text-center text-2xl text-[#003366] mb-2">Đang chờ giáo viên phát bài...</h2>
            <p className="text-slate-500 text-center">Vui lòng giữ màn hình này, bài tập sẽ tự động hiện ra khi có yêu cầu.</p>
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-col h-full animate-fade-in-up">
        {renderPageHeader(`Phòng học: ${roomId}`)}
        <div className="max-w-4xl mx-auto w-full mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {vocabSet && (
              <button onClick={() => setView('VOCAB_HOME')} className="flex flex-col items-center bg-white border-2 border-sky-400 rounded-3xl p-10 cursor-pointer transition-transform hover:-translate-y-1 shadow-[0_10px_15px_-3px_rgba(14,165,233,0.1)]">
                <div className="text-sky-500 mb-5"><SvgIcons.Book /></div>
                <h3 className="m-0 text-[#003366] text-2xl font-extrabold">Ôn Từ Vựng</h3>
                <p className="text-slate-500 text-sm mt-3">{vocabSet.title}</p>
              </button>
            )}

            {quiz && (
              <button onClick={() => setView('QUIZ')} className="flex flex-col items-center bg-white border-2 border-orange-400 rounded-3xl p-10 cursor-pointer transition-transform hover:-translate-y-1 shadow-[0_10px_15px_-3px_rgba(230,126,34,0.1)]">
                <div className="text-orange-500 mb-5"><SvgIcons.Quiz /></div>
                <h3 className="m-0 text-[#003366] text-2xl font-extrabold">Làm bài Quiz</h3>
                <p className="text-slate-500 text-sm mt-3">{shuffledQuiz?.title || quiz.title}</p>
              </button>
            )}

          </div>
        </div>
      </div>
    );
  }

  // 2. VOCABULARY VIEWS
  if (view.startsWith('VOCAB')) {
    if (view === 'VOCAB_HOME') {
      return (
        <div className="flex flex-col h-full animate-fade-in-up">
          {renderPageHeader('Vocabulary', true, () => setView('DASHBOARD'))}
          <div className="max-w-2xl mx-auto w-full text-center mt-6 bg-white p-8 rounded-2xl border border-slate-100 shadow-sm">
            <h2 className="text-[#003366] text-3xl font-extrabold mb-3">{vocabSet.title}</h2>
            <p className="text-slate-500 mb-10 font-bold">{vocabSet.cards.length} terms</p>

            <div className="flex flex-col gap-4">
              <button onClick={() => setView('VOCAB_FLASHCARDS')} className="p-5 bg-slate-50 border border-slate-200 rounded-2xl text-lg font-bold text-[#003366] hover:border-[#003366] transition-colors shadow-sm">Flashcards</button>
              <button onClick={() => { initLearnMode(); setView('VOCAB_LEARN'); }} className="p-5 bg-[#003366] border-none rounded-2xl text-lg font-bold text-white hover:bg-[#002244] transition-colors shadow-md">Learn Mode</button>
              <button onClick={() => { initMatchMode(); setView('VOCAB_MATCH'); }} className="p-5 bg-white border-2 border-[#003366] rounded-2xl text-lg font-bold text-[#003366] hover:bg-blue-50 transition-colors shadow-sm">Match Mode</button>
            </div>
          </div>
        </div>
      );
    }

    if (view === 'VOCAB_FLASHCARDS') {
      const card = vocabSet.cards[vocabCardIndex];
      return (
        <div className="flex flex-col h-full animate-fade-in-up">
          {renderPageHeader(`Flashcard: ${vocabCardIndex + 1} / ${vocabSet.cards.length}`, true, () => setView('VOCAB_HOME'))}
          <div className="flex-1 flex flex-col items-center justify-center mt-4">

            <div onClick={() => setIsFlipped(!isFlipped)} className="w-full max-w-2xl h-96 perspective-[1000px] cursor-pointer">
              <div className="w-full h-full relative transition-transform duration-700 preserve-3d" style={{ transform: isFlipped ? 'rotateX(180deg)' : 'rotateX(0deg)' }}>
                {/* Front */}
                <div className="w-full h-full absolute backface-hidden bg-white rounded-3xl flex items-center justify-center shadow-lg border border-slate-200">
                  <h2 className="text-4xl text-[#003366] font-extrabold text-center p-5">{card.term}</h2>
                  <div className="absolute bottom-5 text-slate-400 flex items-center gap-2 text-sm font-bold"><SvgIcons.Flip /> Click to flip</div>
                </div>
                {/* Back */}
                <div className="w-full h-full absolute backface-hidden bg-[#003366] text-white rounded-3xl flex flex-col items-center justify-center p-10 shadow-lg" style={{ transform: 'rotateX(180deg)' }}>
                  <h3 className="text-2xl font-bold mb-5 text-center">{card.definition}</h3>
                  {card.example && <p className="text-lg text-blue-200 text-center italic leading-relaxed">"{card.example}"</p>}
                </div>
              </div>
            </div>

            <div className="flex gap-4 mt-10">
              <button onClick={() => { setVocabCardIndex(Math.max(0, vocabCardIndex - 1)); setIsFlipped(false); }} disabled={vocabCardIndex === 0} className="px-8 py-4 rounded-full border border-slate-300 bg-white text-[#003366] font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors">Prev</button>
              <button onClick={() => { setVocabCardIndex(Math.min(vocabSet.cards.length - 1, vocabCardIndex + 1)); setIsFlipped(false); }} disabled={vocabCardIndex === vocabSet.cards.length - 1} className="px-8 py-4 rounded-full bg-[#003366] text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#002244] transition-colors">Next</button>
            </div>
          </div>
        </div>
      );
    }

    if (view === 'VOCAB_LEARN') {
      if (!learnQ) return null;
      return (
        <div className="flex flex-col h-full animate-fade-in-up">
          {renderPageHeader(`Learn Mode (${learnStats.correct}/${learnStats.total})`, true, () => setView('VOCAB_HOME'))}
          <div className="max-w-3xl mx-auto w-full mt-6">
            <div className="bg-white p-10 rounded-3xl shadow-sm mb-8 border border-slate-200">
              <h3 className="text-slate-500 text-sm uppercase tracking-wider mb-5 font-bold">Definition</h3>
              <p className="text-[#003366] text-2xl font-bold m-0 leading-relaxed">{learnQ.card.definition}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {learnQ.options.map(opt => (
                <button key={opt} onClick={() => handleLearnAnswer(opt)} className="p-6 bg-white border-2 border-slate-200 rounded-2xl text-lg font-bold text-slate-700 cursor-pointer hover:border-[#003366] transition-colors text-center shadow-sm">
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (view === 'VOCAB_MATCH') {
      return (
        <div className="flex flex-col h-full animate-fade-in-up">
          {renderPageHeader(`Match Mode`, true, () => setView('VOCAB_HOME'))}
          <div className="max-w-5xl mx-auto w-full mt-6">
            {matchItems.every(i => i.matched) ? (
              <div className="text-center p-16 bg-white rounded-3xl shadow-sm border border-green-100">
                <h2 className="text-green-600 text-4xl font-extrabold mb-6">Tuyệt vời!</h2>
                <button onClick={initMatchMode} className="px-10 py-4 bg-[#003366] text-white rounded-full font-bold text-lg hover:-translate-y-1 transition-transform shadow-lg">Chơi lại</button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {matchItems.map(item => (
                  <div
                    key={item.id}
                    onClick={() => handleMatchClick(item)}
                    className={`p-6 bg-white rounded-2xl flex items-center justify-center text-center min-h-[120px] shadow-sm transition-all duration-200 ${matchSelected?.id === item.id ? 'border-4 border-sky-500' : 'border border-slate-200'} ${item.matched ? 'opacity-0 pointer-events-none' : 'cursor-pointer hover:border-sky-300'}`}
                  >
                    <span className={`${item.type === 'term' ? 'text-xl font-extrabold' : 'text-base font-bold'} text-[#003366]`}>{item.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }
  }

  // 3. RENDER QUIZ (BÀI KIỂM TRA)
  if (isSubmitted) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] animate-fade-in-up">
        <div className="mb-6"><SvgIcons.CheckBig /></div>
        <h2 className="font-extrabold m-0 mb-3 text-2xl text-[#003366]">Đã nộp bài thành công!</h2>
        <p className="text-slate-500 text-center max-w-md leading-relaxed">Kết quả của bạn đã được gửi đến giáo viên. Vui lòng trở về Dashboard hoặc đợi giáo viên thông báo kết quả.</p>
        <button onClick={() => navigate('/student/dashboard')} className="mt-8 px-8 py-3 rounded-full bg-white border border-slate-300 font-bold text-[#003366] hover:bg-slate-50 transition-colors shadow-sm">Về trang Tổng quan</button>
      </div>
    );
  }

  const isTeacherPaced = sessionInfo?.mode === 'Teacher Paced';
  const isInstantFeedback = sessionInfo?.mode === 'Instant Feedback';
  const requiresLocking = isInstantFeedback || isTeacherPaced;
  const currentQuestionIndex = sessionInfo?.currentQuestionIndex || 0;
  const showFeedback = sessionInfo?.settings?.showFeedback;
  let globalQuestionIndex = 1;

  const sections = shuffledQuiz.sections && shuffledQuiz.sections.length > 0
    ? shuffledQuiz.sections
    : [{ id: 'default', type: shuffledQuiz.quizMode === 'PASSAGE' ? 'PASSAGE' : 'SINGLE', title: shuffledQuiz.passageTitle || 'Quiz Assignment', passageContent: shuffledQuiz.passage }];

  const renderTextWithGapsQuiz = (text, qId) => {
    if (!text) return null;
    const formattedText = text.replace(/\n/g, '<br/>');
    const parts = formattedText.split(/\[(\d+)\]/g);
    const isLocked = lockedQuestions[qId];

    return (
      <div className="leading-[2.4] text-[15px] text-slate-700">
        {parts.map((part, index) => {
          if (index % 2 === 1) {
            return (
              <input
                key={index} type="text" placeholder={part} value={(localAnswers[qId] && localAnswers[qId][part]) || ''}
                onChange={(e) => handleGapFillChange(qId, part, e.target.value)} disabled={isLocked}
                className={`min-w-[80px] max-w-full mx-1 px-3 py-1 border-none border-b-2 outline-none text-center text-[15px] text-[#003366] font-bold rounded-t-md transition-colors ${isLocked ? 'bg-slate-100 border-slate-300 cursor-not-allowed opacity-80' : 'bg-sky-50 border-slate-300 focus:border-[#003366]'}`}
              />
            );
          }
          return <span key={index} dangerouslySetInnerHTML={{ __html: part }} />;
        })}
      </div>
    );
  };

  return (
    <div className="animate-fade-in-up pb-20">
      {renderPageHeader(shuffledQuiz.title, true, () => setView('DASHBOARD'))}

      <div className="max-w-4xl mx-auto mt-4">

        {sections.map((section) => {
          const targetQ = shuffledQuiz.questions[currentQuestionIndex];
          if (isTeacherPaced && (!targetQ || (section.id !== targetQ.sectionId && !(section.id === 'default' && !targetQ.sectionId)))) return null;

          let secQuestions = (shuffledQuiz.questions || []).filter(q => q.sectionId === section.id || (!q.sectionId && section.id === 'default'));
          if (isTeacherPaced) secQuestions = [targetQ];
          if (secQuestions.length === 0 && !section.passageContent) return null;

          return (
            <div key={section.id} className="mb-12">

              {section.type === 'PASSAGE' && (
                <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm mb-8">
                  <div className="flex items-center gap-2 text-sky-500 mb-4">
                    <SvgIcons.Passage />
                    <span className="font-extrabold text-sm tracking-wider uppercase">Reading Passage</span>
                  </div>
                  <h2 className="text-[#003366] mt-0 mb-6 text-2xl md:text-3xl font-extrabold">{section.title}</h2>
                  <div className="text-slate-700 text-base leading-loose whitespace-pre-wrap text-justify">{section.passageContent}</div>
                </div>
              )}

              {section.type === 'SINGLE' && section.title && section.title !== 'Quiz Assignment' && (
                <h2 className="text-[#003366] text-xl font-extrabold mb-6 border-b-2 border-slate-200 pb-3">{section.title}</h2>
              )}

              <div className="flex flex-col gap-6">
                {secQuestions.map((q) => {
                  const isLocked = lockedQuestions[q.id];
                  const currentQNum = isTeacherPaced ? currentQuestionIndex + 1 : globalQuestionIndex++;

                  return (
                    <div key={q.id} className={`bg-white p-5 md:p-8 rounded-2xl border border-slate-200 shadow-sm transition-opacity ${isLocked ? 'opacity-90' : 'opacity-100'}`}>

                      <div className="flex items-center gap-3 mb-5 flex-wrap">
                        <span className="bg-[#003366] text-white w-8 h-8 rounded-full flex items-center justify-center font-extrabold text-sm">{currentQNum}</span>
                        {q.wordLimit && <span className="bg-slate-100 text-slate-500 text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">NO MORE THAN {q.wordLimit} WORDS</span>}
                        {isLocked && <span className="bg-amber-100 text-amber-600 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1"><SvgIcons.Check /> Đã chốt</span>}
                      </div>

                      {q.optionsList && (
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-5 text-[15px] text-slate-700 whitespace-pre-wrap leading-relaxed">
                          <div className="font-extrabold text-[#003366] mb-2 flex items-center gap-1"><SvgIcons.Info /> Reference List:</div>
                          {q.optionsList}
                        </div>
                      )}

                      {q.text && q.type !== 'GAP_FILL_PARAGRAPH' && <div className="text-base text-[#003366] font-bold mb-6 leading-relaxed" dangerouslySetInnerHTML={{ __html: q.text }} />}

                      {/* XỬ LÝ CÁC DẠNG CÂU HỎI */}
                      {q.type === 'MCQ' && (
                        <div className="flex flex-col gap-3">
                          {(q.displayOptions || []).map((optObj, i) => {
                            const originalIdx = optObj.originalIndex;
                            const isChecked = (localAnswers[q.id] || []).includes(originalIdx);
                            return (
                              <div key={originalIdx} onClick={() => !isLocked && handleToggleMCQ(q.id, originalIdx)} className={`flex items-start p-4 border rounded-xl transition-all duration-200 ${isLocked ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-slate-50'} ${isChecked ? 'border-[#003366] bg-sky-50' : 'border-slate-200 bg-white'}`}>
                                <div className={`mt-1 w-[22px] h-[22px] rounded-md flex items-center justify-center mr-4 shrink-0 border-2 ${isChecked ? 'border-[#003366] bg-[#003366] text-white' : 'border-slate-300 bg-transparent'}`}>{isChecked && <SvgIcons.Check />}</div>
                                <div className={`text-[15px] leading-relaxed flex items-start flex-1 pointer-events-none ${isChecked ? 'font-bold text-[#003366]' : 'font-medium text-slate-700'}`}><span className="font-extrabold mr-2">{String.fromCharCode(65 + i)}.</span><div dangerouslySetInnerHTML={{ __html: optObj.text }} className="flex-1 m-0 p-0" /></div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {q.type === 'EVALUATION' && (
                        <div className="flex flex-col md:flex-row gap-3">
                          {(q.evalType === 'YNNG' ? ['Yes', 'No', 'Not Given'] : ['True', 'False', 'Not Given']).map(opt => {
                            const isSelected = localAnswers[q.id] === opt;
                            return (
                              <div key={opt} onClick={() => !isLocked && handleSimpleAnswer(q.id, opt)} className={`flex-1 text-center p-4 border rounded-xl font-bold transition-all duration-200 ${isLocked ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-slate-50'} ${isSelected ? 'border-[#003366] bg-sky-50 text-[#003366]' : 'border-slate-200 bg-white text-slate-500'}`}>
                                {opt}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {['MATCHING', 'SAQ'].includes(q.type) && (
                        <input type="text" placeholder="Nhập câu trả lời của bạn..." value={localAnswers[q.id] || ''} onChange={(e) => handleSimpleAnswer(q.id, e.target.value)} disabled={isLocked} className={`w-full p-4 rounded-xl border outline-none text-[15px] font-bold transition-colors ${isLocked ? 'bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed' : 'bg-white border-slate-300 text-[#003366] focus:border-[#003366]'}`} />
                      )}

                      {q.type === 'GAP_FILL_DIAGRAM' && (
                        <div className="mb-4">
                          {q.imageUrl && (
                            <div className="relative inline-block max-w-full rounded-xl overflow-hidden border border-slate-300 mb-5 w-full">
                              <img src={q.imageUrl} alt="Diagram" className={`block max-w-full h-auto ${isLocked ? 'opacity-80' : 'opacity-100'}`} />
                              {(q.labels || []).map(lbl => (
                                <div key={lbl.id} className="absolute bg-sky-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-md border-2 border-white" style={{ left: `${lbl.x}%`, top: `${lbl.y}%`, transform: 'translate(-50%, -50%)' }}>{lbl.id}</div>
                              ))}
                            </div>
                          )}
                          {(q.labels && q.labels.length > 0) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {q.labels.map(lbl => (
                                <div key={lbl.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${isLocked ? 'bg-slate-100 border-slate-200' : 'bg-white border-slate-300 focus-within:border-[#003366]'}`}>
                                  <span className="bg-sky-500 text-white w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm shrink-0">{lbl.id}</span>
                                  <input type="text" placeholder={`Nhập đáp án nhãn ${lbl.id}...`} value={(localAnswers[q.id] && localAnswers[q.id][lbl.id]) || ''} onChange={(e) => handleGapFillChange(q.id, lbl.id, e.target.value)} disabled={isLocked} className="flex-1 border-none outline-none text-[15px] text-[#003366] font-bold w-full bg-transparent" />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {q.type === 'GAP_FILL_PARAGRAPH' && (
                        <div className="p-5 md:p-6 bg-white rounded-xl border border-slate-200 overflow-x-auto">{renderTextWithGapsQuiz(q.text, q.id)}</div>
                      )}

                      {/* --- NÚT CHỐT ĐÁP ÁN --- */}
                      {requiresLocking && !isLocked && (
                        <div className="flex justify-end mt-5 pt-5 border-t border-dashed border-slate-200">
                          <button
                            onClick={() => handleLockQuestion(q.id)}
                            className="flex items-center gap-2 bg-sky-500 text-white font-bold py-3 px-6 rounded-full cursor-pointer border-none hover:bg-sky-600 transition-colors shadow-sm"
                          >
                            <SvgIcons.Lock /> Chốt đáp án
                          </button>
                        </div>
                      )}

                      {/* --- HIỂN THỊ ĐÁP ÁN ĐÚNG & GIẢI THÍCH KHI ĐÃ CHỐT --- */}
                      {requiresLocking && isLocked && (
                        <div className="mt-5 p-5 bg-sky-50 rounded-xl border border-sky-200 text-sky-800 text-sm leading-relaxed">
                          <div className={`font-extrabold ${showFeedback ? 'mb-3' : 'mb-0'} text-green-700 flex items-center gap-1.5`}>
                            <SvgIcons.Check /> Đáp án đúng: {getCorrectAnswerDisplayForStudent(q)}
                          </div>

                          {showFeedback && (
                            <>
                              <div className="font-extrabold mb-2 flex items-center gap-1.5">
                                <SvgIcons.Info /> Giải thích / Feedback:
                              </div>
                              {q.explanation ? <div dangerouslySetInnerHTML={{ __html: q.explanation }} /> : <div>Không có giải thích chi tiết cho câu hỏi này.</div>}
                            </>
                          )}
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {isTeacherPaced ? (
          <div className="text-center mt-10 p-6 bg-sky-50 rounded-xl border border-sky-200 text-sky-800 font-bold text-[15px] flex flex-col md:flex-row items-center justify-center gap-3 shadow-sm">
            <div className="animate-pulse"><SvgIcons.Wait /></div>
            Chế độ Teacher Paced: Vui lòng đợi giáo viên chuyển sang câu hỏi tiếp theo...
          </div>
        ) : (
          <div className="flex justify-center mt-12 mb-10">
            <button onClick={handleQuizSubmit} className="w-full md:w-auto flex justify-center items-center gap-2 bg-[#003366] text-white font-extrabold py-4 px-10 text-base rounded-full cursor-pointer border-none hover:-translate-y-1 transition-transform shadow-[0_10px_25px_-5px_rgba(0,51,102,0.3)]">
              <SvgIcons.Submit /> Submit Assignment
            </button>
          </div>
        )}
      </div>
    </div>
  );
}