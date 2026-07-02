import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { ref, onValue } from 'firebase/database';

const MyAttendance = () => {
  const { currentUser } = useAuth();
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;

    // 1. Lấy dữ liệu classes để biết tên lớp
    onValue(ref(db, 'classes'), (classSnap) => {
      const classes = classSnap.val() || {};
      
      // 2. Lấy dữ liệu attendance
      onValue(ref(db, 'attendance'), (attSnap) => {
        const attRecord = attSnap.val() || {};
        const result = [];
        
        // Lấy danh sách ID lớp của học viên
        const studentClassIds = Array.isArray(currentUser.classIds) 
            ? currentUser.classIds 
            : Object.values(currentUser.classIds || {});

        // Duyệt qua từng lớp học viên tham gia
        studentClassIds.forEach(classId => {
            const classInfo = classes[classId];
            if (!classInfo) return;

            // Lấy dữ liệu điểm danh của lớp đó
            const classAtt = attRecord[classId] || {};
            
            let totalSessions = 0;
            let presentCount = 0;
            let lateCount = 0;
            let absentCount = 0;
            let excusedCount = 0; // Thêm biến đếm Vắng có phép
            const history = [];

            // Duyệt qua từng ngày điểm danh
            Object.entries(classAtt).forEach(([date, sessionData]) => {
                if (sessionData && sessionData[currentUser.id]) {
                    totalSessions++;
                    
                    // FIX LỖI ĐIỂM DANH: Trích xuất đúng thuộc tính status từ Object
                    const dataObj = sessionData[currentUser.id];
                    const status = typeof dataObj === 'object' ? dataObj.status : dataObj;
                    const note = typeof dataObj === 'object' ? dataObj.note : '';
                    
                    if (status === 'present') presentCount++;
                    else if (status === 'late') lateCount++;
                    else if (status === 'excused') excusedCount++;
                    else absentCount++;

                    history.push({ date, status, note });
                }
            });

            // Sắp xếp lịch sử theo ngày giảm dần
            history.sort((a, b) => new Date(b.date) - new Date(a.date));

            // Tính % chuyên cần (Vắng có phép không bị trừ điểm nặng như Vắng không phép)
            const diligence = totalSessions > 0 
                ? Math.round(((presentCount + lateCount * 0.5) / totalSessions) * 100) 
                : 100;

            result.push({
                classId,
                className: classInfo.name,
                diligence,
                totalSessions,
                presentCount,
                lateCount,
                absentCount,
                excusedCount,
                history
            });
        });

        setAttendanceData(result);
        setLoading(false);
      });
    });
  }, [currentUser]);

  // Helper render badge trạng thái
  const renderStatus = (status) => {
      switch(status) {
          case 'present': return <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded">Có mặt</span>;
          case 'late': return <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-1 rounded">Đi muộn</span>;
          case 'excused': return <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded">Có phép</span>;
          default: return <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-1 rounded">Vắng</span>;
      }
  };

  // Màu progress bar theo ngưỡng
  const diligenceColor = (rate) => {
    if (rate >= 80) return { bar: 'bg-emerald-500', text: 'text-emerald-600' };
    if (rate >= 60) return { bar: 'bg-amber-400',   text: 'text-amber-600' };
    return               { bar: 'bg-red-500',       text: 'text-red-600' };
  };

  return (
    <div className="space-y-6 pb-6">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
        <div className="p-2 bg-[#E8F4EC] rounded-xl text-[#2B6830]">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
          </svg>
        </div>
        <h2 className="page-title">Theo dõi Chuyên cần</h2>
      </div>

      {/* SKELETON */}
      {loading && (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="card-std p-5 animate-pulse space-y-3">
              <div className="h-5 bg-slate-100 rounded w-32" />
              <div className="h-3 bg-slate-100 rounded w-full" />
              <div className="h-3 bg-slate-100 rounded w-3/4" />
              <div className="grid grid-cols-4 gap-3 mt-3">
                {[1,2,3,4].map(j => <div key={j} className="h-10 bg-slate-100 rounded" />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && (
        attendanceData.length > 0 ? (
            attendanceData.map(item => {
              const { bar, text } = diligenceColor(item.diligence);
              return (
                <div key={item.classId} className="card-std overflow-hidden">
                    {/* Header Lớp + Progress Bar */}
                    <div className="p-4 bg-slate-50 border-b border-slate-100">
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <h3 className="font-bold text-[#2B6830]">{item.className}</h3>
                                <p className="text-xs text-slate-500">{item.totalSessions} buổi đã điểm danh</p>
                            </div>
                            <div className="text-right">
                                <div className={`text-3xl font-extrabold leading-tight ${text}`}>{item.diligence}%</div>
                                <p className="stat-label">Chuyên cần</p>
                            </div>
                        </div>
                        {/* Progress bar */}
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-700 ${bar}`}
                                style={{ width: `${item.diligence}%` }}
                            />
                        </div>
                        {item.diligence < 70 && (
                            <p className="text-xs text-red-500 font-medium mt-1.5">
                                ⚠️ Chuyên cần thấp — Liên hệ giáo viên để được hỗ trợ.
                            </p>
                        )}
                    </div>

                    {/* Chi tiết thống kê */}
                    <div className="grid grid-cols-4 divide-x divide-slate-100 border-b border-slate-100">
                        <div className="p-3 text-center">
                            <div className="text-green-600 font-bold">{item.presentCount}</div>
                            <div className="text-[10px] text-slate-400">Có mặt</div>
                        </div>
                        <div className="p-3 text-center">
                            <div className="text-orange-500 font-bold">{item.lateCount}</div>
                            <div className="text-[10px] text-slate-400">Đi muộn</div>
                        </div>
                        <div className="p-3 text-center">
                            <div className="text-green-500 font-bold">{item.excusedCount}</div>
                            <div className="text-[10px] text-slate-400">Có phép</div>
                        </div>
                        <div className="p-3 text-center">
                            <div className="text-red-500 font-bold">{item.absentCount}</div>
                            <div className="text-[10px] text-slate-400">Vắng</div>
                        </div>
                    </div>

                    {/* Lịch sử chi tiết */}
                    <div className="max-h-60 overflow-y-auto p-4 custom-scrollbar">
                        <p className="text-xs font-bold text-slate-400 mb-3 uppercase">Lịch sử điểm danh</p>
                        {item.history.length > 0 ? (
                            <div className="space-y-3">
                                {item.history.map((record, idx) => (
                                    <div key={idx} className="flex flex-col border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                                        <div className="flex justify-between items-center text-sm mb-1">
                                            <span className="text-slate-600 font-medium">
                                                {new Date(record.date).toLocaleDateString('vi-VN')}
                                            </span>
                                            {renderStatus(record.status)}
                                        </div>
                                        {/* Hiển thị lý do nếu có */}
                                        {record.note && (
                                            <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded border border-slate-100">
                                                <span className="font-bold text-slate-400">Lý do: </span>{record.note}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : <p className="text-sm text-slate-400 italic">Chưa có dữ liệu điểm danh.</p>}
                    </div>
                </div>
              );
            })
        ) : (
          <div className="bg-white rounded-xl border border-dashed border-slate-200 p-10 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="#cbd5e1" className="w-12 h-12 mx-auto mb-3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
            </svg>
            <p className="text-slate-400 text-sm font-medium">Bạn chưa tham gia lớp học nào.</p>
          </div>
        )
      )}
    </div>
  );
};

export default MyAttendance;