import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebase';
import { ref, set, onValue, update, remove, push } from 'firebase/database';
import bcrypt from 'bcryptjs';
import { normClassIds } from '../../utils/contactBook';

// ============================================================
// QUẢN LÝ PHỤ HUYNH (Admin)
// - Tạo tài khoản phụ huynh (role 'parent') + liên kết 1..n học viên
// - Liên kết lưu ở node parentLinks/{parentUid}/{studentId}: true
//   (dạng map để Rules tra được quyền đọc hồ sơ con)
// - Mật khẩu hash bcrypt, lưu ở node riêng userAuth/{uid} (giống học viên)
// ============================================================

const ConfirmModal = ({ title, message, confirmLabel = 'Xác nhận', confirmColor = 'bg-red-500 hover:bg-red-600', onConfirm, onCancel }) => (
  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
    <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4 border border-slate-100">
      <p className="text-base font-bold text-slate-800">{title}</p>
      {message && <p className="text-sm text-slate-500">{message}</p>}
      <div className="flex gap-3 justify-end">
        <button onClick={onCancel} className="btn-secondary">Hủy</button>
        <button onClick={onConfirm} className={`px-4 py-2 rounded-xl text-sm font-bold text-white transition-colors ${confirmColor}`}>{confirmLabel}</button>
      </div>
    </div>
  </div>
);

const ChangePasswordModal = ({ parent, onConfirm, onCancel }) => {
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
        <h3 className="font-bold text-primary text-base">Đổi mật khẩu: {parent.name}</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="stat-label block mb-1">Mật khẩu mới</label>
            <input type="text" className="input-base font-mono" value={newPass} onChange={e => { setNewPass(e.target.value); setError(''); }} autoFocus />
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

// Bộ chọn học viên để liên kết: tìm theo tên / mã HV, chọn nhiều
const ChildPicker = ({ students, classes, selected, onChange }) => {
  const [term, setTerm] = useState('');
  // normClassIds: classIds trong DB có thể là object (dữ liệu cũ), .map thẳng sẽ crash
  const className = (ids) => normClassIds(ids).map(id => classes.find(c => c.id === id)?.name || '').filter(Boolean).join(', ');
  const matches = useMemo(() => {
    const t = term.trim().toLowerCase();
    if (!t) return [];
    return students
      .filter(s => !selected.includes(s.id))
      .filter(s => (s.name || '').toLowerCase().includes(t) || (s.studentCode || '').toLowerCase().includes(t))
      .slice(0, 8);
  }, [term, students, selected]);

  return (
    <div className="space-y-2">
      {/* Chip các con đã chọn */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map(sid => {
            const s = students.find(x => x.id === sid);
            return (
              <span key={sid} className="inline-flex items-center gap-1.5 bg-primary-light text-primary text-xs font-bold px-3 py-1.5 rounded-xl border border-green-200">
                {s ? `${s.name} (${s.studentCode || '–'})` : sid}
                <button type="button" onClick={() => onChange(selected.filter(x => x !== sid))} className="text-green-700 hover:text-red-500 font-black">✕</button>
              </span>
            );
          })}
        </div>
      )}
      <input
        className="input-base"
        placeholder="Gõ tên hoặc Mã HV để tìm học viên cần liên kết..."
        value={term}
        onChange={e => setTerm(e.target.value)}
      />
      {term.trim() && (
        <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-white">
          {matches.length ? matches.map(s => (
            <button key={s.id} type="button"
              onClick={() => { onChange([...selected, s.id]); setTerm(''); }}
              className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left hover:bg-primary-subtle transition-colors">
              <span className="min-w-0">
                <span className="block text-sm font-bold text-slate-700">{s.name}</span>
                <span className="block text-[11px] text-slate-400 truncate">Mã HV: {s.studentCode || '–'}{className(s.classIds) ? ` · ${className(s.classIds)}` : ''}</span>
              </span>
              <span className="text-primary text-xs font-bold shrink-0">+ Liên kết</span>
            </button>
          )) : (
            <p className="px-3.5 py-3 text-xs text-slate-400 italic">Không tìm thấy học viên phù hợp.</p>
          )}
        </div>
      )}
    </div>
  );
};

