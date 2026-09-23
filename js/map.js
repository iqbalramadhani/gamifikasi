function blocked(x, y, r = player.r) {
  if (typeof currentScene !== 'undefined' && currentScene === 'hometown') {
      if (x - r < 9700 || x + r > 10300 || y - r < 9700 || y + r > 10300) return true;
  } else {
      if (x - r < 0 || x + r > mapSize || y - r < 0 || y + r > mapSize) return true;
  }
  
  for (let i = 0; i < obstacles.length; i++) {
    let o = obstacles[i];
    // Fast Rejection (Kotak pembatas / AABB)
    if (Math.abs(o.x - x) > o.r + r || Math.abs(o.y - y) > o.r + r) continue;
    
    // Exact collision (Jarak Kuadrat untuk hindari akar/hypot yang berat)
    let dx = o.x - x;
    let dy = o.y - y;
    if (dx * dx + dy * dy < (o.r + r) * (o.r + r)) return true;
  }
  return false;
}

function spawnAtFreePos() {
  let x, y;
  let valid = false;
  while(!valid) {
    x = 50 + Math.random() * (mapSize - 100);
    y = 50 + Math.random() * (mapSize - 100);
    if (Math.hypot(x - mapSize/2, y - mapSize/2) < 250) continue; // Jangan di sekitar altar
    if (Math.hypot(x - player.x, y - player.y) < 250) continue; // Jangan di dekat pemain saat baru mulai
    if (obstacles.some(o => Math.hypot(o.x - x, o.y - y) < o.r + 30)) continue;
    valid = true;
  }
  return {x, y};
}

window.initMap = function() {
// --- ALTAR UPGRADE DI TENGAH PETA ---
const altarGroup = new THREE.Group();
const altarBase = new THREE.Mesh(new THREE.CylinderGeometry(40, 40, 10, 8), new THREE.MeshLambertMaterial({color: 0x555555}));
altarBase.position.y = 5;
const altarPillar = new THREE.Mesh(new THREE.CylinderGeometry(15, 20, 30, 8), new THREE.MeshLambertMaterial({color: 0x444444}));
altarPillar.position.y = 20;
altarCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(15, 0), new THREE.MeshBasicMaterial({color: 0x00ffff, wireframe: true}));
altarCrystal.position.y = 50;
altarGroup.add(altarBase);
altarGroup.add(altarPillar);
altarGroup.add(altarCrystal);
altarGroup.position.set(mapSize / 2, 0, mapSize / 2);
scene.add(altarGroup);

obstacles.push({ x: mapSize / 2, y: mapSize / 2, r: 40 });

// Buat hutan dan pegunungan secara klaster (bergerombol)
const numClusters = 40;
for (let c = 0; c < numClusters; c++) {
    let cx = 200 + Math.random() * (mapSize - 400);
    let cy = 200 + Math.random() * (mapSize - 400);
    
    if (Math.hypot(cx - mapSize/2, cy - mapSize/2) < 250) continue;
    
    let isRockCluster = Math.random() < 0.3; // 30% kemungkinan ini adalah gunung berbatu
    let clusterSize = 15 + Math.floor(Math.random() * 25);
    
    for (let i = 0; i < clusterSize; i++) {
        let rAngle = Math.random() * Math.PI * 2;
        let rDist = Math.random() * 250; 
        let x = cx + Math.cos(rAngle) * rDist;
        let y = cy + Math.sin(rAngle) * rDist;
        
        if (x < 50 || x > mapSize - 50 || y < 50 || y > mapSize - 50) continue;
        if (Math.hypot(x - mapSize/2, y - mapSize/2) < 200) continue;
        
        let radius = 15;
        if (obstacles.some(o => Math.hypot(o.x - x, o.y - y) < o.r + radius + 5)) continue;
        
        let rand = Math.random();
        if (isRockCluster) {
            if (rand < 0.7) {
                let r = 15 + Math.random() * 25;
                let rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), new THREE.MeshLambertMaterial({ color: 0x777777 }));
                rock.position.set(x, r, y);
                rock.rotation.y = Math.random() * Math.PI;
                scene.add(rock);
                obstacles.push({ x: x, y: y, r: r * 0.8 });
            } else {
                let log = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 50, 8), new THREE.MeshLambertMaterial({ color: 0x4a3219 }));
                log.rotation.z = Math.PI / 2;
                log.rotation.y = Math.random() * Math.PI;
                log.position.set(x, 7, y);
                scene.add(log);
                obstacles.push({ x: x, y: y, r: 25 });
            }
        } else {
            if (rand < 0.6) {
                let treeGroup = new THREE.Group();
                let trunk = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 30, 8), new THREE.MeshLambertMaterial({ color: 0x5c4033 }));
                trunk.position.y = 15;
                let leaves = new THREE.Mesh(new THREE.ConeGeometry(25, 55, 8), new THREE.MeshLambertMaterial({ color: 0x226b2b }));
                leaves.position.y = 42;
                treeGroup.add(trunk);
                treeGroup.add(leaves);
                treeGroup.position.set(x, 0, y);
                scene.add(treeGroup);
                obstacles.push({ x: x, y: y, r: 12 });
            } else {
                let r = 12 + Math.random() * 12;
                let bush = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 8), new THREE.MeshLambertMaterial({ color: 0x1d5c22 }));
                bush.position.set(x, r - 2, y);
                scene.add(bush);
                obstacles.push({ x: x, y: y, r: r * 0.7 });
            }
        }
    }
}
};

