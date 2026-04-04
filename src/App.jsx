import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

// --- IMPORT LAYOUTS ---
import AdminLayout from './components/Layouts/AdminLayout';
import StaffLayout from './components/Layouts/StaffLayout';
import StudentLayout from './components/Layouts/StudentLayout';

// --- IMPORT TRANG ĐĂNG NHẬP ---
import Login from './pages/Login';

// --- IMPORT CÁC TRANG CỦA HỌC VIÊN (STUDENT) ---
import DashboardStudent from './pages/Student/Dashboard';
import MyAttendance from './pages/Student/MyAttendance';
import MyGrades from './pages/Student/MyGrades';
import StudentNotifications from './pages/Student/Notifications';

// --- IMPORT CÁC TRANG CỦA GIÁO VIÊN (STAFF) ---
import ClassList from './pages/Staff/ClassList';
import StaffAttendance from './pages/Staff/Attendance';
import ScoreInput from './pages/Staff/ScoreInput';
import StaffNotifications from './pages/Staff/Notifications';

// --- IMPORT CÁC TRANG CỦA ADMIN ---
import StaffManager from './pages/Admin/StaffManager';
import StudentManager from './pages/Admin/StudentManager';
import DataManager from './pages/Admin/DataManager';
import AdminNotifications from './pages/Admin/NotificationManager';

// --- IMPORT CÁC TRANG ASSIGNMENT (HỆ THỐNG BÀI TẬP) ---
import TeacherDashboard from './pages/Assignments/Teacher/TeacherDashboard';
import DoAssignment from './pages/Assignments/Student/DoAssignment';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />

          {/* KHU VỰC CỦA HỌC VIÊN (STUDENT) */}
          <Route path="/student" element={<StudentLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DashboardStudent />} />
            <Route path="attendance" element={<MyAttendance />} />
            <Route path="scores" element={<MyGrades />} />
            <Route path="notifications" element={<StudentNotifications />} />
            <Route path="room/:roomId" element={<DoAssignment />} />
          </Route>

          {/* KHU VỰC CỦA GIÁO VIÊN (STAFF) */}
          <Route path="/staff" element={<StaffLayout />}>
            <Route index element={<Navigate to="classes" replace />} />
            <Route path="classes" element={<ClassList />} />
            <Route path="attendance" element={<StaffAttendance />} />
            <Route path="scores" element={<ScoreInput />} />
            <Route path="notifications" element={<StaffNotifications />} />
          </Route>
          <Route path="/staff/assignments/*" element={<TeacherDashboard />} />
          {/* KHU VỰC CỦA ADMIN */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="staff" replace />} />
            <Route path="staff" element={<StaffManager />} />
            <Route path="students" element={<StudentManager />} />
            <Route path="data" element={<DataManager />} />
            <Route path="notifications" element={<AdminNotifications />} />
          </Route>
          
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;