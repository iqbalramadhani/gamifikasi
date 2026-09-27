import re

# 1. Update state.js
with open('src/state.js', 'r') as f:
    state_code = f.read()

state_code = state_code.replace('obstacles: [],', 'obstaclesHometown: [],\n  obstaclesWilds: [],\n  wildsLoaded: false,\n  hometownGroup: null,\n  wildsGroup: null,')
with open('src/state.js', 'w') as f:
    f.write(state_code)


# 2. Update helpers.js
with open('src/helpers.js', 'r') as f:
    helpers_code = f.read()

blocked_func_old = """export function blocked(x, y, r = state.player.r) {
  const s = state;
  if (s.currentScene === 'hometown') {
    if (x - r < -100 || x + r > 1100 || y - r < -100 || y + r > 1100) return true;
  } else {
    if (x - r < 0 || x + r > mapSize || y - r < 0 || y + r > mapSize) return true;
  }
  for (let i = 0; i < s.obstacles.length; i++) {
    const o = s.obstacles[i];
    if (Math.abs(o.x - x) > o.r + r || Math.abs(o.y - y) > o.r + r) continue;
    const dx = o.x - x, dy = o.y - y;
    if (dx * dx + dy * dy < (o.r + r) * (o.r + r)) return true;
  }
  return false;
}"""
blocked_func_new = """export function blocked(x, y, r = state.player.r) {
  const s = state;
  const isHometown = s.currentScene === 'hometown';
  
  if (isHometown) {
    if (x - r < -100 || x + r > 1100 || y - r < -100 || y + r > 1100) return true;
  } else {
    if (x - r < 0 || x + r > mapSize || y - r < 0 || y + r > mapSize) return true;
  }
  
  const obs = isHometown ? s.obstaclesHometown : s.obstaclesWilds;
  for (let i = 0; i < obs.length; i++) {
    const o = obs[i];
    if (Math.abs(o.x - x) > o.r + r || Math.abs(o.y - y) > o.r + r) continue;
    const dx = o.x - x, dy = o.y - y;
    if (dx * dx + dy * dy < (o.r + r) * (o.r + r)) return true;
  }
  return false;
}"""
helpers_code = helpers_code.replace(blocked_func_old, blocked_func_new)
with open('src/helpers.js', 'w') as f:
    f.write(helpers_code)


# 3. Update main.js
with open('src/main.js', 'r') as f:
    main_code = f.read()

main_code = main_code.replace('initHometown();\n  initMap();\n  initEntities();\n  initNPCs();', 'initHometown();\n  initEntities();\n  initNPCs();')
with open('src/main.js', 'w') as f:
    f.write(main_code)


# 4. Update scenes.js
with open('src/scenes.js', 'r') as f:
    scenes_code = f.read()

scenes_code = scenes_code.replace('export function initMap() {\n  const s = state;', 'export function initMap() {\n  const s = state;\n  s.wildsGroup = new THREE.Group();\n  s.scene.add(s.wildsGroup);\n')
scenes_code = scenes_code.replace('export function initHometown() {\n  const s = state;', 'export function initHometown() {\n  const s = state;\n  s.hometownGroup = new THREE.Group();\n  s.scene.add(s.hometownGroup);\n')

# replace s.scene.add and s.obstacles.push inside initMap and initHometown
def replace_in_func(code, func_name, add_replacement, obs_replacement):
    start = code.find(f'export function {func_name}()')
    if start == -1: return code
    end = code.find('export function ', start + 10)
    if end == -1: end = len(code)
    
    func_body = code[start:end]
    func_body = func_body.replace('s.scene.add(', add_replacement)
    func_body = func_body.replace('s.obstacles.push(', obs_replacement)
    
    return code[:start] + func_body + code[end:]

scenes_code = replace_in_func(scenes_code, 'initMap', 's.wildsGroup.add(', 's.obstaclesWilds.push(')
scenes_code = replace_in_func(scenes_code, 'initHometown', 's.hometownGroup.add(', 's.obstaclesHometown.push(')

