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
  altarCrystal: null, // Keep key so it doesn't break anything, but won't be used
  rainParticles: null,

  // GLTF references
  gltfPlayerRef: null,
  playerLegL: null,
  playerLegR: null,
  playerArmL: null,
  playerArmR: null,
  playerBodyMat: null,
  playerBladeMat: null,
  playerSwordMesh: null,
  playerAuraLight: null,

  // Camera presets (read-write from settings UI)
  cameraOffsetY: 150,
  cameraOffsetZ: 200,
  cameraLookAtY: 10,
  cameraAngle: 0,
  cameraShake: 0,
  zoomLevel: 200,

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
    x: 500, y: 800, r: 16, speed: 4.5,
    hp: 100, maxHp: 100, stamina: 100, maxStamina: 100, attackDamage: 1,
    facingX: 1, facingY: 0,
    attackCooldown: 0, defending: false,
    walkCycle: 0, dashCooldown: 0, spinCooldown: 0,
    isDashing: 0, isSpinning: 0, spinAngle: 0,
    level: 1, exp: 0, nextExp: 20, statPoints: 0,
    stats: { str: 1, agi: 1, vit: 1 },
    height: 0, heightVelocity: 0, lastFootstep: 0,
  },

  lockedEnemy: null,
  tabCooldown: 0,

  upgrades: { hpLevel: 1, atkLevel: 1, spdLevel: 1 },
  currentWeapon: 0,
  currentArmor: 0,
  ownedWeapons: [0],
  ownedArmors: [0],

  gold: 0,
  potions: 0,

  bountyQuest: null,
  bountyQuestProgress: 0,

  // Collections (populated at runtime)
  obstaclesHometown: [],
  obstaclesWilds: [],
  wildsLoaded: false,
  hometownGroup: null,
  wildsGroup: null,

  coinItems: [],
  expOrbs: [],
  potionItems: [],
  enemies: [],
  projectiles: [],
  particles: [],
  lootDrops: [],
  
  inventory: {},

  keys: {},

  // Boss
  bossActive: false,
  bossMesh: null,
  bossHpGroup: null,
  bossHpFg: null,
  bossHp: 200,
  bossMaxHp: 200,
  bossX: 10000,
  bossY: 10500,
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

