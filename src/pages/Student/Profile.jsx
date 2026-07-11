import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { ref, get, update, onValue } from 'firebase/database';
import bcrypt from 'bcryptjs';
import StudentAvatar from '../../components/StudentAvatar';
import { DEFAULT_SKINS, DEFAULT_SKIN_ID, getSkin, normalizeSkin, getTitle } from '../../data/skins';

const Profile = () => {
  const { currentUser } = useAuth();
  const [equipped, setEquipped] = useState(DEFAULT_SKIN_ID);
  const [owned, setOwned] = useState({});       // skin đã sở hữu → tính danh hiệu
  const [dbSkins, setDbSkins] = useState(null); // catalog DB
  const [form, setForm] = useState({ oldPass: '', newPass: '', confirmPass: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Lắng nghe skin của học viên + catalog
  useEffect(() => {
    if (!currentUser?.id) return;
    const unsubMine = onValue(ref(db, `studentSkins/${currentUser.id}`), (snap) => {
      const d = snap.val() || {};
      setEquipped(d.equipped || DEFAULT_SKIN_ID);
      setOwned(d.owned || {});
    });
    const unsubSkins = onValue(ref(db, 'skins'), (snap) => setDbSkins(snap.val() || {}));
    return () => { unsubMine(); unsubSkins(); };
  }, [currentUser?.id]);

  // Catalog hiệu lực (DB nếu có, ngược lại mặc định)
  const catalog = useMemo(() => {
    if (dbSkins && Object.keys(dbSkins).length > 0)
      return Object.entries(dbSkins).map(([id, v]) => normalizeSkin(v, id));
    return DEFAULT_SKINS.map(s => normalizeSkin(s));
  }, [dbSkins]);

  // Skin đang trang bị (object) + danh hiệu (skin mốc cao nhất đã mở)
  const equippedSkin = catalog.find(s => s.id === equipped) || getSkin(equipped);
  const title = getTitle(owned, catalog);

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
    <div className="space-y-6 pb-20">
      {/* PAGE HEADER */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
        <div className="p-2 bg-primary-light rounded-xl text-primary-medium">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
        </div>
        <div>
          <h2 className="page-title">Hồ sơ cá nhân</h2>
          <p className="page-sub">Thông tin tài khoản của bạn.</p>
        </div>
      </div>

      {/* Thông tin cá nhân */}
      <div className="card-std p-6">
        <h2 className="section-title mb-4">Thông tin tài khoản</h2>
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <StudentAvatar skin={equippedSkin} name={currentUser?.name} size={56} />
            <div>
              <p className="font-bold text-slate-800 text-lg">{currentUser?.name}</p>
              {/* Danh hiệu: skin MỐC cao nhất đã mở khóa bằng thành tích */}
              {title && (
                <span className="inline-block text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 mt-0.5">🏅 {title}</span>
              )}
              <p className="text-xs text-slate-400 font-mono mt-0.5">{currentUser?.studentCode || currentUser?.loginId}</p>
              <Link to="/student/skins" className="inline-block mt-1 text-[11px] font-bold text-primary hover:underline">🎨 Đổi skin avatar →</Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <p className="stat-label">Vai trò</p>
              <p className="font-bold text-slate-700 text-sm mt-0.5">Học viên</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <p className="stat-label">Mã học viên</p>
              <p className="font-bold text-primary text-sm font-mono mt-0.5">{currentUser?.studentCode || '–'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Đổi mật khẩu */}
      <div className="card-std p-6">
        <h2 className="section-title mb-1">Đổi mật khẩu</h2>
        <p className="text-xs text-slate-400 mb-4">Mật khẩu phải từ 6 ký tự trở lên.</p>

        {error && (
          <div className="alert-error mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0 mt-0.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            {error}
          </div>
        )}
        {success && (
          <div className="alert-success mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            {success}
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="stat-label block mb-1">Mật khẩu hiện tại</label>
            <input
              type="password"
              className="input-base"
              value={form.oldPass}
              onChange={e => { setForm({...form, oldPass: e.target.value}); setError(''); }}
              placeholder="••••••"
            />
          </div>
          <div>
            <label className="stat-label block mb-1">Mật khẩu mới</label>
            <input
              type="password"
              className="input-base"
              value={form.newPass}
              onChange={e => { setForm({...form, newPass: e.target.value}); setError(''); }}
              placeholder="••••••"
            />
          </div>
          <div>
            <label className="stat-label block mb-1">Xác nhận mật khẩu mới</label>
            <input
              type="password"
              className={`w-full border p-3 rounded-xl text-sm outline-none focus:ring-2 transition ${
                form.confirmPass && form.newPass !== form.confirmPass
                  ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                  : 'border-slate-200 focus:border-primary focus:ring-primary/10'
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
            className="btn-primary w-full"
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