# initNPCs contains both hometown and wilds NPCs. Let's separate wilds portal.
init_npcs_replacement = """export function initNPCs() {
  const s = state;
  const hx = 500, hy = 500;
  const NPC_HEIGHT = 30;

  // Portal to Wilds
  const portalGeo = new THREE.OctahedronGeometry(20, 0);
  const portalMat = new THREE.MeshLambertMaterial({ color: 0x00ffff, wireframe: true });
  s.hometownPortal = new THREE.Mesh(portalGeo, portalMat);
  s.hometownPortal.position.set(hx, 30, hy + 400);
  s.hometownGroup.add(s.hometownPortal);

  // Shop NPC
  if (loadedModels.char_b) {
    const shopMesh = SkeletonUtils.clone(loadedModels.char_b);
    scaleNPCToHeight(shopMesh, NPC_HEIGHT);
    s.shopNPC = new THREE.Group();
    s.shopNPC.add(shopMesh);
  } else {
    s.shopNPC = new THREE.Mesh(
      new THREE.CylinderGeometry(8, 8, 25, 8),
      new THREE.MeshLambertMaterial({ color: 0xffd700 })
    );
  }
  s.shopNPC.position.set(hx - 200, 0, hy - 200);
  s.hometownGroup.add(s.shopNPC);

  // Healer NPC
  if (loadedModels.char_c) {
    const healerMesh = SkeletonUtils.clone(loadedModels.char_c);
    scaleNPCToHeight(healerMesh, NPC_HEIGHT);
    s.healerNPC = new THREE.Group();
    s.healerNPC.add(healerMesh);
  } else {
    s.healerNPC = new THREE.Mesh(
      new THREE.CylinderGeometry(8, 8, 25, 8),
      new THREE.MeshLambertMaterial({ color: 0xff66cc })
    );
  }
  s.healerNPC.position.set(hx + 200, 0, hy - 200);
  s.hometownGroup.add(s.healerNPC);

  // Blacksmith NPC
  if (loadedModels.char_d) {
    const bsMesh = SkeletonUtils.clone(loadedModels.char_d);
    scaleNPCToHeight(bsMesh, NPC_HEIGHT);
    s.blacksmithNPC = new THREE.Group();
    s.blacksmithNPC.add(bsMesh);
  } else {
    s.blacksmithNPC = new THREE.Mesh(
      new THREE.CylinderGeometry(9, 9, 25, 8),
      new THREE.MeshLambertMaterial({ color: 0x333333 })
    );
  }
  s.blacksmithNPC.position.set(hx - 200, 0, hy + 200);
  s.hometownGroup.add(s.blacksmithNPC);

  // Extra NPCs
  if (loadedModels.char_e) {
    const guardMesh = SkeletonUtils.clone(loadedModels.char_e);
    scaleNPCToHeight(guardMesh, NPC_HEIGHT);
    const guardGroup = new THREE.Group();
    guardGroup.add(guardMesh);
    guardGroup.position.set(hx + 120, 0, hy + 120);
    guardGroup.rotation.y = Math.PI;
    s.hometownGroup.add(guardGroup);
  }
  if (loadedModels.char_f) {
    const villagerMesh = SkeletonUtils.clone(loadedModels.char_f);
    scaleNPCToHeight(villagerMesh, NPC_HEIGHT);
    const villagerGroup = new THREE.Group();
    villagerGroup.add(villagerMesh);
    villagerGroup.position.set(hx - 120, 0, hy + 120);
    villagerGroup.rotation.y = 0;
    s.hometownGroup.add(villagerGroup);
  }
  if (loadedModels.char_g) {
    const guard2Mesh = SkeletonUtils.clone(loadedModels.char_g);
    scaleNPCToHeight(guard2Mesh, NPC_HEIGHT);
    const guard2Group = new THREE.Group();
    guard2Group.add(guard2Mesh);
    guard2Group.position.set(hx + 120, 0, hy - 120);
    guard2Group.rotation.y = Math.PI * 0.5;
    s.hometownGroup.add(guard2Group);
  }

  // Collision for NPCs
  s.obstaclesHometown.push(
    { x: hx - 200, y: hy - 200, r: 10 },
    { x: hx + 200, y: hy - 200, r: 10 },
    { x: hx - 200, y: hy + 200, r: 10 },
    { x: hx + 120, y: hy + 120, r: 10 },
    { x: hx - 120, y: hy + 120, r: 10 },
    { x: hx + 120, y: hy - 120, r: 10 },
  );
}

export function initWildsNPCs() {
  const s = state;
  // Wilds return portal (near altar)
  const portalGeo = new THREE.OctahedronGeometry(20, 0);
  const wildsPortalMat = new THREE.MeshLambertMaterial({
    color: 0xff00ff, wireframe: true,
  });
  s.wildsPortal = new THREE.Mesh(portalGeo, wildsPortalMat);
  s.wildsPortal.position.set(mapSize / 2, 30, mapSize / 2 + 60);
  s.wildsGroup.add(s.wildsPortal);
}
"""

start_npcs = scenes_code.find('export function initNPCs() {')
scenes_code = scenes_code[:start_npcs] + init_npcs_replacement

with open('src/scenes.js', 'w') as f:
    f.write(scenes_code)


# 5. Update environment.js (teleportTo)
with open('src/environment.js', 'r') as f:
    env_code = f.read()

