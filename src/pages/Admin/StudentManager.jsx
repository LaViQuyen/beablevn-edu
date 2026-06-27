import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { ref, set, onValue, update, remove, push, get } from "firebase/database";
import bcrypt from 'bcryptjs';
import { getReserveStatus, RESERVE_LABEL, RESERVE_BADGE, fmtReserveDate } from '../../utils/reserve';
// Modal xác nhận (dùng chung cho xóa + mở khóa)
const ConfirmModal = ({ title, message, confirmLabel = 'Xác nhận', confirmColor = 'bg-red-500 hover:bg-red-600', onConfirm, onCancel }) => (
  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
    <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4 border border-slate-100">
      <p className="text-base font-bold text-slate-800">{title}</p>
      {message && <p className="text-sm text-slate-500">{message}</p>}
      <div className="flex gap-3 justify-end">
        <button onClick={onCancel} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Hủy</button>
        <button onClick={onConfirm} className={`px-4 py-2 rounded-xl text-sm font-bold text-white transition-colors ${confirmColor}`}>{confirmLabel}</button>
      </div>
    </div>
  </div>
);

// Modal đổi mật khẩu học viên
const ChangePasswordModal = ({ student, onConfirm, onCancel }) => {
  const [newPass, setNewPass] = useState('BAVNbavn');
  const [error, setError] = useState('');
  const handleSubmit = (e) => {
    e.preventDefault();
    if (newPass.length < 6) { setError('Mật khẩu phải từ 6 ký tự trở lên.'); return; }
    onConfirm(newPass);
  };
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4 border border-slate-100">
        <h3 className="font-bold text-[#2B6830] text-base">Đổi mật khẩu: {student.name}</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Mật khẩu mới</label>
            <input type="text" className="w-full border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10 font-mono transition" value={newPass} onChange={e => { setNewPass(e.target.value); setError(''); }} autoFocus />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Hủy</button>
            <button type="submit" className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-[#2B6830] hover:bg-[#1E5225] transition-colors">Xác nhận</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const StudentManager = () => {
  const [activeTab, setActiveTab] = useState('create');
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ name: '', password: 'BAVNbavn', studentCode: '', classId1: '', classId2: '', classId3: '', role: 'student' });
  // Modal states
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [unlockTarget, setUnlockTarget] = useState(null);
  const [changePassTarget, setChangePassTarget] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [editingStudent, setEditingStudent] = useState(null);
  const [selectedStudentToLock, setSelectedStudentToLock] = useState(null);
  const [customLockDate, setCustomLockDate] = useState(new Date().toISOString().split('T')[0]); 
  const [filterClass, setFilterClass] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  // Bảo lưu
  const [reserveTarget, setReserveTarget] = useState(null);
  const [reserveStart, setReserveStart] = useState('');
  const [reserveEnd, setReserveEnd] = useState('');

  useEffect(() => {
    onValue(ref(db, 'classes'), (snap) => setClasses(snap.val() ? Object.entries(snap.val()).map(([id, val]) => ({ id, ...val })).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi')) : []));
    onValue(ref(db, 'users'), (snap) => {
      if(snap.val()) setStudents(Object.entries(snap.val()).map(([id, val]) => ({ id, ...val })).filter(u => u.role === 'student'));
      setLoading(false);
    });
  }, []);

  const showSuccess = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 3500); };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.password || !formData.studentCode) return showSuccess('⚠️ Thiếu thông tin!');

    const classIds = [formData.classId1, formData.classId2, formData.classId3].filter(id => id);
    const loginEmail = `${formData.studentCode.trim()}@beable.vn`;

    try {
      const salt = bcrypt.genSaltSync(10);
      const hashedPassword = bcrypt.hashSync(formData.password, salt);
      const newUserRef = push(ref(db, 'users'));
      await set(newUserRef, {
        name: formData.name, loginId: formData.studentCode,
        studentCode: formData.studentCode, username: formData.studentCode,
        password: hashedPassword, email: loginEmail,
        role: 'student', classIds, createdAt: new Date().toISOString()
      });
      showSuccess(`✅ Đã thêm "${formData.name}" · ID: ${formData.studentCode}`);
      setFormData({ name: '', password: 'BAVNbavn', studentCode: '', classId1: '', classId2: '', classId3: '', role: 'student' });
    } catch (error) { showSuccess('❌ Lỗi: ' + error.message); }
  };

  const handleUpdate = async () => {
    if(!editingStudent) return;
    try {
      await update(ref(db, `users/${editingStudent.id}`), {
        name: editingStudent.name, studentCode: editingStudent.studentCode,
        classIds: [editingStudent.classId1, editingStudent.classId2, editingStudent.classId3].filter(Boolean),
        isDemo: !!editingStudent.isDemo // tài khoản demo: ẩn khỏi leaderboard + không vào báo cáo
      });
      setEditingStudent(null);
      showSuccess(`✅ Đã cập nhật thông tin học viên.`);
    } catch (e) { showSuccess('❌ Lỗi: ' + e.message); }
  };

  const handleResetPassword = (student) => setChangePassTarget(student);

  const confirmResetPassword = async (newPass) => {
    const student = changePassTarget;
    setChangePassTarget(null);
    try {
      const salt = bcrypt.genSaltSync(10);
      const hashedPassword = bcrypt.hashSync(newPass, salt);
      await update(ref(db, `users/${student.id}`), { password: hashedPassword });
      showSuccess(`Đã đổi mật khẩu cho "${student.name}"`);
    } catch (error) { showSuccess('❌ Lỗi: ' + error.message); }
  };

  const handleToggleLock = (student) => {
    const isCurrentlyLocked = student.lockedAt || student.isLocked;
    if (isCurrentlyLocked) {
      setUnlockTarget(student);
    } else {
      setSelectedStudentToLock(student);
      setCustomLockDate(new Date().toISOString().split('T')[0]);
    }
  };

  const confirmUnlock = async () => {
    try {
      await update(ref(db, `users/${unlockTarget.id}`), { lockedAt: null, isLocked: null });
      showSuccess(`Đã mở khóa tài khoản "${unlockTarget.name}"`);
    } catch (error) { showSuccess('❌ Lỗi: ' + error.message); }
    setUnlockTarget(null);
  };

  const handleConfirmLockWithDate = async () => {
    if (!selectedStudentToLock) return;
    try {
      await update(ref(db, `users/${selectedStudentToLock.id}`), {
        lockedAt: new Date(customLockDate).toISOString()
      });
      showSuccess(`🔒 Đã khóa tài khoản "${selectedStudentToLock.name}" từ ${new Date(customLockDate).toLocaleDateString('vi-VN')}`);
      setSelectedStudentToLock(null);
    } catch (error) {
      showSuccess('❌ Lỗi: ' + error.message);
    }
  };

  const handleDelete = (id) => setDeleteTarget(id);
  const confirmDelete = async () => { await remove(ref(db, `users/${deleteTarget}`)); setDeleteTarget(null); };

  // ===== BẢO LƯU =====
  // Mở popup bảo lưu (điền sẵn nếu đang có cấu hình)
  const handleOpenReserve = (student) => {
    setReserveTarget(student);
    setReserveStart(student.reserve?.start || new Date().toISOString().split('T')[0]);
    setReserveEnd(student.reserve?.end || '');
  };

  // Gửi tin nhắn THÔNG TIN BẢO LƯU tới GV/CCO phụ trách lớp của học viên
  const sendReserveMessages = async (student, content) => {
    try {
      const snap = await get(ref(db, 'users'));
      const usersData = snap.val() || {};
      const sClasses = student.classIds || [];
      const now = new Date().toISOString();
      const staffToNotify = Object.entries(usersData)
        .map(([id, u]) => ({ id, ...u }))
        .filter(u => u.role === 'staff' && (u.assignedClasses || []).some(c => sClasses.includes(c)));
      await Promise.all(staffToNotify.map(staff => set(push(ref(db, 'messages')), {
        studentId:     student.id,
        studentName:   'Admin',
        studentCode:   '',
        recipientId:   staff.id,
        recipientName: staff.name,
        recipientRole: staff.subRole || 'staff',
        subject:       'THÔNG TIN BẢO LƯU',
        lastDate:      now,
        lastMessage:   content,
        studentUnread: 0,
        staffUnread:   1,
        system:        true,
        thread: [{ from: 'student', fromName: 'Admin', content, date: now }],
      })));
    } catch (e) { console.error('Lỗi gửi tin nhắn bảo lưu:', e); }
  };

  const confirmReserve = async () => {
    if (!reserveTarget || !reserveStart || !reserveEnd) return showSuccess('⚠️ Vui lòng chọn ngày bắt đầu và kết thúc.');
    if (reserveEnd < reserveStart) return showSuccess('⚠️ Ngày kết thúc phải sau ngày bắt đầu.');
    try {
      // Nếu thời điểm tạo đã nằm trong 7 ngày cuối -> gửi luôn nhắc "còn một tuần" (kèm cờ chống trùng)
      const nowMs = Date.now();
      const endMs = new Date(reserveEnd + 'T23:59:59').getTime();
      const wb = new Date(reserveEnd + 'T00:00:00'); wb.setDate(wb.getDate() - 7);
      const dueNow = nowMs >= wb.getTime() && nowMs <= endMs;

      await update(ref(db, `users/${reserveTarget.id}`), {
        reserve: { start: reserveStart, end: reserveEnd, createdBy: 'Admin', createdAt: new Date().toISOString(), weekReminderSent: dueNow }
      });
      const className = getClassNames(reserveTarget.classIds);
      const startMsg = `Học viên ${reserveTarget.name}, học lớp ${className}, bắt đầu bảo lưu từ ${fmtReserveDate(reserveStart)} đến ${fmtReserveDate(reserveEnd)}`;
      await sendReserveMessages(reserveTarget, startMsg);
      if (dueNow) {
        const weekMsg = `Học viên ${reserveTarget.name}, học lớp ${className}, thời gian bảo lưu còn một tuần`;
        await sendReserveMessages(reserveTarget, weekMsg);
      }
      showSuccess(`📌 Đã đặt bảo lưu cho "${reserveTarget.name}" và thông báo GV phụ trách.`);
      setReserveTarget(null);
    } catch (e) { showSuccess('❌ Lỗi: ' + e.message); }
  };

  const clearReserve = async () => {
    if (!reserveTarget) return;
    try {
      await update(ref(db, `users/${reserveTarget.id}`), { reserve: null });
      showSuccess(`Đã gỡ bảo lưu cho "${reserveTarget.name}".`);
      setReserveTarget(null);
    } catch (e) { showSuccess('❌ Lỗi: ' + e.message); }
  };

  const getClassNames = (ids) => {
    if (!ids || !ids.length) return "--";
    return ids.map(id => classes.find(c => c.id === id)?.name || id).join(", ");
  };

  const filteredStudents = students.filter(st => {
      if (filterClass !== 'all') {
          const studentClasses = st.classIds || [];
          if (!studentClasses.includes(filterClass)) return false;
      }
      if (searchTerm) {
          const lowerTerm = searchTerm.toLowerCase();
          const matchName = st.name.toLowerCase().includes(lowerTerm);
          const matchCode = st.studentCode.toLowerCase().includes(lowerTerm);
          if (!matchName && !matchCode) return false;
      }
      return true;
  }).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi')); // sắp xếp học viên A-Z (có dấu tiếng Việt)

  return (
    <div className="space-y-6 pb-20">

      {/* MODALS */}
      {deleteTarget && <ConfirmModal title="Xóa học viên này?" message="Hành động không thể hoàn tác." confirmLabel="Xóa" onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />}
      {unlockTarget && <ConfirmModal title={`Mở khóa tài khoản "${unlockTarget.name}"?`} confirmLabel="Mở khóa" confirmColor="bg-emerald-600 hover:bg-emerald-700" onConfirm={confirmUnlock} onCancel={() => setUnlockTarget(null)} />}
      {changePassTarget && <ChangePasswordModal student={changePassTarget} onConfirm={confirmResetPassword} onCancel={() => setChangePassTarget(null)} />}

      {/* POPUP BẢO LƯU */}
      {reserveTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-100 p-6 w-full max-w-md shadow-xl animate-scale-up">
            <div className="flex items-center gap-3 mb-4 text-blue-600">
              <div className="p-2 bg-blue-50 rounded-xl">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
              </div>
              <h3 className="text-base font-bold text-slate-800">Bảo lưu học viên</h3>
            </div>

            <p className="text-slate-500 text-xs leading-relaxed mb-4">
              Học viên <strong className="text-slate-700">{reserveTarget.name}</strong> sẽ <strong>không xem được Thông báo</strong> trong thời gian bảo lưu. GV/CCO phụ trách lớp sẽ nhận tin nhắn thông báo.
            </p>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Ngày bắt đầu</label>
                <input type="date" className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10 text-sm font-semibold bg-slate-50 focus:bg-white transition-colors" value={reserveStart} onChange={e => setReserveStart(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Ngày kết thúc</label>
                <input type="date" className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10 text-sm font-semibold bg-slate-50 focus:bg-white transition-colors" value={reserveEnd} onChange={e => setReserveEnd(e.target.value)} />
              </div>
            </div>

            <div className="flex gap-3 justify-between items-center">
              <div>
                {reserveTarget.reserve && (
                  <button onClick={clearReserve} className="px-3 py-2.5 text-red-600 text-xs font-bold hover:underline">Gỡ bảo lưu</button>
                )}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setReserveTarget(null)} className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-50 transition-all active:scale-95">Hủy bỏ</button>
                <button onClick={confirmReserve} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all shadow-md active:scale-95">Xác nhận</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FLASH SUCCESS */}
      {successMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
          {successMsg}
        </div>
      )}

      <div className="flex gap-4 border-b border-slate-200 overflow-x-auto w-full flex-nowrap scrollbar-hide">
        <button onClick={() => setActiveTab('create')} className={`pb-3 px-4 text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'create' ? 'text-[#2B6830] border-b-2 border-[#2B6830]' : 'text-slate-400 hover:text-slate-600'}`}>Thêm Học Viên</button>
        <button onClick={() => setActiveTab('list')} className={`pb-3 px-4 text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'list' ? 'text-[#2B6830] border-b-2 border-[#2B6830]' : 'text-slate-400 hover:text-slate-600'}`}>Danh sách</button>
      </div>

      {activeTab === 'create' && (
        <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-100 shadow-sm animate-fade-in-up">
          <h2 className="text-lg font-bold text-[#2B6830] mb-4">Thông tin Học viên mới</h2>
          <form onSubmit={handleCreate} className="space-y-4 max-w-2xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="space-y-1">
                 <label className="text-xs font-bold text-slate-500 uppercase">Họ và Tên</label>
                 <input className="w-full border p-3 rounded-xl outline-none focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10 text-sm" placeholder="Nguyễn Văn A" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
               </div>
               <div className="space-y-1">
                 <label className="text-xs font-bold text-slate-500 uppercase">Mã HV (Login ID)</label>
                 <input className="w-full border p-3 rounded-xl outline-none focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10 text-sm" placeholder="HV001" value={formData.studentCode} onChange={e => setFormData({...formData, studentCode: e.target.value})} />
               </div>
            </div>
            <div className="space-y-1">
                 <label className="text-xs font-bold text-slate-500 uppercase">Mật khẩu</label>
                 <input className="w-full border p-3 rounded-xl outline-none focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10 text-sm" type="password" placeholder="••••••" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
            </div>
            <div className="space-y-1">
                 <label className="text-xs font-bold text-slate-500 uppercase">Chọn Lớp (Tối đa 3)</label>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {[1,2,3].map(i => (
                        <select key={i} className="border p-3 rounded-xl text-sm outline-none focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10 bg-white w-full" value={formData[`classId${i}`]} onChange={e => setFormData({...formData, [`classId${i}`]: e.target.value})}>
                            <option value="">-- Lớp {i} --</option>
                            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    ))}
                 </div>
            </div>
            <button className="w-full md:w-auto bg-[#2B6830] text-white py-3 px-8 rounded-xl font-bold shadow-lg shadow-green-900/20 hover:bg-[#1E5225] transition-all active:scale-[0.98]">Lưu Học Viên</button>
          </form>
        </div>
      )}

      {activeTab === 'list' && (
        <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-100 shadow-sm">
           {/* --- BỘ LỌC (Responsive) --- */}
           <div className="flex flex-col md:flex-row gap-3 mb-4">
               <select 
                   className="p-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10 md:min-w-[150px] bg-slate-50"
                   value={filterClass}
                   onChange={e => setFilterClass(e.target.value)}
               >
                   <option value="all">Tất cả lớp</option>
                   {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
               </select>
               <input 
                   className="p-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10 md:min-w-[250px]"
                   placeholder="Tìm theo Tên hoặc Mã HV..."
                   value={searchTerm}
                   onChange={e => setSearchTerm(e.target.value)}
               />
           </div>

           {/* DESKTOP TABLE */}
           <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200">
             <table className="w-full text-left text-sm">
               <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 text-xs uppercase font-bold">
                 <tr>
                    <th className="p-4 w-12 text-center">STT</th>
                    <th className="p-4">Mã HV</th>
                    <th className="p-4">Tên</th>
                    <th className="p-4">Lớp đang học</th>
                    <th className="p-4 text-right">Thao tác</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                 {filteredStudents.map((st, index) => (
                   <tr key={st.id} className="hover:bg-slate-50 transition-colors">
                     <td className="p-4 text-center text-slate-400 font-bold">{index + 1}</td>
                     <td className="p-4 font-bold text-[#2B6830]">{st.studentCode}</td>
                     <td className="p-4 font-medium">
                       <div className="flex items-center gap-2 flex-wrap">
                         <span>{st.name}</span>
                         {(() => { const rs = getReserveStatus(st); return rs ? <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${RESERVE_BADGE[rs]}`}>{RESERVE_LABEL[rs]}</span> : null; })()}
                       </div>
                     </td>
                     <td className="p-4 text-slate-600 max-w-xs truncate">{getClassNames(st.classIds)}</td>
                     <td className="p-4 text-right flex justify-end gap-2">
                        <button onClick={() => setEditingStudent({...st, classId1: st.classIds?.[0]||'', classId2: st.classIds?.[1]||'', classId3: st.classIds?.[2]||''})} className="text-[#2B6830] border border-[#2B6830] px-2 py-1 rounded text-xs font-bold hover:bg-[#2B6830] hover:text-white transition-all">Sửa</button>
                        <button onClick={() => handleResetPassword(st)} className="text-yellow-600 border border-yellow-600 px-2 py-1 rounded text-xs font-bold hover:bg-yellow-600 hover:text-white transition-colors">Pass</button>
                        <button 
                            onClick={() => handleToggleLock(st)} 
                            className={`px-2 py-1 rounded text-xs font-bold border transition-colors ${(st.lockedAt || st.isLocked) ? 'text-emerald-600 border-emerald-600 hover:bg-emerald-600 hover:text-white' : 'text-orange-500 border-orange-500 hover:bg-orange-500 hover:text-white'}`}
                        >
                            {(st.lockedAt || st.isLocked) ? 'Mở' : 'Khóa'}
                        </button>
                        <button
                            onClick={() => handleOpenReserve(st)}
                            className={`px-2 py-1 rounded text-xs font-bold border transition-colors ${st.reserve ? 'text-blue-600 border-blue-600 hover:bg-blue-600 hover:text-white' : 'text-slate-500 border-slate-300 hover:bg-slate-500 hover:text-white'}`}
                        >
                            Bảo lưu
                        </button>
                        <button onClick={() => handleDelete(st.id)} className="text-red-500 hover:text-red-700 font-bold text-xs px-2">Xóa</button>
                     </td>
                   </tr>
                 ))}
                 {loading && [1,2,3].map(i => (
                   <tr key={i} className="animate-pulse">
                     {[1,2,3,4,5].map(j => <td key={j} className="p-4"><div className="h-4 bg-slate-100 rounded w-full" /></td>)}
                   </tr>
                 ))}
                 {!loading && filteredStudents.length === 0 && <tr><td colSpan="5" className="p-8 text-center text-slate-400 italic">Không tìm thấy dữ liệu.</td></tr>}
               </tbody>
             </table>
           </div>

           {/* MOBILE CARDS */}
           <div className="md:hidden space-y-3">
                {filteredStudents.map((st, index) => (
                    <div key={st.id} className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm flex flex-col gap-3">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-[#E8F4EC] text-[#2B6830] flex items-center justify-center font-bold text-xs">
                                    {index + 1}
                                </div>
                                <div>
                                    <h4 className="font-bold text-[#2B6830] text-sm flex items-center gap-2 flex-wrap">
                                      {st.name}
                                      {(() => { const rs = getReserveStatus(st); return rs ? <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${RESERVE_BADGE[rs]}`}>{RESERVE_LABEL[rs]}</span> : null; })()}
                                    </h4>
                                    <p className="text-xs text-slate-500 font-mono font-bold bg-slate-50 px-1 rounded inline-block mt-0.5">{st.studentCode}</p>
                                </div>
                            </div>
                        </div>
                        
                        <div className="text-xs bg-slate-50 p-2 rounded border border-slate-100">
                            <span className="font-bold text-slate-500 block mb-1 uppercase">Lớp:</span>
                            <div className="text-slate-700">{getClassNames(st.classIds)}</div>
                        </div>

                        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3 mt-1">
                            <button onClick={() => setEditingStudent({...st, classId1: st.classIds?.[0]||'', classId2: st.classIds?.[1]||'', classId3: st.classIds?.[2]||''})} className="flex-1 min-w-[60px] py-2 text-[#2B6830] bg-[#E8F4EC] rounded-xl text-xs font-bold border border-green-200 active:bg-green-100">Sửa</button>
                            <button onClick={() => handleResetPassword(st)} className="flex-1 min-w-[60px] py-2 text-yellow-700 bg-yellow-50 rounded-xl text-xs font-bold border border-yellow-200 active:bg-yellow-100">Pass</button>
                            <button
                                  onClick={() => handleToggleLock(st)}
                                  className={`flex-1 min-w-[60px] py-2 rounded-xl text-xs font-bold border transition-colors ${(st.lockedAt || st.isLocked) ? 'text-emerald-700 bg-emerald-50 border-emerald-200 active:bg-emerald-100' : 'text-orange-600 bg-orange-50 border-orange-200 active:bg-orange-100'}`}
                              >
                                  {(st.lockedAt || st.isLocked) ? 'Mở Khóa' : 'Khóa'}
                              </button>
                            <button onClick={() => handleOpenReserve(st)} className={`flex-1 min-w-[60px] py-2 rounded-xl text-xs font-bold border transition-colors ${st.reserve ? 'text-blue-600 bg-blue-50 border-blue-200 active:bg-blue-100' : 'text-slate-600 bg-slate-50 border-slate-200 active:bg-slate-100'}`}>Bảo lưu</button>
                            <button onClick={() => handleDelete(st.id)} className="flex-1 min-w-[60px] py-2 text-red-600 bg-red-50 rounded-xl text-xs font-bold border border-red-200 active:bg-red-100">Xóa</button>
                        </div>
                    </div>
                ))}
                {filteredStudents.length === 0 && <div className="p-8 text-center text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">Không tìm thấy dữ liệu.</div>}
           </div>
        </div>
      )}

      {/* POPUP EDIT (Responsive) */}
      {editingStudent && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl w-full max-w-md shadow-2xl animate-fade-in-up flex flex-col max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-lg mb-4 text-[#2B6830]">Chỉnh sửa: {editingStudent.name}</h3>
            <div className="space-y-3">
              <input className="w-full border p-3 rounded-xl outline-none focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10 text-sm" value={editingStudent.name} onChange={e => setEditingStudent({...editingStudent, name: e.target.value})} placeholder="Tên" />
              <input className="w-full border p-3 rounded-xl outline-none focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10 text-sm" value={editingStudent.studentCode} onChange={e => setEditingStudent({...editingStudent, studentCode: e.target.value})} placeholder="Mã HV" />
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-2">
                 <p className="text-xs font-bold text-slate-400 uppercase">Cập nhật lớp</p>
                 {[1,2,3].map(i => (
                   <select key={i} className="border p-2 rounded text-sm w-full bg-white outline-none focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10" value={editingStudent[`classId${i}`]} onChange={e => setEditingStudent({...editingStudent, [`classId${i}`]: e.target.value})}>
                     <option value="">-- Lớp {i} --</option>
                     {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                   </select>
                 ))}
              </div>
              {/* Tài khoản DEMO: dùng để thử nghiệm, không tính vào báo cáo & bảng xếp hạng */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl border border-amber-200 bg-amber-50 cursor-pointer">
                <input type="checkbox" checked={!!editingStudent.isDemo} onChange={e => setEditingStudent({...editingStudent, isDemo: e.target.checked})} className="w-4 h-4 accent-amber-500 mt-0.5" />
                <span className="text-xs">
                  <span className="font-bold text-amber-700">Tài khoản DEMO (thử nghiệm)</span>
                  <span className="block text-amber-600/80 mt-0.5">Hiện nhãn DEMO cho nhân sự, KHÔNG xuất hiện trên Bảng Vinh Danh và KHÔNG ghi vào file báo cáo đổi thưởng.</span>
                </span>
              </label>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setEditingStudent(null)} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm hover:bg-slate-50 font-medium">Hủy</button>
              <button onClick={handleUpdate} className="px-5 py-2 bg-[#2B6830] text-white rounded-xl text-sm font-bold hover:bg-[#1E5225] shadow-sm">Lưu</button>
            </div>
          </div>
        </div>
      )}
      {/* --- POPUP (MODAL) CHỌN NGÀY BẮT ĐẦU KHÓA --- */}
      {selectedStudentToLock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
          <div className="bg-white rounded-xl border border-slate-100 p-6 w-full max-w-md shadow-xl animate-scale-up">
            <div className="flex items-center gap-3 mb-4 text-orange-600">
              <div className="p-2 bg-orange-50 rounded-xl">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
              </div>
              <h3 className="text-base font-bold text-slate-800">Cài đặt ngày giới hạn thông báo</h3>
            </div>
            
            <p className="text-slate-500 text-xs leading-relaxed mb-4">
              Học viên <strong className="text-slate-700">{selectedStudentToLock.name}</strong> sẽ <strong>không thể xem</strong> bất kỳ thông báo, báo bài hay tài liệu nào được đăng <strong>từ ngày đã chọn trở về sau</strong>. Các bài đăng trước ngày này vẫn xem được bình thường.
            </p>

            <div className="mb-6">
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Chọn ngày áp dụng khóa</label>
              <input 
                type="date" 
                className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10 text-sm font-semibold bg-slate-50 focus:bg-white transition-colors cursor-pointer"
                value={customLockDate}
                onChange={(e) => setCustomLockDate(e.target.value)}
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setSelectedStudentToLock(null)} 
                className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-50 transition-all active:scale-95"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={handleConfirmLockWithDate} 
                className="px-5 py-2.5 bg-orange-500 text-white rounded-xl text-xs font-bold hover:bg-orange-600 transition-all shadow-md active:scale-95 flex items-center gap-1.5"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 00-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
                Xác nhận khóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentManager;
