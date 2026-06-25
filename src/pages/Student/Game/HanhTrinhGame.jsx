import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { db } from '../../../firebase';
import { ref, onValue, update, increment } from 'firebase/database';
import { createGame } from './index';

// ============================================================
// TRANG GAME "HÀNH TRÌNH TRƯỞNG THÀNH" (Phaser) cho khu Học viên.
// - Cấp độ nhân vật bám theo BONUS TÍCH LŨY thật (rankFromBonus).
// - Gate truy cập: cần đạt ACCESS_BONUS mới được chơi.
// - Tiến trình (đã qua ải nào / mở khóa kỹ năng) lưu theo TÀI KHOẢN ở
//   studentGames/{uid}/hanhTrinh -> chơi máy nào cũng giữ.
// ============================================================

// Mốc Bonus tích lũy tối thiểu để MỞ KHÓA game.
const ACCESS_BONUS = 50;

// --- GIỚI HẠN LƯỢT CHƠI (chống nghiện) ---
// MỘT LƯỢT = MỘT LẦN VÀO 1 ẢI. Lượt KIẾM bằng học tập (kho lượt) và bị chặn bởi trần mỗi ngày.
// Chỉnh 3 hằng số này để tinh chỉnh.
const DAILY_CAP = 5;        // tối đa số ẢI được vào chơi MỖI NGÀY (reset 00:00)
const ATTEND_PLAY = 5;      // mỗi buổi ĐI HỌC (có mặt/đi trễ) = +5 lượt vào kho
const BONUS_PER_PLAY = 50;  // mỗi 50 Bonus tích lũy = +1 lượt vào kho

// Brand
const FOREST = '#2B6830';

const RANK_NAMES = ['Mầm Non', 'Tiểu Học', 'THCS', 'THPT', 'Đại Học'];
// Mốc Bonus -> cấp độ (1..5). Học càng nhiều, nhân vật càng mạnh (nhiều tim + vũ khí).
function rankFromBonus(b) {
  if (b >= 700) return 5;
  if (b >= 450) return 4;
  if (b >= 250) return 3;
  if (b >= 100) return 2;
  return 1;
}
// Mốc Bonus của cấp tiếp theo (để hiện thanh tiến độ); null nếu đã max.
function nextRankAt(b) {
  const steps = [100, 250, 450, 700];
  for (const s of steps) if (b < s) return s;
  return null;
}

// CẤP ĐỘ NHÂN VẬT đi theo TIẾN TRÌNH CHƠI (ải đã vượt), KHÔNG theo Bonus.
// Bonus chỉ là cổng mở khóa game (ACCESS_BONUS). Học viên phải tự vượt từng ải
// để lên cấp -> mới có thêm tim (HP) và mở thêm vũ khí/kỹ năng. Mốc dựa theo các
// ải Boss (mirror logic win() trong PlayScene): vượt Boss của cấp nào -> lên cấp đó.
function rankFromProgress(beaten) {
  let maxBeaten = -1;
  Object.keys(beaten || {}).forEach(k => {
    if (beaten[k] && parseInt(k, 10) !== 4) maxBeaten = Math.max(maxBeaten, parseInt(k, 10));
  });
  if (maxBeaten >= 19) return 5;
  if (maxBeaten >= 15) return 4;
  if (maxBeaten >= 10) return 3;
  if (maxBeaten >= 3) return 2;
  return 1;
}

const heartsFor = (rank) => 3 + (rank - 1);

