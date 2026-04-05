// src/pages/teacher/Reports.jsx
import { useState, useEffect } from 'react';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { firestore as db } from "../../../firebase";

// --- HỆ THỐNG SVG ICONS TỐI GIẢN ---
const SvgIcons = {
  Back: () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>,
  Mail: () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>,
  Download: () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>,
  Trash: () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>,
  Archive: () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>,
  Search: () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
};

const Toggle = ({ label, checked, onChange }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => onChange(!checked)}>
    <div style={{ width: '36px', height: '20px', borderRadius: '10px', backgroundColor: checked ? '#003366' : '#cbd5e1', position: 'relative', transition: 'all 0.2s' }}>
      <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'white', position: 'absolute', top: '2px', left: checked ? '18px' : '2px', transition: 'all 0.2s' }} />
    </div>
    <span style={{ fontSize: '14px', color: '#334155', fontWeight: '600' }}>{label}</span>
  </div>
);

// Format Correct Answer Helper
const getCorrectAnswerDisplay = (q) => {
  if (q.type === 'MCQ') return (q.correctOptions || []).map(i => String.fromCharCode(65 + i)).join(', ');
  if (['EVALUATION', 'MATCHING'].includes(q.type)) return q.correctOption || q.correctMatch || '';
  if (q.type === 'SAQ') return q.correctText || '';
  if (q.type.startsWith('GAP_FILL')) {
    const items = q.type === 'GAP_FILL_PARAGRAPH' ? q.gaps : q.labels;
    if (!items || items.length === 0) return '';
    return items.map(item => `[${item.id}]: ${item.answerString}`).join(' | ');
  }
  return '';
};

// Hàm chuyển ảnh thành Base64 để nhúng thẳng vào file HTML (chạy offline vẫn có ảnh)
const getBase64FromUrl = async (url) => {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Failed to load logo for export:', error);
    return null;
  }
};