window.initHometown = function() {
    let hx = 10000;
    let hy = 10000;
    
    // --- LALUAN BATU (PLAZA) ---
    const plazaGeo = new THREE.CircleGeometry(250, 32);
    const plazaMat = new THREE.MeshLambertMaterial({ color: 0x6e6e6e });
    const plazaMesh = new THREE.Mesh(plazaGeo, plazaMat);
    plazaMesh.rotation.x = -Math.PI / 2;
    plazaMesh.position.set(hx, 0.5, hy);
    scene.add(plazaMesh);
    
    // --- TEMBOK KAYU (PALISADE) ---
    const logGeo = new THREE.CylinderGeometry(6, 6, 40, 8);
    const logMat = new THREE.MeshLambertMaterial({ color: 0x3d2314 });
    for (let a = 0; a < Math.PI * 2; a += 0.05) {
        let x = hx + Math.cos(a) * 300;
        let y = hy + Math.sin(a) * 300;
        let log = new THREE.Mesh(logGeo, logMat);
        log.position.set(x, 20, y);
        log.scale.y = 0.8 + Math.random() * 0.4;
        scene.add(log);
        if (a % 0.15 < 0.05) {
            obstacles.push({ x: x, y: y, r: 15 });
        }
    }
    
    // --- AIR MANCUR (FOUNTAIN) ---
    const fountainGeo = new THREE.CylinderGeometry(30, 35, 10, 16);
    const fountainMat = new THREE.MeshLambertMaterial({ color: 0xaaaaaa });
    const fountain = new THREE.Mesh(fountainGeo, fountainMat);
    fountain.position.set(hx, 5, hy);
    scene.add(fountain);
    
    const waterGeo = new THREE.CylinderGeometry(28, 28, 2, 16);
    const waterMat = new THREE.MeshLambertMaterial({ color: 0x00aaff, transparent: true, opacity: 0.8 });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.position.set(hx, 10, hy);
    scene.add(water);
    
    const pillarGeo = new THREE.CylinderGeometry(5, 5, 25, 8);
    const pillar = new THREE.Mesh(pillarGeo, fountainMat);
    pillar.position.set(hx, 15, hy);
    scene.add(pillar);
    
    obstacles.push({ x: hx, y: hy, r: 35 });
    
    // --- RUMAH-RUMAH PENDUDUK ---
    const houseBaseGeo = new THREE.BoxGeometry(60, 40, 60);
    const houseBaseMat = new THREE.MeshLambertMaterial({ color: 0xddd3c6 });
    const roofGeo = new THREE.ConeGeometry(45, 30, 4); 
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x8b2e2e }); 
    
    const positions = [
        { x: -150, z: -150, r: 0 },
        { x: 150, z: 150, r: Math.PI },
        { x: -150, z: 150, r: Math.PI / 2 },
        { x: 200, z: -50, r: -Math.PI / 2 }
    ];
    
    positions.forEach(p => {
        let hGroup = new THREE.Group();
        let base = new THREE.Mesh(houseBaseGeo, houseBaseMat);
        base.position.y = 20;
        let roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.y = 55;
        roof.rotation.y = Math.PI / 4; 
        hGroup.add(base);
        hGroup.add(roof);
        hGroup.position.set(hx + p.x, 0, hy + p.z);
        hGroup.rotation.y = p.r;
        scene.add(hGroup);
        obstacles.push({ x: hx + p.x, y: hy + p.z, r: 40 });
    });
    
    // --- TENDA TOKO (SHOP STALL) ---
    const stallGroup = new THREE.Group();
    const stallPoleGeo = new THREE.CylinderGeometry(2, 2, 40, 4);
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x5c4033 });
    const p1 = new THREE.Mesh(stallPoleGeo, poleMat); p1.position.set(-20, 20, -20); stallGroup.add(p1);
    const p2 = new THREE.Mesh(stallPoleGeo, poleMat); p2.position.set(20, 20, -20); stallGroup.add(p2);
    const p3 = new THREE.Mesh(stallPoleGeo, poleMat); p3.position.set(-20, 20, 20); stallGroup.add(p3);
    const p4 = new THREE.Mesh(stallPoleGeo, poleMat); p4.position.set(20, 20, 20); stallGroup.add(p4);
    
    const awningGeo = new THREE.PlaneGeometry(50, 50);
    const awningMat = new THREE.MeshLambertMaterial({ color: 0xffaa00, side: THREE.DoubleSide });
    const awning = new THREE.Mesh(awningGeo, awningMat);
    awning.rotation.x = -Math.PI / 2 + 0.2;
    awning.position.y = 42;
    stallGroup.add(awning);
    
    const tableGeo = new THREE.BoxGeometry(30, 15, 15);
    const tableMat = new THREE.MeshLambertMaterial({ color: 0x6e4a2b });
    const table = new THREE.Mesh(tableGeo, tableMat);
    table.position.set(0, 7.5, 10);
    stallGroup.add(table);
    
    stallGroup.position.set(hx - 100, 0, hy - 100);
    scene.add(stallGroup);
    
    // --- KUIL HEALER (HEALER SHRINE) ---
    const shrineGroup = new THREE.Group();
    const sBaseGeo = new THREE.CylinderGeometry(25, 25, 5, 8);
    const sBaseMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const sBase = new THREE.Mesh(sBaseGeo, sBaseMat);
    sBase.position.y = 2.5;
    shrineGroup.add(sBase);
    
    for (let i = 0; i < 4; i++) {
        let sp = new THREE.Mesh(stallPoleGeo, sBaseMat);
        let ang = (i / 4) * Math.PI * 2 + Math.PI/4;
        sp.position.set(Math.cos(ang)*20, 20, Math.sin(ang)*20);
        shrineGroup.add(sp);
    }
    const sRoof = new THREE.Mesh(new THREE.ConeGeometry(30, 20, 4), new THREE.MeshLambertMaterial({ color: 0x00aaff }));
    sRoof.position.y = 50;
    sRoof.rotation.y = Math.PI / 4;
    shrineGroup.add(sRoof);
    
    shrineGroup.position.set(hx + 100, 0, hy - 100);
    scene.add(shrineGroup);
    // --- BENGKEL PANDAI BESI (BLACKSMITH) ---
    const bsGroup = new THREE.Group();
    const anvilGeo = new THREE.BoxGeometry(15, 10, 10);
    const anvilMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const anvil = new THREE.Mesh(anvilGeo, anvilMat);
    anvil.position.set(0, 5, 10);
    bsGroup.add(anvil);
    
    const furnaceGeo = new THREE.BoxGeometry(20, 30, 20);
    const furnaceMat = new THREE.MeshLambertMaterial({ color: 0x552222 });
    const furnace = new THREE.Mesh(furnaceGeo, furnaceMat);
    furnace.position.set(0, 15, -15);
    bsGroup.add(furnace);
    
    // Fire in furnace
    const fireGeo = new THREE.SphereGeometry(6, 8, 8);
    const fireMat = new THREE.MeshLambertMaterial({ color: 0xffaa00, emissive: 0xff5500 });
    const fire = new THREE.Mesh(fireGeo, fireMat);
    fire.position.set(0, 10, -5);
    bsGroup.add(fire);
    
    bsGroup.position.set(hx - 100, 0, hy + 100);
    scene.add(bsGroup);
};
