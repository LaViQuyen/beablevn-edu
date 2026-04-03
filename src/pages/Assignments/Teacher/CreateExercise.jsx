// src/pages/teacher/CreateExercise.jsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from "../../../firebase";
import Button from '../../../components/Layouts/Button';
import Input from '../../../components/Layouts/Input';

// --- HỆ THỐNG SVG ICONS TỐI GIẢN (Nét mảnh, màu #003366) ---
const SvgIcons = {
  Trash: () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"/></svg>,
  Plus: () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>,
  Question: () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r="0.75"/><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/></svg>,
  Image: () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
  Back: () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>,
  Checklist: () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>,
  Single: () => <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="9" x2="15" y2="9"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>,
  Passage: () => <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>,
  Combined: () => <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="18" rx="1" ry="1"></rect><rect x="13" y="3" width="8" height="8" rx="1" ry="1"></rect><rect x="13" y="13" width="8" height="8" rx="1" ry="1"></rect></svg>,
  Magic: () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>,
  Info: () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>,
  Bold: () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path></svg>,
  Italic: () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="19" y1="4" x2="10" y2="4"></line><line x1="14" y1="20" x2="5" y2="20"></line><line x1="15" y1="4" x2="9" y2="20"></line></svg>,
  Underline: () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"></path><line x1="4" y1="21" x2="20" y2="21"></line></svg>
};

