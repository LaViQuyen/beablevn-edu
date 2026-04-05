import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { ref, set, onValue, remove, update, push, get } from "firebase/database";
import bcrypt from 'bcryptjs';

const StaffManager = () => {
  const [formData, setFormData] = useState({ name: '', username: '', password: 'BAVNbavn', subRole: 'teacher', assignedClasses: [] });
  const [staffList, setStaffList] = useState([]);
  const [availableClasses, setAvailableClasses] = useState([]);
  const [editingStaff, setEditingStaff] = useState(null);

  // --- STATE BỘ LỌC MỚI ---
  const [filterRole, setFilterRole] = useState('all');
  const [filterClass, setFilterClass] = useState('all');

  useEffect(() => {
    onValue(ref(db, 'classes'), (snap) => setAvailableClasses(snap.val() ? Object.entries(snap.val()).map(([id, val]) => ({ id, ...val })) : []));
    onValue(ref(db, 'users'), (snap) => {
      const data = snap.val();
      if(data) setStaffList(Object.entries(data).map(([id, val]) => ({ id, ...val })).filter(u => u.role === 'staff'));
    });
  }, []);

  const handleClassToggle = (classId) => {
    const current = editingStaff ? (editingStaff.assignedClasses || []) : formData.assignedClasses;
    const newClasses = current.includes(classId) ? current.filter(id => id !== classId) : [...current, classId];
    editingStaff ? setEditingStaff({ ...editingStaff, assignedClasses: newClasses }) : setFormData({ ...formData, assignedClasses: newClasses });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.username || !formData.password) return alert("Thiếu thông tin!");
    
    const loginEmail = `${formData.username.trim()}@beable.vn`;

    try {
      const salt = bcrypt.genSaltSync(10);
      const hashedPassword = bcrypt.hashSync(formData.password, salt);

      const newUserRef = push(ref(db, 'users'));
      await set(newUserRef, { 
          ...formData, 
          email: loginEmail, 
          loginId: formData.username, 
          password: hashedPassword, 
          role: 'staff', 
          createdAt: new Date().toISOString() 
      });

      alert(`Đã tạo nhân sự!\nID: ${formData.username}\nMật khẩu: ${formData.password}`);
      setFormData({ name: '', username: '', password: 'BAVNbavn', subRole: 'teacher', assignedClasses: [] });
    } catch (error) { 
        alert("Lỗi: " + error.message); 
    }
  };

  const handleChangePassword = async (staff) => {
    const newPass = prompt(`Nhập mật khẩu mới cho ${staff.name} (Tối thiểu 6 ký tự):`, "BAVNbavn");
    if (!newPass) return;
    if (newPass.length < 6) return alert("Mật khẩu quá ngắn!");

    try {
      const salt = bcrypt.genSaltSync(10);
      const hashedPassword = bcrypt.hashSync(newPass, salt);

      await update(ref(db, `users/${staff.id}`), {
          password: hashedPassword
      });

      alert(`Thành công! Mật khẩu mới là: ${newPass}`);
    } catch (error) {
        console.error(error);
        alert(`Lỗi: ${error.message}`);
    }
  };

  const handleDelete = async (id) => { if (window.confirm("Xóa nhân sự này?")) await remove(ref(db, `users/${id}`)); };
  const getClassNames = (ids) => (!ids || !ids.length) ? <span className="text-slate-300 italic">--</span> : ids.map(id => availableClasses.find(c => c.id === id)?.name || id).join(", ");

  // --- LOGIC LỌC DANH SÁCH ---
  const filteredStaffList = staffList.filter(staff => {
      if (filterRole !== 'all' && staff.subRole !== filterRole) return false;
      if (filterClass !== 'all') {
          const assigned = staff.assignedClasses || [];
          if (!assigned.includes(filterClass)) return false;
      }
      return true;
  });

  return (
    <div className="space-y-6 pb-20 mt-16 md:mt-0"> {/* Fix header che nội dung mobile */}
      {/* FORM TẠO MỚI */}
      <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-4">
           <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#003366" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3.75 15a2.25 2.25 0 012.25-2.25h2.93a2.625 2.625 0 011.603.543c.47.372.673.855.567 1.348l-.053.25c-.29.988-1.2 1.609-2.227 1.609H6.262c-1.026 0-1.936-.621-2.226-1.61l-.054-.25a1.884 1.884 0 01.568-1.348z" /></svg>
           <h2 className="text-lg font-bold text-[#003366]">Tạo Nhân sự Mới</h2>
        </div>
        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input className="border border-slate-200 p-3 rounded-lg text-sm outline-none focus:border-[#003366]" placeholder="Họ tên" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          <div className="flex gap-2">
             <input className="border border-slate-200 p-3 rounded-lg w-1/2 text-sm outline-none focus:border-[#003366]" placeholder="ID Đăng nhập" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} />
             <input className="border border-slate-200 p-3 rounded-lg w-1/2 text-sm outline-none focus:border-[#003366]" placeholder="Mật khẩu" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
          </div>
          <select className="border border-slate-200 p-3 rounded-lg text-sm outline-none focus:border-[#003366] bg-white" value={formData.subRole} onChange={e => setFormData({...formData, subRole: e.target.value})}>
             <option value="teacher">Giáo viên</option><option value="cco">CCO</option><option value="cca">CCA</option>
          </select>
          <div className="bg-slate-50 p-4 rounded-lg h-32 overflow-y-auto border border-slate-200">
             <p className="text-xs font-bold text-slate-500 uppercase mb-2">Gán lớp:</p>
             {availableClasses.map(c => (
               <label key={c.id} className="flex items-center gap-2 text-sm mb-1 cursor-pointer"><input type="checkbox" className="accent-[#003366] w-4 h-4" checked={formData.assignedClasses.includes(c.id)} onChange={() => handleClassToggle(c.id)} /> {c.name}</label>
             ))}
          </div>
          <button className="md:col-span-2 bg-[#003366] text-white py-3 rounded-lg font-bold shadow-sm hover:bg-[#002244] transition-all active:scale-[0.98]">Tạo Tài khoản</button>
        </form>
      </div>

      {/* POPUP CHỈNH SỬA (MOBILE RESPONSIVE) */}
      {editingStaff && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl w-full max-w-md shadow-2xl animate-fade-in-up flex flex-col max-h-[90vh]">
            <h3 className="font-bold text-lg mb-4 text-[#003366]">Điều chỉnh lớp: {editingStaff.name}</h3>
            <div className="flex-1 overflow-y-auto space-y-2 mb-4 bg-slate-50 p-3 rounded border border-slate-200">
               {availableClasses.map((cls) => (
                  <label key={cls.id} className="flex items-center space-x-3 cursor-pointer text-sm p-2 hover:bg-slate-100 rounded">
                    <input type="checkbox" className="accent-[#003366] w-5 h-5" checked={(editingStaff.assignedClasses || []).includes(cls.id)} onChange={() => handleClassToggle(cls.id)} />
                    <span className="font-medium text-slate-700">{cls.name}</span>
                  </label>
                ))}
            </div>
            <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
              <button onClick={() => setEditingStaff(null)} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50 font-medium">Hủy</button>
              <button onClick={() => { update(ref(db, `users/${editingStaff.id}`), { assignedClasses: editingStaff.assignedClasses }); setEditingStaff(null); }} className="px-4 py-2 bg-[#003366] text-white rounded-lg text-sm font-bold hover:bg-[#002244] shadow-sm">Lưu</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white p-4 md:p-6 rounded-xl border border-slate-100 shadow-sm overflow-hidden">
         <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#003366" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
                <h2 className="text-lg font-bold text-[#003366]">Danh sách Nhân sự</h2>
            </div>
            
            {/* --- BỘ LỌC (Responsive) --- */}
            <div className="flex flex-col md:flex-row gap-2">
                <select className="p-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-[#003366] bg-slate-50" value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
                    <option value="all">Tất cả vai trò</option>
                    <option value="teacher">Giáo viên</option>
                    <option value="cco">CCO</option>
                    <option value="cca">CCA</option>
                </select>
                <select className="p-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-[#003366] bg-slate-50 md:min-w-[150px]" value={filterClass} onChange={(e) => setFilterClass(e.target.value)}>
                    <option value="all">Tất cả lớp</option>
                    {availableClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>
         </div>

         {/* DESKTOP TABLE VIEW */}
         <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 text-xs uppercase font-bold">
                    <tr>
                        <th className="p-4 w-12 text-center">STT</th>
                        <th className="p-4">ID Đăng nhập</th>
                        <th className="p-4">Tên</th>
                        <th className="p-4">Vai trò</th>
                        <th className="p-4">Lớp</th>
                        <th className="p-4 text-right">Thao tác</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                {filteredStaffList.map((s, index) => (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4 text-center text-slate-400 font-bold">{index + 1}</td>
                        <td className="p-4 font-bold text-[#003366]">{s.loginId || s.email.split('@')[0]}</td>
                        <td className="p-4 font-medium text-gray-800">{s.name}</td>
                        <td className="p-4 uppercase text-[10px] font-bold text-slate-400">{s.subRole}</td>
                        <td className="p-4"><div className="flex items-center gap-2"><span className="truncate max-w-[150px] text-xs text-slate-600">{getClassNames(s.assignedClasses)}</span><button onClick={() => setEditingStaff(s)} className="text-[#003366] border border-[#003366] text-[10px] font-bold px-2 py-0.5 rounded hover:bg-[#003366] hover:text-white transition-all">Sửa</button></div></td>
                        <td className="p-4 text-right flex justify-end gap-2">
                            <button onClick={() => handleChangePassword(s)} className="text-yellow-600 border border-yellow-600 px-2 py-0.5 rounded text-[10px] font-bold hover:bg-yellow-600 hover:text-white transition-colors" title="Đổi mật khẩu">Pass</button>
                            <button onClick={() => handleDelete(s.id)} className="text-red-500 hover:text-red-700 text-xs font-bold px-2">Xóa</button>
                        </td>
                    </tr>
                ))}
                {filteredStaffList.length === 0 && <tr><td colSpan="6" className="p-8 text-center text-slate-400 italic">Không tìm thấy dữ liệu.</td></tr>}
                </tbody>
            </table>
         </div>

         {/* MOBILE CARD VIEW */}
         <div className="md:hidden space-y-3">
            {filteredStaffList.map((s, index) => (
                <div key={s.id} className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-50 text-[#003366] flex items-center justify-center font-bold text-xs">
                                {index + 1}
                            </div>
                            <div>
                                <h4 className="font-bold text-[#003366] text-sm">{s.name}</h4>
                                <p className="text-xs text-slate-500">@{s.loginId || s.email.split('@')[0]}</p>
                            </div>
                        </div>
                        <span className="uppercase text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded">{s.subRole}</span>
                    </div>
                    
                    <div className="text-xs bg-slate-50 p-2 rounded border border-slate-100">
                        <span className="font-bold text-slate-500 block mb-1 uppercase">Lớp phụ trách:</span>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-700 truncate mr-2">{getClassNames(s.assignedClasses)}</span>
                            <button onClick={() => setEditingStaff(s)} className="text-[#003366] border border-[#003366] text-[10px] font-bold px-2 py-0.5 rounded hover:bg-[#003366] hover:text-white transition-all whitespace-nowrap">Sửa</button>
                        </div>
                    </div>

                    <div className="flex gap-2 border-t border-slate-100 pt-3 mt-1">
                        <button onClick={() => handleChangePassword(s)} className="flex-1 text-center py-2 text-yellow-700 bg-yellow-50 rounded-lg text-xs font-bold border border-yellow-200 active:bg-yellow-100">Đổi Pass</button>
                        <button onClick={() => handleDelete(s.id)} className="flex-1 text-center py-2 text-red-600 bg-red-50 rounded-lg text-xs font-bold border border-red-200 active:bg-red-100">Xóa</button>
                    </div>
                </div>
            ))}
            {filteredStaffList.length === 0 && <div className="p-8 text-center text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">Không tìm thấy dữ liệu.</div>}
         </div>
      </div>
    </div>
  );
};
export default StaffManager;