import Phaser from 'phaser';
import { W, H, LEVELS, MONSTER_DEFS, heartsFor } from '../config';
import { loadProg, saveProg, EXTERNAL } from '../progress';
import { buildScenery } from '../scenery';
import { initAudio, playSfx } from '../audio';
import { LEVEL_STORY } from '../story';

export class PlayScene extends Phaser.Scene {
  constructor(){ super('PlayScene'); }
  init(data){
    this.stage = data.stage || 0; this.levelData = LEVELS[this.stage];
    this._done=false; this.prog=loadProg(); this.hp=heartsFor(this.prog.rank);
    this.score=0; this.invuln=0; this.facing=1; this.comboStr = ""; this.activeMonsters = [];
    this.joyData = { active: false, x: 0, y: 0 }; this.joyJumpFired = false;
    this.leNghiaUses = 2; this.thaiDoUses = 2; this.shieldActive = false; this.shieldTimer = 0;
    this.gm = this.levelData.gm || null;
    this.reverseCtrl=false; this.reverseEndT=0; this.stunT=0; this.lagActive=false; this.lagNeed=0;
    this.hudHidden=false;
    // ---- THỂ LỰC (Stamina) toàn cục: bắn tốn thể lực, không spam được ----
    this.staminaMax=100; this.stamina=100; this.staminaRegen=24; // hồi /giây
    this.shotCost={1:6,2:9,3:12,4:16,5:20}; this.comboCost={JK:28,UIO:50};
    this.jumpStaminaLevel = (this.gm==='stamina'); // ải Thức Khuya: nhảy cũng tốn thể lực
    this._staminaMsgT=0;
    // ---- COMBO-CHAIN: chuỗi hạ quái liên tiếp -> nhân điểm + thưởng thể lực ----
    this.killChain=0; this.killChainExpire=0;
    // ---- BOSS 2 trạng thái ----
    this.bossShielded=false; this.bossEnraged=false;
    // ---- Bố cục bản đồ theo cấp ----
    this.WORLD=3500; this.elevatedSpawns=[]; this.disciplineRoad=null;
    // reset tham chiếu đối tượng (scene instance được Phaser tái sử dụng giữa các lượt)
    this.chainText=null; this.darkOverlay=null; this.lightGlow=null; this.fireWall=null;
    this.boss=null; this.bossGroup=null; this.bossAura=null; this.staminaBar=null; this.reverseText=null;
    this.isBossStage = this.levelData.isBoss; this.isCollectStage = this.levelData.isCollectStage;
    this.layout = this.isBossStage ? 'arena'
      : this.isCollectStage ? 'flat'
      : (this.levelData.rank===3 ? 'vertical'
      : (this.levelData.rank===4 ? 'branching' : 'flat'));
  }

  create(){
    initAudio(); const WORLD = this.WORLD;
    this.physics.world.setBounds(0,0,WORLD,H); this.cameras.main.setBounds(0,0,WORLD,H); this.cameras.main.setRoundPixels(true);
    buildScenery(this, WORLD, this.levelData.rank);

    this.floorGroup = this.physics.add.staticGroup();
    this.hazardGroup = this.physics.add.staticGroup();
    this.boats = this.physics.add.group({ allowGravity: false, immovable: true });

    this.buildWorld();

    this.player=this.physics.add.sprite(70,H-120, 'player_' + this.levelData.rank).setCollideWorldBounds(true);
    this.physics.add.collider(this.player, this.floorGroup); this.physics.add.collider(this.player, this.boats);
    this.physics.add.overlap(this.player, this.hazardGroup, this.onHazardHit, null, this);

    // ===== ANIMATION BẰNG CODE =====
    this.idleTween = this.tweens.add({ targets:this.player, scaleY:0.95, scaleX:1.03, duration:600, yoyo:true, repeat:-1, ease:'Sine.easeInOut' });
    this.walkTween = this.tweens.add({ targets:this.player, angle:{from:-10,to:10}, yoyo:true, repeat:-1, duration:130, ease:'Sine.easeInOut' });
    this.walkTween.pause();

    this.shieldVisual = this.add.circle(this.player.x, this.player.y, 48, 0x00ffff, 0.5).setStrokeStyle(5, 0x00ffff, 1).setVisible(false).setDepth(60);
    this.shieldCountText = this.add.text(this.player.x, this.player.y - 70, '', {fontSize:'30px', fontStyle:'900', color:'#00ffff', stroke:'#003344', strokeThickness:5}).setOrigin(0.5).setDepth(61).setVisible(false);
    this.dustEmitter = this.add.particles(0,0,'dust',{ lifespan: 300, speedX: {min:-20, max:20}, speedY: {min:-10, max:0}, scale: {start:0.8, end:0}, alpha: {start:0.5, end:0}, emitting: false }).setDepth(10);

    // ===== VFX VỤ NỔ 3 LỚP =====
    this.flashEmitter = this.add.particles(0, 0, 'star', { lifespan:150, scale:{start:2,end:0}, alpha:{start:1,end:0}, tint:0xffffff, blendMode:Phaser.BlendModes.ADD, emitting:false }).setDepth(25);
    this.sparkEmitter = this.add.particles(0, 0, 'dust', { lifespan:800, speed:{min:200,max:400}, scale:{start:0.6,end:0}, alpha:{start:1,end:0}, tint:[0xffaa00,0xff0000,0xffffff], blendMode:Phaser.BlendModes.ADD, gravityY:400, emitting:false }).setDepth(24);
    this.smokeEmitter = this.add.particles(0, 0, 'cloud', { lifespan:1000, speed:{min:20,max:50}, scale:{start:0.1,end:0.4}, alpha:{start:0.5,end:0}, tint:0x333333, emitting:false }).setDepth(23);

    this.shots=this.physics.add.group({allowGravity:false}); this.monsters=this.physics.add.group();

    // ===== SINH QUÁI =====
    const num = this.isCollectStage ? 20 : (this.isBossStage ? 6 : (10 + this.levelData.rank * 2));
    if(this.layout==='branching'){
      this.spawnMonsters(7, 'lower');                 // tầng dưới (Đường Lười Biếng): ít quái
      this.spawnRoadMonsters(num + 2);                // tầng trên (Đường Kỷ Luật): nhiều quái
    } else {
      this.spawnMonsters(num);
    }
    this.spawnGuards();                                // quái BAY canh tầng trên (vertical)

    this.physics.add.collider(this.monsters, this.floorGroup); this.physics.add.collider(this.monsters, this.hazardGroup);
    this.physics.add.overlap(this.shots, this.monsters, this.onHit, null, this); this.physics.add.overlap(this.player, this.monsters, this.onTouchMonster, null, this);

    this.flag=this.physics.add.staticImage(WORLD-80, H-66, 'flag'); this.physics.add.overlap(this.player, this.flag, ()=>this.win(), null, this);
    this.tweens.add({targets:this.flag, scaleY: 1.1, duration: 800, yoyo:true, repeat:-1});

    if (this.isBossStage) this.buildBoss();

    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    const isMobile = !this.sys.game.device.os.desktop || this.sys.game.device.input.touch;
    this.buildHeaderUI(); this.buildStaminaHUD(); this.buildInput();
    if (isMobile) this.buildMobileUI(); else this.buildPCUI();
    this.setupGimmicks();
    this.showStoryIntro();
  }

