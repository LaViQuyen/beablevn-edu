import React, { useState } from 'react';
import { db } from '../../firebase';
import { ref, update } from "firebase/database";
import { fmtStudentName } from '../../utils/studentName';

// ===== Tiện ích ngày sinh =====
// Parse chuỗi "YYYY-MM-DD" theo từng phần (KHÔNG dùng new Date() để tránh lệch múi giờ)
// Parse ngày: ưu tiên "dd/mm/yyyy" (GV/CCO gõ tay); vẫn nhận "yyyy-mm-dd" để tương thích dữ liệu cũ
const parseYMD = (s) => {
  if (!s || typeof s !== 'string') return null;
  const t = s.trim();
  let d, m, y;
  if (t.includes('/')) {
    const p = t.split('/');
    if (p.length !== 3) return null;
    d = +p[0]; m = +p[1]; y = +p[2];
  } else if (t.includes('-')) {
    const p = t.split('-');
    if (p.length !== 3) return null;
    y = +p[0]; m = +p[1]; d = +p[2];
  } else return null;
  if (!d || !m || !y || m < 1 || m > 12 || d < 1 || d > 31 || y < 1900) return null;
  return { y, m, d };
};
// Có sinh nhật trong tháng hiện tại không
export const isBirthdayThisMonth = (s) => {
  const ymd = parseYMD(s);
  return !!ymd && ymd.m === (new Date().getMonth() + 1);
};
// Hiển thị "dd/mm"
const fmtDM = (s) => {
  const ymd = parseYMD(s);
  if (!ymd) return '';
  return `${String(ymd.d).padStart(2, '0')}/${String(ymd.m).padStart(2, '0')}`;
};
// Hiển thị đầy đủ "dd/mm/yyyy"
const fmtFull = (s) => {
  const ymd = parseYMD(s);
  if (!ymd) return '';
  return `${String(ymd.d).padStart(2, '0')}/${String(ymd.m).padStart(2, '0')}/${ymd.y}`;
};

// Icon lịch nhỏ
const CalendarIcon = ({ className = 'w-4 h-4' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0V11.25A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
  </svg>
);

// Ô ngày sinh "trang trí": chế độ xem hiển thị dd/mm/yyyy kèm icon; chế độ sửa là input date bọc icon
const DateField = ({ value, disabled, onChange }) => {
  if (disabled) {
    return (
      <div className="flex items-center gap-2 w-full border border-slate-200 bg-slate-50 px-3 py-2 rounded-xl text-sm">
        <span className="text-primary"><CalendarIcon /></span>
        <span className={value ? 'font-medium text-slate-700' : 'text-slate-400 italic'}>
          {value ? fmtFull(value) : 'Chưa có dữ liệu'}
        </span>
      </div>
    );
  }
  // Gõ tay dd/mm/yyyy, tự chèn dấu "/", KHÔNG mở lịch để khỏi tốn thời gian tìm ngày
  const handleType = (raw) => {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    let out = digits;
    if (digits.length >= 5) out = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4);
    else if (digits.length >= 3) out = digits.slice(0, 2) + '/' + digits.slice(2);
    onChange(out);
  };
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary pointer-events-none"><CalendarIcon /></span>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => handleType(e.target.value)}
        placeholder="dd/mm/yyyy"
        maxLength={10}
        className="w-full border border-slate-200 bg-white pl-9 pr-3 py-2 rounded-xl text-sm font-medium text-slate-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
      />
    </div>
  );
};

// ===== Drink Preference =====
const DRINK_OPTIONS = [
  { value: 'milktea', label: 'Team Trà sữa' },
  { value: 'healthy', label: 'Team healthy' },
  { value: 'alert',   label: 'Team tỉnh táo' },
];

// Chuẩn hoá Drink Preference về mảng (tương thích dữ liệu cũ lưu dạng chuỗi)
const toArr = (v) => (Array.isArray(v) ? v : (v ? [v] : []));

