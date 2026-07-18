import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { ref, onValue } from 'firebase/database';
import ContactBook from '../../components/ContactBook';
import { effectiveTuitionStatus, pickPrimaryTuitionRecord } from '../../utils/tuition';

// ============================================================
// SỔ LIÊN LẠC ONLINE (cổng Học viên)
// Mỗi lớp 1 thẻ; trong thẻ: Chuyên cần & Điểm danh, Điểm số theo loại, Báo bài.
// Mục Báo bài áp cùng cơ chế khóa với trang Thông báo khi học phí Quá hạn.
// ============================================================
const StudentContactBook = () => {
  const { currentUser } = useAuth();
  const [tuitionRecord, setTuitionRecord] = useState(null);

  // Theo dõi học phí để khóa mục Báo bài khi Quá hạn (đồng bộ đòn bẩy của trang Thông báo)
  useEffect(() => {
    const code = String(currentUser?.studentCode || '').trim();
    if (!code || /[.#$/\[\]]/.test(code)) return;
    const unsub = onValue(ref(db, `tuitionRecords/${code}`), (snap) => {
      const picked = pickPrimaryTuitionRecord(snap.val());
      setTuitionRecord(picked ? picked.record : null);
    });
    return () => unsub();
  }, [currentUser?.studentCode]);

  const isOverdue = effectiveTuitionStatus(tuitionRecord) === 'Quá hạn';

  return (
    <div className="space-y-6 pb-20 animate-fade-in-up">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
        <div className="p-2 bg-primary-light rounded-xl text-primary">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
        </div>
        <div>
          <h2 className="page-title">Sổ liên lạc online</h2>
          <p className="page-sub">Chuyên cần, điểm số và báo bài của từng lớp, gom về một nơi.</p>
        </div>
      </div>

      <ContactBook
        student={currentUser}
        homeworkLocked={isOverdue}
        attendanceHref="/student/attendance"
        scoresHref="/student/scores"
      />
    </div>
  );
};

export default StudentContactBook;