  // ===================== DỰNG BẢN ĐỒ =====================
  buildWorld(){
    if (this.layout==='arena') this.buildArena();
    else if (this.layout==='vertical') this.buildVertical();
    else if (this.layout==='branching') this.buildBranching();
    else this.buildFlat();
  }
  // Lát nền đất đặc từ x0->x1
  layGround(x0,x1,y=H-20){
    if(x1<=x0) return;
    for(let px=x0; px<x1; px+=40) this.add.image(px+20, y, 'ground');
    const w=x1-x0; const plat=this.add.rectangle((x0+x1)/2, y, w, 40, 0x000000, 0);
    this.physics.add.existing(plat, true); this.floorGroup.add(plat);
  }
  // Đoạn hố Nước/Bùn từ x0->x1 (+ thuyền nếu rộng)
  addHazardRun(x0,x1){
    if(x1<=x0) return;
    const hType = Math.random() > 0.5 ? 'water' : 'mud';
    for(let px=x0; px<x1; px+=40){ const hz=this.hazardGroup.create(px+20, H-20, hType); hz.body.setSize(40,20); hz.body.setOffset(0,20); }
    if((x1-x0) >= 160){ const b=this.boats.create((x0+x1)/2, H-32, 'boat'); b.minX=x0+40; b.maxX=x1-40; b.setVelocityX((this.isCollectStage?140:70)*(Math.random()>0.5?1:-1)); }
  }
  // Bệ đá ONE-WAY: nhảy xuyên từ dưới lên, đứng được trên đỉnh
  makePlatform(cx, cy, w){
    for(let px=cx-w/2; px<cx+w/2; px+=40) this.add.image(px+20, cy, 'stone').setDepth(-4);
    const plat=this.add.rectangle(cx, cy, w, 22, 0x000000, 0);
    this.physics.add.existing(plat, true);
    plat.body.checkCollision.down=false; plat.body.checkCollision.left=false; plat.body.checkCollision.right=false;
    this.floorGroup.add(plat);
    return plat;
  }
  // Cấp 1,2,5 + Ải Ẩn: nền phẳng có hố ngẫu nhiên (logic gốc)
  buildFlat(){
    const WORLD=this.WORLD; let curX=0;
    while(curX < WORLD){
      const gapChance = this.isCollectStage ? 0.45 : 0.25;
      const isGap = (curX > 600 && curX < WORLD - 800) && (Math.random() < gapChance);
      if(isGap){
        let gapW = Math.floor(Math.random()*4+4)*40;
        this.addHazardRun(curX, curX+gapW); curX += gapW;
      } else {
        let platW = Math.floor(Math.random()*8+6)*40; if(curX+platW>WORLD) platW=WORLD-curX;
        this.layGround(curX, curX+platW); curX += platW;
      }
    }
  }
  // Ải Boss: đấu trường nền đặc (công bằng), thêm vài bệ né đòn
  buildArena(){
    const WORLD=this.WORLD; this.layGround(0, WORLD);
    this.makePlatform(900, H-120, 200); this.makePlatform(1700, H-150, 220); this.makePlatform(2500, H-120, 200);
  }
  // THCS: bản đồ nhiều tầng, bệ đá xếp chồng, leo nhảy bậc + quái bay canh tầng trên
  buildVertical(){
    const WORLD=this.WORLD;
    const segs=[[0,700],[700,920],[920,1500],[1500,1760],[1760,2500],[2500,2760],[2760,WORLD]];
    segs.forEach((s,i)=>{ if(i%2===0) this.layGround(s[0],s[1]); else this.addHazardRun(s[0],s[1]); });
    // bệ bắc qua các đoạn hụt (tầng 1), buộc leo nhảy
    [[700,920],[1500,1760],[2500,2760]].forEach(([a,b])=>{
      const mid=(a+b)/2; this.makePlatform(mid, H-118, (b-a)+140); this.elevatedSpawns.push({x:mid, y:H-160});
    });
    // tầng 2 trên cao để khám phá, quái bay canh giữ
    for(let i=0;i<4;i++){ const x=620+i*680; this.makePlatform(x, H-205, 200); this.elevatedSpawns.push({x:x, y:H-245}); }
  }
  // THPT: ngã rẽ định hướng, Đường Kỷ Luật (trên, phẳng, nhiều quái) vs Đường Lười Biếng (dưới, đầy hố)
  buildBranching(){
    const WORLD=this.WORLD;
    const A=950, B=2550;
    this.layGround(0, A);
    // tầng dưới giữa map: nhiều hố nước/bùn xen kẽ chút nền
    let x=A;
    while(x<B){
      const w=Math.floor(Math.random()*3+3)*40, end=Math.min(x+w,B);
      if(Math.random()<0.6) this.addHazardRun(x,end); else this.layGround(x,end);
      x=end;
    }
    this.layGround(B, WORLD);
    // tầng trên: bệ phẳng LIÊN TỤC bắc qua vùng hố (Đường Kỷ Luật)
    this.makePlatform((A+B)/2, H-118, (B-A)+40);
    this.makePlatform(A-10, H-118, 130); this.makePlatform(B+10, H-118, 130); // bậc lên/xuống 2 đầu
    this.disciplineRoad = { a:A, b:B, y:H-129 };
    this.add.text(A+30, H-160, '↑ ĐƯỜNG KỶ LUẬT, nhiều quái, an toàn', {fontFamily:'Be Vietnam Pro', fontSize:'12px', color:'#ffffff', fontStyle:'bold', backgroundColor:'#2B6830', padding:{x:6,y:3}}).setDepth(30);
    this.add.text(A+30, H-66, '↓ ĐƯỜNG LƯỜI BIẾNG, ít quái, đầy hố', {fontFamily:'Be Vietnam Pro', fontSize:'12px', color:'#ffffff', fontStyle:'bold', backgroundColor:'#8B1E3B', padding:{x:6,y:3}}).setDepth(30);
  }

  // ===================== SINH QUÁI =====================
  // Tạo 1 con quái. forceY: đặt độ cao; keepGravity=true -> rơi xuống bệ; false -> bay lơ lửng.
  createMonster(spawnX, template, forceY=null, keepGravity=false){
    const m = this.monsters.create(spawnX, (forceY!=null?forceY:H-120), template.sprite);
    m.originTint = template.tint || 0xffffff; if(template.tint) m.setTint(template.tint); if(template.scale) m.setScale(template.scale);
    m.kind = template.sprite; m.behavior = this.isCollectStage ? 'chase' : (template.behavior || 'walk'); m.startX = spawnX; m.speedMulti = 1.0;
    const hpValue = (this.isCollectStage ? 6 : 2) + (this.levelData.rank * 2); m.hp = hpValue; m.maxHp = hpValue;
    m.hpBg = this.add.rectangle(m.x, m.y - 60, 40, 6, 0x000000, 0.6).setDepth(48);
    m.hpBar = this.add.rectangle(m.x - 20, m.y - 60, 40, 6, 0x7ED957).setOrigin(0, 0.5).setDepth(49);
    const flyingBehavior = (m.behavior==='fly'||m.behavior==='fly_chase'||m.behavior==='fly_drop');
    if(flyingBehavior || (forceY!=null && !keepGravity)){ m.y = (forceY!=null?forceY:(H-200-Math.random()*100)); m.startY=m.y; m.body.setAllowGravity(false); }
    this.tweens.add({targets:m, scaleY: m.scaleY*0.9, duration:400 + Math.random()*200, yoyo:true, repeat:-1, ease:'Sine.easeInOut'});
    m.nameLabel = this.add.text(m.x, m.y - 45, template.name, { fontSize:'11px', color:'#fff', backgroundColor:'rgba(0,0,0,0.6)', fontStyle:'bold', padding:{x:3,y:1} }).setOrigin(0.5);
    this.activeMonsters.push(m);
    return m;
  }
  spawnMonsters(num, area=null){
    const defs = MONSTER_DEFS[this.levelData.rank] || MONSTER_DEFS[1];
    for(let i=0;i<num;i++){
      let template = defs[i % defs.length]; if(this.isCollectStage && i > 5) template = MONSTER_DEFS[2][i % MONSTER_DEFS[2].length];
      let spawnX;
      if(area==='lower' && this.disciplineRoad){ spawnX = this.disciplineRoad.a + Math.random()*(this.disciplineRoad.b - this.disciplineRoad.a); }
      else { spawnX = 400 + Math.random() * (this.WORLD - 800); }
      this.createMonster(spawnX, template);
    }
  }
  // Quái đi bộ trên Đường Kỷ Luật (rơi xuống đứng trên bệ)
  spawnRoadMonsters(num){
    if(!this.disciplineRoad) return;
    const defs = MONSTER_DEFS[this.levelData.rank] || MONSTER_DEFS[1];
    for(let i=0;i<num;i++){
      const template = defs[i % defs.length];
      const x = this.disciplineRoad.a + 40 + Math.random()*(this.disciplineRoad.b - this.disciplineRoad.a - 80);
      const t2 = Object.assign({}, template); if(t2.behavior==='fly'||t2.behavior==='fly_chase'||t2.behavior==='fly_drop') t2.behavior='walk';
      const m = this.createMonster(x, t2, this.disciplineRoad.y - 50, true);
      m.roadBound = { a:this.disciplineRoad.a+20, b:this.disciplineRoad.b-20 };
    }
  }
  // Quái BAY canh tầng trên (vertical), lấy mẫu quái bay của cấp
  spawnGuards(){
    if(!this.elevatedSpawns.length) return;
    const defs = MONSTER_DEFS[this.levelData.rank] || MONSTER_DEFS[1];
    const flyer = defs.find(d=>d.behavior==='fly'||d.behavior==='fly_chase') || defs[0];
    this.elevatedSpawns.forEach(pos=>{
      const t = Object.assign({}, flyer, { behavior:'fly' });
      this.createMonster(pos.x, t, pos.y, false);
    });
  }

