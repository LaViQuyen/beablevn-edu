import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { ref, onValue } from 'firebase/database';
import StudentAvatar from '../../components/StudentAvatar';
import { DEFAULT_SKINS, DEFAULT_SKIN_ID, getSkin, normalizeSkin, getTitle } from '../../data/skins';

// ============================================================
// BẢNG VINH DANH, toàn hệ thống, NHIỀU HẠNG MỤC (tab).
// Nguyên tắc: vinh danh nhiều kiểu giá trị → nhiều con đường toả sáng.
//   1. Nỗ lực     , Bonus tích lũy (điểm dương). Ai chăm cũng leo được.
//   2. Điểm thi   , TB điểm thi MMT/EOMT các khóa. ẨN số tuyệt đối của người khác
//                    (chỉ hiện hạng + bậc), chỉ hiện điểm thật của CHÍNH MÌNH → tôn trọng
//                    quyền riêng tư của trẻ.
//   3. Chuyên cần , streak buổi đi học liên tiếp (có mặt/muộn/có phép giữ chuỗi, vắng phá).
//   4. Sưu tầm    , số skin MỐC mở khóa bằng thành tích (KHÔNG tính skin mua/nạp tiền).
// Luôn hiện hạng của chính mình dù ngoài top 20.
// ============================================================

const MEDAL = ['🥇', '🥈', '🥉'];
const KEPT = new Set(['present', 'late', 'excused']); // trạng thái GIỮ chuỗi chuyên cần

