import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { ref, push, onValue, remove, update } from "firebase/database";

const DataManager = () => {
  const [classes, setClasses] = useState([]);
  const [filteredClasses, setFilteredClasses] = useState([]);
  const [formData, setFormData] = useState({ name: '', room: '', subject: '', schedule: '', startTime: '', endTime: '' });
  const [editingId, setEditingId] = useState(null);
  
  // --- STATE BỘ LỌC ---
  const [filters, setFilters] = useState({ room: '', schedule: '' });
  const [selectedClassFilter, setSelectedClassFilter] = useState('all');

  useEffect(() => {
    onValue(ref(db, 'classes'), (snapshot) => {
      const data = snapshot.val();
      let list = data ? Object.entries(data).map(([id, val]) => ({ id, ...val })) : [];
      list.sort((a, b) => a.name.localeCompare(b.name));
      setClasses(list);
      setFilteredClasses(list);
    });
  }, []);

  // Logic lọc dữ liệu
  useEffect(() => {
    let result = classes;
    
    if (selectedClassFilter !== 'all') {
        result = result.filter(c => c.id === selectedClassFilter);
    }

    if (filters.room) result = result.filter(c => c.room.toLowerCase().includes(filters.room.toLowerCase()));
    if (filters.schedule) result = result.filter(c => c.schedule.toLowerCase().includes(filters.schedule.toLowerCase()));
    
    setFilteredClasses(result);
  }, [filters, classes, selectedClassFilter]);

  const handleSubmit = () => {
    if (!formData.name) return alert("Cần nhập tên lớp");
    if (editingId) {
      update(ref(db, `classes/${editingId}`), formData);
      setEditingId(null);
    } else {
      push(ref(db, 'classes'), formData);
    }
    setFormData({ name: '', room: '', subject: '', schedule: '', startTime: '', endTime: '' });
  };

  const handleEdit = (c) => {
    setFormData(c);
    setEditingId(c.id);
  };

  const handleDelete = (id) => {
    if (window.confirm("Xóa lớp này? Dữ liệu điểm danh liên quan có thể bị ảnh hưởng.")) {
      remove(ref(db, `classes/${id}`));
    }
  };

  return (
    <div className="space-y-6 pb-20 mt-16 md:mt-0"> {/* Fix header che nội dung mobile */}
      
      {/* FORM NHẬP LIỆU RESPONSIVE */}
      <div className="bg-white p-4 md:p-6 rounded-xl border border-slate-100 shadow-sm">
        <h2 className="text-lg font-bold text-[#003366] mb-4">{editingId ? 'Cập nhật Lớp' : 'Thêm Lớp Mới'}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <input className="border p-3 rounded-lg text-sm outline-none focus:border-[#003366]" placeholder="Tên Lớp (VD: Kids 1)" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          <input className="border p-3 rounded-lg text-sm outline-none focus:border-[#003366]" placeholder="Phòng (VD: P.101)" value={formData.room} onChange={e => setFormData({...formData, room: e.target.value})} />
          <input className="border p-3 rounded-lg text-sm outline-none focus:border-[#003366]" placeholder="Môn (VD: Tiếng Anh)" value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} />
          <input className="border p-3 rounded-lg text-sm outline-none focus:border-[#003366]" placeholder="Lịch (VD: T2-T4-T6)" value={formData.schedule} onChange={e => setFormData({...formData, schedule: e.target.value})} />
          
          <div className="md:col-span-2 lg:col-span-4 grid grid-cols-2 gap-3">
             <div className="flex flex-col">
                <label className="text-xs font-bold text-slate-500 uppercase mb-1">Giờ bắt đầu</label>
                <input className="border p-3 rounded-lg text-sm outline-none focus:border-[#003366]" type="time" value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})} />
             </div>
             <div className="flex flex-col">
                <label className="text-xs font-bold text-slate-500 uppercase mb-1">Giờ kết thúc</label>
                <input className="border p-3 rounded-lg text-sm outline-none focus:border-[#003366]" type="time" value={formData.endTime} onChange={e => setFormData({...formData, endTime: e.target.value})} />
             </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSubmit} className="flex-1 md:flex-none bg-[#003366] text-white px-8 py-3 rounded-lg font-bold shadow-md shadow-blue-900/10 hover:bg-[#002244] transition-all active:scale-[0.98]">{editingId ? 'Lưu Thay Đổi' : 'Thêm Lớp'}</button>
          {editingId && <button onClick={() => { setEditingId(null); setFormData({ name: '', room: '', subject: '', schedule: '', startTime: '', endTime: '' }); }} className="flex-1 md:flex-none bg-slate-100 text-slate-600 px-6 py-3 rounded-lg font-medium hover:bg-slate-200 transition-all">Hủy</button>}
        </div>
      </div>

      {/* DANH SÁCH LỚP */}
      <div className="bg-white p-4 md:p-6 rounded-xl border border-slate-100 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <h2 className="text-lg font-bold text-[#003366]">Danh sách Lớp học</h2>
            
            {/* --- BỘ LỌC RESPONSIVE --- */}
            <div className="flex flex-col md:flex-row gap-3">
                <select className="p-3 border border-slate-200 rounded-lg text-sm outline-none focus:border-[#003366] bg-slate-50 md:min-w-[180px]" value={selectedClassFilter} onChange={(e) => setSelectedClassFilter(e.target.value)}>
                    <option value="all">-- Tất cả các lớp --</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {/* Tối ưu tỉ lệ hiển thị trên mobile bằng grid */}
                <div className="grid grid-cols-2 gap-3 md:flex">
                    <input className="w-full p-3 border border-slate-200 rounded-lg text-sm outline-none focus:border-[#003366] md:w-32" placeholder="Lọc Phòng..." value={filters.room} onChange={e => setFilters({...filters, room: e.target.value})} />
                    <input className="w-full p-3 border border-slate-200 rounded-lg text-sm outline-none focus:border-[#003366] md:w-32" placeholder="Lọc Lịch..." value={filters.schedule} onChange={e => setFilters({...filters, schedule: e.target.value})} />
                </div>
            </div>
        </div>

        {/* DESKTOP TABLE */}
        <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 text-xs uppercase font-bold">
              <tr>
                <th className="p-4 w-12 text-center">STT</th>
                <th className="p-4">Tên Lớp</th>
                <th className="p-4">Phòng</th>
                <th className="p-4">Môn học</th>
                <th className="p-4">Lịch</th>
                <th className="p-4">Giờ</th>
                <th className="p-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredClasses.map((c, index) => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 text-center text-slate-400 font-bold">{index + 1}</td>
                  <td className="p-4 font-bold text-[#003366]">{c.name}</td>
                  <td className="p-4">{c.room}</td>
                  <td className="p-4 text-slate-600">{c.subject}</td>
                  <td className="p-4"><span className="text-[10px] font-bold bg-blue-50 text-[#003366] px-2 py-1 rounded border border-blue-100 whitespace-nowrap">{c.schedule}</span></td>
                  <td className="p-4 text-xs text-slate-500 font-mono">{c.startTime} - {c.endTime}</td>
                  <td className="p-4 text-right space-x-2">
                    <button onClick={() => handleEdit(c)} className="text-[#003366] text-xs font-bold border border-[#003366] px-3 py-1 rounded-lg hover:bg-[#003366] hover:text-white transition-all">Sửa</button>
                    <button onClick={() => handleDelete(c.id)} className="text-red-500 text-xs font-bold border border-red-500 px-3 py-1 rounded-lg hover:bg-red-500 hover:text-white transition-all">Xóa</button>
                  </td>
                </tr>
              ))}
              {filteredClasses.length === 0 && <tr><td colSpan="7" className="p-8 text-center text-slate-400 italic">Không tìm thấy dữ liệu.</td></tr>}
            </tbody>
          </table>
        </div>

        {/* MOBILE CARDS */}
        <div className="md:hidden space-y-3">
            {filteredClasses.map((c, index) => (
                <div key={c.id} className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-50 text-[#003366] flex items-center justify-center font-bold text-xs">
                                {index + 1}
                            </div>
                            <div>
                                <h4 className="font-bold text-[#003366] text-sm">{c.name}</h4>
                                <p className="text-xs text-slate-500">{c.subject || 'Chưa cập nhật môn'}</p>
                            </div>
                        </div>
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-200">{c.room || 'N/A'}</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2 rounded border border-slate-100">
                        <div>
                            <span className="text-slate-400 block mb-0.5">Lịch học</span>
                            <span className="font-bold text-[#003366]">{c.schedule}</span>
                        </div>
                        <div className="text-right">
                            <span className="text-slate-400 block mb-0.5">Thời gian</span>
                            <span className="font-mono text-slate-700">{c.startTime} - {c.endTime}</span>
                        </div>
                    </div>

                    <div className="flex gap-2 border-t border-slate-100 pt-3 mt-1">
                        <button onClick={() => handleEdit(c)} className="flex-1 py-2 text-[#003366] bg-blue-50 rounded-lg text-xs font-bold border border-blue-200 active:bg-blue-100">Sửa</button>
                        <button onClick={() => handleDelete(c.id)} className="flex-1 py-2 text-red-600 bg-red-50 rounded-lg text-xs font-bold border border-red-200 active:bg-red-100">Xóa</button>
                    </div>
                </div>
            ))}
            {filteredClasses.length === 0 && <div className="p-8 text-center text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">Không tìm thấy dữ liệu.</div>}
        </div>
      </div>
    </div>
  );
};

export default DataManager;