  buildBoss(){
    this.bossGroup = this.physics.add.group(); const bossKey = 'boss_' + this.levelData.rank;
    this.boss = this.bossGroup.create(this.WORLD - 300, H - 200, bossKey);
    const hpMap = { 1: 12, 2: 20, 3: 30, 4: 45, 5: 60 };
    this.boss.hp = hpMap[this.levelData.rank] || 20; this.boss.maxHp = this.boss.hp; this.boss.originTint = 0xffffff;
    const speedMap = { 1: 0.4, 2: 0.65, 3: 0.9, 4: 1.2, 5: 1.5 };
    this.boss.speedMulti = speedMap[this.levelData.rank] || 1.0;
    this.physics.add.collider(this.boss, this.floorGroup); this.physics.add.collider(this.boss, this.hazardGroup);
    this.physics.add.overlap(this.shots, this.bossGroup, this.onHitBoss, null, this); this.physics.add.overlap(this.player, this.bossGroup, this.onTouchMonster, null, this);
    let bossName = "BOSS"; if(this.levelData.rank === 1) bossName = "TRÙM VÒI VĨNH"; else if(this.levelData.rank === 2) bossName = "LỖI CHÍNH TẢ"; else if(this.levelData.rank === 3) bossName = "ĐỀ THI VÀO 10"; else if(this.levelData.rank === 4) bossName = "ĐẠI MA VƯƠNG"; else if(this.levelData.rank === 5) bossName = "TỨ ĐẠI TRƯỞNG LÃO";
    this.boss.baseName = bossName;
    this.boss.nameLabel = this.add.text(this.boss.x, this.boss.y - 80, `${bossName} (${this.boss.hp}/${this.boss.maxHp})`, { fontSize:'14px', color:'#ffffff', fontStyle:'bold', backgroundColor:'#d63d54', padding:{x:4,y:2} }).setOrigin(0.5);
    this.flag.setVisible(false); this.flag.body.enable = false;
    // Vòng bảo vệ (Aura), Trạng thái 1
    this.bossAura = this.add.circle(this.boss.x, this.boss.y, 78, 0x66ccff, 0.22).setStrokeStyle(3, 0x66ccff, 0.9).setDepth(55).setVisible(false);
    this.bossShielded = true;
    this.add.text(this.boss.x, this.boss.y - 105, '🛡 Hạ hết đệ tử để phá khiên Boss', {fontSize:'12px', color:'#cdefff', fontStyle:'bold', backgroundColor:'rgba(0,0,40,0.5)', padding:{x:5,y:2}}).setOrigin(0.5).setDepth(56).setScrollFactor(1);
    const attackDelayMap = { 1: 2500, 2: 2000, 3: 1600, 4: 1200, 5: 900 };
    this.bossAtkDelay = attackDelayMap[this.levelData.rank] || 2000;
    this.bossAtkTimer = this.time.addEvent({ delay:this.bossAtkDelay, loop:true, callback:()=>this.bossAttack(250) });
  }
  bossAttack(spd){
    if(!this.boss || !this.boss.active || this._done) return;
    if(Phaser.Math.Distance.Between(this.player.x, this.player.y, this.boss.x, this.boss.y) < 950){
      const atk = this.monsters.create(this.boss.x - 40, this.boss.y, 'vietau'); atk.setTint(0xff0000); atk.kind='vietau'; atk.behavior='chase'; atk.isBossAtk=true;
      this.physics.moveTo(atk, this.player.x, this.player.y, spd); this.time.delayedCall(3000, ()=>{ if(atk.active) atk.destroy(); });
    }
  }

  // ===================== CỐT TRUYỆN (nền hồng phấn, chữ đỏ đô) =====================
  showStoryIntro(){
    const SW=this.scale.width; const line = LEVEL_STORY[this.stage]; if(!line) return;
    const bg = this.add.rectangle(SW/2, 104, SW-110, 66, 0xFCE4EC, 0.96).setScrollFactor(0).setDepth(80).setStrokeStyle(3, 0xC2185B, 0.95);
    const txt = this.add.text(SW/2, 104, line, { fontFamily:'Be Vietnam Pro', fontSize:'15px', color:'#7B1E3B', fontStyle:'italic bold', align:'center', wordWrap:{width:SW-150} }).setOrigin(0.5).setScrollFactor(0).setDepth(81);
    bg.setAlpha(0); txt.setAlpha(0);
    this.tweens.add({ targets:[bg,txt], alpha:1, duration:420 });
    this.time.delayedCall(4800, ()=>{ this.tweens.add({ targets:[bg,txt], alpha:0, duration:650, onComplete:()=>{ bg.destroy(); txt.destroy(); } }); });
  }

  // ===================== HUD =====================
  buildHeaderUI(){
    const SW=this.scale.width;
    this.add.rectangle(SW/2, 35, SW-40, 50, 0x000000, 0.4).setScrollFactor(0).setDepth(49).setStrokeStyle(2, 0xffffff, 0.2);
    this.hearts=[]; for(let i=0;i<10;i++) this.hearts.push(this.add.image(46+i*28,35,'heart').setScrollFactor(0).setDepth(50).setScale(0.92));
    this.updateHearts();
    this.scoreText=this.add.text(SW-140, 35, '⭐ 0', {fontSize:'24px',color:'#FFD23F',fontStyle:'900'}).setOrigin(0,0.5).setScrollFactor(0).setDepth(50);
    this.add.text(SW/2, 35, this.levelData.name, {fontSize:'16px',color:'#fff',fontStyle:'bold'}).setOrigin(0.5).setScrollFactor(0).setDepth(50);
  }
  buildStaminaHUD(){
    const SW=this.scale.width;
    this.staminaBg=this.add.rectangle(SW/2, 62, 184, 14, 0x000000, 0.5).setScrollFactor(0).setDepth(50);
    this.staminaBar=this.add.rectangle(SW/2-90, 62, 180, 10, 0x39C0ED).setOrigin(0,0.5).setScrollFactor(0).setDepth(51);
    this.staminaLabel=this.add.text(SW/2, 46, '⚡ Thể lực', {fontSize:'10px', color:'#BDE9FF', fontStyle:'bold'}).setOrigin(0.5).setScrollFactor(0).setDepth(51);
  }
  updateHearts(){ this.hearts.forEach((h,i)=>h.setVisible(!this.hudHidden && i<this.hp)); }
  buildPCUI() {
    const rank = this.prog.rank; const skills = [];
    if(this.prog.unlockedSkills) {
        skills.push({ key: 'n', name: `Lễ Nghĩa (${this.leNghiaUses}/2)`, icon: 'w_lenghia' });
        skills.push({ key: 'm', name: `Thái Độ (${this.thaiDoUses}/2)`, icon: 'w_thaido' });
    }
    skills.push({ key: 'J', name: 'Tẩy', icon: 'w_tay' });
    if(rank >= 2) skills.push({ key: 'K', name: 'Vở', icon: 'w_vo' }); if(rank >= 3) skills.push({ key: 'L', name: 'Bút', icon: 'w_but' });
    if(rank >= 4) skills.push({ key: 'U', name: 'Kiến Thức', icon: 'w_kienthuc' });
    if(rank >= 5) { skills.push({ key: 'I', name: 'Kỹ Năng', icon: 'w_kynang' }); skills.push({ key: 'O', name: 'Trình Độ', icon: 'w_trinhdo' }); }
    const startX = 20; const startY = 80; const boxW = 85, boxH = 36, gap = 8; this.pcSkillTexts = [];
    skills.forEach((sk, idx) => {
      const x = startX + idx * (boxW + gap); const y = startY + 20;
      this.add.rectangle(x + boxW/2, y, boxW, boxH, 0x000000, 0.5).setStrokeStyle(1, 0xffffff, 0.3).setScrollFactor(0).setDepth(50);
      this.add.image(x + 15, y, sk.icon).setScale(0.8).setScrollFactor(0).setDepth(51);
      this.add.text(x + 32, y - 8, sk.key.toUpperCase(), {fontSize: '13px', color: '#FFD700', fontStyle: '900'}).setScrollFactor(0).setDepth(51);
      let t = this.add.text(x + 32, y + 8, sk.name, {fontSize: '10px', color: '#fff'}).setScrollFactor(0).setDepth(51).setOrigin(0, 0.5);
      if(sk.key === 'n' || sk.key === 'm') this.pcSkillTexts[sk.key] = t;
    });
  }
  buildMobileUI() {
    const SW=this.scale.width;
    this.input.addPointer(3);
    const joyBase = this.add.circle(0, 0, 70, 0xffffff, 0.1).setStrokeStyle(3, 0xffffff, 0.2).setScrollFactor(0).setDepth(100).setVisible(false);
    const joyThumb = this.add.circle(0, 0, 30, 0xffffff, 0.3).setScrollFactor(0).setDepth(101).setVisible(false);
    let joyStartX = 0, joyStartY = 0;
    this.input.on('pointerdown', (p) => { if (p.x < SW / 2 && !this.joyData.active) { this.joyData.pointerId = p.id; this.joyData.active = true; joyStartX = p.x; joyStartY = p.y; joyBase.setPosition(joyStartX, joyStartY).setVisible(true); joyThumb.setPosition(joyStartX, joyStartY).setVisible(true); } });
    this.input.on('pointermove', (p) => { if (this.joyData.active && p.id === this.joyData.pointerId) { let dx = p.x - joyStartX; let dy = p.y - joyStartY; let dist = Math.sqrt(dx*dx + dy*dy); if (dist > 70) { dx = (dx / dist) * 70; dy = (dy / dist) * 70; } joyThumb.setPosition(joyStartX + dx, joyStartY + dy); this.joyData.x = dx / 70; this.joyData.y = dy / 70; } });
    const releaseJoy = (p) => { if (this.joyData.active && p.id === this.joyData.pointerId) { this.joyData.active = false; this.joyData.x = 0; this.joyData.y = 0; joyBase.setVisible(false); joyThumb.setVisible(false); } };
    this.input.on('pointerup', releaseJoy); this.input.on('pointerout', releaseJoy);
    const rank = this.prog.rank; this.mobileSkillTexts = [];
    const createMobileBtn = (x, y, r, key, iconLabel, isCollectSkill = false) => {
      const bg = this.add.circle(x, y, r, isCollectSkill ? 0x4b0082 : 0x000000, 0.5).setStrokeStyle(3, 0xffffff, 0.3).setScrollFactor(0).setDepth(100).setInteractive();
      this.add.image(x, y - r/6, iconLabel).setScale(r/45).setScrollFactor(0).setDepth(101);
      let t = this.add.text(x, y + r/2, key, {fontSize: `${r/2.5}px`, color: '#FFD700', fontStyle: '900'}).setOrigin(0.5).setScrollFactor(0).setDepth(101);
      bg.on('pointerdown', () => { initAudio(); bg.setFillStyle(0xffffff, 0.4); this.handleSkillInput(key); });
      bg.on('pointerup', () => bg.setFillStyle(isCollectSkill ? 0x4b0082 : 0x000000, 0.5));
      if(isCollectSkill) this.mobileSkillTexts[key] = t;
    };
    createMobileBtn(SW - 90, H - 90, 45, 'J', 'w_tay');
    if(this.prog.unlockedSkills) { createMobileBtn(SW - 70, H - 200, 32, 'N', 'w_lenghia', true); createMobileBtn(SW - 150, H - 200, 32, 'M', 'w_thaido', true); }
    if(rank >= 2) createMobileBtn(SW - 180, H - 70, 32, 'K', 'w_vo'); if(rank >= 3) createMobileBtn(SW - 250, H - 90, 32, 'L', 'w_but');
    if(rank >= 4) createMobileBtn(SW - 230, H - 160, 32, 'U', 'w_kienthuc');
    if(rank >= 5) { createMobileBtn(SW - 150, H - 130, 32, 'I', 'w_kynang'); createMobileBtn(SW - 310, H - 150, 32, 'O', 'w_trinhdo'); }
  }
  buildInput(){
    this.keys = this.input.keyboard.addKeys('W,A,S,D,U,I,O,J,K,L,N,M');
    ['U','I','O','J','K','L','N','M'].forEach(k => { this.keys[k].on('down', () => { initAudio(); this.handleSkillInput(k); }); });
  }

