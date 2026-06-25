import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Layouts
import AdminLayout from './components/Layouts/AdminLayout';
import StaffLayout from './components/Layouts/StaffLayout';
import StudentLayout from './components/Layouts/StudentLayout';

// Pages - Auth
import Login from './pages/Login';

// Pages - Admin
import AdminDashboard from './pages/Admin/AdminDashboard';
import StaffManager from './pages/Admin/StaffManager';
import StudentManager from './pages/Admin/StudentManager';
import DataManager from './pages/Admin/DataManager';
import NotificationManager from './pages/Admin/NotificationManager';
import FeedbackManager from './pages/Admin/FeedbackManager';
import BulkImport from './pages/Admin/BulkImport';
import ClassStats from './pages/Admin/ClassStats';
import SkinManager from './pages/Admin/SkinManager'; // Admin quản lý skin (catalog + cột mốc)
import AutoBonusManager from './pages/Admin/AutoBonusManager'; // Admin cấu hình tự động cộng Bonus
import NotFound from './pages/NotFound';

// Pages - Staff (Be Able)
import ClassList from './pages/Staff/ClassList';
import Attendance from './pages/Staff/Attendance';
import ScoreInput from './pages/Staff/ScoreInput';
import StaffNotifications from './pages/Staff/Notifications';
import StaffInbox from './pages/Staff/Inbox';
import FreshFit from './pages/Staff/FreshFit'; // trang FF: duyệt đổi credits + quản lý menu
import StaffCredits from './pages/Staff/StaffCredits'; // ví BAVN Credits của nhân sự
import BavnCenter from './pages/Staff/BavnCenter';     // khu BOD: grant credits + 2 hệ quà + duyệt đơn quà
import ModBonus from './pages/Staff/ModBonus';         // khu MOD: thưởng Bonus nhân sự + đánh giá thưởng quý/năm

// Pages - Student
import StudentDashboard from './pages/Student/Dashboard';
import MyAttendance from './pages/Student/MyAttendance';
import MyGrades from './pages/Student/MyGrades';
import StudentNotifications from './pages/Student/Notifications';
import StudentProfile from './pages/Student/Profile';
import StudentFeedback from './pages/Student/Feedback';
import StudentContact from './pages/Student/Contact';
import StudentCredits from './pages/Student/Credits'; // ví BAVN Credits của học viên
import StudentResources from './pages/Student/Resources'; // khu Tài nguyên & Luyện tập (link công cụ Coach)
import StudentSkins from './pages/Student/Skins'; // Cửa hàng Skin: đổi Credits lấy avatar
import StudentLeaderboard from './pages/Student/Leaderboard'; // Bảng vinh danh toàn hệ thống
const HanhTrinhGame = lazy(() => import('./pages/Student/Game/HanhTrinhGame')); // Game Phaser — lazy load (Phaser nặng)

// Component: Điều hướng dựa trên Role (Khi vào trang chủ /)
const RedirectBasedOnRole = () => {
  const { currentUser, userData, loading } = useAuth();

  if (loading) return <div className="h-screen flex items-center justify-center text-[#2B6830] font-bold">Đang tải dữ liệu...</div>;
  if (!currentUser) return <Navigate to="/login" />;

  if (userData?.role === 'admin') return <Navigate to="/admin/dashboard" />;
  if (userData?.role === 'staff') return <Navigate to="/staff/classes" />;
  if (userData?.role === 'student') return <Navigate to="/student/dashboard" />;

  return <Navigate to="/login" />;
};

// Component: Bảo vệ Route (Chỉ cho phép Role cụ thể truy cập)
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { currentUser, userData, loading } = useAuth();

  if (loading) return <div className="h-screen flex items-center justify-center text-[#2B6830] font-bold">Đang xác thực...</div>;
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
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="staff" element={<StaffManager />} />
            <Route path="students" element={<StudentManager />} />
            <Route path="data" element={<DataManager />} />
            <Route path="stats" element={<ClassStats />} />
            <Route path="skins" element={<SkinManager />} />
            <Route path="autobonus" element={<AutoBonusManager />} />
            <Route path="notifications" element={<NotificationManager />} />
            <Route path="feedback" element={<FeedbackManager />} />
            <Route path="import" element={<BulkImport />} />
            <Route index element={<Navigate to="dashboard" />} />
          </Route>

          {/* --- STAFF ROUTES --- */}
          <Route path="/staff" element={<ProtectedRoute allowedRoles={['staff', 'admin']}><StaffLayout /></ProtectedRoute>}>
            <Route path="classes" element={<ClassList />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="scores" element={<ScoreInput />} />
            <Route path="notifications" element={<StaffNotifications />} />
            <Route path="inbox" element={<StaffInbox />} />
            {/* Trang Fresh Fit — bên trong component tự chặn nếu nhân sự chưa có cờ ffAccess */}
            <Route path="freshfit" element={<FreshFit />} />
            {/* Ví Credits của nhân sự — mọi nhân sự đều có */}
            <Route path="credits" element={<StaffCredits />} />
            {/* BAVN Center — component tự chặn nếu chưa có cờ bodAccess */}
            <Route path="bavn" element={<BavnCenter />} />
            {/* Khu MOD — component tự chặn nếu chưa có cờ modAccess */}
            <Route path="mod-bonus" element={<ModBonus />} />
            {/* Cửa hàng Skin + Game cho nhân sự (dùng chung component học viên, mở khóa toàn bộ + chơi không giới hạn) */}
            <Route path="skins" element={<StudentSkins />} />
            <Route path="games/hanh-trinh" element={<Suspense fallback={<div className="py-24 text-center text-slate-500">Đang tải game…</div>}><HanhTrinhGame /></Suspense>} />
            <Route index element={<Navigate to="classes" />} />
          </Route>

          {/* --- STUDENT ROUTES --- */}
          <Route path="/student" element={<ProtectedRoute allowedRoles={['student']}><StudentLayout /></ProtectedRoute>}>
            <Route path="dashboard" element={<StudentDashboard />} />
            <Route path="attendance" element={<MyAttendance />} />
            <Route path="scores" element={<MyGrades />} />
            <Route path="notifications" element={<StudentNotifications />} />
            <Route path="credits" element={<StudentCredits />} />
            <Route path="skins" element={<StudentSkins />} />
            <Route path="games/hanh-trinh" element={<Suspense fallback={<div className="py-24 text-center text-slate-500">Đang tải game…</div>}><HanhTrinhGame /></Suspense>} />
            <Route path="leaderboard" element={<StudentLeaderboard />} />
            <Route path="resources" element={<StudentResources />} />
            <Route path="profile" element={<StudentProfile />} />
            <Route path="feedback" element={<StudentFeedback />} />
            <Route path="contact" element={<StudentContact />} />
            <Route index element={<Navigate to="dashboard" />} />
          </Route>

          {/* Default Route */}
          <Route path="/" element={<RedirectBasedOnRole />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
