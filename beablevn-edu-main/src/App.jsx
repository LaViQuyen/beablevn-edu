import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Layouts
import AdminLayout from './components/Layouts/AdminLayout';
import StaffLayout from './components/Layouts/StaffLayout';
import StudentLayout from './components/Layouts/StudentLayout';

// Pages - Auth
import Login from './pages/Login';

// Pages - Admin
import StaffManager from './pages/Admin/StaffManager';
import StudentManager from './pages/Admin/StudentManager';
import DataManager from './pages/Admin/DataManager';
import NotificationManager from './pages/Admin/NotificationManager'; // Đã thêm import này

// Pages - Staff (Be Able)
import ClassList from './pages/Staff/ClassList';
import Attendance from './pages/Staff/Attendance';
import ScoreInput from './pages/Staff/ScoreInput';
import StaffNotifications from './pages/Staff/Notifications';

// Pages - Student
import StudentDashboard from './pages/Student/Dashboard';
import MyAttendance from './pages/Student/MyAttendance';
import MyGrades from './pages/Student/MyGrades';
import StudentNotifications from './pages/Student/Notifications';

// Component: Điều hướng dựa trên Role (Khi vào trang chủ /)
const RedirectBasedOnRole = () => {
  const { currentUser, userData, loading } = useAuth();
  
  if (loading) return <div className="h-screen flex items-center justify-center text-[#003366] font-bold">Đang tải dữ liệu...</div>;
  if (!currentUser) return <Navigate to="/login" />;
  
  if (userData?.role === 'admin') return <Navigate to="/admin/staff" />;
  if (userData?.role === 'staff') return <Navigate to="/staff/classes" />;
  if (userData?.role === 'student') return <Navigate to="/student/dashboard" />;
  
  return <Navigate to="/login" />;
};

// Component: Bảo vệ Route (Chỉ cho phép Role cụ thể truy cập)
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { currentUser, userData, loading } = useAuth();
  
  if (loading) return <div className="h-screen flex items-center justify-center text-[#003366] font-bold">Đang xác thực...</div>;
  if (!currentUser) return <Navigate to="/login" />;
  
  // Nếu đã đăng nhập nhưng không đúng quyền -> Về trang chủ để Redirect lại đúng chỗ
  if (allowedRoles && !allowedRoles.includes(userData?.role)) {
    return <Navigate to="/" />;
  }
  
  return children;
};

const App = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Route */}
          <Route path="/login" element={<Login />} />

          {/* --- ADMIN ROUTES --- */}
          <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminLayout /></ProtectedRoute>}>
            <Route path="staff" element={<StaffManager />} />
            <Route path="students" element={<StudentManager />} />
            <Route path="data" element={<DataManager />} />
            <Route path="notifications" element={<NotificationManager />} /> {/* Route mới cho Quản lý Thông báo */}
            <Route index element={<Navigate to="staff" />} />
          </Route>

          {/* --- STAFF ROUTES --- */}
          <Route path="/staff" element={<ProtectedRoute allowedRoles={['staff', 'admin']}><StaffLayout /></ProtectedRoute>}>
            <Route path="classes" element={<ClassList />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="scores" element={<ScoreInput />} />
            <Route path="notifications" element={<StaffNotifications />} />
            <Route index element={<Navigate to="classes" />} />
          </Route>

          {/* --- STUDENT ROUTES --- */}
          <Route path="/student" element={<ProtectedRoute allowedRoles={['student']}><StudentLayout /></ProtectedRoute>}>
            <Route path="dashboard" element={<StudentDashboard />} />
            <Route path="attendance" element={<MyAttendance />} />
            <Route path="scores" element={<MyGrades />} />
            <Route path="notifications" element={<StudentNotifications />} />
            <Route index element={<Navigate to="dashboard" />} />
          </Route>

          {/* Default Route */}
          <Route path="/" element={<RedirectBasedOnRole />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;