  // ===================== THỂ LỰC =====================
  spendStamina(c){ this.stamina = Math.max(0, this.stamina - c); }
  addStamina(c){ this.stamina = Math.min(this.staminaMax, this.stamina + c); }
  staminaWarn(){ if(this.time.now > this._staminaMsgT){ this._staminaMsgT = this.time.now + 700; this.showFloatingText("Hết thể lực, chờ hồi sức!", 0xFF5A6E); } }

  handleSkillInput(key) {
    if(!this.player.active || this._done) return;
    const rank = this.prog.rank; const kUpper = key.toUpperCase();
    if (kUpper === 'N' && this.prog.unlockedSkills) {
        if (this.leNghiaUses > 0 && this.hp < heartsFor(rank)) { this.leNghiaUses--; this.hp = Math.min(heartsFor(rank), this.hp + 2); this.updateHearts(); playSfx('heal'); this.updateSkillUsesUI(); this.showFloatingText("+2 Máu (Lễ Nghĩa)", 0x7ED957); }
        else if (this.leNghiaUses <= 0) { this.showFloatingText("Hết lượt Lễ Nghĩa (2/ải)", 0xFF5A6E); }
        else { this.showFloatingText("Máu đã đầy", 0x7ED957); }
        return;
    }
    if (kUpper === 'M' && this.prog.unlockedSkills) {
        if (this.thaiDoUses > 0 && !this.shieldActive) {
            this.thaiDoUses--; this.shieldActive = true; this.shieldTimer = 3000;
            this.shieldVisual.setVisible(true).setScale(0.5); this.tweens.add({targets:this.shieldVisual, scale:1, duration:300, ease:'Back.Out'});
            this.shieldCountText.setVisible(true).setText('3');
            this.updateSkillUsesUI(); this.showFloatingText("Màn Chắn Bất Tử (Thái Độ)", 0x00ffff);
        }
        else if (this.shieldActive) { this.showFloatingText("Khiên đang bật", 0x00ffff); }
        else { this.showFloatingText("Hết lượt Thái Độ (2/ải)", 0xFF5A6E); }
        return;
    }
    const reqs = { 'J':1, 'K':2, 'L':3, 'U':4, 'I':5, 'O':5 }; if (key === 'N' || key === 'M') return; if (reqs[kUpper] && rank < reqs[kUpper]) return;
    this.comboStr += kUpper; if(this.comboTimer) this.comboTimer.remove();
    let isComboFired = false;
    if (this.comboStr.includes("UIO") && rank >= 5) { this.fireCombo("UIO"); this.comboStr = ""; isComboFired = true; }
    else if (this.comboStr.includes("JK") && rank >= 2) { this.fireCombo("JK"); this.comboStr = ""; isComboFired = true; }
    if (!isComboFired) this.fireBaseWeapon(kUpper);
    this.comboTimer = this.time.delayedCall(400, () => { this.comboStr = ""; });
  }
  updateSkillUsesUI() {
      if(this.pcSkillTexts){ if(this.pcSkillTexts['n']) this.pcSkillTexts['n'].setText(`Lễ Nghĩa (${this.leNghiaUses}/2)`); if(this.pcSkillTexts['m']) this.pcSkillTexts['m'].setText(`Thái Độ (${this.thaiDoUses}/2)`); }
      if(this.mobileSkillTexts){ if(this.mobileSkillTexts['N']) this.mobileSkillTexts['N'].setText(`N (${this.leNghiaUses})`); if(this.mobileSkillTexts['M']) this.mobileSkillTexts['M'].setText(`M (${this.thaiDoUses})`); }
  }
  showFloatingText(msg, color) {
      const t = this.add.text(this.player.x, this.player.y - 60, msg, {fontSize:'16px', fontStyle:'bold', color:'#fff', backgroundColor:Phaser.Display.Color.IntegerToColor(color).rgba, padding:{x:6,y:3}}).setOrigin(0.5).setDepth(70);
      this.tweens.add({targets:t, y: t.y - 40, alpha:0, duration:1200, onComplete:()=>t.destroy()});
  }
  fireBaseWeapon(key) {
    let type = null, vY = 0, speed = 600, scale = 1, tier = 1;
    if (key === 'J') { type = 'w_tay'; tier = 1; } else if (key === 'K') { type = 'w_vo'; vY = -150; speed = 450; tier = 2; } else if (key === 'L') { type = 'w_but'; speed = 800; tier = 3; } else if (key === 'U') { type = 'w_kienthuc'; speed = 500; scale = 1.2; tier = 4; } else if (key === 'I') { type = 'w_kynang'; speed = 700; vY = 50; tier = 5; } else if (key === 'O') { type = 'w_trinhdo'; speed = 550; scale = 1.5; tier = 5; }
    if(!type) return;
    const cost = this.shotCost[tier] || 6;
    if(this.stamina < cost){ this.staminaWarn(); return; }
    this.spendStamina(cost); playSfx('shoot');
    this.spawnProjectile(type, speed, vY, scale, tier);
  }
  fireCombo(comboType) {
    const cost = this.comboCost[comboType] || 25;
    if(this.stamina < cost){ this.staminaWarn(); return; }
    this.spendStamina(cost); playSfx('shoot');
    if (comboType === 'JK') { this.spawnProjectile('w_tay', 600, -150, 1.2, 3); this.spawnProjectile('w_vo', 650, 0, 1.2, 3); this.spawnProjectile('w_tay', 600, 150, 1.2, 3); }
    else if (comboType === 'UIO') { this.cameras.main.shake(300, 0.02); this.activeMonsters.forEach(m => { if(m.active) { this.explodeMonster(m); } }); }
  }
  spawnProjectile(type, speed, vY = 0, scale = 1, tier = 1) {
    const s = this.shots.create(this.player.x + this.facing*22, this.player.y - 4, type);
    s.tier = tier; s.setScale(scale); s.setVelocity(this.facing * speed, vY); s.setFlipX(this.facing < 0);
    this.tweens.add({targets:s, angle: this.facing*360, duration: 800, repeat:-1}); this.time.delayedCall(1200, () => s.active && s.destroy());
  }
  explodeMonster(m) {
    playSfx('hit');
    this.flashEmitter.explode(1, m.x, m.y); this.sparkEmitter.explode(20, m.x, m.y); this.smokeEmitter.explode(5, m.x, m.y);
    this.cameras.main.shake(200, 0.015);
    if(m.nameLabel) m.nameLabel.destroy(); if(m.hpBg) m.hpBg.destroy(); if(m.hpBar) m.hpBar.destroy();
    m.destroy();
    // COMBO-CHAIN: hạ liên tiếp trong 1.3s -> nhân điểm + thưởng thể lực
    const now = this.time.now;
    this.killChain = (now < this.killChainExpire) ? this.killChain + 1 : 1;
    this.killChainExpire = now + 1300;
    const mult = Math.min(3, 1 + Math.floor((this.killChain - 1) / 3) * 0.5);
    this.score += Math.round(20 * mult);
    this.scoreText.setText('⭐ ' + this.score);
    this.addStamina(6);
    if(this.killChain >= 3) this.showChain(mult);
  }
  showChain(mult){
    const SW=this.scale.width;
    if(!this.chainText){ this.chainText = this.add.text(SW/2, 88, '', {fontFamily:'Be Vietnam Pro', fontSize:'18px', color:'#FFB300', fontStyle:'900', stroke:'#7a3b00', strokeThickness:4}).setOrigin(0.5).setScrollFactor(0).setDepth(82); }
    this.chainText.setText(`🔥 COMBO x${mult}  ·  ${this.killChain} hạ liên tiếp`).setAlpha(1).setScale(1.25);
    this.tweens.add({targets:this.chainText, scale:1, duration:200, ease:'Back.out'});
  }
  applyMonsterEffect(m, tier) {
    if (!m.active || m.isFrozen) return; if (m.effectTimer) m.effectTimer.remove();
    let duration = 2000;
    if (tier === 1) { m.speedMulti = 0.4; m.setTint(0x00BFFF); duration = 3000; }
    else if (tier === 2) { m.isFrozen = true; m.setTint(0x87CEFA); duration = 2000; playSfx('freeze'); }
    else if (tier === 3) { m.isFrozen = true; m.setTint(0xFFD700); duration = 1500; }
    else if (tier === 4) { m.speedMulti = 0.2; m.setTint(0x9370DB); duration = 3000; }
    m.effectTimer = this.time.delayedCall(duration, () => { if(m && m.active) { m.speedMulti = 1; m.isFrozen = false; m.setTint(m.originTint); } });
  }
  onHit(shot,monster){ const tier = shot.tier || 1; const mRank = this.levelData.rank; shot.destroy(); if (tier >= mRank) { this.poof(monster.x, monster.y); playSfx('hit'); let dmg = monster.armor ? Math.max(1, tier-2) : tier; monster.hp -= dmg; monster.setTint(0xff0000); this.time.delayedCall(100, () => { if(monster.active) monster.setTint(monster.isFrozen ? 0x87CEFA : (monster.speedMulti<1?0x00BFFF:monster.originTint)); }); if(this.gm==='reflect' && monster.active && !monster.isFrozen){ const atk=this.monsters.create(monster.x,monster.y,'vietau'); atk.setTint(0x8B0000); atk.kind='vietau'; atk.behavior='chase'; this.physics.moveTo(atk,this.player.x,this.player.y,300); this.time.delayedCall(2500,()=>{ if(atk.active) atk.destroy(); }); } if(monster.hp <= 0) this.explodeMonster(monster); } else { this.applyMonsterEffect(monster, tier); this.poof(monster.x, monster.y); } }
  onHitBoss(shot, boss){
    const tier = shot.tier || 1; const mRank = this.levelData.rank; shot.destroy(); this.poof(boss.x, boss.y);
    // TRẠNG THÁI 1: còn đệ tử -> khiên Aura, không gây sát thương
    if(this.bossShielded){ if(this.time.now > (this._shieldMsgT||0)){ this._shieldMsgT = this.time.now + 1200; this.showFloatingText("Hạ hết đệ tử trước!", 0x66ccff); } this.cameras.main.shake(60, 0.004); return; }
    if (tier >= mRank) {
      playSfx('hit'); boss.hp -= tier; boss.setTint(0xff0000); this.time.delayedCall(150, () => { if(boss.active && !this.bossEnraged) boss.clearTint(); });
      // TRẠNG THÁI 2: cận tử <30% -> nổi giận
      if(boss.hp > 0 && !this.bossEnraged && boss.hp <= boss.maxHp * 0.3) this.enrageBoss();
      if(boss.hp <= 0) {
        if(boss.nameLabel) boss.nameLabel.destroy(); if(this.bossAura) this.bossAura.destroy(); this.explodeMonster(boss); playSfx('win');
        this.flag.setVisible(true); this.flag.body.enable = true; this.cameras.main.shake(400, 0.02); this.score += 100; this.scoreText.setText('⭐ ' + this.score);
      } else { boss.nameLabel.setText(`${boss.baseName}${this.bossEnraged?' ☠':''} (${Math.max(0,boss.hp)}/${boss.maxHp})`); }
    } else { this.applyMonsterEffect(boss, tier); }
  }
  enrageBoss(){
    this.bossEnraged = true; this.boss.speedMulti *= 2; this.boss.setTint(0xff3333);
    this.cameras.main.shake(450, 0.02); playSfx('hurt');
    this.showFloatingText("CẬN TỬ! Boss nổi giận!", 0xff3333);
    if(this.boss.nameLabel) this.boss.nameLabel.setText(`${this.boss.baseName} ☠ CẬN TỬ`);
    // x2 nhịp bắn
    this.enrageAtkTimer = this.time.addEvent({ delay: Math.max(350, this.bossAtkDelay/2), loop:true, callback:()=>this.bossAttack(330) });
    this.startEnrageGimmick();
  }
  startEnrageGimmick(){
    const SW=this.scale.width; const r = this.levelData.rank;
    if(r === 2){ // Lỗi Chính Tả: màn tối dần + ĐẢO HƯỚNG dồn dập
      if(!this.darkOverlay) this.darkOverlay = this.add.rectangle(SW/2, H/2, SW, H, 0x05060a, 0.5).setScrollFactor(0).setDepth(44);
      this.enrageGmTimer = this.time.addEvent({ delay:3000, loop:true, callback:()=>{ if(this._done) return; this.triggerReverse(1600); } });
    } else if(r === 4){ // Đại Ma Vương: mưa "điểm số" nổ chậm
      this.enrageGmTimer = this.time.addEvent({ delay:1400, loop:true, callback:()=>{ if(this._done) return; const mx=this.player.x+Phaser.Math.Between(-220,220); const mine=this.add.circle(mx, H-46, 12, 0xff0000, 0.9).setDepth(40); this.tweens.add({targets:mine, scale:1.3, yoyo:true, repeat:-1, duration:300}); this.time.delayedCall(1200, ()=>{ if(this._done){ mine.destroy(); return; } this.poof(mine.x, mine.y); this.cameras.main.shake(120,0.008); if(Math.abs(this.player.x-mine.x)<70 && this.invuln<=0 && !this.shieldActive){ this.invuln=1000; this.hp--; this.updateHearts(); playSfx('hurt'); if(this.hp<=0) this.lose(); } mine.destroy(); }); } });
    } else if(r === 5){ // Tứ Đại Trưởng Lão: màn mờ + summon nhanh
      if(!this.darkOverlay) this.darkOverlay = this.add.rectangle(SW/2, H/2, SW, H, 0x05060a, 0.42).setScrollFactor(0).setDepth(44);
    }
    // r===1,3: chỉ tăng tốc + x2 bắn (đã đủ "dồn dập")
  }

