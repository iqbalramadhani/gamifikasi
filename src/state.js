// Shared mutable game state — imported by all modules that need to read/write it.
// Modules read from `state` instead of using bare `let` variables.

export const state = {
  // --- Scenery / scene graph refs ---
  scene: null,
  sceneMount: null, // TransformNode parented into scene — mount point for hot-path dynamic entities (enemies, projectiles, loot, particles)
  camera: null,
  renderer: null, // Babylon Engine instance
  dirLight: null,
  composer: null, // always null — Babylon render loop replaces this; kept only so any stale reference stays safe
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
  // Phase 1: procedural placeholder (no skeleton anim yet); kept null-safe so callers guard with `if (...)`.
  playerMixer: null,
  playerActions: null,
  activeAction: null,

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
  autoHealThreshold: 50, // auto-heal saat HP <= 50%
  autoSPThreshold: 50,   // auto-SP saat Stamina <= 50%
  autoAttack: false,     // Mode auto-attack aktif/nonaktif
  autoAttackSpin: true,  // Gunakan Spin Attack jika dikelilingi >= 2 musuh
  autoAttackRange: 140,  // Jarak jangkauan deteksi auto-attack (pixel)
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
    statusEffect: null,
    level: 1, exp: 0, nextExp: 20, statPoints: 0,
    stats: { str: 1, agi: 1, vit: 1 },
    attackHitDelay: [],
    tripleCooldown: 0, isTripling: 0, tripleHitDelay: [],
    height: 0, heightVelocity: 0, lastFootstep: 0,
  },

  lockedEnemy: null,
  tabCooldown: 0,

  upgrades: { hpLevel: 1, atkLevel: 1, spdLevel: 1 },
  currentWeapon: 0,
  currentArmor: 0,
  ownedWeapons: [0],
  ownedArmors: [0],
  currentHelmet: 0,
  currentBoots: 0,
  ownedHelmets: [0],
  ownedBootss: [0],
  ownedBoots: [0],

  critChance: 0.05,
  critMultiplier: 2.0,

  gold: 0,
  potions: 0,

  bountyQuest: null,
  bountyQuestProgress: 0,
  questStage: 0,
  questCompleted: [],

  // Collections (populated at runtime)
  obstaclesHometown: [],
  obstaclesWilds: [],
  wildsLoaded: false,
  hometownGroup: null,
  wildsGroup: null,

  // Scorched Dunes (wilds2) — level 10+
  wilds2Loaded: false,
  obstaclesWilds2: [],
  wilds2Group: null,
  desertPortalWilds: null,  // portal in wilds → wilds2
  desertPortalWilds2: null, // portal in wilds2 → wilds

  coinItems: [],
  expOrbs: [],
  potionItems: [],
  enemies: [],
  dyingEnemies: [],
  projectiles: [],
  particles: [],
  lootDrops: [],
  interactables: [],
  
  inventory: {},

  keys: {},

  // Boss
  bossActive: false,
  bossDefeated: false,
  bossMesh: null,
  bossHpGroup: null,
  bossHpFg: null,
  bossHp: 200,
  bossMaxHp: 200,
  bossX: 10000,
  bossY: 10500,
  bossPhase: 1,
  bossSpawnX: 10000, // Home position per active boss (Golem: map corner, Soldier: pyramid)
  bossSpawnY: 10500,
  // Phase 1: boss animation placeholder (mirrors createEnemyMixer return shape); null-safe guarded at call sites.
  bossMixer: null,
  bossActions: null,
  bossCurrentAction: null,
  bossDyingMesh: null,
  bossDyingMixer: null,

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
  autoWalkTarget: null,
  waypointMesh: null,
  auraBursts: null,

  // BGM flag
  bgmStarted: false,

  lastCrystalUse: 0,
};

