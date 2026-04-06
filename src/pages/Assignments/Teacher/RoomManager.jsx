// src/pages/Assignments/Teacher/RoomManager.jsx
import { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
// IMPORT CẢ 2 DATABASE: firestore (chứa phòng) và realtimeDb (chứa users)
import { firestore as db, db as realtimeDb } from "../../../firebase";
import { ref, get } from "firebase/database"; 
import Input from "../../../components/Layouts/Input";

// --- HỆ THỐNG SVG ICONS TỐI GIẢN ---
const SvgIcons = {
  Plus: () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>,
  Edit: () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>,
  Share: () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>,
  Trash: () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>,
  Users: () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>,
  Close: () => <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
};

export default function RoomManager() {
  const [rooms, setRooms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  const [isAddingRoom, setIsAddingRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [editingRoomId, setEditingRoomId] = useState(null);
  const [editRoomName, setEditRoomName] = useState('');

  const [rosterRoom, setRosterRoom] = useState(null);
  const [newStudent, setNewStudent] = useState({ firstName: '', lastName: '', studentId: '' });
  const [isAddingStudent, setIsAddingStudent] = useState(false); // State báo hiệu đang check database

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchRooms = async () => {
    setIsLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "rooms"));
      const roomsData = querySnapshot.docs.map(doc => ({ id: doc.id, inMenu: true, ...doc.data() }));
      roomsData.sort((a, b) => a.roomId.localeCompare(b.roomId));
      setRooms(roomsData);
    } catch (error) { console.error("Lỗi khi tải danh sách phòng:", error); }
    setIsLoading(false);
  };

  useEffect(() => { fetchRooms(); }, []);

  const handleAddRoom = async () => {
    const roomNameUpper = newRoomName.trim().toUpperCase();
    if (!roomNameUpper) return;
    if (rooms.some(r => r.roomId === roomNameUpper)) return alert("Tên phòng đã tồn tại!");
    try {
      const newRoom = { roomId: roomNameUpper, createdAt: new Date().toISOString(), students: [], inMenu: true };
      await setDoc(doc(db, "rooms", roomNameUpper), newRoom);
      setRooms([...rooms, newRoom].sort((a, b) => a.roomId.localeCompare(b.roomId)));
      setNewRoomName(''); setIsAddingRoom(false);
    } catch (error) { console.error("Lỗi tạo phòng:", error); }
  };

  const handleRenameRoom = async (oldRoomId) => {
    const newNameUpper = editRoomName.trim().toUpperCase();
    if (!newNameUpper || newNameUpper === oldRoomId) { setEditingRoomId(null); return; }
    if (rooms.some(r => r.roomId === newNameUpper)) { alert("Tên phòng đã tồn tại!"); setEditingRoomId(null); return; }
    try {
      const oldRoomData = rooms.find(r => r.roomId === oldRoomId);
      const newRoomData = { ...oldRoomData, roomId: newNameUpper };
      await setDoc(doc(db, "rooms", newNameUpper), newRoomData);
      await deleteDoc(doc(db, "rooms", oldRoomId));
      setRooms(rooms.map(r => r.roomId === oldRoomId ? newRoomData : r).sort((a, b) => a.roomId.localeCompare(b.roomId)));
      setEditingRoomId(null);
    } catch (error) { alert("Có lỗi xảy ra khi đổi tên."); }
  };

  const handleDeleteRoom = async (roomId) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa phòng ${roomId}? Mọi dữ liệu học viên và kết quả sẽ bị mất.`)) {
      try {
        await deleteDoc(doc(db, "rooms", roomId));
        setRooms(rooms.filter(r => r.roomId !== roomId));
      } catch (error) { console.error("Lỗi xóa phòng:", error); }
    }
  };

  const handleToggleInMenu = async (roomId, currentStatus) => {
    try {
      await updateDoc(doc(db, "rooms", roomId), { inMenu: !currentStatus });
      setRooms(rooms.map(r => r.roomId === roomId ? { ...r, inMenu: !currentStatus } : r));
    } catch (error) { console.error("Lỗi cập nhật trạng thái menu:", error); }
  };

  const handleShareRoom = (roomId) => {
    navigator.clipboard.writeText(roomId);
    alert(`Đã sao chép Room ID: ${roomId}\nBạn có thể gửi mã này cho học viên để tham gia lớp.`);
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();
    const sId = newStudent.studentId.trim();

    if (!sId) return;

    // 1. Kiểm tra độ dài 8 chữ số
    if (!/^\d{8}$/.test(sId)) {
      alert("LỖI: Mã học viên bắt buộc phải là 8 chữ số!");
      return;
    }

    // 2. Kiểm tra xem học viên đã có trong phòng chưa
    const isDuplicate = rosterRoom.students?.some(s => s.studentId === sId);
    if (isDuplicate) {
      alert("Học viên này đã có trong danh sách phòng rồi!");
      return;
    }

    setIsAddingStudent(true);
    try {
      // 3. Chạy sang hệ thống Edu (Realtime DB) để dò tìm tài khoản
      const snapshot = await get(ref(realtimeDb, 'users'));
      if (!snapshot.exists()) {
        alert("Hệ thống chưa có bất kỳ dữ liệu học viên nào!");
        setIsAddingStudent(false);
        return;
      }

      const users = snapshot.val();
      const foundStudent = Object.values(users).find(u => String(u.studentCode) === sId && u.role === 'student');

      if (!foundStudent) {
        alert(`TỪ CHỐI: Không tìm thấy Học viên nào mang mã [${sId}] trong hệ thống!`);
        setIsAddingStudent(false);
        return;
      }

      // 4. LẤY TÊN CHÍNH THỨC TỪ DATABASE VÀ TỰ ĐỘNG TÁCH HỌ/TÊN
      const officialFullName = foundStudent.name.trim(); // Lấy "La Vĩ Quyền"
      const nameParts = officialFullName.split(' ');
      
      // Lấy chữ cuối cùng làm Tên, phần còn lại làm Họ
      const officialFirstName = nameParts.length > 1 ? nameParts.pop() : officialFullName; 
      const officialLastName = nameParts.join(' '); 

      // Tạo object học viên chuẩn xác 100% so với Admin
      const studentToAdd = {
        studentId: sId,
        firstName: officialFirstName, // Sẽ tự động là "Quyền"
        lastName: officialLastName,   // Sẽ tự động là "La Vĩ"
        fullName: officialFullName
      };

      // 5. Lưu vào Roster của Firestore
      const updatedStudents = [...(rosterRoom.students || []), studentToAdd];
      await updateDoc(doc(db, "rooms", rosterRoom.roomId), { students: updatedStudents });
      
      setRosterRoom({ ...rosterRoom, students: updatedStudents });
      setRooms(rooms.map(r => r.roomId === rosterRoom.roomId ? { ...r, students: updatedStudents } : r));
      
      // Xóa form nhập liệu sau khi thêm thành công
      setNewStudent({ firstName: '', lastName: '', studentId: '' });

      // Hiển thị thông báo nhỏ báo cho giáo viên biết đã lấy đúng tên gốc
      alert(`Đã thêm thành công học viên chính thức: ${officialFullName}`);

    } catch (error) {
      console.error("Lỗi thêm học viên:", error);
      alert("Đã có lỗi xảy ra khi truy xuất dữ liệu.");
    } finally {
      setIsAddingStudent(false);
    }
  };

  const handleDeleteStudent = async (studentId) => {
    const updatedStudents = rosterRoom.students.filter(s => s.studentId !== studentId);
    try {
      await updateDoc(doc(db, "rooms", rosterRoom.roomId), { students: updatedStudents });
      setRosterRoom({ ...rosterRoom, students: updatedStudents });
      setRooms(rooms.map(r => r.roomId === rosterRoom.roomId ? { ...r, students: updatedStudents } : r));
    } catch (error) { console.error("Lỗi xóa học viên:", error); }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-6 animate-fade-in-up">
      
      {/* HEADER TỐI ƯU */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-[#003366] m-0">Quản lý Phòng thi (Rooms)</h2>
          <p className="text-sm text-slate-500 font-medium mt-1">Tạo lớp học ảo để triển khai bài tập và duyệt danh sách học viên.</p>
        </div>
        
        <button 
          onClick={() => setIsAddingRoom(true)} 
          className="flex items-center justify-center gap-2 w-full md:w-auto bg-[#003366] text-white font-bold py-3 px-6 rounded-full hover:-translate-y-0.5 transition-transform shadow-md"
        >
          <SvgIcons.Plus /> Thêm phòng mới
        </button>
      </div>

      {/* BOX THÊM PHÒNG */}
      {isAddingRoom && (
        <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl mb-8 flex flex-col md:flex-row gap-4 items-end shadow-sm">
          <div className="flex-1 w-full">
            <Input label="Tên Phòng (Room Name)" placeholder="Ví dụ: IELTS01, KIDS_A..." value={newRoomName} onChange={(e) => setNewRoomName(e.target.value.toUpperCase())} />
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <button onClick={handleAddRoom} className="flex-1 md:flex-none bg-[#003366] text-white font-bold py-3 px-8 rounded-full hover:bg-[#002244] transition-colors whitespace-nowrap">Lưu phòng</button>
            <button onClick={() => setIsAddingRoom(false)} className="flex-1 md:flex-none bg-white text-slate-500 font-bold py-3 px-8 rounded-full border border-slate-300 hover:bg-slate-100 transition-colors whitespace-nowrap">Hủy</button>
          </div>
        </div>
      )}

      {/* DANH SÁCH PHÒNG (TABLE VIEW) */}
      <div className="w-full overflow-x-auto bg-white rounded-2xl border border-slate-200 shadow-sm">
        {isLoading ? (
          <div className="p-10 text-center text-slate-400 font-bold">Đang tải danh sách phòng...</div>
        ) : (
          <table className="w-full min-w-[700px] border-collapse text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="p-4 text-slate-500 font-extrabold text-xs uppercase tracking-wider w-20 text-center">In Menu</th>
                <th className="p-4 text-slate-500 font-extrabold text-xs uppercase tracking-wider w-20 text-center">Trạng thái</th>
                <th className="p-4 text-slate-500 font-extrabold text-xs uppercase tracking-wider">Tên Phòng (Mã chia sẻ)</th>
                <th className="p-4 text-slate-500 font-extrabold text-xs uppercase tracking-wider text-center">Copy Mã</th>
                <th className="p-4 text-slate-500 font-extrabold text-xs uppercase tracking-wider text-center">Học viên</th>
                <th className="p-4 text-slate-500 font-extrabold text-xs uppercase tracking-wider text-center">Xóa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rooms.length === 0 ? (
                <tr><td colSpan="6" className="p-16 text-center text-slate-400 font-medium">Chưa có lớp học nào. Hãy bấm "Thêm phòng mới" để bắt đầu!</td></tr>
              ) : (
                rooms.map((room, index) => (
                  <tr key={room.id} className="hover:bg-sky-50 transition-colors">
                    
                    {/* In Menu */}
                    <td className="p-4 text-center">
                      <input type="checkbox" checked={room.inMenu !== false} onChange={() => handleToggleInMenu(room.roomId, room.inMenu !== false)} className="w-5 h-5 cursor-pointer accent-[#003366]" />
                    </td>

                    {/* Status */}
                    <td className="p-4 text-center">
                      <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block shadow-[0_0_8px_rgba(16,185,129,0.5)]" title="Active"></span>
                    </td>

                    {/* Room Name */}
                    <td className="p-4">
                      {editingRoomId === room.roomId ? (
                        <div className="flex items-center gap-3">
                          <input 
                            autoFocus value={editRoomName} onChange={(e) => setEditRoomName(e.target.value)}
                            onBlur={() => handleRenameRoom(room.roomId)} onKeyDown={(e) => e.key === 'Enter' && handleRenameRoom(room.roomId)}
                            className="p-2 rounded-lg border-2 border-[#003366] outline-none font-bold text-[#003366] w-40"
                          />
                          <span className="text-xs text-slate-400 italic">Nhấn Enter để lưu</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <span className="text-[#003366] font-extrabold text-lg">{room.roomId}</span>
                          <button onClick={() => { setEditingRoomId(room.roomId); setEditRoomName(room.roomId); }} className="text-slate-400 hover:text-[#003366] transition-colors p-1" title="Đổi tên phòng">
                            <SvgIcons.Edit />
                          </button>
                          {index === 0 && <span className="bg-sky-100 text-sky-600 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">Phòng Mặc Định</span>}
                        </div>
                      )}
                    </td>

                    {/* Share */}
                    <td className="p-4 text-center">
                      <button onClick={() => handleShareRoom(room.roomId)} className="p-2 text-[#003366] hover:bg-slate-200 rounded-lg transition-colors" title="Sao chép Mã phòng">
                        <SvgIcons.Share />
                      </button>
                    </td>

                    {/* Roster */}
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => setRosterRoom(room)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-full text-[#003366] font-bold hover:border-[#003366] hover:bg-slate-50 transition-all shadow-sm"
                      >
                        <SvgIcons.Users /> {room.students?.length || 0}
                      </button>
                    </td>

                    {/* Delete */}
                    <td className="p-4 text-center">
                      <button onClick={() => handleDeleteRoom(room.roomId)} className="p-2 text-red-500 hover:bg-red-50 hover:text-red-700 rounded-lg transition-colors" title="Xóa phòng">
                        <SvgIcons.Trash />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* MODAL QUẢN LÝ ROSTER VỚI TAILWIND */}
      {rosterRoom && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[1000] p-4">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl animate-fade-in-up">
            
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-3xl">
              <div>
                <h2 className="m-0 text-[#003366] font-extrabold text-xl md:text-2xl">Duyệt danh sách thi: <span className="text-sky-500">{rosterRoom.roomId}</span></h2>
                <span className="text-sm text-slate-500 font-bold mt-1 block">Đang có {rosterRoom.students?.length || 0} học viên trong phòng</span>
              </div>
              <button onClick={() => setRosterRoom(null)} className="text-slate-400 hover:text-red-500 transition-colors p-2"><SvgIcons.Close /></button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              
              {/* Form thêm học viên */}
              <form onSubmit={handleAddStudent} className="flex flex-col md:flex-row gap-4 items-end mb-8 p-6 bg-sky-50 border border-sky-100 rounded-2xl">
                <div className="flex-1 w-full"><Input label="Họ (Last Name)" placeholder="VD: Nguyễn Văn" value={newStudent.lastName} onChange={e => setNewStudent({...newStudent, lastName: e.target.value})} required /></div>
                <div className="flex-1 w-full"><Input label="Tên (First Name)" placeholder="VD: A" value={newStudent.firstName} onChange={e => setNewStudent({...newStudent, firstName: e.target.value})} required /></div>
                <div className="flex-1 w-full"><Input label="Mã Học Viên (8 chữ số)" placeholder="VD: 20260101" value={newStudent.studentId} onChange={e => setNewStudent({...newStudent, studentId: e.target.value.toUpperCase()})} required /></div>
                
                <button 
                  type="submit" 
                  disabled={isAddingStudent}
                  className={`w-full md:w-auto py-3 px-8 rounded-full font-bold transition-all shadow-md whitespace-nowrap ${isAddingStudent ? 'bg-slate-400 text-white cursor-not-allowed' : 'bg-sky-500 text-white hover:bg-sky-600 hover:-translate-y-0.5'}`}
                >
                  {isAddingStudent ? 'Đang dò tìm...' : 'Thêm vào Roster'}
                </button>
              </form>

              <div className="w-full overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="min-w-[500px] w-full border-collapse text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="p-4 font-extrabold text-slate-500 text-xs uppercase tracking-wider">Họ đệm</th>
                      <th className="p-4 font-extrabold text-slate-500 text-xs uppercase tracking-wider">Tên</th>
                      <th className="p-4 font-extrabold text-slate-500 text-xs uppercase tracking-wider">Mã Học Viên</th>
                      <th className="p-4 font-extrabold text-slate-500 text-xs uppercase tracking-wider text-center">Xóa khỏi phòng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(rosterRoom.students || []).length === 0 ? (
                      <tr><td colSpan="4" className="p-10 text-center text-slate-400 font-medium">Phòng thi đang trống. Hãy nhập mã học viên để thêm người!</td></tr>
                    ) : (
                      rosterRoom.students.map((student, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4 text-slate-700 font-bold">{student.lastName}</td>
                          <td className="p-4 text-slate-700 font-bold">{student.firstName}</td>
                          <td className="p-4 text-[#003366] font-extrabold text-base">{student.studentId}</td>
                          <td className="p-4 text-center">
                            <button onClick={() => handleDeleteStudent(student.studentId)} className="p-2 text-red-500 hover:bg-red-50 hover:text-red-700 rounded-lg transition-colors" title="Mời ra khỏi phòng">
                              <SvgIcons.Trash />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}