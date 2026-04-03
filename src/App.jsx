import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

// --- IMPORT CÁC LAYOUT TỪ EDU ---
import AdminLayout from './components/Layouts/AdminLayout';
import StaffLayout from './components/Layouts/StaffLayout';
import StudentLayout from './components/Layouts/StudentLayout';

// --- IMPORT CÁC TRANG CỦA EDU ---
import Login from './pages/Login';
import DashboardStudent from './pages/Student/Dashboard';
import ClassList from './pages/Staff/ClassList';
// (Bạn có thể import thêm các trang Edu khác của bạn ở đây...)

// --- IMPORT CÁC TRANG ASSIGNMENT (VỪA COPY SANG) ---
// Chú ý sửa lại đường dẫn import nếu bạn đặt tên thư mục khác
import TeacherDashboard from './pages/Assignments/Teacher/TeacherDashboard';
import DoAssignment from './pages/Assignments/Student/DoAssignment';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Trang mặc định điều hướng về Login */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />

          {/* ========================================== */}
          {/* KHU VỰC CỦA HỌC VIÊN (DÙNG STUDENT LAYOUT) */}
          {/* ========================================== */}
          <Route path="/student" element={<StudentLayout />}>
            <Route index element={<DashboardStudent />} />
            
            {/* Đây là route làm bài thi mới được ghép vào */}
            {/* Khi học sinh vào /student/room/ABC, nó sẽ hiện trong Layout của Edu */}
            <Route path="room/:roomId" element={<DoAssignment />} />
          </Route>

          {/* ========================================== */}
          {/* KHU VỰC CỦA GIÁO VIÊN (DÙNG STAFF LAYOUT)  */}
          {/* ========================================== */}
          <Route path="/staff" element={<StaffLayout />}>
            <Route index element={<ClassList />} />
            
            {/* Toàn bộ khu vực quản lý đề thi được đưa vào đường dẫn /staff/assignments */}
            <Route path="assignments/*" element={<TeacherDashboard />} />
          </Route>

          {/* ========================================== */}
          {/* KHU VỰC CỦA ADMIN (DÙNG ADMIN LAYOUT)      */}
          {/* ========================================== */}
          <Route path="/admin" element={<AdminLayout />}>
            {/* Các route của Admin giữ nguyên */}
          </Route>
          
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;