// Drink Preference: chọn NHIỀU team, bấm lại 1 lần nữa để bỏ chọn
const DrinkToggle = ({ value, disabled, onToggle }) => (
  <div className="flex flex-wrap gap-2">
    {DRINK_OPTIONS.map(opt => {
      const active = value.includes(opt.value);
      return (
        <button
          type="button"
          key={opt.value}
          disabled={disabled}
          onClick={() => onToggle(opt.value)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-all
            ${active ? 'border-primary bg-primary-light text-primary' : 'border-slate-200 text-slate-600 hover:border-green-100'}
            ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <span className={`w-4 h-4 rounded-md border flex items-center justify-center text-[10px] font-bold ${active ? 'bg-primary border-primary text-white' : 'border-slate-300'}`}>
            {active ? '✓' : ''}
          </span>
          {opt.label}
        </button>
      );
    })}
  </div>
);

// Label + ô hiển thị thống nhất
const Field = ({ label, children }) => (
  <div>
    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1">{label}</label>
    {children}
  </div>
);

const inputCls = (disabled) =>
  `w-full border border-slate-200 px-3 py-2 rounded-xl text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 ${disabled ? 'bg-slate-50 text-slate-500' : 'bg-white'}`;

const StudentDetailModal = ({ student, classNames = [], onClose }) => {
  // Có sẵn dữ liệu profile chưa? Nếu chưa → mở thẳng chế độ điền
  const hasProfile = !!(student.birthDate || student.englishName || student.drinkPref || student.parent);
  const [editing, setEditing] = useState(!hasProfile);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  // ---- State form học viên ----
  const [birthDate, setBirthDate] = useState(student.birthDate || '');
  const [englishName, setEnglishName] = useState(student.englishName || '');
  const [drinkPref, setDrinkPref] = useState(toArr(student.drinkPref));

  // ---- State form phụ huynh ----
  const p = student.parent || {};
  const [parentName, setParentName] = useState(p.name || '');
  // Liên hệ động: mảng chuỗi, tối thiểu 1 ô
  const [contacts, setContacts] = useState(
    Array.isArray(p.contacts) && p.contacts.length ? [...p.contacts] : ['']
  );
  const [parentBirthDate, setParentBirthDate] = useState(p.birthDate || '');
  const [parentDrinkPref, setParentDrinkPref] = useState(toArr(p.drinkPref));

  const setContactAt = (i, val) => setContacts(prev => prev.map((c, idx) => (idx === i ? val : c)));
  const addContact = () => setContacts(prev => [...prev, '']);
  const removeContact = (i) => setContacts(prev => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));

  // Bật/tắt 1 team drink (bấm lại để bỏ chọn)
  const toggleStDrink = (v) => setDrinkPref(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
  const togglePhDrink = (v) => setParentDrinkPref(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);

  const drinkLabels = (arr) => {
    const a = toArr(arr);
    return a.length ? a.map(v => DRINK_OPTIONS.find(o => o.value === v)?.label).filter(Boolean).join(', ') : '–';
  };

  // Sinh nhật trong tháng?
  const stBirthday = isBirthdayThisMonth(birthDate);
  const phBirthday = isBirthdayThisMonth(parentBirthDate);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Lọc ô liên hệ trống trước khi lưu
      const cleanContacts = contacts.map(c => (c || '').trim()).filter(Boolean);
      await update(ref(db, `users/${student.id}`), {
        birthDate: birthDate || null,
        englishName: englishName.trim() || null,
        drinkPref: drinkPref.length ? drinkPref : null,
        parent: {
          name: parentName.trim() || null,
          contacts: cleanContacts.length ? cleanContacts : null,
          birthDate: parentBirthDate || null,
          drinkPref: parentDrinkPref.length ? parentDrinkPref : null,
        },
      });
      setSavedMsg('Đã lưu thông tin!');
      setEditing(false);
      setTimeout(() => setSavedMsg(''), 2000);
    } catch (err) {
      setSavedMsg('Lỗi khi lưu: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-light text-primary flex items-center justify-center font-bold">
              {(student.name || '?').charAt(0)}
            </div>
            <div>
              <h3 className="section-title flex items-center gap-2">
                {fmtStudentName(student.name, englishName)}
                {stBirthday && <span title="Sinh nhật tháng này">🎂</span>}
              </h3>
              <p className="text-xs text-slate-400 font-mono">{student.studentCode || ''}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="p-5 space-y-6">
          {/* ===== THÔNG TIN HỌC VIÊN ===== */}
          <section>
            <h4 className="text-sm font-extrabold text-primary uppercase tracking-wide mb-3">Thông tin học viên</h4>

            {stBirthday && (
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                🎂 Ngày {fmtDM(birthDate)} là sinh nhật của {student.name || 'học viên'}
              </div>
            )}

            <div className="space-y-3">
              <Field label="Họ và tên">
                <input className={inputCls(true)} value={student.name || ''} disabled />
              </Field>

              <Field label="Ngày sinh">
                <DateField value={birthDate} disabled={!editing} onChange={setBirthDate} />
              </Field>

              <Field label="Lớp">
                <div className="flex flex-wrap gap-1.5">
                  {classNames.length ? classNames.map((c, i) => (
                    <span key={i} className="text-[11px] font-bold bg-primary-light text-primary px-2 py-1 rounded border border-green-100">{c}</span>
                  )) : <span className="text-sm text-slate-400">–</span>}
                </div>
              </Field>

              <Field label="Mã học viên">
                <input className={inputCls(true)} value={student.studentCode || ''} disabled />
              </Field>

              <Field label="Tên tiếng Anh">
                <input className={inputCls(!editing)} value={englishName} disabled={!editing}
                  placeholder="VD: David" onChange={e => setEnglishName(e.target.value)} />
              </Field>

              <Field label="Drink Preference">
                {editing
                  ? <DrinkToggle value={drinkPref} disabled={!editing} onToggle={toggleStDrink} />
                  : <p className="text-sm font-medium text-slate-700">{drinkLabels(drinkPref)}</p>}
              </Field>
            </div>
          </section>

          {/* ===== THÔNG TIN PHỤ HUYNH ===== */}
          <section className="border-t border-slate-100 pt-5">
            <h4 className="text-sm font-extrabold text-primary uppercase tracking-wide mb-3">Thông tin phụ huynh</h4>

            {phBirthday && (
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                🎂 Ngày {fmtDM(parentBirthDate)} là sinh nhật của {parentName || 'phụ huynh'}
              </div>
            )}

            <div className="space-y-3">
              <Field label="Tên phụ huynh">
                <input className={inputCls(!editing)} value={parentName} disabled={!editing}
                  placeholder="VD: Mr/Ms Nguyễn Văn A" onChange={e => setParentName(e.target.value)} />
              </Field>

              <Field label="Liên hệ">
                <div className="space-y-2">
                  {contacts.map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        className={inputCls(!editing)}
                        value={c}
                        disabled={!editing}
                        placeholder={i === 0 ? 'VD: Số điện thoại' : i === 1 ? 'VD: Email' : 'Liên hệ khác'}
                        onChange={e => setContactAt(i, e.target.value)}
                      />
                      {editing && contacts.length > 1 && (
                        <button type="button" onClick={() => removeContact(i)}
                          className="w-9 h-9 shrink-0 rounded-xl border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 text-lg leading-none">
                          &minus;
                        </button>
                      )}
                    </div>
                  ))}
                  {editing && (
                    <button type="button" onClick={addContact}
                      className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-hover">
                      <span className="w-6 h-6 rounded-full bg-primary-light flex items-center justify-center font-bold">+</span>
                      Thêm liên hệ
                    </button>
                  )}
                </div>
              </Field>

              <Field label="Ngày sinh">
                <DateField value={parentBirthDate} disabled={!editing} onChange={setParentBirthDate} />
              </Field>

              <Field label="Drink Preference">
                {editing
                  ? <DrinkToggle value={parentDrinkPref} disabled={!editing} onToggle={togglePhDrink} />
                  : <p className="text-sm font-medium text-slate-700">{drinkLabels(parentDrinkPref)}</p>}
              </Field>
            </div>
          </section>

          {savedMsg && (
            <p className="text-sm font-medium text-center text-primary">{savedMsg}</p>
          )}
        </div>

        {/* Footer 2 nút */}
        <div className="flex gap-3 px-5 py-4 border-t border-slate-100 sticky bottom-0 bg-white rounded-b-2xl">
          <button
            onClick={handleSave}
            disabled={!editing || saving}
            className={`flex-1 py-2.5 rounded-xl font-bold text-sm text-white transition-all
              ${editing && !saving ? 'bg-primary hover:bg-primary-hover' : 'bg-slate-300 cursor-not-allowed'}`}
          >
            {saving ? 'Đang lưu...' : 'Xác nhận'}
          </button>
          <button
            onClick={() => setEditing(true)}
            disabled={editing}
            className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all border
              ${editing ? 'border-slate-200 text-slate-300 cursor-not-allowed' : 'border-primary text-primary hover:bg-primary-light'}`}
          >
            Thay đổi
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentDetailModal;
