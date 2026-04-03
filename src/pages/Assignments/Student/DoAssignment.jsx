// src/pages/student/DoAssignment.jsx
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from "../../../firebase";
import { useAuth } from '../../../context/AuthContext';

// --- HỆ THỐNG SVG ICONS TỐI GIẢN (Nét mảnh, màu #003366) ---
const SvgIcons = {
  Submit: () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>,
  Wait: () => <svg width="48" height="48" fill="none" stroke="#003366" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>,
  Check: () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>,
  CheckBig: () => <svg width="48" height="48" fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>,
  Passage: () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>,
  LogOut: () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>,
  Info: () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>,
  Lock: () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>,
  Menu: () => <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>,
  Close: () => <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>,
  User: () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>,
  Refresh: () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>,
  Quiz: () => <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>,
  Book: () => <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>,
  Flip: () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"></polyline><polyline points="23 20 23 14 17 14"></polyline><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path></svg>
};

export default function DoAssignment() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  // States chung
  const [view, setView] = useState('DASHBOARD'); // DASHBOARD, QUIZ, VOCAB_HOME, VOCAB_FLASHCARDS, VOCAB_LEARN, VOCAB_MATCH
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Kéo xuống trong function DoAssignment(), thêm dòng này:
  const { currentUser } = useAuth();
  // Lấy email hoặc UID của user đang đăng nhập làm studentId
  const studentId = currentUser?.email?.split('@')[0] || currentUser?.uid || "Unknown";

  // Room & Data States
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

  // Learn Mode States
  const [learnQ, setLearnQ] = useState(null);
  const [learnStats, setLearnStats] = useState({ correct: 0, total: 0 });

  // Match Mode States
  const [matchItems, setMatchItems] = useState([]);
  const [matchSelected, setMatchSelected] = useState(null);
  const [matchStartTime, setMatchStartTime] = useState(null);

  // States cho Menu và Verification
  const [showVerification, setShowVerification] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);

    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('currentStudentId');
    navigate('/student/login');
  };

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
  // LOGIC QUIZ
  // ==========================================
  useEffect(() => {
    if (sessionInfo?.startTime) {
      setIsInitialized(false);
      setLocalAnswers({});
      setLockedQuestions({});
      setCurrentSessionId(null);
      setIsSubmitted(false);
      sessionsRef.current = [];
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

  // --- LOGIC ONE ATTEMPT & KHỞI TẠO PHIÊN (SESSION) ---
  useEffect(() => {
    if (!shuffledQuiz || !sessionInfo || isInitialized) return;

    const initSession = async () => {
      const subRef = doc(db, `rooms/${roomId}/submissions`, studentId);
      const subSnap = await getDoc(subRef);
      let prevRaw = {};
      let existingSessions = [];
      let isSub = false;

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

  // Helper hiển thị kết quả đáp án đúng sau khi Chốt
  const getCorrectAnswerDisplayForStudent = (q) => {
    if (q.type === 'MCQ') {
      if (!q.displayOptions) return '';
      const correctLetters = [];
      q.displayOptions.forEach((opt, index) => {
        if ((q.correctOptions || []).includes(opt.originalIndex)) {
          correctLetters.push(String.fromCharCode(65 + index));
        }
      });
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
      const formattedAnswers = {};
      let completedCount = 0;

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
        await setDoc(doc(db, `rooms/${roomId}/submissions`, studentId), { studentId, studentName: studentId, rawAnswers: localAnswers, answers: formattedAnswers, sessions: updatedSessions, lastUpdated: new Date().toISOString() }, { merge: true });
      } catch (error) { console.error(error); }
    };
    const timeoutId = setTimeout(() => { syncAnswers(); }, 800);
    return () => clearTimeout(timeoutId);
  }, [localAnswers, shuffledQuiz, isInitialized, currentSessionId, isSubmitted, roomId, studentId, view]);

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
      await setDoc(doc(db, `rooms/${roomId}/submissions`, studentId), { studentId, studentName: studentId, answers: formattedAnswers, submittedAt: new Date().toISOString(), score: 0 }, { merge: true });
      setIsSubmitted(true);
    } catch (error) { alert("Lỗi nộp bài."); }
  };


  // ==========================================
  // LOGIC VOCABULARY
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
  // RENDERS
  // ==========================================

  // COMPONENT HEADER CÓ LOGO
  const appHeader = (titleText, showBack = false, backAction = null) => (
    <header style={{ backgroundColor: 'white', padding: isMobile ? '16px' : '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 50, borderBottom: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', overflow: 'hidden' }}>
        {showBack && (
          <button onClick={backAction} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#003366', display: 'flex', padding: 0 }}><SvgIcons.Close /></button>
        )}
        <img src="/BA LOGO.png" alt="BA Logo" style={{ height: '32px', objectFit: 'contain', flexShrink: 0 }} />
        <h1 style={{ fontSize: isMobile ? '18px' : '22px', margin: 0, fontWeight: '800', color: '#003366', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{titleText}</h1>
      </div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ position: 'relative' }} ref={menuRef}>
          <button onClick={() => setShowMenu(!showMenu)} style={{ background: 'none', border: 'none', color: '#003366', cursor: 'pointer', display: 'flex', padding: '8px' }}>
            <SvgIcons.Menu />
          </button>

          {showMenu && (
            <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', width: '220px', zIndex: 100, overflow: 'hidden' }}>
              <div style={{ padding: '16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ color: '#94a3b8', display: 'flex' }}><SvgIcons.User /></div>
                <span style={{ fontWeight: '700', color: '#003366', fontSize: '15px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{studentId}</span>
              </div>
              <button onClick={() => { setShowMenu(false); window.location.reload(); }} style={{ width: '100%', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', background: 'none', border: 'none', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', color: '#334155', fontSize: '14px', fontWeight: '600', textAlign: 'left', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                <span style={{ color: '#64748b', display: 'flex' }}><SvgIcons.Refresh /></span> Refresh
              </button>
              <button onClick={handleLogout} style={{ width: '100%', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '14px', fontWeight: '600', textAlign: 'left', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fef2f2'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                <span style={{ color: '#ef4444', display: 'flex' }}><SvgIcons.LogOut /></span> Log Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );

  const verificationModal = showVerification && (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 99999, paddingTop: '10vh', paddingLeft: '15px', paddingRight: '15px' }}>
      <div style={{ backgroundColor: 'white', borderRadius: '12px', width: '100%', maxWidth: '380px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <h2 style={{ margin: 0, color: '#64748b', fontSize: '18px', fontWeight: '500' }}>Login Verification</h2>
          <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', display: 'flex', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#ef4444'} onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}><SvgIcons.Close /></button>
        </div>
        <div style={{ padding: '24px 20px' }}>
          <p style={{ fontSize: '16px', color: '#334155', margin: '0 0 24px 0' }}>Are you <span style={{ fontWeight: '700', color: '#003366' }}>{studentId}</span>?</p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => setShowVerification(false)} style={{ flex: 1, backgroundColor: '#003366', color: 'white', border: 'none', padding: '12px', borderRadius: '6px', fontWeight: '700', cursor: 'pointer', fontSize: '14px', boxShadow: '0 2px 4px rgba(0,51,102,0.2)', transition: 'background 0.2s' }}>YES</button>
            <button onClick={handleLogout} style={{ flex: 1, backgroundColor: 'white', color: '#003366', border: '1px solid #003366', padding: '12px', borderRadius: '6px', fontWeight: '700', cursor: 'pointer', fontSize: '14px', transition: 'background 0.2s' }}>NO</button>
          </div>
        </div>
      </div>
    </div>
  );

  // RENDER TÙY CHỌN (DASHBOARD)
  if (view === 'DASHBOARD') {
    if (!quiz && !vocabSet) {
      return (
        <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          {verificationModal} {appHeader(roomId)}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ marginBottom: '24px', animation: 'pulse 2s infinite' }}><SvgIcons.Wait /></div>
            <h2 style={{ fontWeight: '800', margin: '0 0 12px 0', textAlign: 'center', fontSize: '22px', color: '#003366' }}>Đang chờ giáo viên phát bài...</h2>
          </div>
        </div>
      );
    }
    return (
      <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Josefin Sans', sans-serif" }}>
        {verificationModal} {appHeader(`Hello, ${studentId}`)}
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px', width: '100%', boxSizing: 'border-box' }}>
          <h2 style={{ color: '#003366', textAlign: 'center', marginBottom: '40px', fontSize: '26px', fontWeight: '800' }}>Hôm nay bạn muốn học gì?</h2>
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '20px', justifyContent: 'center' }}>

            {vocabSet && (
              <button onClick={() => setView('VOCAB_HOME')} style={{ flex: 1, backgroundColor: 'white', border: '2px solid #0ea5e9', borderRadius: '20px', padding: '40px 20px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 10px 15px -3px rgba(14,165,233,0.1)' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-5px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                <div style={{ color: '#0ea5e9', marginBottom: '20px', display: 'flex', justifyContent: 'center' }}><SvgIcons.Book /></div>
                <h3 style={{ margin: 0, color: '#003366', fontSize: '22px', fontWeight: '800' }}>Ôn Từ Vựng</h3>
                <p style={{ color: '#64748b', fontSize: '14px', marginTop: '10px' }}>{vocabSet.title}</p>
              </button>
            )}

            {quiz && (
              <button onClick={() => setView('QUIZ')} style={{ flex: 1, backgroundColor: 'white', border: '2px solid #e67e22', borderRadius: '20px', padding: '40px 20px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 10px 15px -3px rgba(230,126,34,0.1)' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-5px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                <div style={{ color: '#e67e22', marginBottom: '20px', display: 'flex', justifyContent: 'center' }}><SvgIcons.Quiz /></div>
                <h3 style={{ margin: 0, color: '#003366', fontSize: '22px', fontWeight: '800' }}>Làm bài Quiz</h3>
                <p style={{ color: '#64748b', fontSize: '14px', marginTop: '10px' }}>{shuffledQuiz?.title || quiz.title}</p>
              </button>
            )}

          </div>
        </div>
      </div>
    );
  }

  // RENDER VOCABULARY SYSTEM
  if (view.startsWith('VOCAB')) {
    if (view === 'VOCAB_HOME') {
      return (
        <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Josefin Sans', sans-serif" }}>
          {appHeader('Vocabulary', true, () => setView('DASHBOARD'))}
          <div style={{ maxWidth: '600px', margin: '0 auto', padding: '40px 20px', width: '100%', boxSizing: 'border-box', textAlign: 'center' }}>
            <h2 style={{ color: '#003366', fontSize: '28px', fontWeight: '800', marginBottom: '10px' }}>{vocabSet.title}</h2>
            <p style={{ color: '#64748b', marginBottom: '40px', fontWeight: '600' }}>{vocabSet.cards.length} terms</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <button onClick={() => setView('VOCAB_FLASHCARDS')} style={{ padding: '20px', backgroundColor: 'white', border: '1px solid #cbd5e1', borderRadius: '16px', fontSize: '18px', fontWeight: '700', color: '#003366', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.borderColor = '#003366'} onMouseLeave={e => e.currentTarget.style.borderColor = '#cbd5e1'}>Flashcards</button>
              <button onClick={() => { initLearnMode(); setView('VOCAB_LEARN'); }} style={{ padding: '20px', backgroundColor: '#003366', border: 'none', borderRadius: '16px', fontSize: '18px', fontWeight: '700', color: 'white', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(0,51,102,0.2)', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#002244'} onMouseLeave={e => e.currentTarget.style.backgroundColor = '#003366'}>Learn Mode</button>
              <button onClick={() => { initMatchMode(); setView('VOCAB_MATCH'); }} style={{ padding: '20px', backgroundColor: 'white', border: '2px solid #003366', borderRadius: '16px', fontSize: '18px', fontWeight: '700', color: '#003366', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f0f9ff'; }} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}>Match Mode</button>
            </div>
          </div>
        </div>
      );
    }

    if (view === 'VOCAB_FLASHCARDS') {
      const card = vocabSet.cards[vocabCardIndex];
      return (
        <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Josefin Sans', sans-serif" }}>
          {appHeader(`${vocabCardIndex + 1} / ${vocabSet.cards.length}`, true, () => setView('VOCAB_HOME'))}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>

            <div
              onClick={() => setIsFlipped(!isFlipped)}
              style={{ width: '100%', maxWidth: '600px', height: '400px', perspective: '1000px', cursor: 'pointer' }}
            >
              <div style={{ width: '100%', height: '100%', position: 'relative', transition: 'transform 0.6s', transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateX(180deg)' : 'rotateX(0deg)' }}>
                {/* Front */}
                <div style={{ width: '100%', height: '100%', position: 'absolute', backfaceVisibility: 'hidden', backgroundColor: 'white', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
                  <h2 style={{ fontSize: '40px', color: '#003366', fontWeight: '800', textAlign: 'center', padding: '20px' }}>{card.term}</h2>
                  <div style={{ position: 'absolute', bottom: '20px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: '600' }}><SvgIcons.Flip /> Click to flip</div>
                </div>
                {/* Back */}
                <div style={{ width: '100%', height: '100%', position: 'absolute', backfaceVisibility: 'hidden', backgroundColor: '#003366', color: 'white', borderRadius: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', boxSizing: 'border-box', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2)', transform: 'rotateX(180deg)' }}>
                  <h3 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '20px', textAlign: 'center' }}>{card.definition}</h3>
                  {card.example && <p style={{ fontSize: '16px', color: '#cbd5e1', textAlign: 'center', fontStyle: 'italic', lineHeight: '1.6' }}>"{card.example}"</p>}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '20px', marginTop: '40px' }}>
              <button onClick={() => { setVocabCardIndex(Math.max(0, vocabCardIndex - 1)); setIsFlipped(false); }} disabled={vocabCardIndex === 0} style={{ padding: '16px 32px', borderRadius: '100px', border: '1px solid #cbd5e1', background: 'white', color: '#003366', fontWeight: '700', cursor: vocabCardIndex === 0 ? 'not-allowed' : 'pointer', opacity: vocabCardIndex === 0 ? 0.5 : 1 }}>Prev</button>
              <button onClick={() => { setVocabCardIndex(Math.min(vocabSet.cards.length - 1, vocabCardIndex + 1)); setIsFlipped(false); }} disabled={vocabCardIndex === vocabSet.cards.length - 1} style={{ padding: '16px 32px', borderRadius: '100px', border: 'none', background: '#003366', color: 'white', fontWeight: '700', cursor: vocabCardIndex === vocabSet.cards.length - 1 ? 'not-allowed' : 'pointer', opacity: vocabCardIndex === vocabSet.cards.length - 1 ? 0.5 : 1 }}>Next</button>
            </div>
          </div>
        </div>
      );
    }

    if (view === 'VOCAB_LEARN') {
      if (!learnQ) return null;
      return (
        <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Josefin Sans', sans-serif" }}>
          {appHeader(`Learn Mode (${learnStats.correct}/${learnStats.total})`, true, () => setView('VOCAB_HOME'))}
          <div style={{ maxWidth: '700px', margin: '0 auto', padding: '40px 20px', width: '100%', boxSizing: 'border-box' }}>
            <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '24px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)', marginBottom: '30px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ color: '#64748b', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '20px' }}>Definition</h3>
              <p style={{ color: '#003366', fontSize: '24px', fontWeight: '700', margin: 0 }}>{learnQ.card.definition}</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
              {learnQ.options.map(opt => (
                <button key={opt} onClick={() => handleLearnAnswer(opt)} style={{ padding: '24px', backgroundColor: 'white', border: '2px solid #cbd5e1', borderRadius: '16px', fontSize: '18px', fontWeight: '700', color: '#334155', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center' }} onMouseEnter={e => e.currentTarget.style.borderColor = '#003366'} onMouseLeave={e => e.currentTarget.style.borderColor = '#cbd5e1'}>
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
        <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Josefin Sans', sans-serif" }}>
          {appHeader(`Match Mode`, true, () => setView('VOCAB_HOME'))}
          <div style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 20px', width: '100%', boxSizing: 'border-box' }}>
            {matchItems.every(i => i.matched) ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: 'white', borderRadius: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <h2 style={{ color: '#15803d', fontSize: '32px', fontWeight: '800' }}>Tuyệt vời!</h2>
                <button onClick={initMatchMode} style={{ marginTop: '20px', padding: '16px 40px', backgroundColor: '#003366', color: 'white', border: 'none', borderRadius: '100px', fontWeight: '700', fontSize: '18px', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>Chơi lại</button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: '16px' }}>
                {matchItems.map(item => (
                  <div
                    key={item.id}
                    onClick={() => handleMatchClick(item)}
                    style={{
                      padding: '24px', backgroundColor: 'white', borderRadius: '16px', cursor: item.matched ? 'default' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', minHeight: '100px',
                      border: matchSelected?.id === item.id ? '3px solid #0ea5e9' : '1px solid #cbd5e1',
                      opacity: item.matched ? 0 : 1, pointerEvents: item.matched ? 'none' : 'auto',
                      transition: 'all 0.2s', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                      fontSize: item.type === 'term' ? '20px' : '15px', fontWeight: item.type === 'term' ? '800' : '600', color: '#003366'
                    }}
                  >
                    {item.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }
  }

  // ==========================================
  // RENDER QUIZ 
  // ==========================================
  if (isSubmitted) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', color: '#003366', padding: '20px', fontFamily: "'Josefin Sans', sans-serif" }}>
        <div style={{ marginBottom: '24px' }}><SvgIcons.CheckBig /></div>
        <h2 style={{ fontWeight: '800', margin: '0 0 12px 0', fontSize: '22px' }}>Đã nộp bài thành công!</h2>
        <p style={{ color: '#64748b', textAlign: 'center', maxWidth: '400px', lineHeight: '1.6' }}>Kết quả của bạn đã được gửi đến giáo viên. Vui lòng giữ nguyên màn hình và chờ hoạt động tiếp theo.</p>
        <button onClick={() => setView('DASHBOARD')} style={{ marginTop: '30px', padding: '12px 24px', borderRadius: '100px', backgroundColor: 'white', border: '1px solid #cbd5e1', fontWeight: '700', cursor: 'pointer', color: '#003366', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}>Quay lại Trang chủ</button>
      </div>
    );
  }

  const isTeacherPaced = sessionInfo?.mode === 'Teacher Paced';
  const isInstantFeedback = sessionInfo?.mode === 'Instant Feedback';

  // Xác định câu hỏi nào cần hiển thị Nút "Chốt đáp án"
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
      <div style={{ lineHeight: '2.4', fontSize: '15px', color: '#334155' }}>
        {parts.map((part, index) => {
          if (index % 2 === 1) {
            return (
              <input
                key={index} type="text" placeholder={part} value={(localAnswers[qId] && localAnswers[qId][part]) || ''}
                onChange={(e) => handleGapFillChange(qId, part, e.target.value)} disabled={isLocked}
                style={{ minWidth: '80px', maxWidth: '100%', margin: '0 6px', padding: '6px 12px', border: 'none', borderBottom: '2px solid #cbd5e1', outline: 'none', textAlign: 'center', fontSize: '15px', color: '#003366', fontWeight: 'bold', backgroundColor: isLocked ? '#f1f5f9' : '#f0f9ff', borderRadius: '6px 6px 0 0', cursor: isLocked ? 'not-allowed' : 'text', opacity: isLocked ? 0.7 : 1 }}
              />
            );
          }
          return <span key={index} dangerouslySetInnerHTML={{ __html: part }} />;
        })}
      </div>
    );
  };

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: '80px', fontFamily: "'Josefin Sans', sans-serif" }}>
      {appHeader(shuffledQuiz.title, true, () => setView('DASHBOARD'))}

      <div style={{ maxWidth: '840px', margin: '0 auto', padding: isMobile ? '20px 15px' : '40px 20px' }}>

        {sections.map((section) => {
          const targetQ = shuffledQuiz.questions[currentQuestionIndex];
          if (isTeacherPaced && (!targetQ || (section.id !== targetQ.sectionId && !(section.id === 'default' && !targetQ.sectionId)))) return null;

          let secQuestions = (shuffledQuiz.questions || []).filter(q => q.sectionId === section.id || (!q.sectionId && section.id === 'default'));
          if (isTeacherPaced) secQuestions = [targetQ];
          if (secQuestions.length === 0 && !section.passageContent) return null;

          return (
            <div key={section.id} style={{ marginBottom: '50px' }}>

              {section.type === 'PASSAGE' && (
                <div style={{ backgroundColor: 'white', padding: isMobile ? '24px' : '32px', borderRadius: '20px', border: '1px solid #cbd5e1', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)', marginBottom: '30px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#0ea5e9', marginBottom: '16px' }}>
                    <SvgIcons.Passage />
                    <span style={{ fontWeight: '800', fontSize: '14px', letterSpacing: '1px', textTransform: 'uppercase' }}>Reading Passage</span>
                  </div>
                  <h2 style={{ color: '#003366', marginTop: 0, marginBottom: '24px', fontSize: isMobile ? '22px' : '26px', fontWeight: '800' }}>{section.title}</h2>
                  <div style={{ color: '#334155', fontSize: '16px', lineHeight: '1.8', whiteSpace: 'pre-wrap', textAlign: 'justify' }}>{section.passageContent}</div>
                </div>
              )}

              {section.type === 'SINGLE' && section.title && section.title !== 'Quiz Assignment' && (
                <h2 style={{ color: '#003366', fontSize: '20px', fontWeight: '800', marginBottom: '24px', borderBottom: '2px solid #e2e8f0', paddingBottom: '10px' }}>{section.title}</h2>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {secQuestions.map((q) => {
                  const isLocked = lockedQuestions[q.id];
                  const currentQNum = isTeacherPaced ? currentQuestionIndex + 1 : globalQuestionIndex++;

                  return (
                    <div key={q.id} style={{ backgroundColor: 'white', padding: isMobile ? '20px' : '30px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', opacity: isLocked ? 0.9 : 1 }}>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
                        <span style={{ backgroundColor: '#003366', color: 'white', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '15px' }}>{currentQNum}</span>
                        {q.wordLimit && <span style={{ backgroundColor: '#f1f5f9', color: '#64748b', fontSize: '13px', fontWeight: '700', padding: '4px 12px', borderRadius: '100px', whiteSpace: 'nowrap' }}>NO MORE THAN {q.wordLimit} WORDS</span>}
                        {isLocked && <span style={{ backgroundColor: '#fef3c7', color: '#d97706', fontSize: '13px', fontWeight: '700', padding: '4px 12px', borderRadius: '100px', display: 'flex', alignItems: 'center', gap: '4px' }}><SvgIcons.Check /> Đã chốt</span>}
                      </div>

                      {q.optionsList && (
                        <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #cbd5e1', marginBottom: '20px', fontSize: '15px', color: '#334155', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                          <div style={{ fontWeight: '800', color: '#003366', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}><SvgIcons.Info /> Reference List:</div>
                          {q.optionsList}
                        </div>
                      )}

                      {q.text && q.type !== 'GAP_FILL_PARAGRAPH' && <div style={{ fontSize: '16px', color: '#003366', fontWeight: '700', marginBottom: '24px', lineHeight: '1.6' }} dangerouslySetInnerHTML={{ __html: q.text }} />}

                      {/* XỬ LÝ CÁC DẠNG CÂU HỎI */}
                      {q.type === 'MCQ' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {(q.displayOptions || []).map((optObj, i) => {
                            const originalIdx = optObj.originalIndex;
                            const isChecked = (localAnswers[q.id] || []).includes(originalIdx);
                            return (
                              <div key={originalIdx} onClick={() => !isLocked && handleToggleMCQ(q.id, originalIdx)} style={{ display: 'flex', alignItems: 'flex-start', padding: '16px', border: isChecked ? '2px solid #003366' : '1px solid #e2e8f0', borderRadius: '12px', cursor: isLocked ? 'not-allowed' : 'pointer', backgroundColor: isChecked ? '#f0f9ff' : 'white', transition: 'all 0.2s', color: '#334155' }}>
                                <div style={{ marginTop: '2px', width: '22px', height: '22px', borderRadius: '6px', border: isChecked ? 'none' : '2px solid #cbd5e1', backgroundColor: isChecked ? '#003366' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '16px', flexShrink: 0 }}><SvgIcons.Check /></div>
                                <div style={{ fontSize: '15px', fontWeight: isChecked ? '700' : '500', lineHeight: '1.6', pointerEvents: 'none', display: 'flex', alignItems: 'flex-start', flex: 1 }}><span style={{ fontWeight: '800', marginRight: '8px' }}>{String.fromCharCode(65 + i)}.</span><div dangerouslySetInnerHTML={{ __html: optObj.text }} style={{ flex: 1, margin: 0, padding: 0 }} /></div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {q.type === 'EVALUATION' && (
                        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '12px' }}>
                          {(q.evalType === 'YNNG' ? ['Yes', 'No', 'Not Given'] : ['True', 'False', 'Not Given']).map(opt => {
                            const isSelected = localAnswers[q.id] === opt;
                            return (
                              <div key={opt} onClick={() => !isLocked && handleSimpleAnswer(q.id, opt)} style={{ flex: 1, textAlign: 'center', padding: '16px', border: isSelected ? '2px solid #003366' : '1px solid #e2e8f0', borderRadius: '12px', cursor: isLocked ? 'not-allowed' : 'pointer', fontWeight: '700', color: isSelected ? '#003366' : '#64748b', backgroundColor: isSelected ? '#f0f9ff' : 'white' }}>
                                {opt}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {['MATCHING', 'SAQ'].includes(q.type) && (
                        <input type="text" placeholder="Nhập câu trả lời của bạn..." value={localAnswers[q.id] || ''} onChange={(e) => handleSimpleAnswer(q.id, e.target.value)} disabled={isLocked} style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '15px', color: '#003366', fontWeight: '600', boxSizing: 'border-box', backgroundColor: isLocked ? '#f1f5f9' : '#f8fafc' }} />
                      )}

                      {q.type === 'GAP_FILL_DIAGRAM' && (
                        <div style={{ marginBottom: '15px' }}>
                          {q.imageUrl && (
                            <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', borderRadius: '12px', overflow: 'hidden', border: '1px solid #cbd5e1', marginBottom: '20px', width: '100%' }}>
                              <img src={q.imageUrl} alt="Diagram" style={{ display: 'block', maxWidth: '100%', height: 'auto', opacity: isLocked ? 0.8 : 1 }} />
                              {(q.labels || []).map(lbl => (
                                <div key={lbl.id} style={{ position: 'absolute', left: `${lbl.x}%`, top: `${lbl.y}%`, transform: 'translate(-50%, -50%)', background: '#0ea5e9', color: 'white', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>{lbl.id}</div>
                              ))}
                            </div>
                          )}
                          {(q.labels && q.labels.length > 0) && (
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
                              {q.labels.map(lbl => (
                                <div key={lbl.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: isLocked ? '#f1f5f9' : 'white', padding: '10px 16px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                                  <span style={{ backgroundColor: '#0ea5e9', color: 'white', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '13px', flexShrink: 0 }}>{lbl.id}</span>
                                  <input type="text" placeholder={`Nhập đáp án nhãn ${lbl.id}...`} value={(localAnswers[q.id] && localAnswers[q.id][lbl.id]) || ''} onChange={(e) => handleGapFillChange(q.id, lbl.id, e.target.value)} disabled={isLocked} style={{ flex: 1, border: 'none', outline: 'none', fontSize: '15px', color: '#003366', fontWeight: '600', width: '100%', minWidth: '0', backgroundColor: 'transparent' }} />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {q.type === 'GAP_FILL_PARAGRAPH' && (
                        <div style={{ padding: isMobile ? '16px' : '24px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #cbd5e1', overflowX: 'auto' }}>{renderTextWithGapsQuiz(q.text, q.id)}</div>
                      )}

                      {/* --- NÚT CHỐT ĐÁP ÁN --- */}
                      {requiresLocking && !isLocked && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed #e2e8f0' }}>
                          <button
                            onClick={() => handleLockQuestion(q.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#0ea5e9', color: 'white', fontWeight: '700', padding: '10px 20px', borderRadius: '100px', cursor: 'pointer', border: 'none', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(14,165,233,0.2)' }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#0284c7'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#0ea5e9'}
                          >
                            <SvgIcons.Lock /> Chốt đáp án
                          </button>
                        </div>
                      )}

                      {/* --- HIỂN THỊ ĐÁP ÁN ĐÚNG & GIẢI THÍCH KHI ĐÃ CHỐT --- */}
                      {requiresLocking && isLocked && (
                        <div style={{ marginTop: '20px', padding: '16px', backgroundColor: '#f0f9ff', borderRadius: '12px', border: '1px solid #bae6fd', color: '#0369a1', fontSize: '14px', lineHeight: '1.6' }}>
                          <div style={{ fontWeight: '800', marginBottom: showFeedback ? '12px' : '0', color: '#15803d', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <SvgIcons.Check /> Đáp án đúng: {getCorrectAnswerDisplayForStudent(q)}
                          </div>

                          {showFeedback && (
                            <>
                              <div style={{ fontWeight: '800', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
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
          <div style={{ textAlign: 'center', marginTop: '40px', padding: '20px', backgroundColor: '#e0f2fe', borderRadius: '12px', border: '1px solid #bae6fd', color: '#0369a1', fontWeight: '700', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <div style={{ animation: 'pulse 2s infinite' }}><SvgIcons.Wait /></div>
            Chế độ Teacher Paced: Vui lòng đợi giáo viên chuyển sang câu hỏi tiếp theo...
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '50px' }}>
            <button onClick={handleQuizSubmit} style={{ width: isMobile ? '100%' : 'auto', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', backgroundColor: '#003366', color: 'white', fontWeight: '800', padding: '16px 40px', fontSize: '16px', borderRadius: '100px', cursor: 'pointer', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,51,102,0.3)', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
              <SvgIcons.Submit /> Submit Assignment
            </button>
          </div>
        )}
      </div>
    </div>
  );
}