// --- COMPONENT: REPORT DETAIL VIEW ---
const ReportDetailView = ({ report, onBack }) => {
  const [showNames, setShowNames] = useState(true);
  const [showResponses, setShowResponses] = useState(true);
  const [showResults, setShowResults] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Export Modal States
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportScope, setExportScope] = useState('all');
  const [exportStudents, setExportStudents] = useState([]);
  const [includeAnswers, setIncludeAnswers] = useState(true);
  const [includeExplanations, setIncludeExplanations] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const dateStr = new Date(report.date).toLocaleString('vi-VN');
  const questions = report.questions || [];
  const submissions = report.submissions || [];

  const totalParticipated = submissions.filter(s => s.submitted).length;
  const totalStudents = report.totalStudents || submissions.length || 1;
  const completionRate = Math.round((totalParticipated / totalStudents) * 100) || 0;
  
  const totalScore = submissions.reduce((acc, curr) => acc + (curr.score || 0), 0);
  const avgScore = totalParticipated > 0 ? Math.round(totalScore / totalParticipated) : 0; 
  const passRate = totalParticipated > 0 ? Math.round((submissions.filter(s => s.score >= 50).length / totalParticipated) * 100) : 0; 

  const handleToggleExportStudent = (id) => {
    setExportStudents(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // HÀM XUẤT FILE HTML CHUYÊN SÂU ĐỂ IN (Giống Socrative/Showbie, Tích hợp Logo)
  const handleExportHTML = async () => {
    const studentsToExport = exportScope === 'all' 
      ? submissions.filter(s => s.submitted) 
      : submissions.filter(s => exportStudents.includes(s.studentId) && s.submitted);

    if (studentsToExport.length === 0) {
      alert("Không có dữ liệu học viên để xuất!");
      return;
    }

    setIsExporting(true);

    // Lấy ảnh Logo và chuyển sang Base64
    const logoBase64 = await getBase64FromUrl('/BA LOGO.png');
    const logoHtml = logoBase64 ? `<img src="${logoBase64}" alt="BA Logo" style="height: 65px; object-fit: contain;" />` : '';

    let htmlContent = `
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="UTF-8">
        <title>Report - ${report.name}</title>
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; line-height: 1.6; margin: 0; padding: 0; background: #f4f4f9; }
          .page { max-width: 800px; margin: 20px auto; padding: 40px; background: white; box-shadow: 0 4px 10px rgba(0,0,0,0.1); border-radius: 8px; page-break-after: always; }
          @media print { body { background: white; } .page { margin: 0; padding: 20px; box-shadow: none; border-radius: 0; } }
          h1, h2, h3 { color: #003366; }
          .header-box { border-bottom: 3px solid #003366; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-end; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; font-size: 14px; }
          .session-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 13px; }
          .session-table th, .session-table td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
          .session-table th { background-color: #f1f5f9; color: #003366; }
          .question-box { margin-bottom: 25px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; page-break-inside: avoid; }
          .q-title { font-weight: bold; color: #003366; margin-bottom: 10px; display: flex; justify-content: space-between; }
          .q-text { margin-bottom: 15px; font-size: 15px; }
          .answer-row { display: flex; gap: 10px; align-items: baseline; margin-bottom: 8px; font-size: 14px; }
          .badge { padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 12px; }
          .correct { background: #dcfce7; color: #15803d; border: 1px solid #16a34a; }
          .incorrect { background: #fee2e2; color: #b91c1c; border: 1px solid #dc2626; }
          .explanation-box { margin-top: 15px; padding: 12px; background: #fef3c7; border-left: 4px solid #d97706; font-size: 13.5px; color: #92400e; }
        </style>
      </head>
      <body>
    `;

    studentsToExport.forEach(student => {
      // 1. Tính toán Sessions
      let totalMs = 0;
      let sessionRows = '';
      const sessions = student.sessions || [];

      sessions.forEach((sess, idx) => {
        const start = new Date(sess.loginTime);
        const end = new Date(sess.exitTime);
        const dur = Math.max(0, end - start);
        totalMs += dur;
        
        const m = Math.floor(dur / 60000);
        const s = Math.floor((dur % 60000) / 1000);
        const durStr = `${m}m ${s}s`;

        sessionRows += `
          <tr>
            <td>${idx + 1}</td>
            <td>${start.toLocaleTimeString('vi-VN')}</td>
            <td>${sess.exitTime ? end.toLocaleTimeString('vi-VN') : '--:--'}</td>
            <td>${durStr}</td>
            <td>${sess.completedCount !== undefined ? sess.completedCount + ' câu' : sess.score + '%'}</td>
          </tr>
        `;
      });

      const totalMins = Math.floor(totalMs / 60000);
      const totalSecs = Math.floor((totalMs % 60000) / 1000);
      const totalDurStr = `${totalMins} phút ${totalSecs} giây`;

      // 2. Render Header Sinh Viên với Logo
      htmlContent += `
        <div class="page">
          <div class="header-box">
            <div>
              <h1 style="margin: 0 0 10px 0; font-size: 24px;">${report.name}</h1>
              <h2 style="margin: 0; font-size: 18px; color: #475569;">Học viên: <span style="color: #003366;">${student.lastName || ''} ${student.firstName || student.studentId}</span></h2>
            </div>
            <div>
              ${logoHtml}
            </div>
          </div>
          
          <div class="info-grid">
            <div><strong>Phòng thi:</strong> ${report.room}</div>
            <div><strong>Ngày làm bài:</strong> ${new Date(report.date).toLocaleDateString('vi-VN')}</div>
            <div><strong>Điểm số:</strong> <span style="font-size:18px; color:#15803d; font-weight:bold;">${student.score}%</span></div>
            <div><strong>Tổng thời gian:</strong> ${totalDurStr}</div>
            <div><strong>Số lần đăng nhập:</strong> ${sessions.length} lần</div>
          </div>

          <h3>Chi tiết Lịch sử Đăng nhập</h3>
          <table class="session-table">
            <thead>
              <tr><th>Đợt</th><th>Vào lúc</th><th>Ra lúc</th><th>Thời gian</th><th>Tích lũy</th></tr>
            </thead>
            <tbody>
              ${sessionRows || '<tr><td colSpan="5" style="text-align:center;">Không có dữ liệu session.</td></tr>'}
            </tbody>
          </table>

          <h3>Chi tiết Bài làm</h3>
      `;

      // 3. Render từng câu hỏi
      questions.forEach((q, idx) => {
        const stAnsObj = student.answers?.[q.id];
        const stAns = stAnsObj?.answer || '<em>Chưa làm</em>';
        const isCorrect = stAnsObj?.isCorrect;
        const badge = isCorrect ? '<span class="badge correct">ĐÚNG</span>' : '<span class="badge incorrect">SAI</span>';

        const correctAnsHtml = includeAnswers ? `
          <div class="answer-row" style="color: #15803d;">
            <strong>Đáp án đúng:</strong> <span>${getCorrectAnswerDisplay(q) || 'N/A'}</span>
          </div>
        ` : '';

        const explanationHtml = (includeExplanations && q.explanation) ? `
          <div class="explanation-box">
            <strong>Giải thích:</strong><br/>
            ${q.explanation}
          </div>
        ` : '';

        htmlContent += `
          <div class="question-box">
            <div class="q-title">
              <span>Câu ${idx + 1} (${q.type.replace(/_/g, ' ')})</span>
            </div>
            <div class="q-text">${q.text}</div>
            <div class="answer-row">
              <strong>Trả lời:</strong> <span>${stAns}</span> ${stAns !== '<em>Chưa làm</em>' ? badge : ''}
            </div>
            ${correctAnsHtml}
            ${explanationHtml}
          </div>
        `;
      });

      htmlContent += `</div>`; 
    });

    htmlContent += `</body></html>`;

    // 4. Download file
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Report_${report.name.replace(/\s+/g, '_')}_${new Date().getTime()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    setIsExporting(false);
    setShowExportModal(false);
  };

  return (
    <div style={{ padding: isMobile ? '15px' : '30px', backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: "'Josefin Sans', sans-serif" }}>
      
      {/* MODAL EXPORT */}
      {showExportModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '15px', boxSizing: 'border-box' }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '16px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ color: '#003366', marginTop: 0, marginBottom: '20px', fontWeight: '800', fontSize: '20px' }}>Xuất Báo Cáo (HTML)</h3>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontWeight: '700', marginBottom: '10px', color: '#003366' }}>Lựa chọn học viên:</label>
              <div style={{ display: 'flex', gap: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="radio" name="exportScope" value="all" checked={exportScope === 'all'} onChange={() => setExportScope('all')} style={{ accentColor: '#003366' }} /> Tất cả
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="radio" name="exportScope" value="specific" checked={exportScope === 'specific'} onChange={() => setExportScope('specific')} style={{ accentColor: '#003366' }} /> Chọn cụ thể
                </label>
              </div>
            </div>

            {exportScope === 'specific' && (
              <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px', marginBottom: '20px' }}>
                {submissions.filter(s => s.submitted).map(s => (
                  <label key={s.studentId} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', cursor: 'pointer' }}>
                    <input type="checkbox" checked={exportStudents.includes(s.studentId)} onChange={() => handleToggleExportStudent(s.studentId)} style={{ accentColor: '#003366' }} />
                    {s.lastName || ''} {s.firstName || s.studentId}
                  </label>
                ))}
              </div>
            )}

            <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ display: 'block', fontWeight: '700', color: '#003366' }}>Tùy chọn hiển thị:</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={includeAnswers} onChange={e => setIncludeAnswers(e.target.checked)} style={{ accentColor: '#003366' }} /> Bao gồm đáp án đúng
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={includeExplanations} onChange={e => setIncludeExplanations(e.target.checked)} style={{ accentColor: '#003366' }} /> Bao gồm giải thích chi tiết
              </label>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '30px' }}>
              <button onClick={() => setShowExportModal(false)} disabled={isExporting} style={{ padding: '10px 20px', borderRadius: '100px', border: '1px solid #cbd5e1', backgroundColor: 'white', color: '#64748b', fontWeight: '700', cursor: 'pointer' }}>Hủy</button>
              <button onClick={handleExportHTML} disabled={isExporting} style={{ padding: '10px 20px', borderRadius: '100px', border: 'none', backgroundColor: '#003366', color: 'white', fontWeight: '700', cursor: isExporting ? 'wait' : 'pointer', boxShadow: '0 4px 6px -1px rgba(0,51,102,0.2)' }}>
                {isExporting ? 'Đang xuất...' : 'Xuất File HTML'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* HEADER DETAIL */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'flex-start', marginBottom: '30px', gap: '20px' }}>
        <div>
          <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', marginBottom: '12px', fontWeight: '700', fontSize: '14px', padding: 0, transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#003366'} onMouseLeave={e => e.currentTarget.style.color = '#64748b'}>
            <SvgIcons.Back /> Quay lại Reports
          </button>
          <h2 style={{ color: '#003366', margin: '0 0 8px 0', fontSize: isMobile ? '22px' : '28px', fontWeight: '800', textTransform: 'uppercase', lineHeight: '1.3' }}>{report.name}</h2>
          <p style={{ color: '#64748b', margin: 0, fontWeight: '500', fontSize: '14px' }}>Date: {dateStr} • Room: <span style={{ color: '#003366', fontWeight: '700' }}>{report.room}</span></p>
        </div>
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '12px', width: isMobile ? '100%' : 'auto' }}>
          <button style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flex: 1, backgroundColor: 'white', color: '#003366', border: '1px solid #cbd5e1', padding: '12px 20px', borderRadius: '100px', fontWeight: '700', cursor: 'pointer', fontSize: '14px', transition: 'all 0.2s' }}>
            <SvgIcons.Mail /> Email
          </button>
          <button onClick={() => setShowExportModal(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flex: 1, backgroundColor: '#003366', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '100px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(0,51,102,0.2)', fontSize: '14px', whiteSpace: 'nowrap', transition: 'all 0.2s' }}>
            <SvgIcons.Download /> Export
          </button>
        </div>
      </div>

      {/* STATS OVERVIEW */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '15px', marginBottom: '30px' }}>
        {[
          { label: 'Participated', val: `${totalParticipated} / ${totalStudents}` },
          { label: 'Completion %', val: `${completionRate}%` },
          { label: 'Average Score', val: `${avgScore}%` },
          { label: 'Pass Rate', val: `${passRate}%` }
        ].map((stat, i) => (
          <div key={i} style={{ backgroundColor: 'white', padding: isMobile ? '16px' : '24px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <div style={{ color: '#64748b', fontSize: '12px', textTransform: 'uppercase', fontWeight: '800', marginBottom: '8px', letterSpacing: '0.5px' }}>{stat.label}</div>
            <div style={{ color: '#003366', fontSize: isMobile ? '24px' : '32px', fontWeight: '800' }}>{stat.val}</div>
          </div>
        ))}
      </div>

      {/* TOGGLES */}
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '20px', padding: '0 5px' }}>
        <Toggle label="Show Names" checked={showNames} onChange={setShowNames} />
        <Toggle label="Show Responses" checked={showResponses} onChange={setShowResponses} />
        <Toggle label="Show Results" checked={showResults} onChange={setShowResults} />
      </div>

      {/* RESPONSE MATRIX */}
      <div style={{ width: '100%', overflowX: 'auto', backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        <table style={{ minWidth: '700px', width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
          <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
            <tr>
              <th style={{ padding: '16px 20px', textAlign: 'left', color: '#475569', width: '200px', position: 'sticky', left: 0, backgroundColor: '#f8fafc', zIndex: 10 }}>Name</th>
              <th style={{ padding: '16px', color: '#475569', width: '80px' }}>Score</th>
              {questions.map((q, i) => <th key={q.id} style={{ padding: '16px', color: '#003366', fontWeight: '800' }}>Q{i + 1}</th>)}
            </tr>
          </thead>
          <tbody>
            {submissions.length === 0 ? (
              <tr><td colSpan={questions.length + 2} style={{ padding: '40px', color: '#94a3b8' }}>Không có dữ liệu học viên.</td></tr>
            ) : (
              submissions.map((student, idx) => {
                const hasSubmitted = student.submitted;
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f0f9ff'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}>
                    <td style={{ padding: '16px 20px', textAlign: 'left', fontWeight: '700', color: '#003366', position: 'sticky', left: 0, backgroundColor: 'inherit', zIndex: 5, borderRight: '1px solid #f1f5f9' }}>
                      {showNames ? `${student.lastName || ''} ${student.firstName || student.studentId}` : '••••••••'}
                    </td>
                    <td style={{ padding: '16px', fontWeight: '800', color: hasSubmitted ? '#059669' : '#94a3b8' }}>
                      {hasSubmitted ? `${student.score}%` : '-'}
                    </td>
                    
                    {questions.map(q => {
                      const ansObj = student.answers?.[q.id];
                      const ansText = ansObj?.answer || '';
                      const isCorrect = ansObj?.isCorrect || false;

                      let bg = 'transparent', color = '#334155', text = showResponses ? ansText : '✓';
                      
                      if (!hasSubmitted) {
                        text = '';
                      } else if (showResults && ansText) {
                        bg = isCorrect ? '#dcfce7' : '#fee2e2';
                        color = isCorrect ? '#15803d' : '#b91c1c';
                      }

                      return (
                        <td key={q.id} style={{ padding: '10px' }}>
                          <div style={{ backgroundColor: bg, color, padding: '8px', borderRadius: '8px', fontWeight: '600', minHeight: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: hasSubmitted && !showResults && ansText ? '1px solid #cbd5e1' : 'none', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px', margin: '0 auto' }} title={ansText}>
                            {text}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- TRANG CHÍNH: REPORTS ---
export default function Reports() {
  const [reports, setReports] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roomFilter, setRoomFilter] = useState('All Rooms');
  const [selectedReports, setSelectedReports] = useState([]);
  const [viewingReport, setViewingReport] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch dữ liệu từ Firebase
  const fetchReports = async () => {
    try {
      const snap = await getDocs(collection(db, "reports"));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => new Date(b.date) - new Date(a.date));
      setReports(data);
    } catch (error) {
      console.error("Lỗi lấy báo cáo:", error);
    }
  };

  useEffect(() => { fetchReports(); }, []);

  // Lọc dữ liệu
  const filteredReports = reports.filter(r => {
    const matchSearch = r.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchRoom = roomFilter === 'All Rooms' || r.room === roomFilter;
    return matchSearch && matchRoom;
  });

  const uniqueRooms = ['All Rooms', ...new Set(reports.map(r => r.room))];

  const handleSelectAll = (e) => {
    if (e.target.checked) setSelectedReports(filteredReports.map(r => r.id));
    else setSelectedReports([]);
  };

  const handleDelete = async () => {
    if (!window.confirm(`Bạn có chắc muốn xóa vĩnh viễn ${selectedReports.length} báo cáo này?`)) return;
    try {
      for (let id of selectedReports) {
        await deleteDoc(doc(db, "reports", id));
      }
      setReports(reports.filter(r => !selectedReports.includes(r.id)));
      setSelectedReports([]);
    } catch (error) {
      console.error("Lỗi xóa:", error);
    }
  };

  if (viewingReport) {
    return <ReportDetailView report={viewingReport} onBack={() => setViewingReport(null)} />;
  }

  // --- RENDER DANH SÁCH REPORT (TABLE VIEW) ---
  return (
    <div style={{ padding: isMobile ? '15px' : '30px', backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: "'Josefin Sans', sans-serif" }}>
      <h2 style={{ color: '#003366', margin: '0 0 24px 0', fontSize: isMobile ? '24px' : '28px', fontWeight: '800' }}>Reports</h2>
      
      {/* TOOLBAR: Search, Filter & Actions */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', marginBottom: '24px', gap: '15px' }}>
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '12px', width: isMobile ? '100%' : 'auto' }}>
          <div style={{ position: 'relative', width: isMobile ? '100%' : 'auto' }}>
            <span style={{ position: 'absolute', left: '14px', top: '12px', color: '#94a3b8' }}>
              <SvgIcons.Search />
            </span>
            <input 
              type="text" 
              placeholder="Search reports..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ padding: '12px 16px 12px 42px', borderRadius: '100px', border: '1px solid #cbd5e1', width: '100%', minWidth: isMobile ? '0' : '240px', outlineColor: '#003366', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>
          <select 
            value={roomFilter} 
            onChange={(e) => setRoomFilter(e.target.value)}
            style={{ width: isMobile ? '100%' : 'auto', padding: '12px 20px', borderRadius: '100px', border: '1px solid #cbd5e1', outlineColor: '#003366', color: '#003366', fontWeight: '700', fontSize: '14px', cursor: 'pointer', backgroundColor: 'white', appearance: 'none' }}
          >
            {uniqueRooms.map(room => <option key={room} value={room}>{room}</option>)}
          </select>
        </div>

        {selectedReports.length > 0 && (
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '10px', width: isMobile ? '100%' : 'auto' }}>
            <button style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: isMobile ? '100%' : 'auto', backgroundColor: 'white', color: '#003366', border: '1px solid #cbd5e1', padding: '12px 20px', borderRadius: '100px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s' }}>
              <SvgIcons.Archive /> Archive
            </button>
            <button onClick={handleDelete} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: isMobile ? '100%' : 'auto', backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '100px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s' }}>
              <SvgIcons.Trash /> Delete Selected
            </button>
          </div>
        )}
      </div>

      {/* TABLE VIEW */}
      <div style={{ width: '100%', overflowX: 'auto', backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        <table style={{ minWidth: '700px', width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            <tr>
              <th style={{ padding: '16px', width: '60px', textAlign: 'center' }}>
                <input type="checkbox" checked={selectedReports.length > 0 && selectedReports.length === filteredReports.length} onChange={handleSelectAll} style={{ accentColor: '#003366', cursor: 'pointer', width: '18px', height: '18px' }} />
              </th>
              <th style={{ padding: '16px 20px', color: '#64748b', fontWeight: '800', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Name</th>
              <th style={{ padding: '16px 20px', color: '#64748b', fontWeight: '800', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Date</th>
              <th style={{ padding: '16px 20px', color: '#64748b', fontWeight: '800', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Room</th>
              <th style={{ padding: '16px 20px', color: '#64748b', fontWeight: '800', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Type</th>
            </tr>
          </thead>
          <tbody>
            {filteredReports.length === 0 ? (
              <tr><td colSpan="5" style={{ padding: '60px', textAlign: 'center', color: '#94a3b8', fontSize: '15px', fontWeight: '500' }}>Không tìm thấy báo cáo nào.</td></tr>
            ) : (
              filteredReports.map(report => (
                <tr key={report.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f0f9ff'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}>
                  <td style={{ padding: '16px', textAlign: 'center' }}>
                    <input 
                      type="checkbox" 
                      checked={selectedReports.includes(report.id)} 
                      onChange={() => setSelectedReports(prev => prev.includes(report.id) ? prev.filter(id => id !== report.id) : [...prev, report.id])} 
                      style={{ accentColor: '#003366', cursor: 'pointer', width: '18px', height: '18px' }} 
                    />
                  </td>
                  <td onClick={() => setViewingReport(report)} style={{ padding: '16px 20px', color: '#003366', fontWeight: '800', cursor: 'pointer', fontSize: '15px' }}>
                    <span style={{ borderBottom: '1px dashed #cbd5e1' }}>{report.name}</span>
                  </td>
                  <td style={{ padding: '16px 20px', color: '#64748b', fontWeight: '500', fontSize: '14px' }}>{new Date(report.date).toLocaleString('vi-VN')}</td>
                  <td style={{ padding: '16px 20px', color: '#334155', fontWeight: '700', fontSize: '14px' }}>{report.room}</td>
                  <td style={{ padding: '16px 20px', color: '#64748b' }}>
                    <span style={{ backgroundColor: '#e2e8f0', padding: '6px 12px', borderRadius: '100px', fontSize: '13px', fontWeight: '700', color: '#475569' }}>{report.type}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}