  onTouchMonster(player, src){ if(this.invuln>0||this._done||this.shieldActive) return; if(this.gm==='lag' && !this.lagActive){ this.triggerLag(); return; } this.invuln=1000; this.hp-=1; this.updateHearts(); playSfx('hurt'); if(this.gm==='stun'){ this.stunT=700; this.showFloatingText("Choáng!", 0x9370DB); } const dir=(src&&src.x>player.x)?-1:1; player.setVelocity(dir*200,-250); this.cameras.main.shake(150,0.01); this.tweens.add({targets:player,alpha:0.2,yoyo:true,repeat:5,duration:80,onComplete:()=>player.setAlpha(1)}); if(this.hp<=0) this.lose(); }
  onHazardHit(player, hazard) { if(this.invuln>0||this._done||this.shieldActive) return; this.invuln=1000; this.hp-=1; this.updateHearts(); playSfx('hurt'); player.setVelocityY(-500); this.cameras.main.shake(200, 0.015); this.tweens.add({targets:player,alpha:0.2,yoyo:true,repeat:5,duration:80,onComplete:()=>player.setAlpha(1)}); if(this.hp<=0) this.lose(); }
  poof(x,y){ for(let i=0;i<6;i++){ const a=Phaser.Math.PI2*i/6; const p=this.add.circle(x,y,5,0xffffff,0.95); this.tweens.add({targets:p,x:x+Math.cos(a)*36,y:y+Math.sin(a)*36,alpha:0,scale:0.2,duration:340,onComplete:()=>p.destroy()}); } }
  setHudVisible(v){ this.hudHidden = !v; if(this.scoreText) this.scoreText.setVisible(v); if(this.staminaBar) this.staminaBar.setVisible(v); if(this.staminaBg) this.staminaBg.setVisible(v); if(this.staminaLabel) this.staminaLabel.setVisible(v); this.updateHearts(); }

