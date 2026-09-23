const mapSize = 4000;

// --- GAME LOGIC STATE ---
let currentScene = 'hometown'; // 'hometown' or 'wilds'
let isPaused = false;
let isGameStarted = false;
const player = { x: 10000, y: 10080, r: 16, speed: 4.5, hp: 100, maxHp: 100, attackDamage: 1, facingX: 1, facingY: 0, attackCooldown: 0, defending: false, walkCycle: 0, dashCooldown: 0, spinCooldown: 0, isDashing: 0, isSpinning: 0, level: 1, exp: 0, nextExp: 20 };
const upgrades = { hpLevel: 1, atkLevel: 1, spdLevel: 1 };
const projectiles = [];
let gold = 0;
let potions = 0;
let crystalCount = 0;
const crystalGoal = 10;
let gameOver = false;
let shopOpen = false;
let blacksmithOpen = false;
let shopCooldown = 0;

let currentWeapon = 0;
let currentArmor = 0;

const weaponList = [
    { name: "Wooden Sword", damage: 0, cost: 0, color: 0xeeeeee },
    { name: "Iron Sword", damage: 2, cost: 100, color: 0xaaaaaa },
    { name: "Golden Sword", damage: 5, cost: 300, color: 0xffd700 },
    { name: "Fire Blade", damage: 10, cost: 800, color: 0xff4400 }
];

const armorList = [
    { name: "Rusted Armor", hp: 0, cost: 0, color: 0xaaaaaa },
    { name: "Knight Armor", hp: 50, cost: 150, color: 0xdddddd },
    { name: "Paladin Armor", hp: 150, cost: 400, color: 0xffcc00 },
    { name: "Dragon Armor", hp: 300, cost: 1000, color: 0x221111 }
];

const obstacles = [];
const crystalItems = [];
const coinItems = [];
const expOrbs = [];
const potionItems = [];
const enemies = [];
const keys = {};
const particles = [];

let petActive = true;
let petMesh = null;

// --- BOSS & WEATHER STATE ---
let bossActive = false;
let bossMesh = null;
let bossHpGroup = null;
let bossHpFg = null;
let bossHp = 200;
let bossMaxHp = 200;
let bossX = 2000, bossY = 2000;
let bossPhase = 1;

let dayTime = 0; // 0 to 1 (0 = siang, 0.5 = sore/malam)
let rainParticles;

// Global Object References untuk Three.js
let scene, camera, renderer, dirLight;
let playerMesh, shieldMesh, altarCrystal;
