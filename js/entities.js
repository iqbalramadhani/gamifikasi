window.initEntities = function() {
const crystalGeo = new THREE.OctahedronGeometry(8, 0);
const crystalMat = new THREE.MeshLambertMaterial({ color: 0x00ffff });
for(let i=0; i<crystalGoal; i++) {
  let pos = spawnAtFreePos();
  let mesh = new THREE.Mesh(crystalGeo, crystalMat);
  mesh.position.set(pos.x, 15, pos.y);
  scene.add(mesh);
  crystalItems.push({ x: pos.x, y: pos.y, taken: false, mesh: mesh });
}

const coinGeo = new THREE.CylinderGeometry(6, 6, 2, 16);
const coinMat = new THREE.MeshLambertMaterial({ color: 0xffd700 });
for(let i=0; i<40; i++) {
  let pos = spawnAtFreePos();
  let mesh = new THREE.Mesh(coinGeo, coinMat);
  mesh.rotation.x = Math.PI/2;
  mesh.position.set(pos.x, 10, pos.y);
  scene.add(mesh);
  coinItems.push({ x: pos.x, y: pos.y, taken: false, mesh: mesh });
}

const spikeGeo = new THREE.IcosahedronGeometry(15, 0); 
const spikeMat = new THREE.MeshLambertMaterial({ color: 0x991212 });

const slimeGeo = new THREE.BoxGeometry(16, 16, 16);
const slimeMat = new THREE.MeshLambertMaterial({ color: 0x22cc44, transparent: true, opacity: 0.8 });

const golemGeo = new THREE.BoxGeometry(28, 28, 28);
const golemMat = new THREE.MeshLambertMaterial({ color: 0x666666 });

const hpBgMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
const hpFgMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const hpGeo = new THREE.PlaneGeometry(24, 4);

const archerGeo = new THREE.CylinderGeometry(6, 6, 20, 8);
const archerMat = new THREE.MeshLambertMaterial({ color: 0xdddddd }); 
const kamikazeGeo = new THREE.SphereGeometry(12, 16, 16);
const kamikazeMat = new THREE.MeshLambertMaterial({ color: 0xff4400 }); 
const ghostGeo = new THREE.ConeGeometry(10, 25, 16);
const ghostMat = new THREE.MeshLambertMaterial({ color: 0x8800ff, transparent: true, opacity: 0.6 });

window.spawnEnemy = function(ex, ey) {
    if (!ex || !ey) {
        let pos = spawnAtFreePos();
        ex = pos.x; ey = pos.y;
    }
    
    // Memunculkan semua 6 jenis musuh secara acak dari awal permainan
    let type = Math.floor(Math.random() * 6);
    
    let mesh, eHp, eSpeed, eR, eY, eTypeStr;
    
    if (type === 0) {
       mesh = new THREE.Mesh(spikeGeo, spikeMat);
       eHp = 3; eSpeed = 1.6; eR = 15; eY = 15; eTypeStr = 'spike';
    } else if (type === 1) {
       mesh = new THREE.Mesh(slimeGeo, slimeMat);
       eHp = 1.5; eSpeed = 3.0; eR = 12; eY = 8; eTypeStr = 'slime';
    } else if (type === 2) {
       mesh = new THREE.Mesh(golemGeo, golemMat);
       eHp = 8; eSpeed = 0.8; eR = 20; eY = 14; eTypeStr = 'golem';
    } else if (type === 3) {
       mesh = new THREE.Mesh(archerGeo, archerMat);
       eHp = 4; eSpeed = 1.2; eR = 12; eY = 10; eTypeStr = 'archer';
    } else if (type === 4) {
       mesh = new THREE.Mesh(kamikazeGeo, kamikazeMat);
       eHp = 2; eSpeed = 3.5; eR = 12; eY = 12; eTypeStr = 'kamikaze';
    } else {
       mesh = new THREE.Mesh(ghostGeo, ghostMat);
       eHp = 5; eSpeed = 1.0; eR = 10; eY = 15; eTypeStr = 'ghost';
    }
    
    let levelMulti = 1 + (player.level * 0.1);
    eHp *= levelMulti;
    if (eTypeStr !== 'kamikaze') eSpeed *= (1 + player.level * 0.02);

    mesh.position.set(ex, eY, ey);
    scene.add(mesh);
    
    let hpGroup = new THREE.Group();
    let hpBg = new THREE.Mesh(hpGeo, hpBgMat);
    let hpFg = new THREE.Mesh(hpGeo, hpFgMat);
    hpFg.position.z = 0.1;
    hpGroup.add(hpBg);
    hpGroup.add(hpFg);
    scene.add(hpGroup);

    let dx = (Math.random() - 0.5) * 2;
    let dy = (Math.random() - 0.5) * 2;
    enemies.push({ 
        x: ex, y: ey, r: eR, meshY: eY, dx: dx, dy: dy, 
        hp: eHp, maxHp: eHp, baseSpeed: eSpeed, 
        mesh: mesh, hpGroup: hpGroup, hpFg: hpFg, 
        stunTimer: 0, slowTimer: 0, type: eTypeStr,
        attackTimer: 0
    });
};

// spawnEnemy dipanggil saat masuk the Wilds

playerMesh = new THREE.Group();

// Kaki Kiri & Sendi
player.leftHip = new THREE.Group();
player.leftHip.position.set(0, -3, -3.5);
const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(6, 12, 6), new THREE.MeshLambertMaterial({ color: 0x555555 }));
leftLeg.position.set(0, -6, 0);
player.leftHip.add(leftLeg);
playerMesh.add(player.leftHip);

