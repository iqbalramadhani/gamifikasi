// Shared mutable game state — imported by all modules that need to read/write it.
// Modules read from `state` instead of using bare `let` variables.
import type {
  Enemy,
  Projectile,
  Obstacle,
  LootDrop,
  CollectibleItem,
  Interactable,
  ParticleInstance,
  Villager,
  VillageAnimal,
  NpcDef,
  Portal,
  SwordScale,
  PlayerState,
  SceneName,
  EliteTemplate,
} from './types';

// Babylon types are imported as `import type` where possible; the actual
// values live in @babylonjs/core and are accessed via `state.scene` etc.
// We use `any` for Babylon node refs here to avoid a circular type dep at
// the module level; strict null-checks are enforced at every call site.

export type ModelKey = string;
export type SceneRef = any; // Babylon Scene (imported lazily in scenes.ts)
export type EngineRef = any; // Babylon Engine
export type CameraRef = any; // Babylon UniversalCamera
export type TransformNodeRef = any; // Babylon TransformNode
export type MeshRef = any; // Babylon Mesh
export type MatRef = any; // Babylon StandardMaterial
export type LightRef = any; // Babylon DirectionalLight
export type ParticleSysRef = any; // Babylon ParticleSystem

export interface QuestDef {
  id: number;
  title: string;
  desc: string;
  target: number;
  enemyType: string;
  goldReward: number;
  expReward: number;
}

export interface GameState {
  // ── Babylon engine refs ──
  scene: SceneRef;
  sceneMount: TransformNodeRef;
  camera: CameraRef;
  renderer: EngineRef;
  dirLight: LightRef;
  composer: null;
  controls: null;
  mainFloor: MeshRef;

  // ── Player mesh refs ──
  playerMesh: TransformNodeRef;
  shieldMesh: MeshRef;
  altarCrystal: TransformNodeRef;
  rainParticles: ParticleSysRef;

  // ── GLTF model refs ──
  gltfPlayerRef: TransformNodeRef;
  playerLegL: TransformNodeRef;
  playerLegR: TransformNodeRef;
  playerArmL: TransformNodeRef;
  playerArmR: TransformNodeRef;
  playerBodyMat: MatRef;
  playerBladeMat: MatRef;
  playerSwordMesh: TransformNodeRef;
  playerAuraLight: LightRef;
  playerMixer: null;
  playerActions: Record<string, any>;
  activeAction: null;
  playerMixer_: null; // extra placeholder

  // ── Camera presets ──
  cameraOffsetY: number;
  cameraOffsetZ: number;
  cameraLookAtY: number;
  cameraAngle: number;
  cameraShake: number;
  zoomLevel: number;

  // ── Game logic flags ──
  currentScene: SceneName;
  isPaused: boolean;
  isGameStarted: boolean;
  gameOver: boolean;
  autoHealThreshold: number;
  autoSPThreshold: number;
  autoAttack: boolean;
  autoAttackSpin: boolean;
  autoAttackRange: number;
  shopOpen: boolean;
  blacksmithOpen: boolean;
  shopCooldown: number;

  // ── Player stats ──
  player: PlayerState;

  // ── Targeting ──
  lockedEnemy: Enemy | null;
  tabCooldown: number;

  // ── Upgrades ──
  upgrades: { hpLevel: number; atkLevel: number; spdLevel: number };

  // ── Equipment ──
  currentWeapon: number;
  currentArmor: number;
  ownedWeapons: number[];
  ownedArmors: number[];
  currentHelmet: number;
  currentBoots: number;
  ownedHelmets: number[];
  ownedBoots: number[];

  critChance: number;
  critMultiplier: number;

  gold: number;
  potions: number;
  crystalCount: number;

  // ── Quests ──
  bountyQuest: QuestDef | null;
  bountyQuestProgress: number;
  questStage: number;
  questCompleted: number[];

  // ── Scene collections ──
  obstaclesHometown: Obstacle[];
  obstaclesWilds: Obstacle[];
  wildsLoaded: boolean;
  hometownGroup: TransformNodeRef;
  wildsGroup: TransformNodeRef;

  // ── Wilds2 ──
  wilds2Loaded: boolean;
  obstaclesWilds2: Obstacle[];
  wilds2Group: TransformNodeRef;
  desertPortalWilds: MeshRef;
  desertPortalWilds2: MeshRef;

  // ── Entity collections ──
  coinItems: CollectibleItem[];
  expOrbs: CollectibleItem[];
  potionItems: CollectibleItem[];
  enemies: Enemy[];
  dyingEnemies: Enemy[];
  projectiles: Projectile[];
  particles: ParticleInstance[];
  lootDrops: LootDrop[];
  interactables: Interactable[];

  inventory: Record<string, number>;
  keys: Record<string, boolean>;

  // ── Boss ──
  bossActive: boolean;
  bossDefeated: boolean;
  bossMesh: TransformNodeRef;
  bossHpGroup: TransformNodeRef;
  bossHpFg: MeshRef;
  bossHp: number;
  bossMaxHp: number;
  bossX: number;
  bossY: number;
  bossPhase: number;
  bossSpawnX: number;
  bossSpawnY: number;
  bossMixer: null;
  bossActions: null;
  bossCurrentAction: null;
  bossDyingMesh: TransformNodeRef;
  bossDyingMixer: null;
  bossReturning?: boolean;
  bossDeathTimer?: number;
  bossAttackTimer?: number;
  bossAttackAnimTimer?: number;
  _spawnTimer?: number;

