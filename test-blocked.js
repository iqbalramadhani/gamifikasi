const player = { x: 10000, y: 10080, r: 16 };
let currentScene = 'hometown';
const mapSize = 4000;
const obstacles = [];
let hx = 10000, hy = 10000;

for (let a = 0; a < Math.PI * 2; a += 0.2) {
    let x = hx + Math.cos(a) * 300;
    let y = hy + Math.sin(a) * 300;
    obstacles.push({ x: x, y: y, r: 15 });
}
obstacles.push({ x: hx, y: hy, r: 35 });
const positions = [
    { x: -150, z: -150, r: 0 },
    { x: 150, z: 150, r: Math.PI },
    { x: -150, z: 150, r: Math.PI / 2 },
    { x: 200, z: -50, r: -Math.PI / 2 }
];
positions.forEach(p => {
    obstacles.push({ x: hx + p.x, y: hy + p.z, r: 40 });
});
obstacles.push({ x: hx + 80, y: hy - 150, r: 15 });
obstacles.push({ x: hx - 100, y: hy - 100, r: 10 });
obstacles.push({ x: hx + 100, y: hy - 100, r: 10 });
obstacles.push({ x: hx - 100, y: hy + 100, r: 10 });

function blocked(x, y, r = player.r) {
  if (typeof currentScene !== 'undefined' && currentScene === 'hometown') {
      if (x - r < 9700 || x + r > 10300 || y - r < 9700 || y + r > 10300) return true;
  } else {
      if (x - r < 0 || x + r > mapSize || y - r < 0 || y + r > mapSize) return true;
  }
  
  for (let i = 0; i < obstacles.length; i++) {
    let o = obstacles[i];
    if (Math.abs(o.x - x) > o.r + r || Math.abs(o.y - y) > o.r + r) continue;
    
    let dx = o.x - x;
    let dy = o.y - y;
    if (dx * dx + dy * dy < (o.r + r) * (o.r + r)) {
        console.log("Blocked by obstacle:", o);
        return true;
    }
  }
  return false;
}

console.log("Is blocked?", blocked(player.x, player.y));