// Kaki Kanan & Sendi
player.rightHip = new THREE.Group();
player.rightHip.position.set(0, -3, 3.5);
const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(6, 12, 6), new THREE.MeshLambertMaterial({ color: 0x555555 }));
rightLeg.position.set(0, -6, 0);
player.rightHip.add(rightLeg);
playerMesh.add(player.rightHip);

// Body (Armor Baja)
const bodyGeo = new THREE.BoxGeometry(14, 20, 14);
window.playerBodyMat = new THREE.MeshLambertMaterial({ color: 0xaaaaaa });
const body = new THREE.Mesh(bodyGeo, window.playerBodyMat);
body.position.y = 7;
playerMesh.add(body);

// Kepala
const headGeo = new THREE.SphereGeometry(6, 16, 16);
const headMat = new THREE.MeshLambertMaterial({ color: 0xffccaa });
const head = new THREE.Mesh(headGeo, headMat);
head.position.y = 21;
playerMesh.add(head);

// Helm (Menutupi atas kepala)
const helmGeo = new THREE.SphereGeometry(6.5, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
const helmMat = new THREE.MeshLambertMaterial({ color: 0x778899 });
const helm = new THREE.Mesh(helmGeo, helmMat);
helm.position.y = 21;
playerMesh.add(helm);

const swordGroup = new THREE.Group();
const hilt = new THREE.Mesh(new THREE.BoxGeometry(2, 6, 2), new THREE.MeshLambertMaterial({ color: 0x5c4033 }));
window.playerBladeMat = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
const blade = new THREE.Mesh(new THREE.BoxGeometry(16, 2, 4), window.playerBladeMat);
blade.position.x = 9;
swordGroup.add(hilt);
swordGroup.add(blade);
swordGroup.position.set(0, 7, 9);
playerMesh.add(swordGroup);

const pShield = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 2, 16), new THREE.MeshLambertMaterial({ color: 0x8b4513 }));
pShield.rotation.x = Math.PI / 2;
pShield.position.set(0, 7, -9);
playerMesh.add(pShield);

// Set posisi ke y=15 agar kaki pas berpijak di lantai y=0
playerMesh.position.set(player.x, 15, player.y);
scene.add(playerMesh);

const shieldGeo = new THREE.SphereGeometry(24, 16, 16);
const shieldMat = new THREE.MeshBasicMaterial({ color: 0x00aaff, transparent: true, opacity: 0.5, wireframe: true });
shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
shieldMesh.visible = false;
playerMesh.add(shieldMesh);

  // Companion: The Fairy
  petMesh = new THREE.Mesh(
    new THREE.SphereGeometry(3, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffaa, wireframe: true })
  );
  scene.add(petMesh);
};

