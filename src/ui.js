import { state } from './state.js';
import { mapSize, weaponList, armorList } from './constants.js';
import { playSound } from './audio.js';
import { blocked, spawnParticles, checkItems } from './helpers.js';

// ─── UI throttled update ──────────────────────────────────────────────────────

let uiThrottle = 0;
let lastHp = -1, lastGold = -1, lastCrystal = -1;

export function updateUI() {
  checkItems();

  uiThrottle++;
  if (uiThrottle % 6 !== 0) return; // Throttle to ~10 fps for DOM writes

  const s = state;
  const curHp = Math.ceil(s.player.hp);
  if (lastHp !== curHp) {
    document.getElementById('hp').textContent = `${curHp}/${s.player.maxHp}`;
    lastHp = curHp;
  }
  if (lastGold !== s.gold) {
    document.getElementById('gold').textContent = s.gold;
    lastGold = s.gold;
  }
  if (lastCrystal !== s.crystalCount) {
    document.getElementById('crystal').textContent = `${s.crystalCount}/${s.crystalGoal}`;
    lastCrystal = s.crystalCount;
  }

  const expEl = document.getElementById('exp');
  const maxExpEl = document.getElementById('max-exp');
  const levelEl = document.getElementById('player-level');
  if (expEl) expEl.textContent = s.player.exp;
  if (maxExpEl) maxExpEl.textContent = s.player.nextExp;
  if (levelEl) levelEl.textContent = s.player.level;

  const btnDash = document.getElementById('btn-dash');
  if (btnDash) {
    if (s.player.dashCooldown > 0) {
      btnDash.style.opacity = '0.4';
      btnDash.textContent = `⏳ ${(s.player.dashCooldown / 60).toFixed(1)}s`;
    } else {
      btnDash.style.opacity = '1.0';
      btnDash.textContent = `⚡ Dash (Z)`;
    }
  }

  const btnSpin = document.getElementById('btn-spin');
  if (btnSpin) {
    if (s.player.spinCooldown > 0) {
      btnSpin.style.opacity = '0.4';
      btnSpin.textContent = `⏳ ${(s.player.spinCooldown / 60).toFixed(1)}s`;
    } else {
      btnSpin.style.opacity = '1.0';
      btnSpin.textContent = `🌀 Spin (X)`;
    }
  }

  drawMinimap();
}

// ─── Minimap ───────────────────────────────────────────────────────────────────

export function drawMinimap() {
  const mm = document.getElementById('minimap');
  if (!mm) return;
  const ctx = mm.getContext('2d');
  ctx.clearRect(0, 0, 150, 150);

  const scale = 150 / mapSize;
  const s = state;

  // Altar
  ctx.fillStyle = 'yellow';
  ctx.fillRect((mapSize / 2) * scale - 3, (mapSize / 2) * scale - 3, 6, 6);

  // Crystals
  ctx.fillStyle = 'cyan';
  s.crystalItems.forEach(c => {
    if (!c.taken) ctx.fillRect(c.x * scale - 1, c.y * scale - 1, 2, 2);
  });

  // Enemies
  ctx.fillStyle = 'red';
  s.enemies.forEach(e => ctx.fillRect(e.x * scale - 1, e.y * scale - 1, 3, 3));

  if (s.bossActive) {
    ctx.fillStyle = 'purple';
    ctx.fillRect(s.bossX * scale - 4, s.bossY * scale - 4, 8, 8);
  }

  // Player
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(s.player.x * scale, s.player.y * scale, 3, 0, Math.PI * 2);
  ctx.fill();
}

// ─── Interaction check ────────────────────────────────────────────────────────