  setupGimmicks(){
    const gm = this.gm; if(!gm) return;
    if(gm==='stealth'){ this.activeMonsters.forEach(m=>{ m.dormant=true; m.setVelocity(0,0); }); this.showFloatingText("Đi nhẹ kẻo đánh thức quái!", 0xFFD23F); }
    if(gm==='armor'){ this.activeMonsters.forEach(m=>{ m.armor=true; m.hp+=4; m.maxHp+=4; m.setScale((m.scaleX||1)*1.15); }); this.showFloatingText("Quái có giáp, đánh nhiều phát!", 0xFF8C00); }
    if(gm==='invisible'){ this.activeMonsters.forEach(m=>{ m.ghost=true; m.setAlpha(0.12); if(m.nameLabel) m.nameLabel.setAlpha(0.2); }); this.showFloatingText("Quái tàng hình, tới gần mới hiện!", 0x9370DB); }
    if(gm==='clones'){ for(let i=0;i<4;i++){ const sx=600+Math.random()*2200; const m=this.monsters.create(sx, H-220-Math.random()*80, 'giành'); m.setTint(0xFFD700); m.setAlpha(0.9); m.kind='giành'; m.behavior='fly'; m.startX=sx; m.startY=m.y; m.body.setAllowGravity(false); m.speedMulti=1; m.hp=2; m.maxHp=2; m.originTint=0xFFD700; m.hpBg=this.add.rectangle(m.x,m.y-60,40,6,0x000000,0.6).setDepth(48); m.hpBar=this.add.rectangle(m.x-20,m.y-60,40,6,0x7ED957).setOrigin(0,0.5).setDepth(49); m.nameLabel=this.add.text(m.x,m.y-45,"Phân Thân",{fontSize:'11px',color:'#fff',backgroundColor:'rgba(0,0,0,0.6)',fontStyle:'bold',padding:{x:3,y:1}}).setOrigin(0.5); this.activeMonsters.push(m);} }
    if(gm==='summon'){ const all=[].concat(MONSTER_DEFS[1],MONSTER_DEFS[2],MONSTER_DEFS[3],MONSTER_DEFS[4],MONSTER_DEFS[5]); for(let i=0;i<6;i++){ const t=all[Math.floor(Math.random()*all.length)]; const sx=600+Math.random()*2200; const m=this.monsters.create(sx,H-120,t.sprite); m.originTint=t.tint||0xffffff; if(t.tint)m.setTint(t.tint); m.kind=t.sprite; m.behavior='chase'; m.startX=sx; m.speedMulti=1; m.hp=4; m.maxHp=4; m.hpBg=this.add.rectangle(m.x,m.y-60,40,6,0x000000,0.6).setDepth(48); m.hpBar=this.add.rectangle(m.x-20,m.y-60,40,6,0x7ED957).setOrigin(0,0.5).setDepth(49); m.nameLabel=this.add.text(m.x,m.y-45,t.name,{fontSize:'11px',color:'#fff',backgroundColor:'rgba(0,0,0,0.6)',fontStyle:'bold',padding:{x:3,y:1}}).setOrigin(0.5); this.activeMonsters.push(m);} this.showFloatingText("Nợ Môn: quái mọi cấp ùa tới!", 0xFF0000); }
    if(gm==='thief'){ this.healItems=this.physics.add.group({allowGravity:false}); for(let i=0;i<5;i++){ const it=this.healItems.create(500+i*560, H-72, 'heart'); it.setDepth(15); } this.physics.add.overlap(this.player,this.healItems,(p,it)=>{ if(this.hp<heartsFor(this.prog.rank)){ this.hp++; this.updateHearts(); playSfx('heal'); this.showFloatingText("+1 Máu", 0x7ED957); } it.destroy(); }, null, this); this.physics.add.overlap(this.monsters,this.healItems,(mm,it)=>{ this.poof(it.x,it.y); it.destroy(); }, null, this); this.showFloatingText("Quái Dành Đồ cướp tim, nhặt nhanh!", 0xFF8C00); }
    if(gm==='stamina'){ this.staminaItems=this.physics.add.group({allowGravity:false}); for(let i=0;i<6;i++){ const it=this.staminaItems.create(450+i*480, H-72, 'w_thaido'); it.setDepth(15); } this.physics.add.overlap(this.player,this.staminaItems,(p,it)=>{ this.addStamina(40); playSfx('heal'); this.showFloatingText("+Tỉnh táo (Sữa/Cafe)", 0xFFD23F); it.destroy(); }, null, this); this.showFloatingText("Giữ Thể lực, cạn thì không nhảy được!", 0xFFD23F); }
    if(gm==='dark'){ this.darkOverlay=this.add.rectangle(this.scale.width/2,H/2,this.scale.width,H,0x05060a,0.86).setScrollFactor(0).setDepth(45); this.lightGlow=this.add.circle(this.player.x,this.player.y,150,0xfff2b0,0.16).setDepth(46).setBlendMode(Phaser.BlendModes.ADD); this.showFloatingText("Tối quá, bám theo vùng sáng!", 0xFFD23F); }
    if(gm==='fireWall'){ this.fireWall=this.add.rectangle(-140,H/2,140,H,0xff5a1e,0.82).setDepth(70); this.showFloatingText("CHẠY! Tường lửa Deadline đuổi theo!", 0xff5a1e); }
    if(gm==='ink'){ this.time.addEvent({delay:2600,loop:true,callback:()=>{ if(this._done)return;
      const cx=Phaser.Math.Between(150,this.scale.width-150), cy=Phaser.Math.Between(120,H-130), base=Phaser.Math.Between(38,62);
      const g=this.add.graphics().setScrollFactor(0).setDepth(66).setPosition(cx,cy);
      g.fillStyle(0x101a3a,0.5);
      for(let i=0;i<7;i++){ const a=Phaser.Math.PI2*i/7, d=base*Phaser.Math.FloatBetween(0.35,0.7); g.fillCircle(Math.cos(a)*d, Math.sin(a)*d, base*Phaser.Math.FloatBetween(0.45,0.75)); }
      g.fillStyle(0x0b0b22,0.85); g.fillCircle(0,0,base*0.85);
      for(let i=0;i<5;i++){ const a=Phaser.Math.FloatBetween(0,Phaser.Math.PI2), d=base*Phaser.Math.FloatBetween(0.2,0.6); g.fillCircle(Math.cos(a)*d, Math.sin(a)*d, base*Phaser.Math.FloatBetween(0.3,0.55)); }
      for(let i=0;i<6;i++){ const a=Phaser.Math.FloatBetween(0,Phaser.Math.PI2), d=base*Phaser.Math.FloatBetween(1.0,1.7); g.fillCircle(Math.cos(a)*d, Math.sin(a)*d, Phaser.Math.FloatBetween(2,7)); }
      g.setScale(0.5).setAlpha(0);
      this.tweens.add({targets:g,scale:1,alpha:1,duration:240,ease:'Back.out'});
      this.tweens.add({targets:g,alpha:0,delay:850,duration:1500,onComplete:()=>g.destroy()});
    }}); this.showFloatingText("Viết Ẩu bắn mực che màn hình!", 0x111133); }
    if(gm==='hideHud'){ this.time.addEvent({delay:4500,loop:true,callback:()=>{ if(this._done)return; this.setHudVisible(false); this.time.delayedCall(2000,()=>{ if(!this._done) this.setHudVisible(true); }); }}); this.showFloatingText("Quên Nhớ: thanh máu chốc chốc biến mất!", 0x9999ff); }
    if(gm==='reverse'){ this.time.addEvent({delay:5000,loop:true,callback:()=>{ if(this._done)return; this.triggerReverse(2600); }}); }
    if(gm==='mines'){ this.time.addEvent({delay:1700,loop:true,callback:()=>{ if(this._done)return; const src=this.activeMonsters.find(m=>m.active && Math.abs(m.x-this.player.x)<700); if(!src)return; const mine=this.add.circle(src.x,H-46,12,0xff0000,0.9).setDepth(40); this.tweens.add({targets:mine,scale:1.3,yoyo:true,repeat:-1,duration:300}); this.time.delayedCall(1500,()=>{ if(this._done){ mine.destroy(); return; } this.poof(mine.x,mine.y); this.cameras.main.shake(120,0.008); if(Math.abs(this.player.x-mine.x)<70 && Math.abs(this.player.y-mine.y)<90 && this.invuln<=0 && !this.shieldActive){ this.invuln=1000; this.hp--; this.updateHearts(); playSfx('hurt'); if(this.hp<=0) this.lose(); } mine.destroy(); }); }}); this.showFloatingText("Quay Cóp thả phao thi nổ chậm!", 0xFF8C00); }
    if(gm==='lag'){ this.input.on('pointerdown',()=>{ if(this.lagActive) this.lagDec(); }); }
  }
  // Kích hoạt hiệu ứng ĐẢO HƯỚNG kèm mốc hết hạn -> update() vẽ đồng hồ đếm ngược cho người chơi
  triggerReverse(ms){
    this.reverseCtrl = true; this.reverseEndT = this.time.now + ms;
    this.showFloatingText("Ảo ảnh: ĐẢO HƯỚNG di chuyển!", 0x9370DB);
  }
  triggerLag(){ this.lagActive=true; this.lagNeed=6; this.invuln=1600; this.player.setVelocity(0,0); playSfx('hurt'); this.lagText=this.add.text(this.scale.width/2,H/2,"RỚT MẠNG! Bấm W / chạm nhanh để thoát ("+this.lagNeed+")",{fontSize:'20px',fontStyle:'900',color:'#fff',backgroundColor:'#C0392B',padding:{x:10,y:6}}).setOrigin(0.5).setScrollFactor(0).setDepth(120); }
  lagDec(){ if(!this.lagActive)return; this.lagNeed--; if(this.lagText) this.lagText.setText("RỚT MẠNG! Bấm nhanh để thoát ("+Math.max(0,this.lagNeed)+")"); if(this.lagNeed<=0){ this.lagActive=false; if(this.lagText){ this.lagText.destroy(); this.lagText=null; } this.showFloatingText("Thoát Lag!", 0x7ED957); } }
  updateGimmicks(dt){
    const gm=this.gm;
    if(gm==='invisible'){ this.activeMonsters.forEach(m=>{ if(!m.active||!m.ghost)return; const d=Phaser.Math.Distance.Between(this.player.x,this.player.y,m.x,m.y); m.setAlpha(d<200?1:0.12); }); }
    if(gm==='stealth'){ this.activeMonsters.forEach(m=>{ if(!m.active||!m.dormant)return; const d=Phaser.Math.Distance.Between(this.player.x,this.player.y,m.x,m.y); if(d<210){ m.dormant=false; m.behavior='chase'; } }); }
    if((gm==='dark'||this.darkOverlay) && this.lightGlow){ this.lightGlow.setPosition(this.player.x,this.player.y); }
    if(gm==='fireWall' && this.fireWall){ this.fireWall.x += (95+this.levelData.rank*6)*dt/1000; if(this.player.x < this.fireWall.x + 70){ this.lose(); } }
  }

