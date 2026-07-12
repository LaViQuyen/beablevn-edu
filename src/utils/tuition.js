// ============================================================
// Helper dùng chung cho chức năng HỌC PHÍ (Admin + Student).
// Trạng thái hợp lệ trong tuitionRecords:
//   'Chờ' | 'Đã thanh toán' | 'Chờ duyệt gia hạn' | 'Quá hạn'
// ============================================================

export const TUITION_STATUS = {
  CHO: 'Chờ',
  DA_THANH_TOAN: 'Đã thanh toán',
  CHO_DUYET: 'Chờ duyệt gia hạn',
  QUA_HAN: 'Quá hạn',
};

// Số ngày từ hôm nay đến hạn thanh toán (âm = đã lố hạn). null nếu chưa có hạn.
export const getDaysLeft = (deadline) => {
  if (!deadline) return null;
  const d = new Date(deadline + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((d - today) / 86400000);
};

// Trạng thái HIỆU LỰC phía client: record 'Chờ' đã lố hạn được coi là 'Quá hạn'
// ngay lập tức, không chờ admin mở trang Học phí để autoUpdateOverdue ghi DB.
// 'Chờ duyệt gia hạn' được ân hạn 7 ngày rồi mới coi là quá hạn (xem bên dưới).
export const effectiveTuitionStatus = (record) => {
  if (!record) return null;
  const days = getDaysLeft(record.paymentDeadline);
  if (record.status === TUITION_STATUS.CHO && days !== null && days < 0) {
    return TUITION_STATUS.QUA_HAN;
  }
  // 'Chờ duyệt gia hạn' được ân hạn đúng 7 ngày như popup cam kết với học viên;
  // lố quá deadline + 7 ngày mà admin chưa xử lý thì hệ thống coi là Quá hạn.
  if (record.status === TUITION_STATUS.CHO_DUYET && days !== null && days < -7) {
    return TUITION_STATUS.QUA_HAN;
  }
  return record.status || null;
};

// Một học viên có thể có NHIỀU record (mỗi lớp một dòng). Chọn record "đáng chú ý
// nhất" để hiển thị banner/khoá tính năng: Quá hạn trước, rồi đang chờ thanh toán
// (hạn gần nhất trước), cuối cùng mới tới Đã thanh toán.
// subtree: object {recordId: record} tại nhánh tuitionRecords/{mã HV} của CHÍNH học
// viên (cấu trúc theo mã: rules chỉ cho học viên đọc nhánh của mình).
export const pickPrimaryTuitionRecord = (subtree) => {
  if (!subtree) return null;
  const mine = Object.entries(subtree).filter(([, v]) => v && typeof v === 'object');
  if (mine.length === 0) return null;

  const rank = ([, r]) => {
    const eff = effectiveTuitionStatus(r);
    if (eff === TUITION_STATUS.QUA_HAN) return 0;
    if (eff === TUITION_STATUS.CHO || eff === TUITION_STATUS.CHO_DUYET) return 1;
    return 2; // Đã thanh toán hoặc trạng thái khác
  };
  mine.sort((a, b) => {
    const diff = rank(a) - rank(b);
    if (diff !== 0) return diff;
    // Cùng hạng: hạn gần nhất (nhỏ hơn) đứng trước; chưa có hạn xếp sau
    const da = getDaysLeft(a[1]?.paymentDeadline);
    const db = getDaysLeft(b[1]?.paymentDeadline);
    if (da === null && db === null) return 0;
    if (da === null) return 1;
    if (db === null) return -1;
    return da - db;
  });
  const [id, record] = mine[0];
  return { id, record };
};
