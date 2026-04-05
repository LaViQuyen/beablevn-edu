// src/pages/teacher/RoomManager.jsx
import { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { firestore as db } from "../../../firebase";
import Input from "../../../components/Layouts/Input";
// --- HỆ THỐNG SVG ICONS TỐI GIẢN (Nét mảnh, strokeWidth="1.5") ---
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
  
  // States cho việc tạo phòng mới
  const [isAddingRoom, setIsAddingRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');

  // States cho việc đổi tên phòng (Inline Edit)
  const [editingRoomId, setEditingRoomId] = useState(null);
  const [editRoomName, setEditRoomName] = useState('');

  // States cho Roster Modal (Quản lý học viên)
  const [rosterRoom, setRosterRoom] = useState(null);
  const [newStudent, setNewStudent] = useState({ firstName: '', lastName: '', studentId: '' });

  // Lắng nghe kích thước màn hình
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 1. FETCH DỮ LIỆU TỪ FIREBASE
  const fetchRooms = async () => {
    setIsLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "rooms"));
      const roomsData = querySnapshot.docs.map(doc => ({ 
        id: doc.id, 
        inMenu: true, 
        ...doc.data() 
      }));
      roomsData.sort((a, b) => a.roomId.localeCompare(b.roomId));
      setRooms(roomsData);
    } catch (error) {
      console.error("Lỗi khi tải danh sách phòng:", error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  // 2. THÊM PHÒNG THỦ CÔNG
  const handleAddRoom = async () => {
    const roomNameUpper = newRoomName.trim().toUpperCase();
    if (!roomNameUpper) return;
    
    if (rooms.some(r => r.roomId === roomNameUpper)) {
      alert("Tên phòng đã tồn tại!");
      return;
    }

    try {
      const newRoom = {
        roomId: roomNameUpper,
        createdAt: new Date().toISOString(),
        students: [],
        inMenu: true
      };
      await setDoc(doc(db, "rooms", roomNameUpper), newRoom);
      setRooms([...rooms, newRoom].sort((a, b) => a.roomId.localeCompare(b.roomId)));
      setNewRoomName('');
      setIsAddingRoom(false);
    } catch (error) {
      console.error("Lỗi tạo phòng:", error);
    }
  };

  // 3. ĐỔI TÊN PHÒNG (INLINE EDIT)
  const handleRenameRoom = async (oldRoomId) => {
    const newNameUpper = editRoomName.trim().toUpperCase();
    
    if (!newNameUpper || newNameUpper === oldRoomId) {
      setEditingRoomId(null);
      return;
    }

    if (rooms.some(r => r.roomId === newNameUpper)) {
      alert("Tên phòng đã tồn tại!");
      setEditingRoomId(null);
      return;
    }

    try {
      const oldRoomData = rooms.find(r => r.roomId === oldRoomId);
      const newRoomData = { ...oldRoomData, roomId: newNameUpper };
      
      await setDoc(doc(db, "rooms", newNameUpper), newRoomData);
      await deleteDoc(doc(db, "rooms", oldRoomId));

      setRooms(rooms.map(r => r.roomId === oldRoomId ? newRoomData : r).sort((a, b) => a.roomId.localeCompare(b.roomId)));
      setEditingRoomId(null);
    } catch (error) {
      console.error("Lỗi đổi tên phòng:", error);
      alert("Có lỗi xảy ra khi đổi tên.");
    }
  };

  // 4. XÓA PHÒNG
  const handleDeleteRoom = async (roomId) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa phòng ${roomId}? Mọi dữ liệu học viên và kết quả sẽ bị mất.`)) {
      try {
        await deleteDoc(doc(db, "rooms", roomId));
        setRooms(rooms.filter(r => r.roomId !== roomId));
      } catch (error) {
        console.error("Lỗi xóa phòng:", error);
      }
    }
  };

  // 5. TOGGLE IN MENU
  const handleToggleInMenu = async (roomId, currentStatus) => {
    try {
      await updateDoc(doc(db, "rooms", roomId), { inMenu: !currentStatus });
      setRooms(rooms.map(r => r.roomId === roomId ? { ...r, inMenu: !currentStatus } : r));
    } catch (error) {
      console.error("Lỗi cập nhật trạng thái menu:", error);
    }
  };

  // 6. CHIA SẺ PHÒNG (COPY CLIPBOARD)
  const handleShareRoom = (roomId) => {
    navigator.clipboard.writeText(roomId);
    alert(`Đã sao chép Room ID: ${roomId}\nBạn có thể gửi mã này cho học viên để tham gia lớp.`);
  };

  // 7. QUẢN LÝ ROSTER (THÊM/XÓA HỌC VIÊN LẺ)
  const handleAddStudent = async (e) => {
    e.preventDefault();
    if (!newStudent.studentId.trim() || !newStudent.lastName.trim() || !newStudent.firstName.trim()) return;

    const updatedStudents = [...(rosterRoom.students || []), newStudent];
    try {
      await updateDoc(doc(db, "rooms", rosterRoom.roomId), { students: updatedStudents });
      setRosterRoom({ ...rosterRoom, students: updatedStudents });
      setRooms(rooms.map(r => r.roomId === rosterRoom.roomId ? { ...r, students: updatedStudents } : r));
      setNewStudent({ firstName: '', lastName: '', studentId: '' });
    } catch (error) {
      console.error("Lỗi thêm học viên:", error);
    }
  };

  const handleDeleteStudent = async (studentId) => {
    const updatedStudents = rosterRoom.students.filter(s => s.studentId !== studentId);
    try {
      await updateDoc(doc(db, "rooms", rosterRoom.roomId), { students: updatedStudents });
      setRosterRoom({ ...rosterRoom, students: updatedStudents });
      setRooms(rooms.map(r => r.roomId === rosterRoom.roomId ? { ...r, students: updatedStudents } : r));
    } catch (error) {
      console.error("Lỗi xóa học viên:", error);
    }
  };

  return (
    <div style={{ position: 'relative', minHeight: '100%', padding: isMobile ? '15px' : '30px', backgroundColor: '#f8fafc', fontFamily: "'Josefin Sans', sans-serif" }}>
      
      {/* HEADER TỐI ƯU */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', marginBottom: '30px', gap: '15px' }}>
        <div>
          <h2 style={{ color: '#003366', fontWeight: '800', margin: 0, fontSize: isMobile ? '24px' : '28px' }}>Rooms</h2>
          <p style={{ color: '#64748b', margin: '6px 0 0 0', fontSize: '15px' }}>Quản lý lớp học ảo để triển khai các hoạt động bài tập.</p>
        </div>
        
        {/* NÚT ADD ROOM MỚI */}
        <button 
          onClick={() => setIsAddingRoom(true)} 
          style={{ 
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', 
            width: isMobile ? '100%' : 'auto', backgroundColor: '#003366', color: 'white', 
            fontWeight: '700', padding: '12px 20px', borderRadius: '100px', border: 'none', 
            cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(0,51,102,0.2)', transition: 'all 0.2s',
            fontSize: '14px', whiteSpace: 'nowrap'
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <SvgIcons.Plus /> Add Room
        </button>
      </div>

      {/* BOX THÊM PHÒNG */}
      {isAddingRoom && (
        <div style={{ padding: '24px', backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', marginBottom: '24px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '15px', alignItems: isMobile ? 'stretch' : 'flex-end', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
          <div style={{ flex: 1 }}>
            <Input label="Room Name" placeholder="Nhập tên lớp học..." value={newRoomName} onChange={(e) => setNewRoomName(e.target.value.toUpperCase())} />
          </div>
          <div style={{ display: 'flex', gap: '10px', marginBottom: isMobile ? '0' : '5px' }}>
            <button onClick={handleAddRoom} style={{ flex: 1, backgroundColor: '#003366', color: 'white', fontWeight: '700', padding: '12px 24px', borderRadius: '100px', border: 'none', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap' }}>Lưu</button>
            <button onClick={() => setIsAddingRoom(false)} style={{ flex: 1, backgroundColor: 'white', color: '#64748b', fontWeight: '700', padding: '12px 24px', borderRadius: '100px', border: '1px solid #cbd5e1', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap' }}>Hủy</button>
          </div>
        </div>
      )}

      {/* DANH SÁCH PHÒNG (TABLE VIEW) */}
      <div style={{ width: '100%', overflowX: 'auto', backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontWeight: '600' }}>Đang tải danh sách phòng...</div>
        ) : (
          <table style={{ minWidth: '700px', width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
              <tr>
                <th style={{ padding: '16px 20px', color: '#64748b', fontWeight: '800', width: '80px', textAlign: 'center', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>In Menu</th>
                <th style={{ padding: '16px 20px', color: '#64748b', fontWeight: '800', width: '80px', textAlign: 'center', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
                <th style={{ padding: '16px 20px', color: '#64748b', fontWeight: '800', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Room Name</th>
                <th style={{ padding: '16px 20px', color: '#64748b', fontWeight: '800', textAlign: 'center', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Share</th>
                <th style={{ padding: '16px 20px', color: '#64748b', fontWeight: '800', textAlign: 'center', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Roster</th>
                <th style={{ padding: '16px 20px', color: '#64748b', fontWeight: '800', textAlign: 'center', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Delete</th>
              </tr>
            </thead>
            <tbody>
              {rooms.length === 0 ? (
                <tr><td colSpan="6" style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>Chưa có lớp học nào. Hãy bấm "+ Add Room" để tạo mới!</td></tr>
              ) : (
                rooms.map((room, index) => (
                  <tr key={room.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f9ff'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                    
                    {/* Cột 1: In Menu */}
                    <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={room.inMenu !== false} 
                        onChange={() => handleToggleInMenu(room.roomId, room.inMenu !== false)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#003366' }} 
                      />
                    </td>

                    {/* Cột 2: Status */}
                    <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block', boxShadow: '0 0 5px rgba(16, 185, 129, 0.5)' }} title="Active"></span>
                    </td>

                    {/* Cột 3: Room Name */}
                    <td style={{ padding: '16px 20px' }}>
                      {editingRoomId === room.roomId ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <input 
                            autoFocus
                            value={editRoomName}
                            onChange={(e) => setEditRoomName(e.target.value)}
                            onBlur={() => handleRenameRoom(room.roomId)}
                            onKeyDown={(e) => e.key === 'Enter' && handleRenameRoom(room.roomId)}
                            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #003366', outline: 'none', fontWeight: '700', color: '#003366', width: '150px' }}
                          />
                          <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>Nhấn Enter để lưu</span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                          <span style={{ color: '#003366', fontWeight: '800', fontSize: '16px' }}>{room.roomId}</span>
                          <button onClick={() => { setEditingRoomId(room.roomId); setEditRoomName(room.roomId); }} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px', color: '#64748b', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#003366'} onMouseLeave={e => e.currentTarget.style.color = '#64748b'} title="Đổi tên Room">
                            <SvgIcons.Edit />
                          </button>
                          {index === 0 && (
                            <span style={{ backgroundColor: '#e0f2fe', color: '#0284c7', fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '100px', border: '1px solid #bae6fd', whiteSpace: 'nowrap' }}>Default Room</span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Cột 4: Share */}
                    <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                      <button onClick={() => handleShareRoom(room.roomId)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '6px', color: '#003366', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#e2e8f0'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'} title="Sao chép Room ID">
                        <SvgIcons.Share />
                      </button>
                    </td>

                    {/* Cột 5: Roster */}
                    <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                      <button 
                        onClick={() => setRosterRoom(room)}
                        style={{ background: 'white', border: '1px solid #cbd5e1', borderRadius: '100px', padding: '6px 16px', cursor: 'pointer', color: '#003366', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#003366'; e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.backgroundColor = 'white'; }}
                      >
                        <SvgIcons.Users />
                        {room.students?.length || 0}
                      </button>
                    </td>

                    {/* Cột 6: Delete */}
                    <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                      <button onClick={() => handleDeleteRoom(room.roomId)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '6px', color: '#ef4444', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fee2e2'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'} title="Xóa Room">
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

      {/* MODAL QUẢN LÝ ROSTER */}
      {rosterRoom && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: isMobile ? '10px' : '20px', backdropFilter: 'blur(4px)' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '24px', width: '100%', maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            
            <div style={{ padding: isMobile ? '16px 20px' : '24px 30px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: '24px 24px 0 0' }}>
              <div>
                <h2 style={{ margin: 0, color: '#003366', fontWeight: '800', fontSize: isMobile ? '18px' : '20px' }}>Danh sách học viên: <span style={{ color: '#0ea5e9' }}>{rosterRoom.roomId}</span></h2>
                <span style={{ fontSize: '14px', color: '#64748b', fontWeight: '600' }}>Tổng số: {rosterRoom.students?.length || 0} học viên</span>
              </div>
              <button onClick={() => setRosterRoom(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#ef4444'} onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}>
                <SvgIcons.Close />
              </button>
            </div>

            <div style={{ padding: isMobile ? '15px' : '30px', overflowY: 'auto', flex: 1 }}>
              
              {/* Form thêm học viên */}
              <form onSubmit={handleAddStudent} style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '15px', alignItems: isMobile ? 'stretch' : 'flex-end', marginBottom: '30px', padding: isMobile ? '15px' : '24px', backgroundColor: '#f0f9ff', borderRadius: '16px', border: '1px solid #bae6fd' }}>
                <div style={{ flex: 1 }}><Input label="Last Name" placeholder="Họ" value={newStudent.lastName} onChange={e => setNewStudent({...newStudent, lastName: e.target.value})} required /></div>
                <div style={{ flex: 1 }}><Input label="First Name" placeholder="Tên" value={newStudent.firstName} onChange={e => setNewStudent({...newStudent, firstName: e.target.value})} required /></div>
                <div style={{ flex: 1 }}><Input label="Student ID" placeholder="Mã HV" value={newStudent.studentId} onChange={e => setNewStudent({...newStudent, studentId: e.target.value.toUpperCase()})} required /></div>
                <div style={{ marginBottom: isMobile ? '0' : '5px' }}>
                  <button type="submit" style={{ width: isMobile ? '100%' : 'auto', padding: '12px 24px', backgroundColor: '#0ea5e9', color: 'white', border: 'none', borderRadius: '100px', fontWeight: '700', cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#0284c7'} onMouseLeave={e => e.currentTarget.style.backgroundColor = '#0ea5e9'}>
                    Add Student
                  </button>
                </div>
              </form>

              <div style={{ width: '100%', overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '16px' }}>
                <table style={{ minWidth: '500px', width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #cbd5e1', backgroundColor: '#f8fafc' }}>
                      <th style={{ padding: '16px 20px', fontWeight: '800', color: '#475569', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Last Name</th>
                      <th style={{ padding: '16px 20px', fontWeight: '800', color: '#475569', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>First Name</th>
                      <th style={{ padding: '16px 20px', fontWeight: '800', color: '#475569', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Student ID</th>
                      <th style={{ padding: '16px 20px', fontWeight: '800', color: '#475569', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Remove</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(rosterRoom.students || []).length === 0 ? (
                      <tr><td colSpan="4" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Chưa có học viên nào trong danh sách.</td></tr>
                    ) : (
                      rosterRoom.students.map((student, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '16px 20px', color: '#334155', fontWeight: '600' }}>{student.lastName}</td>
                          <td style={{ padding: '16px 20px', color: '#334155', fontWeight: '600' }}>{student.firstName}</td>
                          <td style={{ padding: '16px 20px', color: '#003366', fontWeight: '800' }}>{student.studentId}</td>
                          <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                            <button onClick={() => handleDeleteStudent(student.studentId)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '6px', borderRadius: '6px', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fef2f2'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'} title="Xóa học viên">
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