export default function HanhTrinhGame() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const uid = currentUser?.id;
  const myClassIds = useMemo(() => (
    currentUser?.classIds
      ? (Array.isArray(currentUser.classIds) ? currentUser.classIds : Object.values(currentUser.classIds))
      : []
  ), [currentUser]);

  const [allScores, setAllScores] = useState({});
  const [savedProgress, setSavedProgress] = useState({ beaten: {}, unlockedSkills: false });
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);

  // Dữ liệu cho GIỚI HẠN LƯỢT + SAO + BẢNG XẾP HẠNG
  const [attendedCount, setAttendedCount] = useState(0); // số buổi đã đi học (có mặt/đi trễ)
  const [gameMeta, setGameMeta] = useState({ playsUsed: 0, totalStars: 0, playLog: {} });
  const [allGames, setAllGames] = useState({}); // studentGames mọi học viên (để xếp hạng theo sao)
  const [allUsers, setAllUsers] = useState({}); // users (để lấy tên trong bảng xếp hạng)

  const hostRef = useRef(null);   // div chứa canvas Phaser
  const gameRef = useRef(null);   // instance Phaser.Game
  const stageWrapRef = useRef(null); // wrapper bọc canvas — phần tử xin toàn màn hình
  const progressRef = useRef({ beaten: {}, unlockedSkills: false });

  // Tỉ lệ khung hình NGANG của thiết bị — để game tràn hết màn hình khi xoay ngang,
  // không còn viền đen 2 bên (Phaser dựng canvas đúng tỉ lệ này thay vì cố định 16:9).
  const landscapeAspect = useMemo(() => {
    const long = Math.max(window.innerWidth, window.innerHeight);
    const short = Math.min(window.innerWidth, window.innerHeight) || 1;
    return Math.min(Math.max(long / short, 1.6), 2.4); // kẹp trong [16:9 .. ~21.6:9]
  }, []);

  // Phát hiện điện thoại đang ở chiều DỌC (để nhắc xoay ngang) + trạng thái toàn màn hình
  const [isPortrait, setIsPortrait] = useState(false);
  const [isFs, setIsFs] = useState(false);

  useEffect(() => {
    const updateOrient = () => {
      // Coi là "điện thoại dọc" khi cao > rộng và bề rộng nhỏ (màn hình hẹp)
      setIsPortrait(window.innerHeight > window.innerWidth && window.innerWidth < 1024);
    };
    const onFsChange = () => setIsFs(!!document.fullscreenElement);
    updateOrient();
    window.addEventListener('resize', updateOrient);
    window.addEventListener('orientationchange', updateOrient);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => {
      window.removeEventListener('resize', updateOrient);
      window.removeEventListener('orientationchange', updateOrient);
      document.removeEventListener('fullscreenchange', onFsChange);
    };
  }, []);

  // Bật toàn màn hình cho khung game + cố gắng khóa xoay ngang (chỉ chạy được trên Android Chrome)
  const enterFullscreen = () => {
    const el = stageWrapRef.current;
    if (!el) return;
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
    if (req) {
      Promise.resolve(req.call(el)).then(() => {
        // Khóa hướng ngang nếu trình duyệt hỗ trợ (bỏ qua lỗi trên iOS)
        if (window.screen?.orientation?.lock) {
          window.screen.orientation.lock('landscape').catch(() => {});
        }
      }).catch(() => {});
    }
  };

  // --- Đọc điểm Bonus (mọi lớp) + tiến trình game đã lưu ---
  useEffect(() => {
    if (!uid) return;
    const unsubScores = onValue(ref(db, 'scores'), (snap) => {
      setAllScores(snap.val() || {});
      setLoading(false);
    }, (err) => { console.error('scores read error', err); setLoading(false); });
    const unsubProg = onValue(ref(db, `studentGames/${uid}/hanhTrinh`), (snap) => {
      const v = snap.val() || {};
      const prog = { beaten: v.beaten || {}, unlockedSkills: !!v.unlockedSkills };
      setSavedProgress(prog);
      // Lưu thêm phần lượt chơi + sao tích lũy (đếm lượt theo NGÀY bằng playLog/{YYYY-MM-DD})
      setGameMeta({
        playsUsed: v.playsUsed || 0,
        totalStars: v.totalStars || 0,
        playLog: v.playLog || {},
      });
      // Chỉ cập nhật ref khi CHƯA chơi (tránh ghi đè trạng thái game đang chạy)
      if (!playing) progressRef.current = prog;
    }, (err) => { console.warn('studentGames read denied (tiến trình sẽ không lưu được):', err); });

    // Đếm số buổi ĐI HỌC (có mặt/đi trễ) trên mọi lớp -> dùng để cấp lượt chơi
    const unsubAtt = onValue(ref(db, 'attendance'), (snap) => {
      const data = snap.val() || {};
      let present = 0;
      myClassIds.forEach(cid => {
        const dates = data[cid] || {};
        Object.values(dates).forEach(sess => {
          const recRaw = sess && sess[uid];
          if (!recRaw) return;
          const st = typeof recRaw === 'object' ? recRaw.status : recRaw;
          if (st === 'present' || st === 'late') present++;
        });
      });
      setAttendedCount(present);
    }, () => {});

    // Bảng xếp hạng theo sao: đọc studentGames mọi học viên + users (lấy tên)
    const unsubGames = onValue(ref(db, 'studentGames'), (snap) => setAllGames(snap.val() || {}), () => {});
    const unsubUsers = onValue(ref(db, 'users'), (snap) => setAllUsers(snap.val() || {}), () => {});

    return () => { unsubScores(); unsubProg(); unsubAtt(); unsubGames(); unsubUsers(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  // Bonus tích lũy = tổng điểm DƯƠNG kiếm được trên mọi lớp (giống Cửa hàng Skin)
  const lifetimeBonus = useMemo(() => {
    return myClassIds.reduce((sum, cid) => {
      const records = Object.values(allScores?.[cid]?.[uid]?.bonus || {});
      return sum + records.reduce((a, r) => a + Math.max(0, Number(r.score) || 0), 0);
    }, 0);
  }, [allScores, myClassIds, uid]);

  // Cấp độ nhân vật = theo TIẾN TRÌNH đã lưu (ải đã vượt), không theo Bonus.
  const rank = rankFromProgress(savedProgress.beaten);
  // Bonus tích lũy vẫn dùng làm cổng MỞ KHÓA game.
  const unlocked = lifetimeBonus >= ACCESS_BONUS;

  // --- LƯỢT CHƠI: 1 lượt = 1 LẦN VÀO ẢI. Kiếm bằng học tập (kho) + trần mỗi ngày ---
  const earnedPlays = attendedCount * ATTEND_PLAY + Math.floor(lifetimeBonus / BONUS_PER_PLAY);
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayUsed = (gameMeta.playLog && gameMeta.playLog[todayStr]) || 0; // số ải đã vào hôm nay
  const poolLeft = Math.max(0, earnedPlays - (gameMeta.playsUsed || 0));   // kho lượt còn (theo học tập)
  const dailyLeft = Math.max(0, DAILY_CAP - todayUsed);                    // còn vào được bao nhiêu ải hôm nay
  const remainingPlays = Math.min(poolLeft, dailyLeft);                    // lượt thực dùng được lúc này
  const canPlay = unlocked && remainingPlays > 0;

  // --- BẢNG XẾP HẠNG theo SAO tích lũy (mọi học viên có sao > 0) ---
  const leaderboard = useMemo(() => {
    return Object.entries(allGames)
      .map(([id, g]) => ({
        id,
        stars: (g && g.hanhTrinh && g.hanhTrinh.totalStars) || 0,
        name: allUsers[id]?.name || 'Học viên',
      }))
      .filter(x => allUsers[x.id]?.role === 'student' && x.stars > 0)
      .sort((a, b) => b.stars - a.stars);
  }, [allGames, allUsers]);
  const myBoardIndex = leaderboard.findIndex(x => x.id === uid);

  // Bật TOÀN MÀN HÌNH + khóa XOAY NGANG ngay trong cử chỉ bấm (đa số trình duyệt yêu cầu vậy).
  // Android Chrome khóa được orientation; iOS Safari không hỗ trợ -> rơi về overlay nhắc xoay ngang.
  const goImmersive = () => {
    try {
      const el = document.documentElement;
      if (!document.fullscreenElement) {
        const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
        if (req) {
          const r = req.call(el);
          if (r && r.then) r.then(() => { window.screen?.orientation?.lock?.('landscape').catch(() => {}); }).catch(() => {});
          else window.screen?.orientation?.lock?.('landscape').catch(() => {});
        }
      } else {
        window.screen?.orientation?.lock?.('landscape').catch(() => {});
      }
    } catch (e) { /* bỏ qua trên trình duyệt không hỗ trợ */ }
  };

  // Vào game (màn bản đồ). KHÔNG trừ lượt ở đây — lượt bị trừ khi VÀO TỪNG ẢI (trong MapScene).
  const startGame = () => {
    if (!canPlay) return;
    goImmersive();                 // tự xoay ngang + full màn hình khi bắt đầu lượt chơi
    progressRef.current = savedProgress;
    setPlaying(true);
  };

  // --- Mount Phaser khi bấm "Bắt đầu chơi" ---
  useEffect(() => {
    if (!playing || !hostRef.current) return;
    const initial = {
      rank,
      beaten: progressRef.current.beaten || {},
      unlockedSkills: !!progressRef.current.unlockedSkills,
    };
    const onSave = (p) => {
      progressRef.current = { beaten: p.beaten || {}, unlockedSkills: !!p.unlockedSkills };
      if (uid) {
        update(ref(db, `studentGames/${uid}/hanhTrinh`), {
          beaten: p.beaten || {},
          unlockedSkills: !!p.unlockedSkills,
          rank: p.rank || rank, // cấp độ theo tiến trình chơi (do win() cập nhật khi vượt ải)
          updatedAt: new Date().toISOString(),
        }).catch(() => {});
      }
    };
    // Cộng dồn SAO sau mỗi lượt chơi (thắng/thua đều tính) -> phục vụ bảng xếp hạng
    const onStars = (stars) => {
      if (uid && stars > 0) {
        update(ref(db, `studentGames/${uid}/hanhTrinh`), { totalStars: increment(stars) }).catch(() => {});
      }
    };
    // TRỪ 1 lượt mỗi khi VÀO 1 ẢI (MapScene gọi). Dùng increment để chống đè giá trị cũ khi chơi liên tục.
    const onConsume = () => {
      if (uid) {
        const today = new Date().toISOString().slice(0, 10);
        update(ref(db, `studentGames/${uid}/hanhTrinh`), {
          playsUsed: increment(1),
          [`playLog/${today}`]: increment(1),
        }).catch(() => {});
      }
    };
    const game = createGame(hostRef.current, { initial, onSave, onStars, onConsume, playsLeft: remainingPlays, aspect: landscapeAspect });
    gameRef.current = game;
    return () => {
      try { game.destroy(true); } catch (e) { /* ignore */ }
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  // ---------------- RENDER ----------------
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500">
        Đang tải dữ liệu…
      </div>
    );
  }

  // Màn chơi: full-bleed khung game
  if (playing) {
    return (
      <div className="max-w-5xl mx-auto px-3 py-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <button
            onClick={() => setPlaying(false)}
            className="px-4 py-2 rounded-lg font-bold text-white shrink-0"
            style={{ background: FOREST }}
          >
            ← Thoát game
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-bold text-slate-600 hidden sm:inline truncate">
              Cấp độ: {RANK_NAMES[rank - 1]} · {'❤️'.repeat(heartsFor(rank))}
            </span>
            {/* Nút toàn màn hình — trải nghiệm tốt nhất khi xoay ngang */}
            <button
              onClick={enterFullscreen}
              className="px-3 py-2 rounded-lg font-bold text-white text-sm shrink-0 flex items-center gap-1"
              style={{ background: FOREST }}
            >
              ⛶ <span>Toàn màn hình</span>
            </button>
          </div>
        </div>

        {/* Wrapper xin fullscreen; khi fullscreen thì lấp đầy màn hình */}
        <div
          ref={stageWrapRef}
          className={`relative ${isFs ? 'w-screen h-screen flex items-center justify-center bg-[#1a2a40]' : ''}`}
        >
          <div
            ref={hostRef}
            className={`bg-[#1a2a40] ${isFs ? 'w-full h-full' : 'w-full rounded-2xl overflow-hidden shadow-2xl'}`}
            style={isFs ? { touchAction: 'none' } : { aspectRatio: landscapeAspect, touchAction: 'none' }}
          />

          {/* Overlay NHẮC XOAY NGANG — chỉ hiện khi điện thoại đang để dọc */}
          {isPortrait && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 px-6 text-center bg-[#1a2a40]/95 backdrop-blur-sm rounded-2xl">
              <div className="text-6xl animate-pulse">🔄📱</div>
              <p className="text-white font-black text-lg">Xoay ngang điện thoại</p>
              <p className="text-slate-300 text-sm max-w-xs">
                Để chơi thoải mái và đẹp nhất, hãy <b className="text-white">xoay ngang</b> màn hình và bật <b className="text-white">toàn màn hình</b>.
              </p>
              <button
                onClick={enterFullscreen}
                className="mt-1 px-6 py-3 rounded-xl font-black text-white shadow-lg active:scale-95 transition"
                style={{ background: FOREST }}
              >
                ⛶ Bật toàn màn hình
              </button>
            </div>
          )}
        </div>

        <p className="text-xs text-slate-400 mt-3 text-center leading-relaxed">
          Di chuyển: <b>A/D</b> · Nhảy: <b>W</b> · Tấn công: <b>J/K/L…</b> ·
          Kỹ năng (khi mở khóa): <b>N</b> (Lễ Nghĩa) / <b>M</b> (Thái Độ).
          Tiến trình được lưu tự động vào tài khoản của bạn.
        </p>
      </div>
    );
  }

  // Màn chờ / giới thiệu
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="rounded-2xl overflow-hidden shadow-xl border border-slate-200 bg-white">
        {/* Hero */}
        <div className="px-6 py-8 text-white text-center"
             style={{ background: `linear-gradient(135deg, ${FOREST}, #1E5225)` }}>
          <div className="text-5xl mb-2">🎮</div>
          <h1 className="text-2xl font-black tracking-wide">HÀNH TRÌNH TRƯỞNG THÀNH</h1>
          <p className="text-sm opacity-90 mt-1">
            Vượt 24 ải học đường — chiến đấu với những “tật xấu”, tiến hóa từ Mầm Non đến Đại Học.
          </p>
        </div>

        <div className="p-6 space-y-5">
          {/* Trạng thái Bonus & cấp độ */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 text-center">
              <div className="text-xs font-bold text-emerald-700">BONUS TÍCH LŨY</div>
              <div className="text-3xl font-black text-emerald-800">{lifetimeBonus}</div>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-center">
              <div className="text-xs font-bold text-slate-500">CẤP ĐỘ NHÂN VẬT</div>
              <div className="text-xl font-black" style={{ color: FOREST }}>
                {RANK_NAMES[rank - 1]}
              </div>
              <div className="text-xs text-slate-400 mt-1">{'❤️'.repeat(heartsFor(rank))}</div>
            </div>
          </div>

          {/* Cách lên cấp: VƯỢT ẢI, không phải tích Bonus */}
          <div className="rounded-xl bg-[#F2F8F4] border border-green-100 p-3 text-center">
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Cấp độ nhân vật tăng khi bạn <b className="text-[#2B6830]">vượt qua các ải Boss</b> — mỗi lần lên cấp được thêm <b>tim (HP)</b> và mở thêm <b>vũ khí / kỹ năng</b>. Bonus tích lũy chỉ dùng để <b>mở khóa</b> game.
            </p>
          </div>

          {/* Nút chơi / khóa / hết lượt */}
          {!unlocked ? (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-5 text-center">
              <div className="text-3xl mb-2">🔒</div>
              <p className="font-bold text-amber-800">Cần đạt {ACCESS_BONUS} Bonus tích lũy để mở khóa</p>
              <div className="h-2.5 rounded-full bg-amber-200 overflow-hidden mt-3">
                <div className="h-full rounded-full bg-amber-500"
                     style={{ width: `${Math.min(100, Math.round(lifetimeBonus / ACCESS_BONUS * 100))}%` }} />
              </div>
              <p className="text-xs text-amber-700 mt-1">{lifetimeBonus}/{ACCESS_BONUS} Bonus</p>
            </div>
          ) : (
            <>
              {/* Thẻ LƯỢT CHƠI — kiếm bằng học tập, có trần mỗi ngày */}
              <div className="rounded-xl border border-green-100 bg-[#F2F8F4] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Lượt chơi</span>
                  <span className="text-xs font-bold text-slate-500">Hôm nay: {todayUsed}/{DAILY_CAP}</span>
                </div>
                <div className="mt-1 text-2xl font-black" style={{ color: FOREST }}>Còn {remainingPlays} lượt</div>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  <b>Mỗi lần vào 1 ải = 1 lượt.</b> Nhận lượt: <b>đi học +{ATTEND_PLAY}</b> · <b>mỗi {BONUS_PER_PLAY} Bonus +1</b>. Tối đa <b>{DAILY_CAP} ải/ngày</b> để giữ cân bằng học – chơi.
                </p>
              </div>

              {canPlay ? (
                <button
                  onClick={startGame}
                  className="w-full py-4 rounded-xl text-white text-lg font-black shadow-lg transition active:scale-95"
                  style={{ background: FOREST }}
                >
                  ▶ Bắt đầu chơi (còn {remainingPlays} lượt)
                </button>
              ) : (
                <div className="rounded-xl bg-slate-100 border border-slate-200 p-4 text-center">
                  <div className="text-2xl mb-1">⏳</div>
                  <p className="font-bold text-slate-600 text-sm">
                    {todayUsed >= DAILY_CAP
                      ? 'Đã hết lượt chơi hôm nay — hẹn gặp lại ngày mai nhé!'
                      : 'Bạn đã dùng hết lượt — đi học và tích Bonus để có thêm lượt chơi.'}
                  </p>
                </div>
              )}
            </>
          )}

          {/* BẢNG XẾP HẠNG theo SAO tích lũy */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 text-white" style={{ background: FOREST }}>
              <span className="font-black text-sm">🏆 Bảng Xếp Hạng Hành Trình</span>
              <span className="text-xs font-bold">⭐ Sao của bạn: {gameMeta.totalStars}</span>
            </div>
            {leaderboard.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-4">Chưa có ai ghi điểm. Hãy là người đầu tiên!</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {leaderboard.slice(0, 10).map((row, i) => (
                  <li key={row.id} className={`flex items-center gap-3 px-4 py-2 text-sm ${row.id === uid ? 'bg-[#E8F4EC] font-bold' : ''}`}>
                    <span className={`w-6 text-center font-black ${i < 3 ? 'text-amber-500' : 'text-slate-400'}`}>{i + 1}</span>
                    <span className="flex-1 truncate text-slate-700">{row.name}{row.id === uid ? ' (Bạn)' : ''}</span>
                    <span className="font-black" style={{ color: FOREST }}>⭐ {row.stars}</span>
                  </li>
                ))}
                {myBoardIndex >= 10 && (
                  <li className="flex items-center gap-3 px-4 py-2 text-sm bg-[#E8F4EC] font-bold border-t-2 border-dashed border-green-200">
                    <span className="w-6 text-center font-black text-slate-400">{myBoardIndex + 1}</span>
                    <span className="flex-1 truncate text-slate-700">{leaderboard[myBoardIndex].name} (Bạn)</span>
                    <span className="font-black" style={{ color: FOREST }}>⭐ {leaderboard[myBoardIndex].stars}</span>
                  </li>
                )}
              </ul>
            )}
          </div>

          <button
            onClick={() => navigate('/student/skins')}
            className="w-full py-2.5 rounded-lg font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition"
          >
            ← Về Cửa hàng Skin
          </button>
        </div>
      </div>
    </div>
  );
}
