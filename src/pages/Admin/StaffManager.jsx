import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { ref, set, onValue, remove, update, push } from "firebase/database";
import bcrypt from 'bcryptjs';

// ============================================================
// MODAL XÁC NHẬN XÓA
// ============================================================
const ConfirmModal = ({ message, onConfirm, onCancel }) => (
  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4 border border-slate-100">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#dc2626" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-slate-700">{message}</p>
      </div>
      <div className="flex gap-3 justify-end">
        <button onClick={onCancel} className="btn-secondary">Hủy</button>
        <button onClick={onConfirm} className="btn-danger">Xóa</button>
      </div>
    </div>
  </div>
);

// ============================================================
// MODAL ĐỔI MẬT KHẨU — thay window.prompt
// ============================================================
const ChangePasswordModal = ({ staff, onConfirm, onCancel }) => {
  const [newPass, setNewPass] = useState('BAVNbavn');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (newPass.length < 6) { setError('Mật khẩu phải từ 6 ký tự trở lên.'); return; }
    onConfirm(newPass);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4 border border-slate-100">
        <h3 className="font-bold text-[#2B6830] text-base">Đổi mật khẩu: {staff.name}</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="stat-label block mb-1">Mật khẩu mới</label>
            <input
              type="text"
              className="input-base font-mono"
              value={newPass}
              onChange={e => { setNewPass(e.target.value); setError(''); }}
              autoFocus
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onCancel} className="btn-secondary">Hủy</button>
            <button type="submit" className="btn-primary">Xác nhận</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================
