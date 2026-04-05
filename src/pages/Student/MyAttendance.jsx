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
          case 'excused': return <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-1 rounded">Có phép</span>;
          default: return <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-1 rounded">Vắng</span>;
      }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-[#003366]">Theo dõi Chuyên cần</h2>
      
      {loading ? <p className="text-slate-400">Đang tải dữ liệu...</p> : (
        attendanceData.length > 0 ? (
            attendanceData.map(item => (
                <div key={item.classId} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    {/* Header Lớp */}
                    <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                        <div>
                            <h3 className="font-bold text-[#003366]">{item.className}</h3>
                            <p className="text-xs text-slate-500">Tổng số buổi đã học: {item.totalSessions}</p>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-bold text-[#003366]">{item.diligence}%</div>
                            <p className="text-[10px] uppercase font-bold text-slate-400">Mức độ chuyên cần</p>
                        </div>
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
                            <div className="text-blue-500 font-bold">{item.excusedCount}</div>
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
            ))
        ) : <p className="text-slate-500 italic">Bạn chưa tham gia lớp học nào.</p>
      )}
    </div>
  );
};

export default MyAttendance;