  update(){
    if(!this.player.active||this._done) return;
    const dt = this.game.loop.delta;
    if(this.invuln>0) this.invuln-=dt;

    // ---- THỂ LỰC: hồi đều mỗi khung ----
    this.stamina = Math.min(this.staminaMax, this.stamina + this.staminaRegen*dt/1000);
    if(this.jumpStaminaLevel){ const near=this.activeMonsters.some(m=>m.active && Phaser.Math.Distance.Between(this.player.x,this.player.y,m.x,m.y)<160); if(near) this.stamina=Math.max(0, this.stamina - 8*dt/1000); }
    if(this.staminaBar && !this.hudHidden){ this.staminaBar.width = 180*(this.stamina/this.staminaMax); this.staminaBar.fillColor = this.stamina<25?0xFF5A6E:(this.stamina<55?0xFFD23F:0x39C0ED); }
    // hết chuỗi combo
    if(this.chainText && this.time.now > this.killChainExpire && this.chainText.alpha>0){ this.tweens.add({targets:this.chainText, alpha:0, duration:300}); }
    // ĐẢO HƯỚNG: hiện đồng hồ đếm ngược để người chơi biết khi nào điều khiển trở lại bình thường
    if(this.reverseCtrl){
      const remain = this.reverseEndT - this.time.now;
      if(remain <= 0){ this.reverseCtrl = false; if(this.reverseText) this.reverseText.setVisible(false); }
      else {
        if(!this.reverseText){ const _SW=this.scale.width; this.reverseText=this.add.text(_SW/2, 150, '', {fontFamily:'Be Vietnam Pro', fontSize:'19px', color:'#ffffff', fontStyle:'900', backgroundColor:'#6D28D9', padding:{x:12,y:6}}).setOrigin(0.5).setScrollFactor(0).setDepth(120); }
        this.reverseText.setVisible(true).setText('🔀 ĐẢO HƯỚNG, về bình thường sau ' + (remain/1000).toFixed(1) + 's');
      }
    } else if(this.reverseText && this.reverseText.visible){ this.reverseText.setVisible(false); }

    if(this.shieldActive){
      this.shieldTimer -= dt;
      if(this.shieldTimer <= 0){ this.shieldActive = false; if(this.shieldVisual && this.shieldVisual.active) this.shieldVisual.setVisible(false); if(this.shieldCountText && this.shieldCountText.active) this.shieldCountText.setVisible(false); }
      else { this.shieldVisual.setPosition(this.player.x, this.player.y); const secs = Math.ceil(this.shieldTimer / 1000); this.shieldCountText.setPosition(this.player.x, this.player.y - 70).setText(String(secs)); }
    }
    if(this.stunT>0){ this.stunT-=dt; }
    if(this.lagActive){ this.player.setVelocityX(0); if(Phaser.Input.Keyboard.JustDown(this.keys.W)) this.lagDec(); }
    if(this.gm || this.darkOverlay) this.updateGimmicks(dt);

    this.activeMonsters.forEach(m => {
        if(!m.active) return; if(m.nameLabel) m.nameLabel.setPosition(m.x, m.y - 45);
        if(m.hpBg) m.hpBg.setPosition(m.x, m.y - 60);
        if(m.hpBar) { m.hpBar.setPosition(m.x - 20, m.y - 60); m.hpBar.width = Math.max(0, 40 * (m.hp / m.maxHp)); }
        if (m.isFrozen) { m.setVelocity(0, 0); return; }
        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, m.x, m.y);
        const sM = m.speedMulti || 1;
        if(m.behavior === 'walk') {
            if(!m.dirX) m.dirX = (Math.random() > 0.5 ? 1 : -1); m.setVelocityX(m.dirX * 60 * sM);
            const range = m.roadBound ? null : 150;
            if(m.roadBound){ if(m.x < m.roadBound.a){ m.dirX=1; } else if(m.x > m.roadBound.b){ m.dirX=-1; } }
            else if(Math.abs(m.x - m.startX) > range) { m.dirX *= -1; m.startX = m.x; }
        }
        else if(m.behavior === 'jump' || m.behavior === 'jump_fast') {
            const spd = m.behavior === 'jump_fast' ? 120 : 70;
            if(!m.dirX) m.dirX = (Math.random() > 0.5 ? 1 : -1); m.setVelocityX(m.dirX * spd * sM);
            if(m.body.blocked.down && Math.random() < (m.behavior === 'jump_fast'? 0.03 : 0.01)) m.setVelocityY(-450 * sM);
            if(Math.abs(m.x - m.startX) > 200) { m.dirX *= -1; m.startX = m.x; }
        }
        else if(m.behavior === 'fly') {
            if(!m.dirX) m.dirX = -1; m.setVelocityX(m.dirX * 80 * sM); m.y = m.startY + Math.sin(this.time.now / 200) * 40;
            if(Math.abs(m.x - m.startX) > 250) { m.dirX *= -1; m.startX = m.x; }
        }
        else if(m.behavior === 'fly_drop') {
            if(!m.dirX) m.dirX = -1; m.setVelocityX(m.dirX * 90 * sM);
            if(Math.abs(this.player.x - m.x) < 50 && m.y < this.player.y && Math.random()<0.05) { m.y += 10 * sM; }
            else { m.y = m.startY + Math.sin(this.time.now / 200) * 20; }
            if(Math.abs(m.x - m.startX) > 300) { m.dirX *= -1; m.startX = m.x; }
        }
        else if(m.behavior === 'chase') {
            if(dist < 500) { if(this.player.x < m.x) m.setVelocityX(-110 * sM); else m.setVelocityX(110 * sM); } else { m.setVelocityX(0); }
        }
        else if(m.behavior === 'fly_chase') {
            if(dist < 600) { this.physics.moveToObject(m, this.player, 110 * sM); } else { m.setVelocity(0,0); m.y = m.startY + Math.sin(this.time.now / 250) * 30; }
        }
        else if(m.behavior === 'teleport') {
            if(!m.teleportTimer) m.teleportTimer = this.time.now + 2000;
            if(this.time.now > m.teleportTimer && dist < 800) {
                this.poof(m.x, m.y); m.x = this.player.x + (Math.random() > 0.5 ? 150 : -150); m.y = this.player.y - 50; this.poof(m.x, m.y);
                m.teleportTimer = this.time.now + 2000 + Math.random()*1500;
            }
        }
        if(m.body.velocity.x < 0) m.setFlipX(false); else if(m.body.velocity.x > 0) m.setFlipX(true);
    });

