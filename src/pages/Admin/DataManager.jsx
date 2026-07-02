import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { ref, push, onValue, remove, update } from "firebase/database";

// Modal xác nhận xóa (tái sử dụng pattern từ NotificationManager)
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

const EMPTY_FORM = { name: '', room: '', subject: '', schedule: '', startTime: '', endTime: '', teacherId: '', teacherName: '' };

const DataManager = () => {
  const [classes, setClasses] = useState([]);
  const [filteredClasses, setFilteredClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [staffList, setStaffList] = useState([]); // danh sách GV để chọn
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formError, setFormError] = useState('');

  // --- STATE BỘ LỌC ---
  const [filters, setFilters] = useState({ room: '', schedule: '' });
  const [selectedClassFilter, setSelectedClassFilter] = useState('all');

  useEffect(() => {
    // Lấy danh sách lớp
    onValue(ref(db, 'classes'), (snapshot) => {
      const data = snapshot.val();
      let list = data ? Object.entries(data).map(([id, val]) => ({ id, ...val })) : [];
      list.sort((a, b) => a.name.localeCompare(b.name));
      setClasses(list);
      setFilteredClasses(list);
      setLoading(false);
    });

    // Lấy danh sách nhân sự (để chọn GV phụ trách)
    onValue(ref(db, 'users'), (snap) => {
      const data = snap.val();
      if (data) {
        const teachers = Object.entries(data)
          .map(([id, val]) => ({ id, ...val }))
          .filter(u => u.role === 'staff')
          .sort((a, b) => a.name.localeCompare(b.name));
        setStaffList(teachers);
      }
    });
  }, []);

  // Logic lọc dữ liệu
  useEffect(() => {
    let result = classes;
    if (selectedClassFilter !== 'all') result = result.filter(c => c.id === selectedClassFilter);
    if (filters.room) result = result.filter(c => (c.room || '').toLowerCase().includes(filters.room.toLowerCase()));
    if (filters.schedule) result = result.filter(c => (c.schedule || '').toLowerCase().includes(filters.schedule.toLowerCase()));
    setFilteredClasses(result);
  }, [filters, classes, selectedClassFilter]);

  // Khi chọn GV → tự điền teacherName
  const handleTeacherSelect = (teacherId) => {
    const teacher = staffList.find(s => s.id === teacherId);
    setFormData({ ...formData, teacherId, teacherName: teacher ? teacher.name : '' });
  };

  const handleSubmit = () => {
    if (!formData.name) { setFormError('Vui lòng nhập tên lớp.'); return; }
    setFormError('');
    const payload = { ...formData };
    if (editingId) {
      update(ref(db, `classes/${editingId}`), payload);
      setEditingId(null);
    } else {
      push(ref(db, 'classes'), payload);
    }
    setFormData(EMPTY_FORM);
  };

  const handleEdit = (c) => {
    setFormData({
      name: c.name || '',
      room: c.room || '',
      subject: c.subject || '',
      schedule: c.schedule || '',
      startTime: c.startTime || '',
      endTime: c.endTime || '',
      teacherId: c.teacherId || '',
      teacherName: c.teacherName || '',
    });
    setEditingId(c.id);
    // Cuộn lên form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id) => setDeleteTarget(id);
  const confirmDelete = () => {
    remove(ref(db, `classes/${deleteTarget}`));
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* PAGE HEADER */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
        <div className="p-2 bg-[#E8F4EC] rounded-xl text-[#3D8B47]">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
          </svg>
        </div>
        <div>
          <h2 className="page-title">Dữ liệu Lớp học</h2>
          <p className="page-sub">Quản lý danh sách lớp và lịch học.</p>
        </div>
      </div>

      {/* MODAL XÓA */}
      {deleteTarget && (
        <ConfirmModal
          message="Xóa lớp này? Dữ liệu điểm danh liên quan có thể bị ảnh hưởng."
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* FORM NHẬP LIỆU */}
      <div className="card-std p-5 md:p-6">
        <h2 className="section-title mb-4">{editingId ? '✏️ Cập nhật Lớp' : '➕ Thêm Lớp Mới'}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
          <input
            className="input-base"
            placeholder="Tên Lớp (VD: Kids 1)"
            value={formData.name}
            onChange={e => setFormData({...formData, name: e.target.value})}
          />
          <input
            className="input-base"
            placeholder="Phòng (VD: P.101)"
            value={formData.room}
            onChange={e => setFormData({...formData, room: e.target.value})}
          />
          <input
            className="input-base"
            placeholder="Môn (VD: Tiếng Anh)"
            value={formData.subject}
            onChange={e => setFormData({...formData, subject: e.target.value})}
          />
          <input
            className="input-base"
            placeholder="Lịch học (VD: T2-T4-T6)"
            value={formData.schedule}
            onChange={e => setFormData({...formData, schedule: e.target.value})}
          />

          {/* DROPDOWN CHỌN GIÁO VIÊN — tính năng mới */}
          <div className="flex flex-col">
            <label className="stat-label mb-1">Giáo viên phụ trách</label>
            <select
              className="input-base"
              value={formData.teacherId}
              onChange={e => handleTeacherSelect(e.target.value)}
            >
              <option value="">-- Chưa phân công --</option>
              {staffList.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.subRole || 'GV'})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col">
              <label className="stat-label mb-1">Giờ bắt đầu</label>
              <input className="input-base" type="time" value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})} />
            </div>
            <div className="flex flex-col">
              <label className="stat-label mb-1">Giờ kết thúc</label>
              <input className="input-base" type="time" value={formData.endTime} onChange={e => setFormData({...formData, endTime: e.target.value})} />
            </div>
          </div>
        </div>

        {formError && (
          <p className="text-red-500 text-sm mb-2 flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
            {formError}
          </p>
        )}
        <div className="flex gap-2">
          <button onClick={handleSubmit} className="btn-primary flex-1 md:flex-none">
            {editingId ? 'Lưu Thay Đổi' : 'Thêm Lớp'}
          </button>
          {editingId && (
            <button
              onClick={() => { setEditingId(null); setFormData(EMPTY_FORM); }}
              className="btn-secondary flex-1 md:flex-none"
            >
              Hủy
            </button>
          )}
        </div>
      </div>

      {/* DANH SÁCH LỚP */}
      <div className="card-std p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <h2 className="section-title">Danh sách Lớp học ({filteredClasses.length})</h2>
          <div className="flex flex-col md:flex-row gap-3">
            <select className="p-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#2B6830] focus:ring-2 focus:ring-[#2B6830]/10 bg-slate-50 md:min-w-[180px]" value={selectedClassFilter} onChange={(e) => setSelectedClassFilter(e.target.value)}>
              <option value="all">-- Tất cả các lớp --</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-3 md:flex">
              <input className="input-base md:w-32" placeholder="Lọc Phòng..." value={filters.room} onChange={e => setFilters({...filters, room: e.target.value})} />
              <input className="input-base md:w-32" placeholder="Lọc Lịch..." value={filters.schedule} onChange={e => setFilters({...filters, schedule: e.target.value})} />
            </div>
          </div>
        </div>

        {/* DESKTOP TABLE */}
        <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200">
          <table className="table-std">
            <thead>
              <tr>
                <th className="w-10 text-center">STT</th>
                <th>Tên Lớp</th>
                <th>Phòng</th>
                <th>Môn học</th>
                <th>Giáo viên</th>
                <th>Lịch</th>
                <th>Giờ</th>
                <th className="text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredClasses.map((c, index) => (
                <tr key={c.id}>
                  <td className="text-center text-slate-400 font-bold">{index + 1}</td>
                  <td className="font-bold text-[#2B6830]">{c.name}</td>
                  <td className="text-slate-600">{c.room || '—'}</td>
                  <td className="text-slate-600">{c.subject || '—'}</td>
                  <td>
                    {c.teacherName
                      ? <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">{c.teacherName}</span>
                      : <span className="text-xs text-slate-300 italic">Chưa phân công</span>
                    }
                  </td>
                  <td><span className="text-[10px] font-bold bg-[#E8F4EC] text-[#2B6830] px-2 py-1 rounded border border-green-100 whitespace-nowrap">{c.schedule || '—'}</span></td>
                  <td className="text-xs text-slate-500 font-mono whitespace-nowrap">{c.startTime || '—'} - {c.endTime || '—'}</td>
                  <td className="text-right space-x-2">
                    <button onClick={() => handleEdit(c)} className="text-[#2B6830] text-xs font-bold border border-[#2B6830] px-3 py-1.5 rounded-xl hover:bg-[#2B6830] hover:text-white transition-all">Sửa</button>
                    <button onClick={() => handleDelete(c.id)} className="text-red-500 text-xs font-bold border border-red-300 px-3 py-1.5 rounded-xl hover:bg-red-500 hover:text-white transition-all">Xóa</button>
                  </td>
                </tr>
              ))}
              {loading && [1,2,3].map(i => (
                <tr key={i} className="animate-pulse">
                  {[1,2,3,4,5,6,7,8].map(j => <td key={j}><div className="h-4 bg-slate-100 rounded w-full" /></td>)}
                </tr>
              ))}
              {!loading && filteredClasses.length === 0 && (
                <tr><td colSpan="8" className="p-8 text-center text-slate-400 italic">Không tìm thấy dữ liệu.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* MOBILE CARDS */}
        <div className="md:hidden space-y-3">
          {filteredClasses.map((c, index) => (
            <div key={c.id} className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#E8F4EC] text-[#2B6830] flex items-center justify-center font-bold text-xs">{index + 1}</div>
                  <div>
                    <h4 className="font-bold text-[#2B6830] text-sm">{c.name}</h4>
                    <p className="text-xs text-slate-500">{c.subject || 'Chưa cập nhật môn'}</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-200">{c.room || 'N/A'}</span>
              </div>

              {/* GV phụ trách */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">Giáo viên:</span>
                {c.teacherName
                  ? <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">{c.teacherName}</span>
                  : <span className="text-slate-300 italic">Chưa phân công</span>
                }
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2 rounded border border-slate-100">
                <div>
                  <span className="text-slate-400 block mb-0.5">Lịch học</span>
                  <span className="font-bold text-[#2B6830]">{c.schedule || '—'}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block mb-0.5">Thời gian</span>
                  <span className="font-mono text-slate-700">{c.startTime || '—'} - {c.endTime || '—'}</span>
                </div>
              </div>

              <div className="flex gap-2 border-t border-slate-100 pt-3">
                <button onClick={() => handleEdit(c)} className="flex-1 py-2 text-[#2B6830] bg-[#E8F4EC] rounded-xl text-xs font-bold border border-green-200 active:bg-green-100">Sửa</button>
                <button onClick={() => handleDelete(c.id)} className="flex-1 py-2 text-red-600 bg-red-50 rounded-xl text-xs font-bold border border-red-200 active:bg-red-100">Xóa</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DataManager;