  // ── Weather / time ──
  dayTime: number;
  lastTimestamp: number;
  lastFacingX: number;
  lastFacingY: number;
  playerIdleBreath: number;

  // ── Pet ──
  petActive: boolean;
  petMesh: TransformNodeRef;
  petAngle: number;

  // ── Map / portals / NPCs ──
  hometownPortal: Portal | null;
  wildsPortal: Portal | null;
  shopNPC: NpcDef | null;
  healerNPC: NpcDef | null;
  blacksmithNPC: NpcDef | null;
  innNPC: TransformNodeRef | null;
  autoWalkTarget: { x: number; y: number } | null;
  waypointMesh: MeshRef;
  auraBursts: TransformNodeRef;

  // ── Villagers / animals (hometown) ──
  villagers: Villager[];
  villageAnimals: VillageAnimal[];
  villagerWalkTargets: Array<{ x: number; y: number }>;
  questBoardPos: { x: number; z: number };
  innSignPos: { x: number; z: number };
  swordBaseScale: SwordScale | null;

  // ── Player HP bar refs ──
  playerHpGroup: TransformNodeRef;
  playerHpFg: MeshRef;

  // ── BGM ──
  bgmStarted: boolean;
  bgmEnabled: boolean;

  lastCrystalUse: number;
}

export function createInitialState(): GameState {
  return {
    scene: null,
    sceneMount: null,
    camera: null,
    renderer: null,
    dirLight: null,
    composer: null,
    controls: null,
    mainFloor: null,

    playerMesh: null,
    shieldMesh: null,
    altarCrystal: null,
    rainParticles: null,

    gltfPlayerRef: null,
    playerLegL: null,
    playerLegR: null,
    playerArmL: null,
    playerArmR: null,
    playerBodyMat: null,
    playerBladeMat: null,
    playerSwordMesh: null,
    playerAuraLight: null,
    playerMixer: null,
    playerActions: {},
    activeAction: null,
    playerMixer_: null,

    cameraOffsetY: 150,
    cameraOffsetZ: 200,
    cameraLookAtY: 10,
    cameraAngle: 0,
    cameraShake: 0,
    zoomLevel: 200,

    currentScene: 'hometown',
    isPaused: false,
    isGameStarted: false,
    gameOver: false,
    autoHealThreshold: 50,
    autoSPThreshold: 50,
    autoAttack: false,
    autoAttackSpin: true,
    autoAttackRange: 140,
    shopOpen: false,
    blacksmithOpen: false,
    shopCooldown: 0,

    player: {
      x: 500,
      y: 800,
      r: 16,
      speed: 4.5,
      hp: 100,
      maxHp: 100,
      stamina: 100,
      maxStamina: 100,
      attackDamage: 1,
      facingX: 1,
      facingY: 0,
      attackCooldown: 0,
      defending: false,
      walkCycle: 0,
      dashCooldown: 0,
      spinCooldown: 0,
      isDashing: 0,
      isSpinning: 0,
      spinAngle: 0,
      statusEffect: null,
      level: 1,
      exp: 0,
      nextExp: 20,
      statPoints: 0,
      stats: { str: 1, agi: 1, vit: 1 },
      attackHitDelay: [],
      tripleCooldown: 0,
      isTripling: 0,
      tripleHitDelay: [],
      height: 0,
      heightVelocity: 0,
      lastFootstep: 0,
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
    ownedBoots: [0],

    critChance: 0.05,
    critMultiplier: 2.0,

    gold: 0,
    potions: 0,
    crystalCount: 0,

    bountyQuest: null,
    bountyQuestProgress: 0,
    questStage: 0,
    questCompleted: [],

    obstaclesHometown: [],
    obstaclesWilds: [],
    wildsLoaded: false,
    hometownGroup: null,
    wildsGroup: null,

    wilds2Loaded: false,
    obstaclesWilds2: [],
    wilds2Group: null,
    desertPortalWilds: null,
    desertPortalWilds2: null,

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
    bossSpawnX: 10000,
    bossSpawnY: 10500,
    bossMixer: null,
    bossActions: null,
    bossCurrentAction: null,
    bossDyingMesh: null,
    bossDyingMixer: null,

    dayTime: 0,
    lastTimestamp: 0,
    lastFacingX: 1,
    lastFacingY: 0,
    playerIdleBreath: 0,

    petActive: true,
    petMesh: null,
    petAngle: 0,

    hometownPortal: null,
    wildsPortal: null,
    shopNPC: null,
    healerNPC: null,
    blacksmithNPC: null,
    innNPC: null,
    autoWalkTarget: null,
    waypointMesh: null,
    auraBursts: null,

    villagers: [],
    villageAnimals: [],
    villagerWalkTargets: [],
    questBoardPos: { x: 0, z: 0 },
    innSignPos: { x: 0, z: 0 },
    swordBaseScale: null,

    playerHpGroup: null,
    playerHpFg: null,

    bgmStarted: false,
    bgmEnabled: true,

    lastCrystalUse: 0,
  };
}

export const state: GameState = createInitialState();