// --- COMPONENT: TRÌNH SOẠN THẢO VĂN BẢN (RICH TEXT INPUT) ---
const RichTextInput = ({ label, value, onChange, placeholder, minHeight = '60px' }) => {
  const editorRef = useRef(null);

  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const handleCommand = (cmd, e) => {
    e.preventDefault(); 
    document.execCommand(cmd, false, null);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
      {label && <label style={{ fontWeight: '700', fontSize: '13px', color: '#003366', display: 'block' }}>{label}</label>}
      <div style={{ border: '1px solid #cbd5e1', borderRadius: '12px', overflow: 'hidden', backgroundColor: 'white', transition: 'border-color 0.2s' }}>
        
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: '8px', padding: '8px 16px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
          <button onMouseDown={(e) => handleCommand('bold', e)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#003366', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="In đậm"><SvgIcons.Bold /></button>
          <button onMouseDown={(e) => handleCommand('italic', e)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#003366', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="In nghiêng"><SvgIcons.Italic /></button>
          <button onMouseDown={(e) => handleCommand('underline', e)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#003366', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Gạch dưới"><SvgIcons.Underline /></button>
        </div>
        
        {/* Editor Area */}
        <div
          className="rich-text-editor"
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onBlur={handleInput}
          style={{ padding: '12px 16px', minHeight: minHeight, outline: 'none', fontSize: '15px', color: '#334155', lineHeight: '1.6' }}
          data-placeholder={placeholder}
        />
      </div>
    </div>
  );
};

// --- DANH SÁCH DẠNG CÂU HỎI ĐÃ PHÂN TÁCH LOGIC ---
const SINGLE_QUESTION_TYPES = {
  MCQ: 'Multiple Choice',
  GAP_FILL_PARAGRAPH: 'Gap Fill (Text/Paragraph)',
  GAP_FILL_DIAGRAM: 'Gap Fill (Diagram)',
  SAQ: 'Short Answer Questions'
};

const PASSAGE_QUESTION_TYPES = {
  MCQ: 'Multiple Choice',
  EVALUATION: 'Statement Evaluation (TFNG/YNNG)',
  MATCHING: 'Matching (Headings, Features, Endings)',
  GAP_FILL_PARAGRAPH: 'Gap Fill (Summary, Table, Notes)',
  GAP_FILL_DIAGRAM: 'Gap Fill (Diagram)',
  SAQ: 'Short Answer Questions'
};

// --- COMPONENT FOOTER CHO TỪNG SECTION ---
const SectionFooter = ({ section, onAddQuestion, isMobile }) => {
  const allowedTypes = section.type === 'SINGLE' ? SINGLE_QUESTION_TYPES : PASSAGE_QUESTION_TYPES;
  const [qType, setQType] = useState('MCQ');

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '12px', marginTop: '20px', borderTop: '1px dashed #cbd5e1', paddingTop: '20px' }}>
      <select 
        value={qType} 
        onChange={e => setQType(e.target.value)} 
        style={{ flex: 1, padding: '12px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: '600', color: '#334155', outline: 'none', backgroundColor: '#f8fafc', appearance: 'none', cursor: 'pointer' }}
      >
        <optgroup label="Chọn Dạng Câu Hỏi">
          {Object.entries(allowedTypes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </optgroup>
      </select>
      <button 
        onClick={() => onAddQuestion(section.id, qType)} 
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: '#003366', color: 'white', fontWeight: '700', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', transition: 'background 0.2s', width: isMobile ? '100%' : 'auto' }}
      >
        <SvgIcons.Plus /> Thêm câu hỏi
      </button>
    </div>
  );
};

export default function CreateExercise() {
  const navigate = useNavigate();
  const { quizId } = useParams(); 
  const fileInputRef = useRef(null); 
  
  const [quizTitle, setQuizTitle] = useState('');
  const [quizMode, setQuizMode] = useState('SINGLE');
  const [sections, setSections] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    
    if (quizId) {
      const fetchQuizData = async () => {
        setIsLoading(true);
        try {
          const docSnap = await getDoc(doc(db, "quizzes", quizId));
          if (docSnap.exists()) {
            const data = docSnap.data();
            setQuizTitle(data.title || '');
            setQuizMode(data.quizMode || 'SINGLE');
            
            if (data.sections) {
              setSections(data.sections);
              setQuestions(data.questions || []);
            } else {
              const defaultSecId = 'sec_' + Date.now();
              if (data.passage) {
                setSections([{ id: defaultSecId, type: 'PASSAGE', title: data.passageTitle || 'Reading Passage 1', passageContent: data.passage }]);
              } else {
                setSections([{ id: defaultSecId, type: 'SINGLE', title: 'Part 1' }]);
              }
              setQuestions((data.questions || []).map(q => ({ ...q, sectionId: defaultSecId })));
            }
          }
        } catch (error) { console.error("Error:", error); }
        setIsLoading(false);
      };
      fetchQuizData();
    } else {
      setSections([{ id: 'sec_' + Date.now(), type: 'SINGLE', title: 'Part 1' }]);
    }
    return () => window.removeEventListener('resize', handleResize);
  }, [quizId]);

  const handleModeChange = (newMode) => {
    if ((sections.length > 1 || questions.length > 0) && !window.confirm("Đổi chế độ sẽ làm mới cấu trúc câu hỏi hiện tại. Bạn có chắc chắn?")) return;
    setQuizMode(newMode);
    setQuestions([]);
    if (newMode === 'SINGLE') {
      setSections([{ id: 'sec_' + Date.now(), type: 'SINGLE', title: 'Part 1' }]);
    } else if (newMode === 'PASSAGE') {
      setSections([{ id: 'sec_' + Date.now(), type: 'PASSAGE', title: 'Reading Passage 1', passageContent: '' }]);
    } else {
      setSections([
        { id: 'sec_' + Date.now(), type: 'SINGLE', title: 'Grammar Section' },
        { id: 'sec_' + (Date.now() + 1), type: 'PASSAGE', title: 'Reading Passage 1', passageContent: '' }
      ]);
    }
  };

  const handleImportJSON = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.title) setQuizTitle(data.title);
        if (data.quizMode) setQuizMode(data.quizMode);
        if (data.sections) setSections(data.sections);
        if (data.questions) setQuestions(data.questions);
      } catch (err) { alert("File JSON không hợp lệ hoặc cấu trúc cũ!"); }
      event.target.value = null;
    };
    reader.readAsText(file);
  };

  const addSection = (type) => {
    const newSec = { 
      id: 'sec_' + Date.now(), 
      type, 
      title: type === 'SINGLE' ? `Section ${sections.length + 1}` : `Reading Passage ${sections.length + 1}`,
      passageContent: ''
    };
    setSections([...sections, newSec]);
  };

  const removeSection = (sectionId) => {
    if(window.confirm("Xóa Section này sẽ xóa toàn bộ câu hỏi bên trong. Tiếp tục?")) {
      setSections(sections.filter(s => s.id !== sectionId));
      setQuestions(questions.filter(q => q.sectionId !== sectionId));
    }
  };

  const updateSection = (id, field, value) => {
    setSections(sections.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const addQuestionToSection = (sectionId, type) => {
    const newQ = { id: Date.now().toString(), sectionId, type, text: '', points: 1, explanation: '' };
    
    switch (type) {
      case 'MCQ':
        newQ.options = ['', '', '', ''];
        newQ.correctOptions = [];
        break;
      case 'EVALUATION':
        newQ.evalType = 'TFNG';
        newQ.correctOption = 'True';
        break;
      case 'MATCHING':
        newQ.optionsList = '';
        newQ.correctMatch = '';
        break;
      case 'GAP_FILL_PARAGRAPH':
        newQ.gaps = [];   
        newQ.wordLimit = 3;
        break;
      case 'GAP_FILL_DIAGRAM':
        newQ.imageUrl = '';
        newQ.labels = []; 
        newQ.wordLimit = 3;
        break;
      case 'SAQ':
        newQ.correctText = '';
        newQ.wordLimit = 3;
        break;
      default:
        break;
    }
    setQuestions([...questions, newQ]);
  };

  const updateQuestion = (id, field, value) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, [field]: value } : q));
  };

  const handleCreateGap = (qId) => {
    const textarea = document.getElementById(`textarea-${qId}`);
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    if (start === end) {
      alert("Vui lòng bôi đen (tô chọn) từ/cụm từ trong đoạn văn để tạo ô trống!");
      return;
    }
    const text = textarea.value;
    const selectedText = text.substring(start, end).trim();
    if (!selectedText) return;

    const q = questions.find(q => q.id === qId);
    const currentGaps = q.gaps || [];
    const newId = currentGaps.length > 0 ? Math.max(...currentGaps.map(g => g.id)) + 1 : 1;

    const newText = text.substring(0, start) + `[${newId}]` + text.substring(end);
    const newGaps = [...currentGaps, { id: newId, answerString: selectedText }];
    
    setQuestions(questions.map(question => question.id === qId ? { ...question, text: newText, gaps: newGaps } : question));
  };

  const removeGap = (qId, gapId) => {
    const q = questions.find(q => q.id === qId);
    const newGaps = (q.gaps || []).filter(g => g.id !== gapId);
    const newText = q.text.replace(new RegExp(`\\[${gapId}\\]`, 'g'), '___'); 
    setQuestions(questions.map(question => question.id === qId ? { ...question, text: newText, gaps: newGaps } : question));
  };

  const handleGapAnswerChange = (qId, gapId, value) => {
    const q = questions.find(q => q.id === qId);
    const newGaps = q.gaps.map(g => g.id === gapId ? { ...g, answerString: value } : g);
    setQuestions(questions.map(question => question.id === qId ? { ...question, gaps: newGaps } : question));
  };

  const handleImageClick = (e, qId) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    const q = questions.find(q => q.id === qId);
    const currentLabels = q.labels || [];
    const newId = currentLabels.length > 0 ? Math.max(...currentLabels.map(l => l.id)) + 1 : 1;
    
    const newLabels = [...currentLabels, { id: newId, x, y, answerString: '' }];
    setQuestions(questions.map(question => question.id === qId ? { ...question, labels: newLabels } : question));
  };

  const removeLabel = (qId, labelId) => {
    const q = questions.find(q => q.id === qId);
    const newLabels = (q.labels || []).filter(l => l.id !== labelId);
    setQuestions(questions.map(question => question.id === qId ? { ...question, labels: newLabels } : question));
  };

  const handleLabelAnswerChange = (qId, labelId, value) => {
    const q = questions.find(q => q.id === qId);
    const newLabels = q.labels.map(l => l.id === labelId ? { ...l, answerString: value } : l);
    setQuestions(questions.map(question => question.id === qId ? { ...question, labels: newLabels } : question));
  };

  const handleSave = async () => {
    if (!quizTitle.trim() || questions.length === 0) return alert("Vui lòng điền tên bài tập và tạo ít nhất 1 câu hỏi!");
    setIsLoading(true);
    try {
      await setDoc(doc(db, "quizzes", quizId || 'q_' + Date.now()), {
        title: quizTitle, 
        quizMode: quizMode,
        sections: sections,
        questions: questions, 
        modified: new Date().toISOString().split('T')[0]
      }, { merge: true });
      alert("Đã lưu bài tập thành công!");
      navigate('/teacher/exercises');
    } catch (error) { alert("Lỗi lưu bài tập!"); }
    setIsLoading(false);
  };

  return (
    <div style={{ paddingBottom: '120px', backgroundColor: '#f8fafc', minHeight: '100vh', padding: isMobile ? '15px' : '30px', fontFamily: "'Josefin Sans', sans-serif" }}>
      
      {/* STYLE RENDER PLACEHOLDER CHO CONTENTEDITABLE */}
      <style>
        {`
          .rich-text-editor:empty:before {
            content: attr(data-placeholder);
            color: #94a3b8;
            pointer-events: none;
            display: block;
          }
          .rich-text-editor p { margin: 0; padding: 0; }
        `}
      </style>

      <div style={{ maxWidth: '900px', margin: '0 auto', paddingBottom: '100px' }}>
        <input type="file" accept=".json" ref={fileInputRef} onChange={handleImportJSON} style={{ display: 'none' }} />
        
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', marginBottom: '30px', gap: '15px' }}>
          <div>
            <button onClick={() => navigate('/teacher/exercises')} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', marginBottom: '8px', fontWeight: '700', fontSize: '14px', padding: 0 }}>
              <SvgIcons.Back /> Quay lại Library
            </button>
            <h2 style={{ color: '#003366', margin: 0, fontSize: isMobile ? '22px' : '28px', fontWeight: '800' }}>
              {quizId ? 'Edit Quiz' : 'Create New Quiz'}
            </h2>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <Button onClick={() => fileInputRef.current.click()} style={{ flex: 1, backgroundColor: 'white', color: '#003366', border: '1px solid #cbd5e1', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', fontWeight: '700' }}>Import JSON</Button>
            <Button onClick={handleSave} disabled={isLoading} style={{ flex: 1, backgroundColor: '#003366', color: 'white', boxShadow: '0 4px 6px -1px rgba(0,51,102,0.2)', fontWeight: '700' }}>{isLoading ? 'Saving...' : 'Save Quiz'}</Button>
          </div>
        </div>

        <div style={{ backgroundColor: 'white', padding: isMobile ? '20px' : '30px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '30px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <Input label="Quiz Title (Tên bài kiểm tra)" value={quizTitle} onChange={e => setQuizTitle(e.target.value)} placeholder="VD: Kiểm tra 15 phút / IELTS Reading Test 1" />
          
          <div>
            <label style={{ display: 'block', fontWeight: '700', color: '#003366', marginBottom: '12px', fontSize: '14px' }}>Chế độ tạo bài (Quiz Mode)</label>
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '15px' }}>
              
              <div onClick={() => handleModeChange('SINGLE')} style={{ flex: 1, padding: '20px', borderRadius: '12px', border: quizMode === 'SINGLE' ? '2px solid #003366' : '1px solid #cbd5e1', backgroundColor: quizMode === 'SINGLE' ? '#f0f9ff' : 'white', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', gap: '12px' }}>
                <div style={{ color: quizMode === 'SINGLE' ? '#003366' : '#94a3b8' }}><SvgIcons.Single /></div>
                <div>
                  <div style={{ fontWeight: '800', color: '#003366', marginBottom: '4px', fontSize: '15px' }}>Single Question</div>
                  <div style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.4' }}>Tạo các nhóm câu hỏi độc lập (Grammar/Vocab). Không kèm bài đọc dài.</div>
                </div>
              </div>

              <div onClick={() => handleModeChange('PASSAGE')} style={{ flex: 1, padding: '20px', borderRadius: '12px', border: quizMode === 'PASSAGE' ? '2px solid #003366' : '1px solid #cbd5e1', backgroundColor: quizMode === 'PASSAGE' ? '#f0f9ff' : 'white', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', gap: '12px' }}>
                <div style={{ color: quizMode === 'PASSAGE' ? '#003366' : '#94a3b8' }}><SvgIcons.Passage /></div>
                <div>
                  <div style={{ fontWeight: '800', color: '#003366', marginBottom: '4px', fontSize: '15px' }}>Reading Passage</div>
                  <div style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.4' }}>Tạo một hoặc nhiều bài đọc (IELTS Style) kèm câu hỏi liên quan.</div>
                </div>
              </div>

              <div onClick={() => handleModeChange('COMBINED')} style={{ flex: 1, padding: '20px', borderRadius: '12px', border: quizMode === 'COMBINED' ? '2px solid #003366' : '1px solid #cbd5e1', backgroundColor: quizMode === 'COMBINED' ? '#f0f9ff' : 'white', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', gap: '12px' }}>
                <div style={{ color: quizMode === 'COMBINED' ? '#003366' : '#94a3b8' }}><SvgIcons.Combined /></div>
                <div>
                  <div style={{ fontWeight: '800', color: '#003366', marginBottom: '4px', fontSize: '15px' }}>Combined Mode</div>
                  <div style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.4' }}>Kết hợp cả bài tập trắc nghiệm độc lập và phần thi bài đọc.</div>
                </div>
              </div>

            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          {sections.map((section, sIdx) => {
            const sectionQuestions = questions.filter(q => q.sectionId === section.id);
            const isPassage = section.type === 'PASSAGE';

            return (
              <div key={section.id} style={{ backgroundColor: 'white', padding: isMobile ? '16px' : '30px', borderRadius: '16px', border: isPassage ? '2px solid #003366' : '1px solid #cbd5e1', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)' }}>
                
                <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', marginBottom: '24px', borderBottom: '2px solid #f1f5f9', paddingBottom: '16px', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, width: '100%' }}>
                    <div style={{ color: isPassage ? '#003366' : '#64748b' }}>{isPassage ? <SvgIcons.Passage /> : <SvgIcons.Single />}</div>
                    <input 
                      value={section.title} 
                      onChange={e => updateSection(section.id, 'title', e.target.value)} 
                      placeholder={isPassage ? "Tiêu đề bài đọc (VD: Passage 1)" : "Tiêu đề phần thi (VD: Grammar Section)"}
                      style={{ fontSize: '18px', fontWeight: '800', color: '#003366', border: 'none', outline: 'none', width: '100%', background: 'transparent' }}
                    />
                  </div>
                  <button onClick={() => removeSection(section.id)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '6px', fontWeight: '700', alignSelf: isMobile ? 'flex-end' : 'auto' }} title="Xóa Section">
                    <SvgIcons.Trash />
                  </button>
                </div>

                {isPassage && (
                  <div style={{ marginBottom: '24px', backgroundColor: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', color: '#003366', marginBottom: '12px', fontSize: '14px' }}>
                      <SvgIcons.Checklist /> Passage Content (Nội dung bài đọc)
                    </label>
                    <textarea 
                      placeholder="Nhập hoặc dán nội dung đoạn văn bài đọc vào đây..."
                      value={section.passageContent || ''}
                      onChange={e => updateSection(section.id, 'passageContent', e.target.value)}
                      style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '15px', fontFamily: 'inherit', minHeight: '200px', resize: 'vertical', lineHeight: '1.6', color: '#334155', boxSizing: 'border-box' }}
                    />
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {sectionQuestions.map((q, qIdx) => (
                    <div key={q.id} style={{ backgroundColor: '#f8fafc', padding: isMobile ? '16px' : '24px', borderRadius: '12px', border: '1px solid #e2e8f0', position: 'relative' }}>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontWeight: '800', color: 'white', backgroundColor: '#003366', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px' }}>
                            {qIdx + 1}
                          </span>
                          <span style={{ fontWeight: '700', color: '#334155', fontSize: '14px' }}>
                            {q.type.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <button onClick={() => setQuestions(questions.filter(item => item.id !== q.id))} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                          <SvgIcons.Trash />
                        </button>
                      </div>

                      {/* --- CÁC DẠNG CÂU HỎI --- */}
                      {q.type === 'MCQ' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          <RichTextInput label="Question Prompt (Câu hỏi)" value={q.text} onChange={val => updateQuestion(q.id, 'text', val)} placeholder="Nhập nội dung câu hỏi..." />
                          <div>
                            <label style={{ fontWeight: '700', fontSize: '13px', color: '#003366', display: 'block', marginBottom: '8px' }}>Answer Options (Tick checkbox để thiết lập đáp án đúng):</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              {q.options.map((opt, i) => (
                                <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', backgroundColor: 'white', padding: '12px 16px', borderRadius: '8px', border: q.correctOptions?.includes(i) ? '1px solid #003366' : '1px solid #cbd5e1', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                                  <div style={{ marginTop: '12px' }}>
                                    <input type="checkbox" checked={q.correctOptions?.includes(i)} onChange={e => {
                                      let copy = [...(q.correctOptions || [])];
                                      if (e.target.checked) copy.push(i); else copy = copy.filter(x => x !== i);
                                      updateQuestion(q.id, 'correctOptions', copy);
                                    }} style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#003366' }} />
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <RichTextInput 
                                      value={opt} 
                                      onChange={val => {
                                        let opts = [...q.options]; opts[i] = val; updateQuestion(q.id, 'options', opts);
                                      }} 
                                      placeholder={`Lựa chọn ${String.fromCharCode(65 + i)}`}
                                      minHeight="40px"
                                    />
                                  </div>
                                  {q.options.length > 2 && (
                                    <div style={{ marginTop: '12px' }}>
                                      <button onClick={() => {
                                        const newOpts = q.options.filter((_, idx) => idx !== i);
                                        let newCorrect = (q.correctOptions || []).filter(idx => idx !== i).map(idx => idx > i ? idx - 1 : idx);
                                        updateQuestion(q.id, 'options', newOpts);
                                        updateQuestion(q.id, 'correctOptions', newCorrect);
                                      }} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}>
                                        <SvgIcons.Trash />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ))}
                              <button onClick={() => updateQuestion(q.id, 'options', [...q.options, ''])} style={{ display: 'flex', alignItems: 'center', gap: '6px', alignSelf: 'flex-start', background: 'none', border: '1px dashed #cbd5e1', color: '#003366', fontWeight: '700', fontSize: '13px', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', marginTop: '4px' }}>
                                <SvgIcons.Plus /> Thêm Option
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {q.type === 'EVALUATION' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '15px' }}>
                            <div style={{ flex: 1 }}>
                              <label style={{ fontWeight: '700', fontSize: '13px', color: '#003366', display: 'block', marginBottom: '8px' }}>Loại hình đánh giá</label>
                              <select value={q.evalType || 'TFNG'} onChange={e => { updateQuestion(q.id, 'evalType', e.target.value); updateQuestion(q.id, 'correctOption', e.target.value === 'TFNG' ? 'True' : 'Yes'); }} style={{ padding: '12px 16px', width: '100%', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px', color: '#334155', fontWeight: '600', appearance: 'none', cursor: 'pointer' }}>
                                <option value="TFNG">True / False / Not Given</option>
                                <option value="YNNG">Yes / No / Not Given</option>
                              </select>
                            </div>
                          </div>
                          <RichTextInput label="Question Prompt (Nhận định / Quan điểm)" value={q.text} onChange={val => updateQuestion(q.id, 'text', val)} placeholder="Nhập nhận định..." />
                          <div>
                            <label style={{ fontWeight: '700', fontSize: '13px', color: '#003366', display: 'block', marginBottom: '10px' }}>Chọn đáp án đúng (Radio):</label>
                            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', flexDirection: isMobile ? 'column' : 'row' }}>
                              {(q.evalType === 'YNNG' ? ['Yes', 'No', 'Not Given'] : ['True', 'False', 'Not Given']).map(opt => (
                                <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '600', color: q.correctOption === opt ? '#003366' : '#64748b', padding: '10px 16px', border: q.correctOption === opt ? '1px solid #003366' : '1px solid #cbd5e1', borderRadius: '8px', backgroundColor: 'white' }}>
                                  <input type="radio" name={`eval-${q.id}`} value={opt} checked={q.correctOption === opt} onChange={e => updateQuestion(q.id, 'correctOption', e.target.value)} style={{ accentColor: '#003366', width: '16px', height: '16px' }} />
                                  {opt}
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {q.type === 'MATCHING' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          <div>
                            <label style={{ fontWeight: '700', fontSize: '13px', color: '#003366', marginBottom: '8px', display: 'block' }}>Options List (Danh sách tham chiếu chung - Tùy chọn)</label>
                            <textarea placeholder="Nhập danh sách các lựa chọn để học viên tham chiếu..." value={q.optionsList || ''} onChange={e => updateQuestion(q.id, 'optionsList', e.target.value)} style={{ width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} rows="3" />
                          </div>
                          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '15px' }}>
                            <div style={{ flex: 1 }}><RichTextInput label="Question Prompt (Đoạn văn / Thông tin)" value={q.text} onChange={val => updateQuestion(q.id, 'text', val)} placeholder="Nhập thông tin câu hỏi..." /></div>
                            <div style={{ flex: 1 }}><Input label="Correct Match (Đáp án nối đúng)" value={q.correctMatch || ''} onChange={e => updateQuestion(q.id, 'correctMatch', e.target.value)} /></div>
                          </div>
                        </div>
                      )}

                      {q.type === 'GAP_FILL_PARAGRAPH' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                          <div style={{ backgroundColor: 'white', padding: isMobile ? '16px' : '20px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
                            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', marginBottom: '16px', gap: '10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ color: '#0ea5e9' }}><SvgIcons.Magic /></div>
                                <label style={{ fontWeight: '800', color: '#003366', fontSize: '14px' }}>Text Content / Structure</label>
                              </div>
                              <button onClick={() => handleCreateGap(q.id)} style={{ width: isMobile ? '100%' : 'auto', background: '#f1f5f9', color: '#003366', border: '1px solid #cbd5e1', padding: '10px 16px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}>
                                + Đục lỗ từ bôi đen
                              </button>
                            </div>
                            <textarea id={`textarea-${q.id}`} placeholder="Dán đoạn văn, bảng, sơ đồ. Bôi đen từ cần điền và bấm nút 'Đục lỗ'..." value={q.text || ''} onChange={e => updateQuestion(q.id, 'text', e.target.value)} style={{ width: '100%', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', minHeight: '120px', lineHeight: '1.6', fontSize: '14px' }} />
                            
                            {(q.gaps && q.gaps.length > 0) && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>
                                 <label style={{ fontWeight: '700', fontSize: '13px', color: '#003366' }}>Đáp án cho các ô trống trong text (cách nhau dấu phẩy):</label>
                                 {q.gaps.map(gap => (
                                    <div key={gap.id} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                      <div style={{ padding: '6px 12px', borderRadius: '6px', backgroundColor: '#f1f5f9', color: '#003366', border: '1px solid #cbd5e1', fontWeight: 'bold', fontSize: '13px' }}>[{gap.id}]</div>
                                      <input value={gap.answerString || ''} onChange={(e) => handleGapAnswerChange(q.id, gap.id, e.target.value)} placeholder={`Đáp án cho ô [${gap.id}]...`} style={{ flex: 1, border: 'none', outline: 'none', fontSize: '14px', color: '#334155', width: '100%' }} />
                                      <button onClick={() => removeGap(q.id, gap.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}><SvgIcons.Trash /></button>
                                    </div>
                                 ))}
                              </div>
                            )}
                          </div>
                          <div style={{ width: isMobile ? '100%' : '200px' }}>
                            <Input label="Word Limit (Giới hạn từ)" type="number" value={q.wordLimit || 3} onChange={e => updateQuestion(q.id, 'wordLimit', e.target.value)} />
                          </div>
                        </div>
                      )}

                      {q.type === 'GAP_FILL_DIAGRAM' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                          <RichTextInput label="Question Prompt (Hướng dẫn chung cho hình ảnh)" value={q.text} onChange={val => updateQuestion(q.id, 'text', val)} placeholder="VD: Hãy gắn nhãn cho các bộ phận..." />
                          
                          <div style={{ backgroundColor: 'white', padding: isMobile ? '16px' : '20px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                              <div style={{ color: '#0ea5e9' }}><SvgIcons.Image /></div>
                              <label style={{ fontWeight: '800', color: '#003366', fontSize: '14px' }}>Image URL (Nhập đường dẫn ảnh và click lên ảnh để gắn nhãn)</label>
                            </div>
                            <input type="text" placeholder="https://link-to-your-image.com/diagram.jpg" value={q.imageUrl || ''} onChange={e => updateQuestion(q.id, 'imageUrl', e.target.value)} style={{ width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px', boxSizing: 'border-box', marginBottom: '20px' }} />
                            
                            {q.imageUrl && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ fontSize: '13px', color: '#64748b', fontStyle: 'italic' }}>* Click trực tiếp lên ảnh để ghim nhãn (Label). Các nhãn sẽ tự động được đánh số.</div>
                                <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', border: '2px dashed #cbd5e1', borderRadius: '8px', overflow: 'hidden', alignSelf: 'flex-start', width: '100%' }}>
                                   <img src={q.imageUrl} alt="Diagram" style={{ display: 'block', maxWidth: '100%', cursor: 'crosshair', height: 'auto' }} onClick={(e) => handleImageClick(e, q.id)} />
                                   {(q.labels || []).map(lbl => (
                                      <div key={lbl.id} style={{ position: 'absolute', left: `${lbl.x}%`, top: `${lbl.y}%`, transform: 'translate(-50%, -50%)', background: '#0ea5e9', color: 'white', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 'bold', pointerEvents: 'none', boxShadow: '0 2px 6px rgba(0,0,0,0.3)', border: '2px solid white' }}>{lbl.id}</div>
                                   ))}
                                </div>
                                {(q.labels && q.labels.length > 0) && (
                                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                                    {q.labels.map(lbl => (
                                       <div key={lbl.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: 'white' }}>
                                         <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: '#0ea5e9', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0, fontSize: '12px' }}>{lbl.id}</div>
                                         <input value={lbl.answerString || ''} onChange={(e) => handleLabelAnswerChange(q.id, lbl.id, e.target.value)} placeholder={`Đáp án cho nhãn ${lbl.id}...`} style={{ flex: 1, border: 'none', outline: 'none', fontSize: '14px', color: '#334155', width: '100%' }} />
                                         <button onClick={() => removeLabel(q.id, lbl.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}><SvgIcons.Trash /></button>
                                       </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          
                          <div style={{ width: isMobile ? '100%' : '200px' }}>
                            <Input label="Word Limit (Giới hạn từ)" type="number" value={q.wordLimit || 3} onChange={e => updateQuestion(q.id, 'wordLimit', e.target.value)} />
                          </div>
                        </div>
                      )}

                      {q.type === 'SAQ' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          <RichTextInput label="Question Prompt (Nội dung câu hỏi ngắn)" value={q.text} onChange={val => updateQuestion(q.id, 'text', val)} placeholder="Nhập câu hỏi ngắn..." />
                          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '15px' }}>
                            <div style={{ flex: 1 }}><Input label="Correct Answer (Nhiều đáp án cách nhau bằng dấu phẩy)" value={q.correctText || ''} onChange={e => updateQuestion(q.id, 'correctText', e.target.value)} /></div>
                            <div style={{ width: isMobile ? '100%' : '180px' }}><Input label="Word Limit" type="number" value={q.wordLimit || 3} onChange={e => updateQuestion(q.id, 'wordLimit', e.target.value)} /></div>
                          </div>
                        </div>
                      )}

                      {/* --- KHU VỰC GIẢI THÍCH (EXPLANATION) --- */}
                      <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px dashed #e2e8f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                          <div style={{ color: '#f59e0b' }}><SvgIcons.Question /></div>
                          <label style={{ fontWeight: '800', color: '#003366', fontSize: '14px' }}>Giải thích (Explanation)</label>
                        </div>
                        <p style={{ color: '#64748b', fontSize: '13px', fontStyle: 'italic', marginBottom: '12px' }}>
                          * Nội dung này sẽ hiển thị cho học viên nếu bạn chọn chế độ "Instant Feedback" và bật "Show Question Feedback" lúc Launch.
                        </p>
                        <textarea 
                          placeholder="Nhập giải thích chi tiết cho đáp án..."
                          value={q.explanation || ''}
                          onChange={e => updateQuestion(q.id, 'explanation', e.target.value)}
                          style={{ width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', minHeight: '80px', fontSize: '14px' }}
                        />
                      </div>

                    </div>
                  ))}
                </div>

                <SectionFooter section={section} onAddQuestion={addQuestionToSection} isMobile={isMobile} />
                
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ 
        position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', 
        backgroundColor: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)',
        padding: '12px 20px', borderRadius: '100px', border: '1px solid #e2e8f0', 
        display: 'flex', gap: '12px', alignItems: 'center', zIndex: 100, 
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        width: isMobile ? '90%' : 'auto', boxSizing: 'border-box', flexWrap: 'wrap', justifyContent: 'center'
      }}>
        {(quizMode === 'SINGLE' || quizMode === 'COMBINED') && (
          <button onClick={() => addSection('SINGLE')} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#f1f5f9', color: '#003366', fontWeight: '700', border: '1px solid #cbd5e1', padding: '12px 20px', borderRadius: '100px', cursor: 'pointer', fontSize: '14px', flex: isMobile ? '1 1 auto' : 'none', justifyContent: 'center', whiteSpace: 'nowrap' }}>
            <SvgIcons.Plus /> Nhóm Câu Hỏi
          </button>
        )}
        {(quizMode === 'PASSAGE' || quizMode === 'COMBINED') && (
          <button onClick={() => addSection('PASSAGE')} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#003366', color: 'white', fontWeight: '700', border: 'none', padding: '12px 20px', borderRadius: '100px', cursor: 'pointer', fontSize: '14px', flex: isMobile ? '1 1 auto' : 'none', justifyContent: 'center', whiteSpace: 'nowrap', boxShadow: '0 2px 4px rgba(0,51,102,0.2)' }}>
            <SvgIcons.Plus /> Bài Đọc (Passage)
          </button>
        )}
      </div>
    </div>
  );
}