export function checkInteractions() {
  const s = state;
  if (s.shopCooldown > 0) s.shopCooldown--;

  if (s.hometownPortal) s.hometownPortal.rotation.y += 0.05;
  if (s.wildsPortal) s.wildsPortal.rotation.y += 0.05;

  let interactText = '';

  if (s.currentScene === 'hometown') {
    const distShop = Math.hypot(s.player.x - s.shopNPC.position.x, s.player.y - s.shopNPC.position.z);
    if (distShop < 50) {
      interactText = 'Tekan [F] untuk Upgrade';
      if (s.keys.f && !s.shopOpen && s.shopCooldown === 0) openShop();
    }

    const distHeal = Math.hypot(s.player.x - s.healerNPC.position.x, s.player.y - s.healerNPC.position.z);
    if (distHeal < 50) {
      interactText = 'Tekan [F] memulihkan HP (10 Gold)';
      if (s.keys.f && s.shopCooldown === 0) {
        s.shopCooldown = 30;
        if (s.gold >= 10 && s.player.hp < s.player.maxHp) {
          s.gold -= 10;
          s.player.hp = s.player.maxHp;
          playSound('coin');
          updateUI();
        }
      }
    }

    const distPortal = Math.hypot(s.player.x - s.hometownPortal.position.x, s.player.y - s.hometownPortal.position.z);
    if (distPortal < 50) {
      interactText = 'Tekan [F] masuk ke The Wilds';
      if (s.keys.f) {
        // Directly teleport without shop cooldown gating
        if (typeof window.teleportTo === 'function') window.teleportTo('wilds');
        // Prevent immediate re‑trigger while the player stays on the portal
        s.shopCooldown = 30;
        s.keys.f = false;
      }
    }

    if (s.blacksmithNPC) {
      const distBS = Math.hypot(s.player.x - s.blacksmithNPC.position.x, s.player.y - s.blacksmithNPC.position.z);
      if (distBS < 50) {
        interactText = 'Tekan [F] Beli Equipment';
        console.log('[interact] blacksmith nearby, dist=' + distBS.toFixed(1), 'keys.f=', s.keys.f, 'blacksmithOpen=', s.blacksmithOpen, 'shopCooldown=', s.shopCooldown);
        if (s.keys.f && !s.blacksmithOpen && s.shopCooldown === 0) {
          console.log('[interact] opening blacksmith');
          openBlacksmith();
        }
      }
    }
  } else {
    if (s.wildsPortal) {
      const distPortal = Math.hypot(s.player.x - s.wildsPortal.position.x, s.player.y - s.wildsPortal.position.z);
      if (distPortal < 50) {
        interactText = 'Tekan [F] pulang ke Kota';
        if (s.keys.f && s.shopCooldown === 0) {
          s.shopCooldown = 60;
          if (typeof window.teleportTo === 'function') window.teleportTo('hometown');
          s.keys.f = false;
        }
      }
    }
  }

  const msgEl = document.getElementById('message');
  if (msgEl) {
    if (interactText !== '') msgEl.textContent = interactText;
    else if (msgEl.textContent.startsWith('Tekan [F]')) msgEl.textContent = '';
  }
}

// ─── Shop ──────────────────────────────────────────────────────────────────────

export function openShop() {
  const s = state;
  s.shopOpen = true;
  s.isPaused = true;
  document.getElementById('shop').style.display = 'flex';
  document.getElementById('shop-gold').textContent = s.gold;
}

export function closeShop() {
  const s = state;
  document.getElementById('shop').style.display = 'none';
  s.shopOpen = false;
  s.isPaused = false;
  s.shopCooldown = 30;
}

export function buyUpgrade(type) {
  const s = state;
  if (type === 'hp' && s.gold >= 15) {
    s.gold -= 15;
    s.player.maxHp += 20;
    s.player.hp = s.player.maxHp;
    s.upgrades.hpLevel++;
    document.getElementById('shop-hp-level').textContent = 'Lv ' + s.upgrades.hpLevel;
  } else if (type === 'atk' && s.gold >= 20) {
    s.gold -= 20;
    s.player.attackDamage += 1;
    s.upgrades.atkLevel++;
    document.getElementById('shop-atk-level').textContent = 'Lv ' + s.upgrades.atkLevel;
  } else if (type === 'spd' && s.gold >= 15) {
    s.gold -= 15;
    s.player.speed += 1;
    s.upgrades.spdLevel++;
    document.getElementById('shop-spd-level').textContent = 'Lv ' + s.upgrades.spdLevel;
  }
  document.getElementById('shop-gold').textContent = s.gold;
  updateUI();
}

// ─── Blacksmith ───────────────────────────────────────────────────────────────

export function openBlacksmith() {
  const s = state;
  s.blacksmithOpen = true;
  s.isPaused = true;
  document.getElementById('blacksmith').style.display = 'flex';
  updateBlacksmithUI();
}

export function closeBlacksmith() {
  const s = state;
  document.getElementById('blacksmith').style.display = 'none';
  s.blacksmithOpen = false;
  s.isPaused = false;
  s.shopCooldown = 30;
}