teleport_func_old = """export function teleportTo(sceneName) {
  console.log('Teleporting to', sceneName);
  const s = state;
  s.currentScene = sceneName;

  if (sceneName === 'wilds') {
    s.player.x = Math.floor(mapSize / 2);
    s.player.y = Math.floor(mapSize / 2) + 100;

    // Clear existing enemies
    s.enemies.forEach(e => {
      s.scene.remove(e.mesh);
      s.scene.remove(e.hpGroup);
    });
    s.enemies.length = 0;

    // Spawn initial wave of enemies in the Wilds
    const initialSpawns = Math.min(30, 10 + s.player.level * 2);
    for (let i = 0; i < initialSpawns; i++) {
      if (typeof window.spawnEnemy === 'function') window.spawnEnemy();
    }

    document.getElementById('message').textContent = 'Merasuki The Wilds...';
  } else {
    s.player.x = 500;
    s.player.y = 800;
    document.getElementById('message').textContent = 'Kembali ke Safe Haven.';
  }

  // Update player mesh position to match new coordinates
  if (s.playerMesh) {
    s.playerMesh.position.set(s.player.x, 15, s.player.y);
  }

  // Reposition camera to follow the player after teleport
  const camX = s.player.x;
  const camZ = s.player.y - s.cameraOffsetZ;
  const camY = s.cameraOffsetY;
  if (s.camera) {
    s.camera.position.set(camX, camY, camZ);
    s.camera.lookAt(s.player.x, s.cameraLookAtY, s.player.y);
  }

  // Reset facing direction if necessary
  if (!s.player.facingX && !s.player.facingY) {
    s.player.facingX = 1;
    s.player.facingY = 0;
  }

  playSound('coin');
  if (typeof window.saveGame === 'function') window.saveGame(true);
}"""

teleport_func_new = """import { initMap, initWildsNPCs } from './scenes.js';

export function teleportTo(sceneName) {
  console.log('Teleporting to', sceneName);
  const s = state;
  s.currentScene = sceneName;

  if (sceneName === 'wilds') {
    if (!s.wildsLoaded) {
      console.log('Lazy loading The Wilds...');
      initMap();
      initWildsNPCs();
      s.wildsLoaded = true;
    }
    
    if (s.hometownGroup) s.hometownGroup.visible = false;
    if (s.wildsGroup) s.wildsGroup.visible = true;
    
    s.player.x = Math.floor(mapSize / 2);
    s.player.y = Math.floor(mapSize / 2) + 100;

    // Clear existing enemies
    s.enemies.forEach(e => {
      s.scene.remove(e.mesh);
      s.scene.remove(e.hpGroup);
    });
    s.enemies.length = 0;

    // Spawn initial wave of enemies in the Wilds
    const initialSpawns = Math.min(30, 10 + s.player.level * 2);
    for (let i = 0; i < initialSpawns; i++) {
      if (typeof window.spawnEnemy === 'function') window.spawnEnemy();
    }

    document.getElementById('message').textContent = 'Merasuki The Wilds...';
  } else {
    if (s.wildsGroup) s.wildsGroup.visible = false;
    if (s.hometownGroup) s.hometownGroup.visible = true;
    
    s.player.x = 500;
    s.player.y = 800;
    document.getElementById('message').textContent = 'Kembali ke Safe Haven.';
  }

  // Update player mesh position to match new coordinates
  if (s.playerMesh) {
    s.playerMesh.position.set(s.player.x, 15, s.player.y);
  }

  // Reposition camera to follow the player after teleport
  const camX = s.player.x;
  const camZ = s.player.y - s.cameraOffsetZ;
  const camY = s.cameraOffsetY;
  if (s.camera) {
    s.camera.position.set(camX, camY, camZ);
    s.camera.lookAt(s.player.x, s.cameraLookAtY, s.player.y);
  }

  // Reset facing direction if necessary
  if (!s.player.facingX && !s.player.facingY) {
    s.player.facingX = 1;
    s.player.facingY = 0;
  }

  playSound('coin');
  if (typeof window.saveGame === 'function') window.saveGame(true);
}"""

# ensure the import doesn't duplicate
if 'import { initMap, initWildsNPCs } from' not in env_code:
    env_code = env_code.replace("export function teleportTo(sceneName) {", teleport_func_new.replace("export function teleportTo(sceneName) {", ""))
    env_code = env_code.replace(teleport_func_old[teleport_func_old.find("console.log('Teleporting to', sceneName);"):], teleport_func_new[teleport_func_new.find("export function teleportTo(sceneName) {"):])
    
with open('src/environment.js', 'w') as f:
    f.write(env_code)

