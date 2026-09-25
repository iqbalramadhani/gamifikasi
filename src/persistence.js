import { state } from './state.js';

/** POST current player progress to the SQLite backend. */
export function saveGame() {
  const s = state;
  const statusEl = document.getElementById('save-status');
  if (!statusEl) return;
  statusEl.textContent = 'Menyimpan...';
  statusEl.style.color = '#f39c12';

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
  };

  fetch('http://localhost:3001/api/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
    .then(res => res.json())
    .then(resData => {
      statusEl.textContent = 'Tersimpan ✅';
      statusEl.style.color = '#2ecc71';
      setTimeout(() => { statusEl.textContent = ''; }, 3000);
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
      s.gold = d.gold;
      s.potions = d.potions;
      s.crystalCount = d.crystalCount;
      s.currentWeapon = d.currentWeapon;
      s.currentArmor = d.currentArmor;

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
      if (typeof s.playerBladeMat !== 'undefined' && weaponList[s.currentWeapon]) {
        s.playerBladeMat.color.setHex(weaponList[s.currentWeapon].color);
      }
      if (typeof s.playerBodyMat !== 'undefined' && armorList[s.currentArmor]) {
        s.playerBodyMat.color.setHex(armorList[s.currentArmor].color);
      }

      console.log('✅ Progres termuat dari Database!', d);
      updateUI();
    })
    .catch(err => console.log('Belum ada save data atau Server Backend mati:', err));
}