export function updateBlacksmithUI() {
  const s = state;
  document.getElementById('blacksmith-gold').textContent = s.gold;

  const wNext = weaponList[s.currentWeapon + 1];
  if (wNext) {
    document.getElementById('weapon-desc').textContent = `${wNext.name} (DMG +${wNext.damage})`;
    document.getElementById('weapon-cost').textContent = wNext.cost;
    document.getElementById('btn-buy-weapon').disabled = s.gold < wNext.cost;
    document.getElementById('btn-buy-weapon').textContent = 'Tempa Senjata';
  } else {
    document.getElementById('weapon-desc').textContent = 'Max Level';
    document.getElementById('weapon-cost').textContent = '-';
    document.getElementById('btn-buy-weapon').disabled = true;
    document.getElementById('btn-buy-weapon').textContent = 'Max Level';
  }

  const aNext = armorList[s.currentArmor + 1];
  if (aNext) {
    document.getElementById('armor-desc').textContent = `${aNext.name} (HP +${aNext.hp})`;
    document.getElementById('armor-cost').textContent = aNext.cost;
    document.getElementById('btn-buy-armor').disabled = s.gold < aNext.cost;
    document.getElementById('btn-buy-armor').textContent = 'Tempa Armor';
  } else {
    document.getElementById('armor-desc').textContent = 'Max Level';
    document.getElementById('armor-cost').textContent = '-';
    document.getElementById('btn-buy-armor').disabled = true;
    document.getElementById('btn-buy-armor').textContent = 'Max Level';
  }
}

export function buyWeapon() {
  const s = state;
  const wNext = weaponList[s.currentWeapon + 1];
  console.log('[buyWeapon] currentWeapon=', s.currentWeapon, 'next=', wNext ? wNext.name : 'null', 'gold=', s.gold, 'cost=', wNext ? wNext.cost : 'n/a');
  if (wNext && s.gold >= wNext.cost) {
    s.gold -= wNext.cost;
    s.currentWeapon++;
    const prevDmg = s.currentWeapon > 0 ? weaponList[s.currentWeapon - 1]?.damage ?? 0 : 0;
    s.player.attackDamage += wNext.damage - prevDmg;
    if (typeof s.playerBladeMat !== 'undefined') s.playerBladeMat.color.setHex(wNext.color);
    playSound('coin');
    updateBlacksmithUI();
    updateUI();
    console.log('[buyWeapon] SUCCESS gold=' + s.gold + ' weapon=' + s.currentWeapon + ' dmg=' + s.player.attackDamage);
  } else {
    console.log('[buyWeapon] BLOCKED: wNext=' + JSON.stringify(wNext) + ' gold=' + s.gold + ' cost=' + (wNext ? wNext.cost : 'N/A'));
  }
}

export function buyArmor() {
  const s = state;
  const aNext = armorList[s.currentArmor + 1];
  console.log('[buyArmor] currentArmor=', s.currentArmor, 'next=', aNext ? aNext.name : 'null', 'gold=', s.gold, 'cost=', aNext ? aNext.cost : 'n/a');
  if (aNext && s.gold >= aNext.cost) {
    s.gold -= aNext.cost;
    s.currentArmor++;
    const prevHp = s.currentArmor > 0 ? armorList[s.currentArmor - 1]?.hp ?? 0 : 0;
    const hpDiff = aNext.hp - prevHp;
    s.player.maxHp += hpDiff;
    s.player.hp += hpDiff;
    if (typeof s.playerBodyMat !== 'undefined') s.playerBodyMat.color.setHex(aNext.color);
    playSound('coin');
    updateBlacksmithUI();
    updateUI();
    console.log('[buyArmor] SUCCESS gold=' + s.gold + ' armor=' + s.currentArmor + ' maxHp=' + s.player.maxHp);
  } else {
    console.log('[buyArmor] BLOCKED: aNext=' + JSON.stringify(aNext) + ' gold=' + s.gold + ' cost=' + (aNext ? aNext.cost : 'N/A'));
  }
}

// ─── Level up ──────────────────────────────────────────────────────────────────

export function levelUp() {
  const s = state;
  s.player.level++;
  s.player.exp -= s.player.nextExp;
  s.player.nextExp = Math.floor(s.player.nextExp * 1.5);
  s.player.maxHp += 20;
  s.player.hp = s.player.maxHp;
  s.player.attackDamage += 0.5;

  playSound('boss_spawn');
  spawnParticles(s.player.x, s.player.y, 0xffff00, 50, 'levelup');

  const modal = document.getElementById('level-up-modal');
  if (modal) {
    modal.querySelector('p').textContent = `Level ${s.player.level}! Max HP & Attack Meningkat!`;
    modal.style.display = 'flex';
    setTimeout(() => modal.style.display = 'none', 3000);
  }
}

// ─── Input handling ────────────────────────────────────────────────────────────

window.addEventListener('keydown', e => {
  const key = e.key.toLowerCase();
  state.keys[key] = true;
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'shift', 'z', 'x', 'c'].includes(key)) {
    e.preventDefault();
  }
  if (key === 'escape' && typeof window.togglePause === 'function') window.togglePause();
});

window.addEventListener('keyup', e => {
  state.keys[e.key.toLowerCase()] = false;
});
