import React from 'react';
import { Link } from 'react-router-dom';

// ============================================================
// Trang 404 — hiển thị khi truy cập đường dẫn không tồn tại.
// Nút "Về trang chủ" trỏ về "/" -> RedirectBasedOnRole tự đưa
// người dùng về dashboard đúng theo vai trò (admin/staff/student).
// ============================================================
const NotFound = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 sm:p-12 max-w-md w-full text-center">
        {/* Mã lỗi lớn */}
        <p className="text-7xl font-black text-[#003366] tracking-tight">404</p>

        {/* Icon la bàn nhỏ */}
        <div className="mx-auto my-5 w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#003366" className="w-7 h-7">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
          </svg>
        </div>

        <h1 className="text-lg font-bold text-slate-800">Không tìm thấy trang</h1>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed">
          Đường dẫn bạn truy cập không tồn tại hoặc đã được di chuyển.
          Hãy quay lại trang chính để tiếp tục.
        </p>

        <Link
          to="/"
          className="inline-flex items-center justify-center gap-2 mt-6 px-6 py-3 rounded-xl bg-[#003366] text-white text-sm font-bold hover:bg-[#002244] transition-all active:scale-[0.98] shadow-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
          </svg>
          Về trang chủ
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