// MAIN COMPONENT
// ============================================================
const StaffManager = () => {
  const [formData, setFormData] = useState({ name: '', username: '', password: 'BAVNbavn', subRole: 'teacher', assignedClasses: [], ffAccess: false, ffPlusAccess: false, bodAccess: false, modAccess: false });
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [availableClasses, setAvailableClasses] = useState([]);
  const [editingStaff, setEditingStaff] = useState(null);

  // Modal states
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [changePassTarget, setChangePassTarget] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  // Bộ lọc
  const [filterRole, setFilterRole] = useState('all');
  const [filterClass, setFilterClass] = useState('all');

  useEffect(() => {
    onValue(ref(db, 'classes'), (snap) => setAvailableClasses(snap.val() ? Object.entries(snap.val()).map(([id, val]) => ({ id, ...val })) : []));
    onValue(ref(db, 'users'), (snap) => {
      const data = snap.val();
      if (data) setStaffList(Object.entries(data).map(([id, val]) => ({ id, ...val })).filter(u => u.role === 'staff'));
      setLoading(false);
    });
  }, []);

  const handleClassToggle = (classId) => {
    const current = editingStaff ? (editingStaff.assignedClasses || []) : formData.assignedClasses;
    const newClasses = current.includes(classId) ? current.filter(id => id !== classId) : [...current, classId];
    editingStaff ? setEditingStaff({ ...editingStaff, assignedClasses: newClasses }) : setFormData({ ...formData, assignedClasses: newClasses });
  };

  const showSuccess = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 3500); };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.username || !formData.password) { showSuccess('⚠️ Vui lòng điền đầy đủ thông tin!'); return; }
    try {
      const salt = bcrypt.genSaltSync(10);
      const hashedPassword = bcrypt.hashSync(formData.password, salt);
      const newUserRef = push(ref(db, 'users'));
      await set(newUserRef, {
        ...formData,
        email: `${formData.username.trim()}@beable.vn`,
        loginId: formData.username,
        password: hashedPassword,
        role: 'staff',
        createdAt: new Date().toISOString()
      });
      showSuccess(`Đã tạo nhân sự "${formData.name}" · ID: ${formData.username}`);
      setFormData({ name: '', username: '', password: 'BAVNbavn', subRole: 'teacher', assignedClasses: [], ffAccess: false, ffPlusAccess: false, bodAccess: false, modAccess: false });
    } catch (error) { showSuccess('❌ Lỗi: ' + error.message); }
  };

  // Bật / tắt quyền FF (Fresh Fit) trên thẻ nhân sự
  const toggleFF = async (staff) => {
    try {
      await update(ref(db, `users/${staff.id}`), { ffAccess: !staff.ffAccess });
      showSuccess(!staff.ffAccess
        ? `Đã gán quyền FF cho "${staff.name}" — truy cập được menu Fresh Fit.`
        : `Đã gỡ quyền FF của "${staff.name}".`);
    } catch (error) { showSuccess('❌ Lỗi: ' + error.message); }
  };

  // Bật / tắt quyền FF+ — cho phép NẠP Credits + cho học viên & nhân sự (nạp tiền mặt)
  const toggleFFPlus = async (staff) => {
    try {
      await update(ref(db, `users/${staff.id}`), { ffPlusAccess: !staff.ffPlusAccess });
      showSuccess(!staff.ffPlusAccess
        ? `Đã gán quyền FF+ cho "${staff.name}" — được nạp Credits + cho học viên.`
        : `Đã gỡ quyền FF+ của "${staff.name}".`);
    } catch (error) { showSuccess('❌ Lỗi: ' + error.message); }
  };

  // Bật / tắt quyền BOD — grant BAVN Credits cho nhân sự, quản lý 2 hệ quà, duyệt đơn đổi quà
  const toggleBOD = async (staff) => {
    try {
      await update(ref(db, `users/${staff.id}`), { bodAccess: !staff.bodAccess });
      showSuccess(!staff.bodAccess
        ? `Đã gán quyền BOD cho "${staff.name}" — truy cập được BAVN Center.`
        : `Đã gỡ quyền BOD của "${staff.name}".`);
    } catch (error) { showSuccess('❌ Lỗi: ' + error.message); }
  };

  // Bật / tắt quyền MODERATION — được THƯỞNG BONUS (kèm lý do) cho nhân sự khác (không tự thưởng)
  const toggleMod = async (staff) => {
    try {
      await update(ref(db, `users/${staff.id}`), { modAccess: !staff.modAccess });
      showSuccess(!staff.modAccess
        ? `Đã gán quyền MOD cho "${staff.name}" — được thưởng Bonus cho nhân sự khác.`
        : `Đã gỡ quyền MOD của "${staff.name}".`);
    } catch (error) { showSuccess('❌ Lỗi: ' + error.message); }
  };

  // Xác nhận đổi mật khẩu (từ modal)
  const confirmChangePassword = async (newPass) => {
    const staff = changePassTarget;
    setChangePassTarget(null);
    try {
      const salt = bcrypt.genSaltSync(10);
      const hashedPassword = bcrypt.hashSync(newPass, salt);
      await update(ref(db, `users/${staff.id}`), { password: hashedPassword });
      showSuccess(`Đã đổi mật khẩu cho "${staff.name}" · Mật khẩu mới: ${newPass}`);
    } catch (error) { showSuccess('❌ Lỗi: ' + error.message); }
  };

  // Xác nhận xóa (từ modal)
  const confirmDelete = async () => {
    await remove(ref(db, `users/${deleteTarget}`));
    setDeleteTarget(null);
  };

  const getClassNames = (ids) => (!ids || !ids.length)
    ? <span className="text-slate-300 italic">--</span>
    : ids.map(id => availableClasses.find(c => c.id === id)?.name || id).join(", ");

  const filteredStaffList = staffList.filter(staff => {
    if (filterRole === 'ff') { if (!staff.ffAccess) return false; }
    else if (filterRole === 'ffplus') { if (!staff.ffPlusAccess) return false; }
    else if (filterRole === 'bod') { if (!staff.bodAccess) return false; }
    else if (filterRole === 'mod') { if (!staff.modAccess) return false; }
    else if (filterRole !== 'all' && staff.subRole !== filterRole) return false;
    if (filterClass !== 'all') {
      const assigned = staff.assignedClasses || [];
      if (!assigned.includes(filterClass)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 pb-20">

      {/* MODALS */}
      {deleteTarget && (
        <ConfirmModal
          message="Xóa nhân sự này? Hành động không thể hoàn tác."
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
      {changePassTarget && (
        <ChangePasswordModal
          staff={changePassTarget}
          onConfirm={confirmChangePassword}
          onCancel={() => setChangePassTarget(null)}
        />
      )}

      {/* FLASH SUCCESS */}
      {successMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 animate-fade-in-up">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          {successMsg}
        </div>
      )}

      {/* FORM TẠO MỚI */}
      <div className="card-std p-5 md:p-6">
        <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-4">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#2B6830" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3.75 15a2.25 2.25 0 012.25-2.25h2.93a2.625 2.625 0 011.603.543c.47.372.673.855.567 1.348l-.053.25c-.29.988-1.2 1.609-2.227 1.609H6.262c-1.026 0-1.936-.621-2.226-1.61l-.054-.25a1.884 1.884 0 01.568-1.348z" />
          </svg>
          <h2 className="section-title">Tạo Nhân sự Mới</h2>
        </div>
        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input className="input-base" placeholder="Họ tên" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          <div className="flex gap-2">
            <input className="border border-slate-200 p-3 rounded-xl w-1/2 text-sm outline-none focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10 transition" placeholder="ID Đăng nhập" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} />
            <input className="border border-slate-200 p-3 rounded-xl w-1/2 text-sm outline-none focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10 transition font-mono" placeholder="Mật khẩu" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
          </div>
          <div className="flex gap-2 items-stretch">
            <select className="input-base flex-1" value={formData.subRole} onChange={e => setFormData({...formData, subRole: e.target.value})}>
              <option value="teacher">Giáo viên</option>
              <option value="cco">CCO</option>
              <option value="cca">CCA</option>
            </select>
            {/* Quyền FF: truy cập menu Fresh Fit + duyệt đổi credits */}
            <label className={`flex items-center gap-2 px-3 rounded-xl border text-sm font-bold cursor-pointer transition-colors ${formData.ffAccess ? 'bg-[#E8F4EC] border-green-300 text-[#2B6830]' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
              <input type="checkbox" className="accent-[#2B6830] w-4 h-4" checked={formData.ffAccess} onChange={e => setFormData({ ...formData, ffAccess: e.target.checked })} />
              🌿 FF
            </label>
            {/* Quyền FF+: nạp Credits + cho học viên & nhân sự (nạp tiền mặt) */}
            <label className={`flex items-center gap-2 px-3 rounded-xl border text-sm font-bold cursor-pointer transition-colors ${formData.ffPlusAccess ? 'bg-sky-50 border-sky-300 text-sky-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
              <input type="checkbox" className="accent-sky-600 w-4 h-4" checked={formData.ffPlusAccess} onChange={e => setFormData({ ...formData, ffPlusAccess: e.target.checked })} />
              💳 FF+
            </label>
            {/* Quyền BOD: grant Credits + quản lý hệ quà + duyệt đơn quà */}
            <label className={`flex items-center gap-2 px-3 rounded-xl border text-sm font-bold cursor-pointer transition-colors ${formData.bodAccess ? 'bg-purple-50 border-purple-300 text-purple-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
              <input type="checkbox" className="accent-purple-600 w-4 h-4" checked={formData.bodAccess} onChange={e => setFormData({ ...formData, bodAccess: e.target.checked })} />
              👑 BOD
            </label>
            {/* Quyền MOD: thưởng Bonus (kèm lý do) cho nhân sự khác — không tự thưởng */}
            <label className={`flex items-center gap-2 px-3 rounded-xl border text-sm font-bold cursor-pointer transition-colors ${formData.modAccess ? 'bg-rose-50 border-rose-300 text-rose-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
              <input type="checkbox" className="accent-rose-600 w-4 h-4" checked={formData.modAccess} onChange={e => setFormData({ ...formData, modAccess: e.target.checked })} />
              🛡️ MOD
            </label>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl h-32 overflow-y-auto border border-slate-200">
            <p className="text-xs font-bold text-slate-500 uppercase mb-2">Gán lớp:</p>
            {availableClasses.map(c => (
              <label key={c.id} className="flex items-center gap-2 text-sm mb-1 cursor-pointer hover:text-[#2B6830] transition-colors">
                <input type="checkbox" className="accent-[#2B6830] w-4 h-4" checked={formData.assignedClasses.includes(c.id)} onChange={() => handleClassToggle(c.id)} />
                {c.name}
              </label>
            ))}
          </div>
          <button className="btn-primary md:col-span-2">Tạo Tài khoản</button>
        </form>
      </div>

      {/* MODAL CHỈNH SỬA LỚP */}
      {editingStaff && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
            <h3 className="section-title mb-4">Điều chỉnh nhân sự: {editingStaff.name}</h3>
            {/* Đổi VAI TRÒ (title) cho tài khoản đã tạo */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Vai trò (title)</label>
              <select
                value={editingStaff.subRole || 'teacher'}
                onChange={e => setEditingStaff({ ...editingStaff, subRole: e.target.value })}
                className="input-base"
              >
                <option value="teacher">Giáo viên</option>
                <option value="cco">CCO</option>
                <option value="cca">CCA</option>
              </select>
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase mb-1">Lớp phụ trách</p>
            <div className="flex-1 overflow-y-auto space-y-2 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
              {availableClasses.map((cls) => (
                <label key={cls.id} className="flex items-center space-x-3 cursor-pointer text-sm p-2 hover:bg-slate-100 rounded-xl">
                  <input type="checkbox" className="accent-[#2B6830] w-5 h-5" checked={(editingStaff.assignedClasses || []).includes(cls.id)} onChange={() => handleClassToggle(cls.id)} />
                  <span className="font-medium text-slate-700">{cls.name}</span>
                </label>
              ))}
            </div>
            {/* Tài khoản DEMO: thử nghiệm, không tính vào báo cáo & bảng xếp hạng */}
            <label className="flex items-start gap-2.5 p-3 mb-3 rounded-xl border border-amber-200 bg-amber-50 cursor-pointer">
              <input type="checkbox" checked={!!editingStaff.isDemo} onChange={e => setEditingStaff({ ...editingStaff, isDemo: e.target.checked })} className="w-4 h-4 accent-amber-500 mt-0.5" />
              <span className="text-xs">
                <span className="font-bold text-amber-700">Tài khoản DEMO (thử nghiệm)</span>
                <span className="block text-amber-600/80 mt-0.5">Hiện nhãn DEMO cho nhân sự, KHÔNG vào file báo cáo đổi thưởng.</span>
              </span>
            </label>
            <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
              <button onClick={() => setEditingStaff(null)} className="btn-secondary">Hủy</button>
              <button onClick={() => { update(ref(db, `users/${editingStaff.id}`), { assignedClasses: editingStaff.assignedClasses, isDemo: !!editingStaff.isDemo, subRole: editingStaff.subRole || 'teacher' }); setEditingStaff(null); showSuccess('Đã cập nhật nhân sự.'); }} className="btn-primary">Lưu</button>
            </div>
          </div>
        </div>
      )}

      {/* DANH SÁCH NHÂN SỰ */}
      <div className="card-std p-5 md:p-6 overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#2B6830" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
            <h2 className="section-title">Danh sách Nhân sự ({filteredStaffList.length})</h2>
          </div>
          <div className="flex flex-col md:flex-row gap-2">
            <select className="p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10 bg-slate-50" value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
              <option value="all">Tất cả vai trò</option>
              <option value="teacher">Giáo viên</option>
              <option value="cco">CCO</option>
              <option value="cca">CCA</option>
              <option value="ff">🌿 Có quyền FF</option>
              <option value="ffplus">💳 Có quyền FF+</option>
              <option value="bod">👑 Có quyền BOD</option>
              <option value="mod">🛡️ Có quyền MOD</option>
            </select>
            <select className="p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10 bg-slate-50 md:min-w-[150px]" value={filterClass} onChange={(e) => setFilterClass(e.target.value)}>
              <option value="all">Tất cả lớp</option>
              {availableClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        {/* DESKTOP TABLE */}
        <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200">
          <table className="table-std">
            <thead>
              <tr>
                <th className="w-12 text-center">STT</th>
                <th>ID Đăng nhập</th>
                <th>Tên</th>
                <th>Vai trò</th>
                <th>Lớp</th>
                <th className="text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredStaffList.map((s, index) => (
                <tr key={s.id}>
                  <td className="text-center text-slate-400 font-bold">{index + 1}</td>
                  <td className="font-bold text-[#2B6830]">{s.loginId || (s.email || '').split('@')[0]}</td>
                  <td className="font-medium text-gray-800">{s.name}</td>
                  <td>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="uppercase text-[10px] font-bold text-slate-400">{s.subRole}</span>
                      {s.ffAccess && <span className="text-[9px] font-bold bg-[#E8F4EC] text-[#2B6830] px-1.5 py-0.5 rounded border border-green-200 uppercase">🌿 FF</span>}
                      {s.ffPlusAccess && <span className="text-[9px] font-bold bg-sky-50 text-sky-700 px-1.5 py-0.5 rounded border border-sky-200 uppercase">💳 FF+</span>}
                      {s.bodAccess && <span className="text-[9px] font-bold bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200 uppercase">👑 BOD</span>}
                      {s.modAccess && <span className="text-[9px] font-bold bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded border border-rose-200 uppercase">🛡️ MOD</span>}
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="truncate max-w-[150px] text-xs text-slate-600">{getClassNames(s.assignedClasses)}</span>
                      <button onClick={() => setEditingStaff(s)} className="text-[#2B6830] border border-[#2B6830] text-[10px] font-bold px-2 py-0.5 rounded-xl hover:bg-[#2B6830] hover:text-white transition-all">Sửa</button>
                    </div>
                  </td>
                  <td className="text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => toggleFF(s)}
                        title={s.ffAccess ? 'Gỡ quyền Fresh Fit' : 'Gán quyền Fresh Fit (duyệt đổi credits)'}
                        className={`px-2 py-1 rounded-xl text-[10px] font-bold border transition-colors ${s.ffAccess ? 'text-white bg-[#2B6830] border-[#2B6830] hover:bg-[#1E5225]' : 'text-[#2B6830] border-green-300 hover:bg-[#E8F4EC]'}`}
                      >
                        FF {s.ffAccess ? 'ON' : 'OFF'}
                      </button>
                      <button
                        onClick={() => toggleFFPlus(s)}
                        title={s.ffPlusAccess ? 'Gỡ quyền FF+ (nạp Credits +)' : 'Gán quyền FF+ — nạp Credits + cho học viên & nhân sự'}
                        className={`px-2 py-1 rounded-xl text-[10px] font-bold border transition-colors ${s.ffPlusAccess ? 'text-white bg-sky-600 border-sky-600 hover:bg-sky-700' : 'text-sky-600 border-sky-300 hover:bg-sky-50'}`}
                      >
                        FF+ {s.ffPlusAccess ? 'ON' : 'OFF'}
                      </button>
                      <button
                        onClick={() => toggleBOD(s)}
                        title={s.bodAccess ? 'Gỡ quyền BOD' : 'Gán quyền BOD — grant Credits, quản lý hệ quà, duyệt đơn quà'}
                        className={`px-2 py-1 rounded-xl text-[10px] font-bold border transition-colors ${s.bodAccess ? 'text-white bg-purple-600 border-purple-600 hover:bg-purple-700' : 'text-purple-600 border-purple-300 hover:bg-purple-50'}`}
                      >
                        BOD {s.bodAccess ? 'ON' : 'OFF'}
                      </button>
                      <button
                        onClick={() => toggleMod(s)}
                        title={s.modAccess ? 'Gỡ quyền MOD' : 'Gán quyền MOD — thưởng Bonus cho nhân sự khác (không tự thưởng)'}
                        className={`px-2 py-1 rounded-xl text-[10px] font-bold border transition-colors ${s.modAccess ? 'text-white bg-rose-600 border-rose-600 hover:bg-rose-700' : 'text-rose-600 border-rose-300 hover:bg-rose-50'}`}
                      >
                        MOD {s.modAccess ? 'ON' : 'OFF'}
                      </button>
                      <button onClick={() => setChangePassTarget(s)} className="text-amber-600 border border-amber-300 px-2 py-1 rounded-xl text-[10px] font-bold hover:bg-amber-50 transition-colors">Pass</button>
                      <button onClick={() => setDeleteTarget(s.id)} className="text-red-500 border border-red-200 px-2 py-1 rounded-xl text-[10px] font-bold hover:bg-red-50 transition-colors">Xóa</button>
                    </div>
                  </td>
                </tr>
              ))}
              {loading && [1,2,3].map(i => (
                <tr key={i} className="animate-pulse">
                  {[1,2,3,4,5,6].map(j => <td key={j}><div className="h-4 bg-slate-100 rounded w-full" /></td>)}
                </tr>
              ))}
              {!loading && filteredStaffList.length === 0 && (
                <tr><td colSpan="6" className="p-8 text-center text-slate-400 italic">Không tìm thấy dữ liệu.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* MOBILE CARDS */}
        <div className="md:hidden space-y-3">
          {filteredStaffList.map((s, index) => (
            <div key={s.id} className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#E8F4EC] text-[#2B6830] flex items-center justify-center font-bold text-xs">{index + 1}</div>
                  <div>
                    <h4 className="font-bold text-[#2B6830] text-sm">{s.name}</h4>
                    <p className="text-xs text-slate-500">@{s.loginId || (s.email || '').split('@')[0]}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="uppercase text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded">{s.subRole}</span>
                  {s.ffAccess && <span className="text-[9px] font-bold bg-[#E8F4EC] text-[#2B6830] px-1.5 py-0.5 rounded border border-green-200 uppercase">🌿 FF</span>}
                  {s.ffPlusAccess && <span className="text-[9px] font-bold bg-sky-50 text-sky-700 px-1.5 py-0.5 rounded border border-sky-200 uppercase">💳 FF+</span>}
                  {s.bodAccess && <span className="text-[9px] font-bold bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200 uppercase">👑 BOD</span>}
                  {s.modAccess && <span className="text-[9px] font-bold bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded border border-rose-200 uppercase">🛡️ MOD</span>}
                </div>
              </div>
              <div className="text-xs bg-slate-50 p-2 rounded-xl border border-slate-100">
                <span className="font-bold text-slate-500 block mb-1 uppercase">Lớp phụ trách:</span>
                <div className="flex justify-between items-center">
                  <span className="text-slate-700 truncate mr-2">{getClassNames(s.assignedClasses)}</span>
                  <button onClick={() => setEditingStaff(s)} className="text-[#2B6830] border border-[#2B6830] text-[10px] font-bold px-2 py-0.5 rounded-xl hover:bg-[#2B6830] hover:text-white transition-all whitespace-nowrap">Sửa</button>
                </div>
              </div>
              <div className="flex gap-2 border-t border-slate-100 pt-3 flex-wrap">
                <button onClick={() => toggleFF(s)} className={`flex-1 text-center py-2 rounded-xl text-xs font-bold border transition-colors ${s.ffAccess ? 'text-white bg-[#2B6830] border-[#2B6830]' : 'text-[#2B6830] bg-[#E8F4EC] border-green-200 active:bg-green-100'}`}>
                  FF {s.ffAccess ? 'ON' : 'OFF'}
                </button>
                <button onClick={() => toggleFFPlus(s)} className={`flex-1 text-center py-2 rounded-xl text-xs font-bold border transition-colors ${s.ffPlusAccess ? 'text-white bg-sky-600 border-sky-600' : 'text-sky-600 bg-sky-50 border-sky-200 active:bg-sky-100'}`}>
                  FF+ {s.ffPlusAccess ? 'ON' : 'OFF'}
                </button>
                <button onClick={() => toggleBOD(s)} className={`flex-1 text-center py-2 rounded-xl text-xs font-bold border transition-colors ${s.bodAccess ? 'text-white bg-purple-600 border-purple-600' : 'text-purple-600 bg-purple-50 border-purple-200 active:bg-purple-100'}`}>
                  BOD {s.bodAccess ? 'ON' : 'OFF'}
                </button>
                <button onClick={() => toggleMod(s)} className={`flex-1 text-center py-2 rounded-xl text-xs font-bold border transition-colors ${s.modAccess ? 'text-white bg-rose-600 border-rose-600' : 'text-rose-600 bg-rose-50 border-rose-200 active:bg-rose-100'}`}>
                  MOD {s.modAccess ? 'ON' : 'OFF'}
                </button>
                <button onClick={() => setChangePassTarget(s)} className="flex-1 text-center py-2 text-amber-700 bg-amber-50 rounded-xl text-xs font-bold border border-amber-200 active:bg-amber-100">Pass</button>
                <button onClick={() => setDeleteTarget(s.id)} className="flex-1 text-center py-2 text-red-600 bg-red-50 rounded-xl text-xs font-bold border border-red-200 active:bg-red-100">Xóa</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StaffManager;
