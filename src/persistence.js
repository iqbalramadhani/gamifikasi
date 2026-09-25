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
    level: s.player.level,
    exp: s.player.exp,
    nextExp: s.player.nextExp,
    camera_y: s.cameraOffsetY,
    camera_z: s.cameraOffsetZ,
    camera_look_y: s.cameraLookAtY,
    inventory: JSON.stringify(s.inventory),
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

      s.player.x = d.player_x ?? 10000;
      s.player.y = d.player_y ?? 10080;
      s.player.hp = d.hp ?? s.player.hp;
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

      try {
        if (d.inventory) s.inventory = JSON.parse(d.inventory);
      } catch (e) {
        s.inventory = {};
      }

      if (s.player.x > 9000) s.currentScene = 'hometown';
      else s.currentScene = 'wilds';

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
      if (typeof window.updateUI === 'function') window.updateUI();
    })
    .catch(err => console.log('Belum ada save data atau Server Backend mati:', err));
}
