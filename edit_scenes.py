import re

with open('src/scenes.js', 'r') as f:
    content = f.read()

# 1. Update paths
content = content.replace('addPath(hx, hy, hx - 150, hy - 150);', 'addPath(hx, hy, hx - 300, hy - 300);')
content = content.replace('addPath(hx, hy, hx + 150, hy + 150);', 'addPath(hx, hy, hx + 300, hy + 300);')
content = content.replace('addPath(hx, hy, hx - 150, hy + 150);', 'addPath(hx, hy, hx - 300, hy + 300);')
content = content.replace('addPath(hx, hy, hx + 200, hy - 50);', 'addPath(hx, hy, hx + 400, hy - 100);')
content = content.replace('addPath(hx, hy, hx - 200, hy + 50);', 'addPath(hx, hy, hx - 400, hy + 100);')
content = content.replace('addPath(hx, hy, hx + 130, hy - 160);', 'addPath(hx, hy, hx + 260, hy - 320);')

content = content.replace('addPath(hx, hy, hx - 100, hy - 100);', 'addPath(hx, hy, hx - 200, hy - 200);')
content = content.replace('addPath(hx, hy, hx + 100, hy - 100);', 'addPath(hx, hy, hx + 200, hy - 200);')
content = content.replace('addPath(hx, hy, hx - 100, hy + 100);', 'addPath(hx, hy, hx - 200, hy + 200);')

content = content.replace('addPath(hx, hy, hx + 80, hy - 150);', 'addPath(hx, hy, hx + 160, hy - 300);')
content = content.replace('addPath(hx, hy, hx - 80, hy + 180);', 'addPath(hx, hy, hx - 160, hy + 360);')
content = content.replace('addPath(hx, hy, hx + 180, hy - 120);', 'addPath(hx, hy, hx + 360, hy - 240);')
content = content.replace('addPath(hx, hy, hx - 220, hy - 30);', 'addPath(hx, hy, hx - 440, hy - 60);')
content = content.replace('addPath(hx, hy, hx + 220, hy + 80);', 'addPath(hx, hy, hx + 440, hy + 160);')
content = content.replace('addPath(hx, hy, hx, hy - 200);', 'addPath(hx, hy, hx, hy - 400);')

# 2. Update housePositions
housePosOld = """  const housePositions = [
    { x: -150, z: -150, r: 0,            model: 'house' },
    { x: 150,  z: 150,  r: Math.PI,      model: 'building_platform' },
    { x: -150, z: 150,  r: Math.PI / 2,  model: 'struct_roof' },
    { x: 200,  z: -50,  r: -Math.PI / 2, model: 'house' },
    { x: -200, z: 50,   r: Math.PI / 3,  model: 'building_platform' },
    { x: 130,  z: -160, r: -Math.PI / 4, model: 'struct_roof' },
    { x: -80,  z: 180,  r: Math.PI / 4,  model: 'house' },
    { x: 180,  z: -120, r: -Math.PI / 3, model: 'house' },
    { x: -120, z: -180, r: Math.PI * 0.7,model: 'building_platform' },
    { x: 60,   z: 120,  r: 0,            model: 'struct_roof' },
    { x: -220, z: -30,  r: Math.PI / 2,  model: 'house' },
    { x: 220,  z: 80,   r: Math.PI,      model: 'building_platform' },
    { x: 0,    z: -200, r: -Math.PI / 6, model: 'struct_roof' },
  ];"""
housePosNew = """  const housePositions = [
    { x: -300, z: -300, r: 0,            model: 'house' },
    { x: 300,  z: 300,  r: Math.PI,      model: 'building_platform' },
    { x: -300, z: 300,  r: Math.PI / 2,  model: 'struct_roof' },
    { x: 400,  z: -100, r: -Math.PI / 2, model: 'house' },
    { x: -400, z: 100,  r: Math.PI / 3,  model: 'building_platform' },
    { x: 260,  z: -320, r: -Math.PI / 4, model: 'struct_roof' },
    { x: -160, z: 360,  r: Math.PI / 4,  model: 'house' },
    { x: 360,  z: -240, r: -Math.PI / 3, model: 'house' },
    { x: -240, z: -360, r: Math.PI * 0.7,model: 'building_platform' },
    { x: 120,  z: 240,  r: 0,            model: 'struct_roof' },
    { x: -440, z: -60,  r: Math.PI / 2,  model: 'house' },
    { x: 440,  z: 160,  r: Math.PI,      model: 'building_platform' },
    { x: 0,    z: -400, r: -Math.PI / 6, model: 'struct_roof' },
  ];"""