// Bậc học lực để hiện thay cho điểm tuyệt đối của người khác (thang 0–10)
const examTier = (v) =>
  v >= 9 ? { label: 'Xuất sắc', cls: 'bg-amber-50 text-amber-700 border-amber-200' }
  : v >= 8 ? { label: 'Giỏi', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
  : v >= 6.5 ? { label: 'Khá', cls: 'bg-sky-50 text-sky-700 border-sky-200' }
  : v >= 5 ? { label: 'Trung bình', cls: 'bg-slate-50 text-slate-600 border-slate-200' }
  : { label: 'Đang cố gắng', cls: 'bg-slate-50 text-slate-500 border-slate-200' };

const TABS = [
  { key: 'effort',    label: 'Nỗ lực',     icon: '⭐', unit: 'điểm', desc: 'Tổng Bonus tích lũy, thưởng sự chăm chỉ, tích cực trên lớp.' },
  { key: 'exam',      label: 'Điểm thi',   icon: '🎓', unit: '',     desc: 'Điểm trung bình thi giữa & cuối khóa. Bảng tôn trọng quyền riêng tư: chỉ bạn thấy điểm cụ thể của mình.' },
  { key: 'diligence', label: 'Chuyên cần', icon: '🔥', unit: 'buổi', desc: 'Chuỗi buổi đi học liên tiếp không vắng. Đi đều là giữ được chuỗi!' },
  { key: 'skins',     label: 'Sưu tầm',    icon: '🏅', unit: 'skin', desc: 'Số skin MỐC mở khóa bằng thành tích học tập (không tính skin mua bằng Credit).' },
];

const StudentLeaderboard = () => {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState({});
  const [allScores, setAllScores] = useState({});
  const [attendance, setAttendance] = useState({});
  const [studentSkins, setStudentSkins] = useState({});
  const [dbSkins, setDbSkins] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('effort');

  useEffect(() => {
    const u1 = onValue(ref(db, 'users'), (s) => setUsers(s.val() || {}));
    const u2 = onValue(ref(db, 'scores'), (s) => { setAllScores(s.val() || {}); setLoading(false); });
    const u3 = onValue(ref(db, 'attendance'), (s) => setAttendance(s.val() || {}));
    const u4 = onValue(ref(db, 'studentSkins'), (s) => setStudentSkins(s.val() || {}));
    const u5 = onValue(ref(db, 'skins'), (s) => setDbSkins(s.val() || {}));
    return () => { u1(); u2(); u3(); u4(); u5(); };
  }, []);

  // Catalog skin hiệu lực (để biết skin nào là 'milestone' + render avatar)
  const catalog = useMemo(() => {
    const src = (dbSkins && Object.keys(dbSkins).length > 0)
      ? Object.entries(dbSkins).map(([id, v]) => normalizeSkin(v, id))
      : DEFAULT_SKINS.map(s => normalizeSkin(s));
    return src;
  }, [dbSkins]);
  const milestoneIds = useMemo(() => new Set(catalog.filter(s => s.unlock === 'milestone').map(s => s.id)), [catalog]);
  const skinMap = useMemo(() => Object.fromEntries(catalog.map(s => [s.id, s])), [catalog]);

  const resolveSkin = (sid) => {
    const eq = studentSkins[sid]?.equipped || DEFAULT_SKIN_ID;
    return skinMap[eq] || getSkin(eq);
  };

  // Danh hiệu của học viên = skin MỐC cao nhất đã mở (đặc quyền hiển thị)
  const titleOf = (sid) => getTitle(studentSkins[sid]?.owned || {}, catalog);

  // --- Danh sách học viên (LOẠI tài khoản demo) ---
  const studentIds = useMemo(
    () => Object.keys(users).filter(id => users[id]?.role === 'student' && !users[id]?.isDemo),
    [users]
  );

  // --- 1. NỖ LỰC: tổng Bonus dương toàn hệ thống ---
  const effortRows = useMemo(() => {
    const earned = {};
    Object.values(allScores).forEach(classNode => {
      Object.entries(classNode || {}).forEach(([sid, rec]) => {
        const sum = Object.values(rec?.bonus || {}).reduce((a, r) => a + Math.max(0, Number(r.score) || 0), 0);
        if (sum > 0) earned[sid] = (earned[sid] || 0) + sum;
      });
    });
    return studentIds
      .filter(id => earned[id] > 0)
      .map(id => ({ id, name: users[id].name || 'Học viên', value: earned[id] }))
      .sort((a, b) => b.value - a.value);
  }, [allScores, studentIds, users]);

  // --- 2. ĐIỂM THI: TB điểm summative (MMT/EOMT) các khóa ---
  const examRows = useMemo(() => {
    const agg = {}; // sid -> {sum, n}
    Object.values(allScores).forEach(classNode => {
      Object.entries(classNode || {}).forEach(([sid, rec]) => {
        Object.values(rec?.summative || {}).forEach(r => {
          if (r?.examType === 'MMT' || r?.examType === 'EOMT') {
            const sc = Number(r.score);
            if (!Number.isNaN(sc)) { agg[sid] = agg[sid] || { sum: 0, n: 0 }; agg[sid].sum += sc; agg[sid].n += 1; }
          }
        });
      });
    });
    return studentIds
      .filter(id => agg[id]?.n > 0)
      .map(id => ({ id, name: users[id].name || 'Học viên', value: agg[id].sum / agg[id].n }))
      .sort((a, b) => b.value - a.value);
  }, [allScores, studentIds, users]);

  // --- 3. CHUYÊN CẦN: chuỗi buổi đi học liên tiếp (toàn timeline, vắng phá chuỗi) ---
  const diligenceRows = useMemo(() => {
    // Gom mọi buổi của từng học viên: sid -> [{date, kept}]
    const byStudent = {};
    Object.values(attendance).forEach(classNode => {
      Object.entries(classNode || {}).forEach(([date, session]) => {
        Object.entries(session || {}).forEach(([sid, val]) => {
          const status = typeof val === 'object' ? val.status : val;
          (byStudent[sid] = byStudent[sid] || []).push({ date, kept: KEPT.has(status) });
        });
      });
    });
    return studentIds
      .filter(id => byStudent[id]?.length)
      .map(id => {
        const list = byStudent[id].sort((a, b) => new Date(a.date) - new Date(b.date));
        // Streak hiện tại = đếm ngược từ buổi gần nhất, dừng khi gặp buổi vắng
        let streak = 0;
        for (let i = list.length - 1; i >= 0; i--) { if (list[i].kept) streak++; else break; }
        return { id, name: users[id].name || 'Học viên', value: streak };
      })
      .filter(r => r.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [attendance, studentIds, users]);

  // --- 4. SƯU TẦM: số skin MỐC đã sở hữu ---
  const skinRows = useMemo(() => {
    return studentIds
      .map(id => {
        const owned = studentSkins[id]?.owned || {};
        const count = Object.keys(owned).filter(k => owned[k] && milestoneIds.has(k)).length;
        return { id, name: users[id].name || 'Học viên', value: count };
      })
      .filter(r => r.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [studentSkins, milestoneIds, studentIds, users]);

  const rowsByTab = { effort: effortRows, exam: examRows, diligence: diligenceRows, skins: skinRows };
  const activeTab = TABS.find(t => t.key === tab);
  const ranked = (rowsByTab[tab] || []).map((r, i) => ({ ...r, rank: i + 1 }));
  const isExam = tab === 'exam';

  // Hiển thị giá trị 1 dòng, điểm thi ẩn số của người khác
  const renderValue = (r) => {
    if (isExam) {
      if (r.id === currentUser?.id) return <span className="text-sm font-extrabold text-primary-medium">{r.value.toFixed(1)} <span className="text-[10px] text-slate-400">điểm</span></span>;
      const t = examTier(r.value);
      return <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${t.cls}`}>{t.label}</span>;
    }
    return <span className="text-sm font-extrabold text-primary-medium">{r.value}{activeTab.unit ? ` ` : ''}<span className="text-[10px] text-slate-400 font-bold">{activeTab.unit}</span></span>;
  };

  const top = ranked.slice(0, 20);
  const podium = ranked.slice(0, 3);
  const me = ranked.find(r => r.id === currentUser?.id);
  const meInTop = me && me.rank <= 20;

  return (
    <div className="space-y-6 animate-fade-in-up pb-10">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-primary to-primary-medium rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <p className="text-green-200 text-xs font-bold uppercase tracking-wider">Bảng Vinh Danh Be Able VN</p>
          <h2 className="text-xl font-bold mt-1">🏆 Học viên ưu tú toàn hệ thống</h2>
          <p className="text-green-200/90 text-[12px] mt-2 max-w-xl">Nhiều hạng mục, mỗi bạn một thế mạnh. Chăm chỉ, học giỏi, đi đều hay sưu tầm thành tích, ai cũng có bảng để toả sáng.</p>
        </div>
        <div className="absolute right-0 top-0 w-40 h-40 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl" />
      </div>

      {/* TABS */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`shrink-0 px-4 py-2.5 rounded-xl text-sm font-bold border-2 transition-colors ${tab === t.key ? 'border-primary bg-primary-light text-primary' : 'border-slate-200 bg-white text-slate-500 hover:border-green-300'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* MÔ TẢ HẠNG MỤC */}
      <div className="bg-primary-light/50 border border-green-100 rounded-xl px-4 py-3">
        <p className="text-[13px] text-slate-600"><b className="text-primary">{activeTab.icon} {activeTab.label}:</b> {activeTab.desc}</p>
      </div>

      {loading ? (
        <p className="text-center text-slate-400 text-sm py-10">Đang tải bảng xếp hạng...</p>
      ) : ranked.length === 0 ? (
        <p className="text-center text-slate-400 text-sm py-10 bg-white rounded-2xl border border-dashed border-slate-200">Chưa có dữ liệu cho hạng mục này. Hãy là người đầu tiên được vinh danh!</p>
      ) : (
        <>
          {/* PODIUM TOP 3 */}
          <div className="grid grid-cols-3 gap-3 items-end">
            {[1, 0, 2].map(pos => {
              const r = podium[pos];
              if (!r) return <div key={pos} />;
              const heights = { 0: 'h-32', 1: 'h-24', 2: 'h-20' };
              const isMe = r.id === currentUser?.id;
              return (
                <div key={r.id} className="flex flex-col items-center">
                  <div className="text-2xl mb-1">{MEDAL[r.rank - 1]}</div>
                  <StudentAvatar skin={resolveSkin(r.id)} name={r.name} size={pos === 0 ? 64 : 52} />
                  <p className={`text-xs font-bold mt-1.5 text-center truncate w-full px-1 ${isMe ? 'text-primary' : 'text-slate-700'}`}>{r.name}{isMe && ' (Bạn)'}</p>
                  <div className="text-[11px] font-extrabold">{renderValue(r)}</div>
                  <div className={`${heights[pos]} w-full mt-2 rounded-t-xl bg-gradient-to-t from-primary to-primary-medium flex items-start justify-center pt-2`}>
                    <span className="text-white font-extrabold text-lg">{r.rank}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* DANH SÁCH TOP 20 */}
          <div className="card-std p-4">
            <h3 className="text-sm font-bold text-primary mb-3 uppercase tracking-wide px-1">Top 20, {activeTab.label}</h3>
            <div className="space-y-1.5">
              {top.map(r => (
                <div key={r.id} className={`flex items-center gap-3 p-2.5 rounded-xl border ${r.id === currentUser?.id ? 'bg-primary-light border-primary/30' : 'bg-white border-slate-100'}`}>
                  <span className={`w-7 text-center font-extrabold text-sm shrink-0 ${r.rank <= 3 ? 'text-primary' : 'text-slate-400'}`}>
                    {r.rank <= 3 ? MEDAL[r.rank - 1] : r.rank}
                  </span>
                  <StudentAvatar skin={resolveSkin(r.id)} name={r.name} size={36} ring={false} />
                  <div className="flex-1 min-w-0">
                    <p className={`truncate text-sm font-bold ${r.id === currentUser?.id ? 'text-primary' : 'text-slate-700'}`}>
                      {r.name}{r.id === currentUser?.id && <span className="text-[10px] font-bold text-primary ml-1">• Bạn</span>}
                    </p>
                    {titleOf(r.id) && <p className="text-[10px] font-bold text-amber-600 truncate leading-tight">🏅 {titleOf(r.id)}</p>}
                  </div>
                  <div className="shrink-0">{renderValue(r)}</div>
                </div>
              ))}
            </div>

            {/* HẠNG CỦA CHÍNH MÌNH nếu ngoài top 20 */}
            {me && !meInTop && (
              <>
                <p className="text-center text-slate-300 text-xs my-2">• • •</p>
                <div className="flex items-center gap-3 p-2.5 rounded-xl border bg-primary-light border-primary/30">
                  <span className="w-7 text-center font-extrabold text-sm shrink-0 text-primary">{me.rank}</span>
                  <StudentAvatar skin={resolveSkin(me.id)} name={me.name} size={36} ring={false} />
                  <p className="flex-1 min-w-0 truncate text-sm font-bold text-primary">{me.name} <span className="text-[10px] font-bold ml-1">• Bạn</span></p>
                  <div className="shrink-0">{renderValue(me)}</div>
                </div>
                <p className="text-center text-[11px] text-slate-400 mt-2">Cố lên! Tiếp tục để lọt vào Top 20 nhé.</p>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default StudentLeaderboard;
