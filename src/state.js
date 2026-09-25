// Shared mutable game state — imported by all modules that need to read/write it.
// Modules read from `state` instead of using bare `let` variables.

export const state = {
  // --- Scenery / scene graph refs ---
  scene: null,
  camera: null,
  renderer: null,
  dirLight: null,
  composer: null,
  controls: null,

  playerMesh: null,
  shieldMesh: null,
  altarCrystal: null,
  rainParticles: null,

  // GLTF references
  gltfPlayerRef: null,
  playerLegL: null,
  playerLegR: null,
  playerArmL: null,
  playerArmR: null,
  playerBodyMat: null,
  playerBladeMat: null,

  // Camera presets (read-write from settings UI)
  cameraOffsetY: 150,
  cameraOffsetZ: 200,
  cameraLookAtY: 10,

  // --- Game logic state ---
  currentScene: 'hometown',
  isPaused: false,
  isGameStarted: false,
  gameOver: false,
  shopOpen: false,
  blacksmithOpen: false,
  shopCooldown: 0,

  // Player
  player: {
    x: 10000, y: 10080, r: 16, speed: 4.5,
    hp: 100, maxHp: 100, attackDamage: 1,
    facingX: 1, facingY: 0,
    attackCooldown: 0, defending: false,
    walkCycle: 0, dashCooldown: 0, spinCooldown: 0,
    isDashing: 0, isSpinning: 0,
    level: 1, exp: 0, nextExp: 20,
  },

  upgrades: { hpLevel: 1, atkLevel: 1, spdLevel: 1 },
  currentWeapon: 0,
  currentArmor: 0,

  gold: 0,
  potions: 0,
  crystalCount: 0,
  crystalGoal: 10,

  // Collections (populated at runtime)
  obstacles: [],
  crystalItems: [],
  coinItems: [],
  expOrbs: [],
  potionItems: [],
  enemies: [],
  projectiles: [],
  particles: [],

  keys: {},

  // Boss
  bossActive: false,
  bossMesh: null,
  bossHpGroup: null,
  bossHpFg: null,
  bossHp: 200,
  bossMaxHp: 200,
  bossX: 2000,
  bossY: 2000,
  bossPhase: 1,

  // Weather / time
  dayTime: 0,
  lastTimestamp: 0,
  lastFacingX: 1,
  lastFacingY: 0,
  playerIdleBreath: 0,

  // Pet
  petActive: true,
  petMesh: null,
  petAngle: 0,

  // Map
  hometownPortal: null,
  wildsPortal: null,
  shopNPC: null,
  healerNPC: null,
  blacksmithNPC: null,

  // BGM flag
  bgmStarted: false,
};