content = content.replace(housePosOld, housePosNew)

# 3. Update addBuildingFence
fenceOld = """    addBuildingFence(hx - 150, hy - 150, 60);
    addBuildingFence(hx + 150, hy + 150, 60);
    addBuildingFence(hx - 150, hy + 150, 60);
    addBuildingFence(hx + 200, hy - 50, 60);
    addBuildingFence(hx - 200, hy + 50, 60);
    addBuildingFence(hx + 130, hy - 160, 60);
    addBuildingFence(hx - 100, hy - 100, 45);
    addBuildingFence(hx + 100, hy - 100, 45);
    addBuildingFence(hx - 100, hy + 100, 45);"""
fenceNew = """    addBuildingFence(hx - 300, hy - 300, 60);
    addBuildingFence(hx + 300, hy + 300, 60);
    addBuildingFence(hx - 300, hy + 300, 60);
    addBuildingFence(hx + 400, hy - 100, 60);
    addBuildingFence(hx - 400, hy + 100, 60);
    addBuildingFence(hx + 260, hy - 320, 60);
    addBuildingFence(hx - 200, hy - 200, 45);
    addBuildingFence(hx + 200, hy - 200, 45);
    addBuildingFence(hx - 200, hy + 200, 45);"""
content = content.replace(fenceOld, fenceNew)

# 4. Update target dummy
content = content.replace('target.position.set(hx + 80, 0, hy - 150);', 'target.position.set(hx + 160, 0, hy - 300);')
content = content.replace("s.obstacles.push({ x: hx + 80, y: hy - 150, r: 15 });", "s.obstacles.push({ x: hx + 160, y: hy - 300, r: 15 });")

# 5. fencePositions
fencePosOld = """  if (loadedModels.fence) {
    const fencePositions = [
      { x: hx - 50, z: hy + 60, ry: 0 },
      { x: hx + 50, z: hy + 60, ry: Math.PI },
      { x: hx + 60, z: hy - 50, ry: Math.PI / 2 },
      { x: hx - 60, z: hy - 50, ry: -Math.PI / 2 },
      { x: hx + 80, z: hy + 80, ry: Math.PI * 0.75 },
      { x: hx - 80, z: hy - 80, ry: -Math.PI * 0.75 },
    ];"""
fencePosNew = """  if (loadedModels.fence) {
    const fencePositions = [
      { x: hx - 100, z: hy + 120, ry: 0 },
      { x: hx + 100, z: hy + 120, ry: Math.PI },
      { x: hx + 120, z: hy - 100, ry: Math.PI / 2 },
      { x: hx - 120, z: hy - 100, ry: -Math.PI / 2 },
      { x: hx + 160, z: hy + 160, ry: Math.PI * 0.75 },
      { x: hx - 160, z: hy - 160, ry: -Math.PI * 0.75 },
    ];"""
content = content.replace(fencePosOld, fencePosNew)

# 6. extraBuildings
extraBldgOld = """  const extraBuildings = [
    { x: hx + 250, z: hy + 200, model: 'house' },
    { x: hx - 250, z: hy + 150, model: 'building_platform' },
    { x: hx + 100, z: hy - 220, model: 'struct_roof' },
    { x: hx - 180, z: hy - 200, model: 'house' },
  ];"""
extraBldgNew = """  const extraBuildings = [
    { x: hx + 500, z: hy + 400, model: 'house' },
    { x: hx - 500, z: hy + 300, model: 'building_platform' },
    { x: hx + 200, z: hy - 440, model: 'struct_roof' },
    { x: hx - 360, z: hy - 400, model: 'house' },
  ];"""
content = content.replace(extraBldgOld, extraBldgNew)

