import { state } from './state.js';
import { weaponList, armorList } from './constants.js';

/** Throttle timer — auto-save minimum 1s apart from manual save. */
let lastSaveTime = 0;

/** POST current player progress to the SQLite backend. */
export function saveGame(isAuto = false) {
  const now = Date.now();
  if (now - lastSaveTime < 1000) return;
  lastSaveTime = now;

  const s = state;
  const statusEl = document.getElementById('save-status');
  if (!statusEl) return;
  statusEl.textContent = isAuto ? 'Auto…' : 'Menyimpan...';
  statusEl.style.color = isAuto ? '#3498db' : '#f39c12';

  if (!s.inventory) s.inventory = {};
  if (s.potions > 0) {
    s.inventory['health_potion'] = s.potions;
  } else {
    delete s.inventory['health_potion'];
  }

  const data = {
    x: s.player.x,
    y: s.player.y,
    hp: s.player.hp,
    maxHp: s.player.maxHp,
    attackDamage: s.player.attackDamage,
    gold: s.gold,
    potions: s.potions,
    crystalCount: s.crystalCount,
    currentWeapon: s.currentWeapon,
    currentArmor: s.currentArmor,
    currentHelmet: s.currentHelmet,
    currentBoots: s.currentBoots,
    ownedWeapons: JSON.stringify(s.ownedWeapons ?? [0]),
    ownedArmors: JSON.stringify(s.ownedArmors ?? [0]),
    ownedHelmets: JSON.stringify(s.ownedHelmets ?? [0]),
    ownedBoots: JSON.stringify(s.ownedBoots ?? [0]),
    level: s.player.level,
    exp: s.player.exp,
    nextExp: s.player.nextExp,
    camera_y: s.cameraOffsetY,
    camera_z: s.cameraOffsetZ,
    camera_look_y: s.cameraLookAtY,
    current_scene: s.currentScene,
    inventory: JSON.stringify(s.inventory),
    statPoints: s.player.statPoints,
    stats: s.player.stats,
    bountyQuest: s.bountyQuest ? JSON.stringify(s.bountyQuest) : null,
    bountyQuestProgress: s.bountyQuestProgress,
    lastCrystalUse: s.lastCrystalUse ?? 0,
    critChance: s.critChance,
    critMultiplier: s.critMultiplier,
    questStage: s.questStage,
    questCompleted: JSON.stringify(s.questCompleted),
    autoHealThreshold: s.autoHealThreshold,
    autoSPThreshold: s.autoSPThreshold,
  };

  fetch('http://localhost:3001/api/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
    .then(res => res.json())
    .then(() => {
      statusEl.textContent = isAuto ? 'Auto ✅' : 'Tersimpan ✅';
      statusEl.style.color = '#2ecc71';
      setTimeout(() => { statusEl.textContent = ''; }, isAuto ? 1200 : 3000);
    })
    .catch(err => {
      statusEl.textContent = 'Gagal ❌';
      statusEl.style.color = '#e74c3c';
      console.error(err);
    });
}

/** Load player progress from the SQLite backend into state. */
export function loadGame() {
  fetch('http://localhost:3001/api/load')
    .then(res => res.json())
    .then(res => {
      if (!res.success || !res.data) return;
      const d = res.data;
      const s = state;

      s.player.x = d.player_x ?? 500;
      s.player.y = d.player_y ?? 800;
      
      // Jika player load di dekat area tengah kota (rawan nyangkut di air mancur / papan misi)
      if (s.player.x > 400 && s.player.x < 600 && s.player.y > 450 && s.player.y < 650) {
        s.player.x = 500;
        s.player.y = 800;
      }
      
      // Or old default
      if (s.player.x === 10000 && s.player.y === 10080) {
        s.player.x = 500;
        s.player.y = 800;
      }

      s.player.hp = d.hp ?? s.player.hp;
      if (s.player.hp <= 0) {
        // Jika save game tersimpan saat mati (HP 0), pulihkan dan kirim ke kota
        s.player.hp = s.player.maxHp || 100;
        s.currentScene = 'hometown';
        s.player.x = 500;
        s.player.y = 500;
      }
      s.player.maxHp = d.maxHp ?? s.player.maxHp;
      s.player.attackDamage = d.attackDamage ?? s.player.attackDamage;
      s.player.level = d.level ?? s.player.level;
      s.player.exp = d.exp ?? s.player.exp;
      s.player.nextExp = d.nextExp ?? s.player.nextExp;
      s.gold = d.gold ?? 0;
      s.potions = d.potions ?? 0;
      s.crystalCount = d.crystalCount ?? 0;
      s.currentWeapon = d.currentWeapon ?? 0;
      s.currentArmor = d.currentArmor ?? 0;
      s.currentHelmet = d.currentHelmet ?? 0;
      s.currentBoots = d.currentBoots ?? 0;

      try {
        if (d.inventory) s.inventory = JSON.parse(d.inventory);
      } catch (e) {
        s.inventory = {};
      }

      // Migrasi jika ada gold lama yang tersimpan di inventory
      if (s.inventory && s.inventory.gold) {
        s.gold = (s.gold || 0) + (s.inventory.gold * 10);
        delete s.inventory.gold;
      }

      // Sinkronkan potion crafting dengan s.potions
      if (s.inventory && s.inventory['health_potion'] !== undefined) {
        if (s.inventory['health_potion'] !== s.potions) {
          s.potions = (s.potions || 0) + (s.inventory['health_potion'] || 0);
        }
      }
      if (!s.inventory) s.inventory = {};
      if (s.potions > 0) {
        s.inventory['health_potion'] = s.potions;
      } else {
        delete s.inventory['health_potion'];
      }

      const navPotionsEl = document.getElementById('nav-potions');
      if (navPotionsEl) navPotionsEl.textContent = s.potions;
      const btnPotion = document.getElementById('btn-potion');
      if (btnPotion) {
        btnPotion.textContent = `🧪 Heal (C) [${s.potions}]`;
        btnPotion.style.opacity = s.potions > 0 ? '1.0' : '0.5';
      }

      // Restore owned weapon/armor/helmet/boots arrays (prefer saved list, fallback to current)
      try {
        s.ownedWeapons = d.ownedWeapons ? JSON.parse(d.ownedWeapons) : null;
      } catch(e) { s.ownedWeapons = null; }
      if (!s.ownedWeapons || !Array.isArray(s.ownedWeapons)) {
        s.ownedWeapons = [];
        for (let i = 0; i <= s.currentWeapon; i++) s.ownedWeapons.push(i);
      }

      try {
        s.ownedArmors = d.ownedArmors ? JSON.parse(d.ownedArmors) : null;
      } catch(e) { s.ownedArmors = null; }
      if (!s.ownedArmors || !Array.isArray(s.ownedArmors)) {
        s.ownedArmors = [];
        for (let i = 0; i <= s.currentArmor; i++) s.ownedArmors.push(i);
      }

      try {
        s.ownedHelmets = d.ownedHelmets ? JSON.parse(d.ownedHelmets) : null;
      } catch(e) { s.ownedHelmets = null; }
      if (!s.ownedHelmets || !Array.isArray(s.ownedHelmets)) {
        s.ownedHelmets = [];
        for (let i = 0; i <= s.currentHelmet; i++) s.ownedHelmets.push(i);
      }

      try {
        s.ownedBoots = d.ownedBoots ? JSON.parse(d.ownedBoots) : null;
      } catch(e) { s.ownedBoots = null; }
      if (!s.ownedBoots || !Array.isArray(s.ownedBoots)) {
        s.ownedBoots = [];
        for (let i = 0; i <= s.currentBoots; i++) s.ownedBoots.push(i);
      }

      if (d.camera_y != null) {
        s.cameraOffsetY = d.camera_y;
        s.cameraOffsetZ = d.camera_z;
        s.cameraLookAtY = d.camera_look_y;

        if (document.getElementById('cam-y')) {
          document.getElementById('cam-y').value = s.cameraOffsetY;
          document.getElementById('val-cam-y').innerText = s.cameraOffsetY;
          document.getElementById('cam-z').value = s.cameraOffsetZ;
          document.getElementById('val-cam-z').innerText = s.cameraOffsetZ;
          document.getElementById('cam-look').value = s.cameraLookAtY;
          document.getElementById('val-cam-look').innerText = s.cameraLookAtY;
        }
      }

      // Restore saved scene; fall back to coordinate-based inference for old saves
      if (d.current_scene) {
        s.currentScene = d.current_scene;
      } else if (s.player.x < 2000) {
        s.currentScene = 'hometown';
      } else {
        s.currentScene = 'wilds';
      }

      // Bebaskan player jika stuck di dalam pyramid map 2 (wilds2)
      if (s.currentScene === 'wilds2') {
        const dx = s.player.x - 10000;
        const dy = s.player.y - 10000;
        // Pengecekan kolisi piramida sudah 360, jadi gunakan 400 sebagai jarak aman
        if (Math.hypot(dx, dy) < 400) {
          s.player.x = 10000;
          s.player.y = 10800; // Spawn aman jauh di depan piramida
        }
      }

      s.player.statPoints = d.statPoints ?? s.player.statPoints;
      s.player.stats.str = d.stat_str ?? s.player.stats.str;
      s.player.stats.agi = d.stat_agi ?? s.player.stats.agi;
      s.player.stats.vit = d.stat_vit ?? s.player.stats.vit;

      try {
        if (d.bountyQuest) s.bountyQuest = JSON.parse(d.bountyQuest);
      } catch (e) { s.bountyQuest = null; }
      s.bountyQuestProgress = d.bountyQuestProgress ?? 0;
      s.lastCrystalUse = d.lastCrystalUse ?? 0;
      s.questStage = d.questStage ?? 0;
      s.questCompleted = d.questCompleted ?? [];
      s.critChance = d.critChance ?? 0.05;
      s.critMultiplier = d.critMultiplier ?? 2.0;
      s.autoHealThreshold = d.autoHealThreshold ?? 50;
      s.autoSPThreshold = d.autoSPThreshold ?? 30;
      s.questStage = d.questStage ?? 0;
      
      try {
        s.questCompleted = d.questCompleted ? JSON.parse(d.questCompleted) : [];
        if (!Array.isArray(s.questCompleted)) s.questCompleted = [];
      } catch(e) {
        s.questCompleted = [];
      }

      // Restore equipment colors on loaded meshes
      if (s.playerBladeMat && weaponList[s.currentWeapon]) {
        s.playerBladeMat.color.setHex(weaponList[s.currentWeapon].color);
      }
      if (s.playerBodyMat && armorList[s.currentArmor]) {
        s.playerBodyMat.color.setHex(armorList[s.currentArmor].color);
      }

      // Process any pending level-ups from accumulated EXP
      let pendingLevels = 0;
      while (s.player.exp >= s.player.nextExp && pendingLevels < 100) {
        if (typeof window.levelUp === 'function') window.levelUp();
        pendingLevels++;
      }

      console.log('✅ Progres termuat dari Database!', d);
      if (typeof window.updateUI === 'function') window.updateUI(true);
      // Trigger aura senjata setelah load — jika model belum siap, tandai untuk dipanggil nanti
      if (s.playerSwordMesh && typeof window.equipWeapon === 'function') {
        window.equipWeapon(s.currentWeapon);
      } else {
        // Simpan flag, dipanggil oleh startGame setelah model selesai
        s._pendingEquipWeapon = s.currentWeapon;
      }
    })
    .catch(err => console.log('Belum ada save data atau Server Backend mati:', err));
}