const ParentManager = () => {
  const [activeTab, setActiveTab] = useState('create');
  const [allUsers, setAllUsers] = useState([]);       // toàn bộ users (để check trùng login + tra tên con)
  const [parentLinks, setParentLinks] = useState({}); // { parentUid: { sid: true } }
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({ name: '', phone: '', username: '', password: 'BAVNbavn' });
  const [formChildren, setFormChildren] = useState([]);
  const [successMsg, setSuccessMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [editingParent, setEditingParent] = useState(null); // { id, name, phone, username, children: [] }
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [changePassTarget, setChangePassTarget] = useState(null);
  const [lockTarget, setLockTarget] = useState(null);

  useEffect(() => {
    const unsubs = [
      onValue(ref(db, 'users'), (snap) => {
        const data = snap.val() || {};
        setAllUsers(Object.entries(data).map(([id, val]) => ({ id, ...val })));
        setLoading(false);
      }),
      onValue(ref(db, 'parentLinks'), (snap) => setParentLinks(snap.val() || {})),
      onValue(ref(db, 'classes'), (snap) => {
        const data = snap.val() || {};
        setClasses(Object.entries(data).map(([id, val]) => ({ id, ...val })));
      }),
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  const parents = allUsers.filter(u => u.role === 'parent').sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'));
  const students = allUsers.filter(u => u.role === 'student');

  const showSuccess = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 3500); };

  const childrenOf = (parentId) => Object.keys(parentLinks[parentId] || {})
    .map(sid => students.find(s => s.id === sid))
    .filter(Boolean);

  // Tên đăng nhập không được trùng với BẤT KỲ khóa đăng nhập nào (issueToken tra 4 field)
  const loginTaken = (login, exceptId = null) => {
    const v = login.trim().toLowerCase();
    return allUsers.some(u => u.id !== exceptId && [u.username, u.loginId, u.email, u.studentCode]
      .some(k => k && String(k).toLowerCase() === v));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const { name, phone, username, password } = formData;
    if (!name.trim() || !username.trim() || !password) return showSuccess('⚠️ Vui lòng nhập Họ tên, Tên đăng nhập và Mật khẩu.');
    if (password.length < 6) return showSuccess('⚠️ Mật khẩu phải từ 6 ký tự trở lên.');
    if (/[.#$/\[\]]/.test(username)) return showSuccess('⚠️ Tên đăng nhập không được chứa ký tự . # $ / [ ]');
    if (loginTaken(username)) return showSuccess('⚠️ Tên đăng nhập này đã tồn tại trong hệ thống.');
    if (!formChildren.length) return showSuccess('⚠️ Chọn ít nhất 1 học viên để liên kết.');

    try {
      const salt = bcrypt.genSaltSync(10);
      const hashed = bcrypt.hashSync(password, salt);
      const newRef = push(ref(db, 'users'));
      await set(newRef, {
        name: name.trim(),
        phone: phone.trim(),
        username: username.trim(),
        loginId: username.trim(),
        role: 'parent',
        createdAt: new Date().toISOString(),
      });
      await set(ref(db, `userAuth/${newRef.key}`), { password: hashed });
      const links = {};
      formChildren.forEach(sid => { links[sid] = true; });
      await set(ref(db, `parentLinks/${newRef.key}`), links);
      showSuccess(`✅ Đã tạo tài khoản phụ huynh "${name.trim()}" · liên kết ${formChildren.length} học viên.`);
      setFormData({ name: '', phone: '', username: '', password: 'BAVNbavn' });
      setFormChildren([]);
    } catch (err) { showSuccess('❌ Lỗi: ' + err.message); }
  };

  const handleUpdate = async () => {
    if (!editingParent) return;
    const { id, name, phone, username, children } = editingParent;
    if (!name.trim() || !username.trim()) return showSuccess('⚠️ Thiếu Họ tên hoặc Tên đăng nhập.');
    if (/[.#$/\[\]]/.test(username)) return showSuccess('⚠️ Tên đăng nhập không được chứa ký tự . # $ / [ ]');
    if (loginTaken(username, id)) return showSuccess('⚠️ Tên đăng nhập này đã tồn tại trong hệ thống.');
    if (!children.length) return showSuccess('⚠️ Phụ huynh phải liên kết ít nhất 1 học viên.');
    try {
      await update(ref(db, `users/${id}`), { name: name.trim(), phone: phone.trim(), username: username.trim(), loginId: username.trim() });
      const links = {};
      children.forEach(sid => { links[sid] = true; });
      await set(ref(db, `parentLinks/${id}`), links);
      setEditingParent(null);
      showSuccess('✅ Đã cập nhật thông tin phụ huynh.');
    } catch (err) { showSuccess('❌ Lỗi: ' + err.message); }
  };

  const confirmResetPassword = async (newPass) => {
    const target = changePassTarget;
    setChangePassTarget(null);
    try {
      const salt = bcrypt.genSaltSync(10);
      await update(ref(db, `userAuth/${target.id}`), { password: bcrypt.hashSync(newPass, salt) });
      showSuccess(`Đã đổi mật khẩu cho "${target.name}"`);
    } catch (err) { showSuccess('❌ Lỗi: ' + err.message); }
  };

  const confirmToggleLock = async () => {
    const p = lockTarget;
    setLockTarget(null);
    try {
      const locking = !p.lockedAt;
      await update(ref(db, `users/${p.id}`), { lockedAt: locking ? new Date().toISOString() : null });
      showSuccess(locking ? `🔒 Đã khóa tài khoản "${p.name}"` : `Đã mở khóa tài khoản "${p.name}"`);
    } catch (err) { showSuccess('❌ Lỗi: ' + err.message); }
  };

  const confirmDelete = async () => {
    const p = deleteTarget;
    setDeleteTarget(null);
    try {
      // Dọn đủ 3 nhánh: hồ sơ + mật khẩu + liên kết (tránh dữ liệu mồ côi)
      await remove(ref(db, `users/${p.id}`));
      await remove(ref(db, `userAuth/${p.id}`));
      await remove(ref(db, `parentLinks/${p.id}`));
      showSuccess(`Đã xóa tài khoản phụ huynh "${p.name}".`);
    } catch (err) { showSuccess('❌ Lỗi: ' + err.message); }
  };

  const filteredParents = parents.filter(p => {
    if (!searchTerm.trim()) return true;
    const t = searchTerm.toLowerCase();
    const digits = searchTerm.replace(/\D/g, '');
    const kids = childrenOf(p.id);
    return (p.name || '').toLowerCase().includes(t)
      || (p.username || '').toLowerCase().includes(t)
      || (digits.length >= 3 && String(p.phone || '').replace(/\D/g, '').includes(digits))
      || kids.some(k => (k.name || '').toLowerCase().includes(t) || (k.studentCode || '').toLowerCase().includes(t));
  });

  return (
    <div className="space-y-6 pb-20">
      {/* MODALS */}
      {deleteTarget && <ConfirmModal title={`Xóa tài khoản phụ huynh "${deleteTarget.name}"?`} message="Liên kết với học viên sẽ bị gỡ. Hành động không thể hoàn tác." confirmLabel="Xóa" onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />}
      {lockTarget && <ConfirmModal title={lockTarget.lockedAt ? `Mở khóa tài khoản "${lockTarget.name}"?` : `Khóa tài khoản "${lockTarget.name}"?`} message={lockTarget.lockedAt ? 'Phụ huynh sẽ đăng nhập lại được ngay.' : 'Phụ huynh sẽ không thể đăng nhập cho tới khi được mở khóa.'} confirmLabel={lockTarget.lockedAt ? 'Mở khóa' : 'Khóa'} confirmColor={lockTarget.lockedAt ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-orange-500 hover:bg-orange-600'} onConfirm={confirmToggleLock} onCancel={() => setLockTarget(null)} />}
      {changePassTarget && <ChangePasswordModal parent={changePassTarget} onConfirm={confirmResetPassword} onCancel={() => setChangePassTarget(null)} />}

      {/* FLASH */}
      {successMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
          {successMsg}
        </div>
      )}

      <div>
        <h1 className="page-title">Quản lý Phụ huynh</h1>
        <p className="page-sub">Tạo tài khoản phụ huynh và liên kết với học viên để Ba Mẹ theo sát việc học của con.</p>
      </div>

      <div className="flex gap-4 border-b border-slate-200 overflow-x-auto w-full flex-nowrap scrollbar-hide">
        <button onClick={() => setActiveTab('create')} className={`pb-3 px-4 text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'create' ? 'text-primary border-b-2 border-primary' : 'text-slate-500 hover:text-slate-700'}`}>Thêm Phụ Huynh</button>
        <button onClick={() => setActiveTab('list')} className={`pb-3 px-4 text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'list' ? 'text-primary border-b-2 border-primary' : 'text-slate-500 hover:text-slate-700'}`}>Danh sách ({parents.length})</button>
      </div>

      {/* ===== TAB TẠO MỚI ===== */}
      {activeTab === 'create' && (
        <div className="card-std p-5 md:p-6 animate-fade-in-up">
          <h2 className="section-title mb-4">Thông tin Phụ huynh mới</h2>
          <form onSubmit={handleCreate} className="space-y-4 max-w-2xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="stat-label">Họ và Tên Phụ huynh</label>
                <input className="input-base" placeholder="Nguyễn Thị B" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="stat-label">Số điện thoại</label>
                <input className="input-base" placeholder="09xx xxx xxx" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="stat-label">Tên đăng nhập (Mã PH)</label>
                <input className="input-base" placeholder="VD: PH001 hoặc SĐT" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="stat-label">Mật khẩu</label>
                <input className="input-base" type="text" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="stat-label">Liên kết học viên (con của phụ huynh)</label>
              <ChildPicker students={students} classes={classes} selected={formChildren} onChange={setFormChildren} />
            </div>
            <button className="btn-primary w-full md:w-auto">Tạo tài khoản Phụ huynh</button>
          </form>
        </div>
      )}

      {/* ===== TAB DANH SÁCH ===== */}
      {activeTab === 'list' && (
        <div className="card-std p-5 md:p-6">
          <input
            className="input-base mb-4 md:max-w-md"
            placeholder="Tìm theo tên PH, tên đăng nhập, SĐT hoặc tên/mã con..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />

          {/* DESKTOP TABLE */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200">
            <table className="table-std">
              <thead>
                <tr>
                  <th className="w-12 text-center">STT</th>
                  <th>Phụ huynh</th>
                  <th>Đăng nhập</th>
                  <th>SĐT</th>
                  <th>Học viên liên kết</th>
                  <th className="text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredParents.map((p, index) => {
                  const kids = childrenOf(p.id);
                  return (
                    <tr key={p.id}>
                      <td className="text-center text-slate-400 font-bold">{index + 1}</td>
                      <td className="font-medium">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-800">{p.name}</span>
                          {p.lockedAt && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-orange-50 text-orange-700 border-orange-200">Đã khóa</span>}
                        </div>
                      </td>
                      <td className="font-mono text-primary font-bold">{p.username}</td>
                      <td className="text-slate-600">{p.phone || '–'}</td>
                      <td className="text-slate-600 max-w-xs">
                        {kids.length ? kids.map(k => `${k.name} (${k.studentCode || '–'})`).join(', ') : <span className="text-red-400 italic">Chưa liên kết</span>}
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-2 flex-wrap">
                          <button onClick={() => setEditingParent({ id: p.id, name: p.name || '', phone: p.phone || '', username: p.username || '', children: Object.keys(parentLinks[p.id] || {}) })} className="text-primary border border-primary px-2 py-1 rounded text-xs font-bold hover:bg-primary hover:text-white transition-all">Sửa</button>
                          <button onClick={() => setChangePassTarget(p)} className="text-slate-600 border border-slate-300 px-2 py-1 rounded text-xs font-bold hover:bg-slate-100 hover:border-slate-400 transition-colors">Pass</button>
                          <button onClick={() => setLockTarget(p)} className={`px-2 py-1 rounded text-xs font-bold border transition-colors ${p.lockedAt ? 'text-amber-600 border-amber-500 hover:bg-amber-500 hover:text-white' : 'text-slate-600 border-slate-300 hover:bg-slate-100 hover:border-slate-400'}`}>{p.lockedAt ? 'Mở' : 'Khóa'}</button>
                          <button onClick={() => setDeleteTarget(p)} className="text-red-500 border border-red-200 px-2 py-1 rounded text-xs font-bold hover:bg-red-500 hover:text-white transition-colors">Xóa</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {loading && [1, 2, 3].map(i => (
                  <tr key={i} className="animate-pulse">
                    {[1, 2, 3, 4, 5, 6].map(j => <td key={j}><div className="h-4 bg-slate-100 rounded w-full" /></td>)}
                  </tr>
                ))}
                {!loading && filteredParents.length === 0 && <tr><td colSpan="6" className="p-8 text-center text-slate-400 italic">Chưa có tài khoản phụ huynh nào.</td></tr>}
              </tbody>
            </table>
          </div>

          {/* MOBILE CARDS */}
          <div className="md:hidden space-y-3">
            {filteredParents.map((p, index) => {
              const kids = childrenOf(p.id);
              return (
                <div key={p.id} className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary-light text-primary flex items-center justify-center font-bold text-xs">{index + 1}</div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-primary text-sm flex items-center gap-2 flex-wrap">
                        {p.name}
                        {p.lockedAt && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-orange-50 text-orange-700 border-orange-200">Đã khóa</span>}
                      </h4>
                      <p className="text-xs text-slate-500 font-mono font-bold bg-slate-50 px-1 rounded inline-block mt-0.5">{p.username}{p.phone ? ` · ${p.phone}` : ''}</p>
                    </div>
                  </div>
                  <div className="text-xs bg-slate-50 p-2 rounded border border-slate-100">
                    <span className="font-bold text-slate-500 block mb-1 uppercase">Học viên liên kết:</span>
                    <div className="text-slate-700">{kids.length ? kids.map(k => `${k.name} (${k.studentCode || '–'})`).join(', ') : 'Chưa liên kết'}</div>
                  </div>
                  <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3 mt-1">
                    <button onClick={() => setEditingParent({ id: p.id, name: p.name || '', phone: p.phone || '', username: p.username || '', children: Object.keys(parentLinks[p.id] || {}) })} className="flex-1 min-w-[60px] py-2 text-primary bg-primary-light rounded-xl text-xs font-bold border border-green-200 active:bg-green-100">Sửa</button>
                    <button onClick={() => setChangePassTarget(p)} className="flex-1 min-w-[60px] py-2 text-slate-600 bg-slate-50 rounded-xl text-xs font-bold border border-slate-200 active:bg-slate-100">Pass</button>
                    <button onClick={() => setLockTarget(p)} className={`flex-1 min-w-[60px] py-2 rounded-xl text-xs font-bold border transition-colors ${p.lockedAt ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-slate-600 bg-slate-50 border-slate-200'}`}>{p.lockedAt ? 'Mở Khóa' : 'Khóa'}</button>
                    <button onClick={() => setDeleteTarget(p)} className="flex-1 min-w-[60px] py-2 text-red-600 bg-red-50 rounded-xl text-xs font-bold border border-red-200 active:bg-red-100">Xóa</button>
                  </div>
                </div>
              );
            })}
            {loading && [1, 2].map(i => <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />)}
            {!loading && filteredParents.length === 0 && <div className="p-8 text-center text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">Chưa có tài khoản phụ huynh nào.</div>}
          </div>
        </div>
      )}

      {/* ===== POPUP SỬA ===== */}
      {editingParent && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl w-full max-w-md shadow-2xl animate-fade-in-up flex flex-col max-h-[90vh] overflow-y-auto">
            <h3 className="section-title mb-4">Chỉnh sửa: {editingParent.name}</h3>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="stat-label">Họ và Tên</label>
                <input className="input-base" value={editingParent.name} onChange={e => setEditingParent({ ...editingParent, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="stat-label">Số điện thoại</label>
                <input className="input-base" value={editingParent.phone} onChange={e => setEditingParent({ ...editingParent, phone: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="stat-label">Tên đăng nhập</label>
                <input className="input-base font-mono" value={editingParent.username} onChange={e => setEditingParent({ ...editingParent, username: e.target.value })} />
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-2">
                <p className="text-xs font-bold text-slate-400 uppercase">Học viên liên kết</p>
                <ChildPicker students={students} classes={classes} selected={editingParent.children} onChange={(children) => setEditingParent({ ...editingParent, children })} />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setEditingParent(null)} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm hover:bg-slate-50 font-medium">Hủy</button>
              <button onClick={handleUpdate} className="btn-primary">Lưu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParentManager;