    let standingOnBoat = false; let boatVelX = 0;
    this.boats.getChildren().forEach(b => {
        if(b.x <= b.minX) b.setVelocityX(70); else if(b.x >= b.maxX) b.setVelocityX(-70);
        if (this.player.body.blocked.down && this.player.body.bottom <= b.body.top + 5 && this.player.x > b.body.left - 15 && this.player.x < b.body.right + 15) { standingOnBoat = true; boatVelX = b.body.velocity.x; }
    });

    // ---- BOSS ----
    if(this.boss && this.boss.active){
        // Khiên Aura: còn đệ tử thì bất khả xâm phạm
        const minionsAlive = this.activeMonsters.some(m=>m.active && !m.isBossAtk);
        this.bossShielded = minionsAlive;
        if(this.bossAura){ this.bossAura.setPosition(this.boss.x, this.boss.y).setVisible(this.bossShielded); if(this.bossShielded) this.bossAura.setScale(1 + Math.sin(this.time.now/200)*0.06); }
        if(this.boss.nameLabel) this.boss.nameLabel.setPosition(this.boss.x, this.boss.y - 80);
        if (!this.boss.isFrozen) {
            const bSM = this.boss.speedMulti || 1; const rank = this.levelData.rank;
            if(rank === 1) { if(this.boss.body.blocked.down && Math.random() < 0.02) this.boss.setVelocityY(-500 * bSM); this.boss.setVelocityX((this.player.x < this.boss.x ? -60 : 60) * bSM); }
            else if(rank === 2) { this.boss.setVelocityX(Math.sin(this.time.now/300) * 150 * bSM); }
            else if(rank === 3) { this.boss.body.setAllowGravity(false); this.physics.moveToObject(this.boss, this.player, 70 * bSM); }
            else if(rank === 4) { this.boss.setVelocityX((this.player.x < this.boss.x ? -100 : 100) * bSM); }
            else if(rank === 5) { this.boss.body.setAllowGravity(false); this.boss.y = H - 250 + Math.sin(this.time.now/200)*60; this.boss.setVelocityX((this.player.x < this.boss.x ? -90 : 90) * bSM); }
        } else { this.boss.setVelocity(0,0); }
    }

    let speed = 220 + (this.levelData.rank * 10); let isMoving = false;
    if(this.gm==='slowAura'){ const _near=this.activeMonsters.some(m=>m.active && Phaser.Math.Distance.Between(this.player.x,this.player.y,m.x,m.y)<170); if(_near) speed*=0.45; }
    let mL = this.keys.A.isDown || (this.joyData.active && this.joyData.x < -0.3);
    let mR = this.keys.D.isDown || (this.joyData.active && this.joyData.x > 0.3);
    if(this.reverseCtrl){ const _t=mL; mL=mR; mR=_t; }
    const moveLeft=mL, moveRight=mR;
    const dropDown = this.keys.S.isDown || (this.joyData.active && this.joyData.y > 0.6);
    const inputLocked = this.stunT>0 || this.lagActive;

    if(!inputLocked && moveLeft){ this.player.setVelocityX(-speed); this.facing=-1; this.player.setFlipX(true); isMoving=true; }
    else if(!inputLocked && moveRight){ this.player.setVelocityX(speed); this.facing=1; this.player.setFlipX(false); isMoving=true; }
    else if(this.gm==='slippery' && this.player.body.blocked.down && !standingOnBoat){ this.player.setVelocityX(this.player.body.velocity.x*0.93); }
    else { this.player.setVelocityX(standingOnBoat ? boatVelX : 0); }

    const onGround = this.player.body.blocked.down;
    if (isMoving && onGround) { this.idleTween.pause(); if (!this.walkTween.isPlaying()) this.walkTween.resume(); }
    else if (onGround) { this.walkTween.pause(); this.player.setAngle(0); if (!this.idleTween.isPlaying()) this.idleTween.resume(); }
    else { this.walkTween.pause(); this.idleTween.pause(); }

    if(isMoving && this.player.body.blocked.down && Math.random() < 0.3) this.dustEmitter.emitParticleAt(this.player.x, this.player.y + 25, 1);

    let wantsToJump = Phaser.Input.Keyboard.JustDown(this.keys.W);
    if(this.joyData.active && this.joyData.y < -0.5) { if(!this.joyJumpFired) { wantsToJump = true; this.joyJumpFired = true; } } else { this.joyJumpFired = false; }
    if(!inputLocked && wantsToJump && this.player.body.blocked.down) {
      if(this.jumpStaminaLevel && this.stamina < 15){ this.showFloatingText("Hết thể lực, nghỉ lấy sức!", 0xFF5A6E); }
      else {
        if(this.jumpStaminaLevel) this.stamina -= 15;
        playSfx('jump'); this.player.setVelocityY(-480); this.dustEmitter.explode(8, this.player.x, this.player.y + 25);
        this.tweens.add({ targets:this.player, scaleY:1.25, scaleX:0.8, duration:150, yoyo:true });
      }
    }
    if(!inputLocked && dropDown && !this.player.body.blocked.down) { this.player.setVelocityY(450); }
    if(this.player.y>H+60) this.lose();
  }
  win(){ if(this._done)return; this._done=true; this.player.setVelocity(0,0); this.physics.pause(); playSfx('win'); const p=loadProg(); p.beaten[this.stage]=true; if (this.isCollectStage) p.unlockedSkills = true; let maxBeaten=-1; Object.keys(p.beaten).forEach(k=>{ if(p.beaten[k] && k != 4) maxBeaten=Math.max(maxBeaten, parseInt(k,10)); }); let newRank = 1; if (maxBeaten >= 19) newRank = 5; else if (maxBeaten >= 15) newRank = 4; else if (maxBeaten >= 10) newRank = 3; else if (maxBeaten >= 3) newRank = 2; p.rank = Math.max(p.rank||1, newRank); saveProg(p); if (EXTERNAL.onStars) EXTERNAL.onStars(this.score); this.scene.start('End',{win:true,score:this.score,stage:this.stage, targetPage: Math.floor(this.stage / 5)}); }
  lose(){ if(this._done)return; this._done=true; this.physics.pause(); if (EXTERNAL.onStars) EXTERNAL.onStars(this.score); this.scene.start('End',{win:false,score:this.score, targetPage: Math.floor(this.stage / 5)}); }
}
