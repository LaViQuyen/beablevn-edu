import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebase';
import { ref, onValue, push, set, update, remove } from 'firebase/database';
import StudentAvatar from '../../components/StudentAvatar';
import { DEFAULT_SKINS, RARITY_META, sortSkins, normalizeSkin } from '../../data/skins';

// ============================================================
// ADMIN — QUẢN LÝ SKIN
// Thầy Cô tự thêm/sửa/xóa skin trong node DB `skins/` mà KHÔNG cần sửa code.
// - DB trống → nút "Nạp 13 skin mặc định" để khởi tạo.
// - 2 loại mở khóa: 'purchase' (đổi bằng Credit) | 'milestone' (miễn phí, đạt mốc Bonus).
// - Không dùng confirm() native: xóa phải bấm xác nhận 2 bước.
// ============================================================

const BLANK = {
  name: '', rarity: 'common', cost: 10, emoji: '✨',
  gradFrom: '#2B6830', gradTo: '#3D8B47', ring: '#2B6830',
  available: true, unlock: 'purchase', threshold: 50, order: 99,
  staffAllowed: false, // Admin bật để CẤP skin này cho nhân sự (staff/giáo viên)
};

const SkinManager = () => {
  const [dbSkins, setDbSkins] = useState({});   // { id: skinRecord }
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);   // null = thêm mới
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null); // id đang chờ xác nhận xóa

  const [toastMsg, setToastMsg] = useState('');
  const showToast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 3500); };

  useEffect(() => {
    const unsub = onValue(ref(db, 'skins'), (snap) => {
      setDbSkins(snap.val() || {});
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Danh sách skin để hiển thị (chuẩn hoá + sắp xếp)
  const list = useMemo(() => {
    const arr = Object.entries(dbSkins).map(([id, val]) => normalizeSkin(val, id));
    return sortSkins(arr);
  }, [dbSkins]);

  const isEmpty = !loading && list.length === 0;

  // --- Nạp 13 skin mặc định vào DB (giữ nguyên id để ánh xạ quyền sở hữu sẵn có) ---
  const seedDefaults = async () => {
    setSeeding(true);
    try {
      const updates = {};
      DEFAULT_SKINS.forEach(s => {
        const n = normalizeSkin(s);
        updates[`skins/${s.id}`] = {
          name: n.name, rarity: n.rarity, cost: n.cost, emoji: n.emoji,
          gradFrom: n.gradFrom, gradTo: n.gradTo, ring: n.ring,
          available: true, unlock: n.unlock, threshold: n.threshold, order: n.order,
        };
      });
      await update(ref(db), updates);
      showToast('✅ Đã nạp bộ skin mặc định!');
    } catch (e) { showToast('❌ Lỗi: ' + e.message); }
    finally { setSeeding(false); }
  };

  // --- Mở modal thêm / sửa ---
  const openAdd = () => { setEditId(null); setForm(BLANK); setModalOpen(true); };
  const openEdit = (skin) => {
    setEditId(skin.id);
    setForm({
      name: skin.name, rarity: skin.rarity, cost: skin.cost, emoji: skin.emoji,
      gradFrom: skin.gradFrom, gradTo: skin.gradTo, ring: skin.ring,
      available: skin.available, unlock: skin.unlock, threshold: skin.threshold, order: skin.order,
      staffAllowed: !!skin.staffAllowed,
    });
    setModalOpen(true);
  };

  // --- Lưu skin (thêm: push id mới; sửa: update đúng id) ---
  const saveSkin = async () => {
    if (!form.name.trim()) return showToast('⚠️ Nhập tên skin!');
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        rarity: form.rarity,
        cost: form.unlock === 'milestone' ? 0 : (Number(form.cost) || 0),
        emoji: form.emoji.trim(),
        gradFrom: form.gradFrom, gradTo: form.gradTo, ring: form.ring,
        available: !!form.available,
        unlock: form.unlock,
        threshold: form.unlock === 'milestone' ? (Number(form.threshold) || 0) : 0,
        order: Number(form.order) || 99,
        staffAllowed: !!form.staffAllowed,
      };
      if (editId) {
        await update(ref(db, `skins/${editId}`), payload);
        showToast('✅ Đã cập nhật skin!');
      } else {
        const newRef = push(ref(db, 'skins'));
        await set(newRef, payload);
        showToast('✅ Đã thêm skin mới!');
      }
      setModalOpen(false);
    } catch (e) { showToast('❌ Lỗi: ' + e.message); }
    finally { setSaving(false); }
  };

  // --- Bật/tắt hiển thị nhanh ---
  const toggleAvailable = async (skin) => {
    try { await update(ref(db, `skins/${skin.id}`), { available: !skin.available }); }
    catch (e) { showToast('❌ Lỗi: ' + e.message); }
  };

  // --- Bật/tắt CẤP cho NHÂN SỰ (kiểm soát skin của staff/giáo viên) ---
  const toggleStaff = async (skin) => {
    try {
      await update(ref(db, `skins/${skin.id}`), { staffAllowed: !skin.staffAllowed });
      showToast(!skin.staffAllowed ? `✅ Đã cấp "${skin.name}" cho nhân sự` : `🚫 Đã thu hồi "${skin.name}" khỏi nhân sự`);
    } catch (e) { showToast('❌ Lỗi: ' + e.message); }
  };

  // --- Xóa skin (đã bấm xác nhận) ---
  const confirmDelete = async (id) => {
    try {
      await remove(ref(db, `skins/${id}`));
      showToast('🗑️ Đã xóa skin. Học viên đang dùng skin này sẽ tự về Mầm Xanh.');
      setDeleteId(null);
    } catch (e) { showToast('❌ Lỗi: ' + e.message); }
  };

  const previewSkin = normalizeSkin(form);

  return (
    <div className="space-y-6 pb-20">
      {/* TOAST */}
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[80] px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white max-w-[90vw]"
          style={{ background: toastMsg.startsWith('✅') ? '#059669' : toastMsg.startsWith('⚠️') ? '#d97706' : toastMsg.startsWith('🗑️') ? '#475569' : '#dc2626' }}>
          {toastMsg}
        </div>
      )}

      {/* HEADER */}
      <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-100 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#E8F4EC] rounded-xl text-[#3D8B47]">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#2B6830]">Quản lý Skin</h2>
            <p className="text-xs text-slate-400 mt-0.5">Thêm/sửa/xóa avatar học viên đổi bằng Credit hoặc mốc học tập.</p>
          </div>
        </div>
        <div className="flex gap-2">
          {!isEmpty && (
            <button onClick={openAdd} className="px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-[#2B6830] hover:bg-[#1E5225] transition-colors">+ Thêm skin</button>
          )}
        </div>
      </div>

      {/* TRỐNG → nút seed */}
      {isEmpty ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-10 text-center">
          <p className="text-4xl mb-3">🎨</p>
          <p className="font-bold text-slate-700">Chưa có skin nào trong hệ thống</p>
          <p className="text-sm text-slate-400 mt-1 mb-5">Nạp bộ 13 skin mặc định để bắt đầu, sau đó tùy ý chỉnh sửa.</p>
          <button onClick={seedDefaults} disabled={seeding}
            className="px-6 py-3 rounded-xl text-sm font-bold text-white bg-[#2B6830] hover:bg-[#1E5225] transition-colors disabled:opacity-50">
            {seeding ? 'Đang nạp...' : '⬇️ Nạp 13 skin mặc định'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {list.map(skin => {
            const meta = RARITY_META[skin.rarity];
            return (
              <div key={skin.id} className={`rounded-2xl border p-4 flex flex-col gap-3 transition-all ${skin.available ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50 opacity-70'}`}>
                <div className="flex items-center gap-3">
                  <StudentAvatar skin={skin} size={52} />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-800 text-sm truncate">{skin.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${meta.cls}`}>{meta.label}</span>
                      {skin.unlock === 'milestone'
                        ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase bg-emerald-50 text-emerald-700 border-emerald-200">Mốc {skin.threshold} bonus</span>
                        : <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase bg-[#E8F4EC] text-[#2B6830] border-green-200">{skin.cost} credit</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleAvailable(skin)}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${skin.available ? 'bg-[#E8F4EC] text-[#2B6830] border-green-200 hover:bg-green-100' : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'}`}>
                    {skin.available ? '👁️ Đang hiện' : '🚫 Đang ẩn'}
                  </button>
                  <button onClick={() => openEdit(skin)} className="px-3 py-2 rounded-lg text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 hover:bg-slate-200 transition-colors">Sửa</button>
                  {deleteId === skin.id ? (
                    <button onClick={() => confirmDelete(skin.id)} className="px-3 py-2 rounded-lg text-xs font-bold text-white bg-red-500 hover:bg-red-600 transition-colors">Chắc chắn?</button>
                  ) : (
                    <button onClick={() => { setDeleteId(skin.id); setTimeout(() => setDeleteId(c => c === skin.id ? null : c), 3000); }} className="px-3 py-2 rounded-lg text-xs font-bold text-red-500 bg-red-50 border border-red-100 hover:bg-red-100 transition-colors">Xóa</button>
                  )}
                </div>
                {/* Kiểm soát skin của NHÂN SỰ — Admin bật/tắt từng skin */}
                <button onClick={() => toggleStaff(skin)}
                  className={`w-full py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${skin.staffAllowed ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100' : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'}`}>
                  {skin.staffAllowed ? '👤 Nhân sự: ĐƯỢC dùng' : '👤 Nhân sự: chưa cấp'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL THÊM/SỬA */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[70] p-4" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-[#2B6830] text-base">{editId ? 'Sửa skin' : 'Thêm skin mới'}</h3>
              <StudentAvatar skin={previewSkin} size={48} />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tên skin</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10" placeholder="VD: Ngôi Sao May Mắn" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Biểu tượng (emoji)</label>
                <input value={form.emoji} onChange={e => setForm({ ...form, emoji: e.target.value })} maxLength={4}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-lg text-center outline-none focus:border-[#2B6830]" placeholder="✨" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hạng</label>
                <select value={form.rarity} onChange={e => setForm({ ...form, rarity: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#2B6830] bg-white">
                  <option value="common">Phổ thông</option>
                  <option value="rare">Hiếm</option>
                  <option value="epic">Cực hiếm</option>
                  <option value="legendary">Huyền thoại</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[['gradFrom', 'Màu nền 1'], ['gradTo', 'Màu nền 2'], ['ring', 'Màu viền']].map(([key, label]) => (
                <div key={key}>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{label}</label>
                  <input type="color" value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}
                    className="w-full h-10 rounded-xl border border-slate-200 cursor-pointer" />
                </div>
              ))}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cách mở khóa</label>
              <div className="flex gap-2">
                <button onClick={() => setForm({ ...form, unlock: 'purchase' })}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold border-2 transition-colors ${form.unlock === 'purchase' ? 'border-[#2B6830] bg-[#E8F4EC]/50 text-[#2B6830]' : 'border-slate-200 text-slate-500'}`}>
                  💰 Đổi bằng Credit
                </button>
                <button onClick={() => setForm({ ...form, unlock: 'milestone' })}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold border-2 transition-colors ${form.unlock === 'milestone' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500'}`}>
                  🎯 Mốc học tập
                </button>
              </div>
            </div>

            {form.unlock === 'purchase' ? (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Giá (Credit)</label>
                <input type="number" min="0" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#2B6830]" />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mốc Bonus tích lũy cần đạt</label>
                <input type="number" min="0" value={form.threshold} onChange={e => setForm({ ...form, threshold: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-emerald-500" />
                <p className="text-[11px] text-slate-400 mt-1">Tổng điểm Bonus học viên KIẾM ĐƯỢC (không tính phần đã tiêu) đạt mốc này thì tự mở, miễn phí.</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Thứ tự hiển thị</label>
                <input type="number" value={form.order} onChange={e => setForm({ ...form, order: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#2B6830]" />
              </div>
              <label className="flex items-center gap-2 mt-6 cursor-pointer">
                <input type="checkbox" checked={form.available} onChange={e => setForm({ ...form, available: e.target.checked })}
                  className="w-4 h-4 accent-[#2B6830]" />
                <span className="text-sm font-bold text-slate-600">Hiện trong cửa hàng</span>
              </label>
            </div>

            <label className="flex items-center gap-2 cursor-pointer bg-indigo-50/50 border border-indigo-100 rounded-xl px-3 py-2.5">
              <input type="checkbox" checked={form.staffAllowed} onChange={e => setForm({ ...form, staffAllowed: e.target.checked })} className="w-4 h-4 accent-indigo-600" />
              <span className="text-sm font-bold text-indigo-700">👤 Cấp cho nhân sự (staff/giáo viên) dùng</span>
            </label>

            <div className="flex gap-2 pt-2">
              <button onClick={() => setModalOpen(false)} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors">Hủy</button>
              <button onClick={saveSkin} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-[#2B6830] hover:bg-[#1E5225] transition-colors disabled:opacity-50">
                {saving ? 'Đang lưu...' : editId ? 'Cập nhật' : 'Thêm skin'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SkinManager;