window.spawnParticles = function(x, y, color, count, type) {
    for (let i = 0; i < count; i++) {
        let mat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 1 });
        let size = type === 'dust' ? 4 : 3;
        let geo = new THREE.BoxGeometry(size, size, size);
        let mesh = new THREE.Mesh(geo, mat);
        
        let py = type === 'dust' ? 2 : 15;
        mesh.position.set(x, py, y);
        scene.add(mesh);
        
        particles.push({
            mesh: mesh,
            dx: (Math.random() - 0.5) * 6,
            dy: (Math.random() - 0.5) * 6,
            dz: (Math.random() - 0.5) * 6 + (type === 'heal' ? 3 : 0),
            life: 1.0,
            decay: type === 'dust' ? 0.05 : 0.03
        });
    }
};

window.spawnBoss = function() {
  if (bossActive) return;
  bossActive = true;
  playSound('boss_spawn');
  document.getElementById("message").textContent = "⚠️ THE GOLDEN GOLEM TELAH BANGKIT! Kalahkan dia untuk menang!";
  
  const bGeo = new THREE.BoxGeometry(60, 60, 60);
  const bMat = new THREE.MeshLambertMaterial({ color: 0xffd700 }); // Emas
  bossMesh = new THREE.Mesh(bGeo, bMat);
  
  bossX = mapSize / 2;
  bossY = mapSize / 2;
  bossMesh.position.set(bossX, 30, bossY);
  scene.add(bossMesh);
  
  bossHpGroup = new THREE.Group();
  let bg = new THREE.Mesh(new THREE.PlaneGeometry(80, 8), new THREE.MeshBasicMaterial({ color: 0x222222 }));
  bossHpFg = new THREE.Mesh(new THREE.PlaneGeometry(80, 8), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
  bossHpFg.position.z = 0.2;
  bossHpGroup.add(bg);
  bossHpGroup.add(bossHpFg);
  scene.add(bossHpGroup);
  
  // Hancurkan altar
  scene.remove(altarCrystal);
};

window.hometownPortal = null;
window.shopNPC = null;
window.healerNPC = null;
window.blacksmithNPC = null;
window.wildsPortal = null;

window.initNPCs = function() {
    let hx = 10000;
    let hy = 10000;

    const portalGeo = new THREE.OctahedronGeometry(20, 0);
    const portalMat = new THREE.MeshLambertMaterial({ color: 0x00ffff, wireframe: true });
    hometownPortal = new THREE.Mesh(portalGeo, portalMat);
    hometownPortal.position.set(hx, 30, hy + 200);
    scene.add(hometownPortal);

    const shopGeo = new THREE.CylinderGeometry(8, 8, 25, 8);
    const shopMat = new THREE.MeshLambertMaterial({ color: 0xffd700 });
    shopNPC = new THREE.Mesh(shopGeo, shopMat);
    shopNPC.position.set(hx - 100, 12.5, hy - 100);
    scene.add(shopNPC);

    const healerGeo = new THREE.CylinderGeometry(8, 8, 25, 8);
    const healerMat = new THREE.MeshLambertMaterial({ color: 0xff66cc });
    healerNPC = new THREE.Mesh(healerGeo, healerMat);
    healerNPC.position.set(hx + 100, 12.5, hy - 100);
    scene.add(healerNPC);
    
    const bsGeo = new THREE.CylinderGeometry(9, 9, 25, 8);
    const bsMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
    blacksmithNPC = new THREE.Mesh(bsGeo, bsMat);
    blacksmithNPC.position.set(hx - 100, 12.5, hy + 100);
    scene.add(blacksmithNPC);
    
    // NPC collision
    obstacles.push({ x: hx - 100, y: hy - 100, r: 10 });
    obstacles.push({ x: hx + 100, y: hy - 100, r: 10 });
    obstacles.push({ x: hx - 100, y: hy + 100, r: 10 });
    
    // Portal in the Wilds (at Altar position)
    wildsPortal = new THREE.Mesh(portalGeo, new THREE.MeshLambertMaterial({ color: 0xff00ff, wireframe: true }));
    wildsPortal.position.set(mapSize/2, 30, mapSize/2 + 60);
    scene.add(wildsPortal);
};
