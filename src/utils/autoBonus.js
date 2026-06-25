// ============================================================
// AUTO-BONUS — luật tự động cộng điểm Bonus khi GIÁO VIÊN nhập điểm.
// Chạy client-side ngay lúc lưu (không cần Cloud Function/Blaze).
// Cấu hình lưu ở node DB `bonusRules` (Admin chỉnh); thiếu → dùng DEFAULT.
//
// Idempotent theo thiết kế: chỉ kích hoạt khi TẠO cột điểm MỚI (handleSaveAll),
// KHÔNG chạy lại khi sửa điểm → mỗi cột điểm chỉ sinh tối đa 1 Bonus tự động.
// ============================================================

export const DEFAULT_BONUS_RULES = {
  enabled: true,
  assignmentBonus: 1,        // mỗi cột Assignment (coi như nộp đủ bài) → +Bonus
  examTier1Score: 8,         // ngưỡng 1 cho bài kiểm tra
  examTier1Bonus: 3,
  examTier2Score: 9,         // ngưỡng 2 (cao hơn)
  examTier2Bonus: 5,
  formativeCounts: true,     // áp ngưỡng cho cả Formative (true) hay chỉ Summative (false)
};

export const normalizeBonusRules = (r) => {
  const m = { ...DEFAULT_BONUS_RULES, ...(r || {}) };
  // ép kiểu số an toàn
  ['assignmentBonus','examTier1Score','examTier1Bonus','examTier2Score','examTier2Bonus'].forEach(k => {
    m[k] = Number(m[k]); if (Number.isNaN(m[k])) m[k] = DEFAULT_BONUS_RULES[k];
  });
  m.enabled = m.enabled !== false;
  m.formativeCounts = m.formativeCounts !== false;
  return m;
};

// Tính Bonus tự động cho 1 cột điểm vừa nhập.
//   activeTab: 'bonus' | 'assignment' | 'formative' | 'summative'
//   score: number (thang điểm của cột)
// Trả { amount, reason } hoặc null nếu không cộng.
export const computeAutoBonus = (activeTab, score, rulesRaw) => {
  const rules = normalizeBonusRules(rulesRaw);
  if (!rules.enabled) return null;
  const s = Number(score);
  if (Number.isNaN(s)) return null;

  // Tab 'bonus' chính nó đã là Bonus → không tự cộng thêm
  if (activeTab === 'assignment') {
    return rules.assignmentBonus > 0 ? { amount: rules.assignmentBonus, reason: 'Hoàn thành Assignment' } : null;
  }
  if (activeTab === 'summative' || (activeTab === 'formative' && rules.formativeCounts)) {
    if (s >= rules.examTier2Score && rules.examTier2Bonus > 0) return { amount: rules.examTier2Bonus, reason: `Kiểm tra đạt ≥ ${rules.examTier2Score}` };
    if (s >= rules.examTier1Score && rules.examTier1Bonus > 0) return { amount: rules.examTier1Bonus, reason: `Kiểm tra đạt ≥ ${rules.examTier1Score}` };
  }
  return null;
};