# 7. NPCs (Town)
content = content.replace('stallGroup.position.set(hx - 100, 0, hy - 100);', 'stallGroup.position.set(hx - 200, 0, hy - 200);')
content = content.replace('shrineGroup.position.set(hx + 100, 0, hy - 100);', 'shrineGroup.position.set(hx + 200, 0, hy - 200);')
content = content.replace('bsGroup.position.set(hx - 100, 0, hy + 100);', 'bsGroup.position.set(hx - 200, 0, hy + 200);')
content = content.replace('qbGroup.position.set(hx, 0, hy + 50);', 'qbGroup.position.set(hx, 0, hy + 100);')
content = content.replace("s.questBoardPos = { x: hx, z: hy + 50 };", "s.questBoardPos = { x: hx, z: hy + 100 };")
content = content.replace("s.obstacles.push({ x: hx, y: hy + 50, r: 15 });", "s.obstacles.push({ x: hx, y: hy + 100, r: 15 });")

# 8. flagPositions
flagsOld = """    const flagPositions = [
      { x: hx - 120, z: hy - 120 },
      { x: hx + 120, z: hy - 120 },
      { x: hx - 120, z: hy + 120 },
      { x: hx + 120, z: hy + 120 },
    ];"""
flagsNew = """    const flagPositions = [
      { x: hx - 240, z: hy - 240 },
      { x: hx + 240, z: hy - 240 },
      { x: hx - 240, z: hy + 240 },
      { x: hx + 240, z: hy + 240 },
    ];"""
content = content.replace(flagsOld, flagsNew)

# 9. NPCs init
content = content.replace("s.hometownPortal.position.set(hx, 30, hy + 200);", "s.hometownPortal.position.set(hx, 30, hy + 400);")
content = content.replace("s.shopNPC.position.set(hx - 100, 0, hy - 100);", "s.shopNPC.position.set(hx - 200, 0, hy - 200);")
content = content.replace("s.healerNPC.position.set(hx + 100, 0, hy - 100);", "s.healerNPC.position.set(hx + 200, 0, hy - 200);")
content = content.replace("s.blacksmithNPC.position.set(hx - 100, 0, hy + 100);", "s.blacksmithNPC.position.set(hx - 200, 0, hy + 200);")

content = content.replace("guardGroup.position.set(hx + 60, 0, hy + 60);", "guardGroup.position.set(hx + 120, 0, hy + 120);")
content = content.replace("s.obstacles.push({ x: hx + 60, y: hy + 60, r: 10 });", "")
content = content.replace("villagerGroup.position.set(hx - 60, 0, hy + 60);", "villagerGroup.position.set(hx - 120, 0, hy + 120);")
content = content.replace("s.obstacles.push({ x: hx - 60, y: hy + 60, r: 10 });", "")
content = content.replace("guard2Group.position.set(hx + 60, 0, hy - 60);", "guard2Group.position.set(hx + 120, 0, hy - 120);")
content = content.replace("s.obstacles.push({ x: hx + 60, y: hy - 60, r: 10 });", "")

npcColsOld = """  // Collision for NPCs
  s.obstacles.push(
    { x: hx - 100, y: hy - 100, r: 10 },
    { x: hx + 100, y: hy - 100, r: 10 },
    { x: hx - 100, y: hy + 100, r: 10 },
    { x: hx + 60, y: hy + 60, r: 10 },
    { x: hx - 60, y: hy + 60, r: 10 },
    { x: hx + 60, y: hy - 60, r: 10 },
  );"""
npcColsNew = """  // Collision for NPCs
  s.obstacles.push(
    { x: hx - 200, y: hy - 200, r: 10 },
    { x: hx + 200, y: hy - 200, r: 10 },
    { x: hx - 200, y: hy + 200, r: 10 },
    { x: hx + 120, y: hy + 120, r: 10 },
    { x: hx - 120, y: hy + 120, r: 10 },
    { x: hx + 120, y: hy - 120, r: 10 },
  );"""
content = content.replace(npcColsOld, npcColsNew)


with open('src/scenes.js', 'w') as f:
    f.write(content)

