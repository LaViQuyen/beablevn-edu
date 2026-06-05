import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { ref, get, update } from 'firebase/database';
import bcrypt from 'bcryptjs';

const Profile = () => {
  const { currentUser } = useAuth();
  const [form, setForm] = useState({ oldPass: '', newPass: '', confirmPass: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');

    if (!form.oldPass || !form.newPass || !form.confirmPass) {
      setError('Vui lòng điền đầy đủ thông tin.'); return;
    }
    if (form.newPass !== form.confirmPass) {
      setError('Mật khẩu xác nhận không khớp.'); return;
    }
    if (form.newPass.length < 6) {
      setError('Mật khẩu mới phải từ 6 ký tự trở lên.'); return;
    }
    if (form.oldPass === form.newPass) {
      setError('Mật khẩu mới phải khác mật khẩu cũ.'); return;
    }

    setLoading(true);
    try {
      const userRef = ref(db, `users/${currentUser.id}`);
      const snapshot = await get(userRef);
      const data = snapshot.val();

      const isMatch = bcrypt.compareSync(form.oldPass, data.password);
      if (!isMatch) { setError('Mật khẩu cũ không đúng.'); setLoading(false); return; }

      const salt = bcrypt.genSaltSync(10);
      const newHash = bcrypt.hashSync(form.newPass, salt);
      await update(userRef, { password: newHash });

      setSuccess('Đổi mật khẩu thành công!');
      setForm({ oldPass: '', newPass: '', confirmPass: '' });
    } catch (err) {
      setError('Lỗi: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 max-w-lg">

      {/* Thông tin cá nhân */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h2 className="text-lg font-bold text-[#2B6830] mb-4">Thông tin tài khoản</h2>
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#2B6830] to-[#3D8B47] flex items-center justify-center text-white text-2xl font-extrabold shrink-0">
              {currentUser?.name?.charAt(0) || '?'}
            </div>
            <div>
              <p className="font-bold text-slate-800 text-lg">{currentUser?.name}</p>
              <p className="text-xs text-slate-400 font-mono">{currentUser?.studentCode || currentUser?.loginId}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vai trò</p>
              <p className="font-bold text-slate-700 text-sm mt-0.5">Học viên</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mã học viên</p>
              <p className="font-bold text-[#2B6830] text-sm font-mono mt-0.5">{currentUser?.studentCode || '—'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Đổi mật khẩu */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h2 className="text-lg font-bold text-[#2B6830] mb-1">Đổi mật khẩu</h2>
        <p className="text-xs text-slate-400 mb-4">Mật khẩu phải từ 6 ký tự trở lên.</p>

        {/* Thông báo lỗi / thành công */}
        {error && (
          <div className="mb-4 flex items-start gap-2 bg-red-50 text-red-700 border border-red-200 px-4 py-3 rounded-xl text-sm">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0 mt-0.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 flex items-center gap-2 bg-green-50 text-green-700 border border-green-200 px-4 py-3 rounded-xl text-sm font-medium">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            {success}
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Mật khẩu hiện tại</label>
            <input
              type="password"
              className="w-full border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10 transition"
              value={form.oldPass}
              onChange={e => { setForm({...form, oldPass: e.target.value}); setError(''); }}
              placeholder="••••••"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Mật khẩu mới</label>
            <input
              type="password"
              className="w-full border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10 transition"
              value={form.newPass}
              onChange={e => { setForm({...form, newPass: e.target.value}); setError(''); }}
              placeholder="••••••"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Xác nhận mật khẩu mới</label>
            <input
              type="password"
              className={`w-full border p-3 rounded-xl text-sm outline-none focus:ring-2 transition ${
                form.confirmPass && form.newPass !== form.confirmPass
                  ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                  : 'border-slate-200 focus:border-[#2B6830] focus:ring-[#2B6830]/10'
              }`}
              value={form.confirmPass}
              onChange={e => { setForm({...form, confirmPass: e.target.value}); setError(''); }}
              placeholder="••••••"
            />
            {form.confirmPass && form.newPass !== form.confirmPass && (
              <p className="text-red-500 text-xs mt-1">Mật khẩu không khớp</p>
            )}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#2B6830] text-white py-3 rounded-xl font-bold hover:bg-[#1E5225] transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Đang xử lý...
              </>
            ) : '🔒 Lưu mật khẩu mới'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Profile;
