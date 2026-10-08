// Shared type definitions for The Lost Kingdom 3D
import type {
  Engine,
  Scene,
  UniversalCamera,
  TransformNode,
  Mesh,
  StandardMaterial,
  DirectionalLight,
  ParticleSystem,
  PointLight,
  AnimationGroup,
} from '@babylonjs/core';

export type SceneName = 'hometown' | 'wilds' | 'wilds2';
export type StatusEffectType = 'poison' | 'burn';

export interface StatusEffectInstance {
  type: StatusEffectType;
  damage: number;
  duration: number;
  tickTimer: number;
}

export interface PlayerStats {
  str: number;
  agi: number;
  vit: number;
}

export interface PlayerState {
  x: number;
  y: number;
  r: number;
  speed: number;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  attackDamage: number;
  facingX: number;
  facingY: number;
  attackCooldown: number;
  attackHitDelay: number[];
  defending: boolean;
  walkCycle: number;
  dashCooldown: number;
  spinCooldown: number;
  isDashing: number;
  isSpinning: number;
  spinAngle: number;
  statusEffect: StatusEffectInstance | null;
  level: number;
  exp: number;
  nextExp: number;
  statPoints: number;
  stats: PlayerStats;
  tripleCooldown: number;
  isTripling: number;
  tripleHitDelay: number[];
  height: number;
  heightVelocity: number;
  lastFootstep: number;
}

// ── Animation layer stubs (Phase 1: no-op, mirrors createEnemyMixer shape) ──
export interface AnimAction {
  fadeIn(d: number): AnimAction;
  fadeOut(d: number): AnimAction;
  play(): AnimAction;
  stop(): AnimAction;
  reset(): AnimAction;
  setLoop(): AnimAction;
  isRunning(): boolean;
  getClip(): AnimationGroup | null;
  time: number;
  timeScale: number;
  clampWhenFinished: boolean;
}

export interface AnimMixer {
  update(dt: number): void;
  stopAllAction(): void;
  uncacheRoot(): void;
}

export interface EnemyActionSet {
  walk?: AnimAction;
  idle?: AnimAction;
  attack?: AnimAction;
  hit?: AnimAction;
  death?: AnimAction;
  [key: string]: AnimAction | undefined;
}

export interface Enemy {
  x: number;
  y: number;
  r: number;
  meshY: number;
  dx: number;
  dy: number;
  hp: number;
  maxHp: number;
  baseSpeed: number;
  damage: number;
  mesh: TransformNode | Mesh;
  hpGroup: TransformNode;
  hpFg: Mesh;
  mixer: AnimMixer | null;
  actions: EnemyActionSet | null;
  currentAction: AnimAction | null;
  currentActionName: string | null;
  stunTimer: number;
  slowTimer: number;
  type: string;
  attackTimer: number;
  walkCycle: number;
  limbs: Partial<Record<'leg-left' | 'leg-right' | 'arm-left' | 'arm-right', TransformNode>>;
  isBossChild: boolean;
  isFlying: boolean;
  tier?: number;
  age: number;
  isElite: boolean;
  elite: EliteTemplate | null;
  auraMesh: Mesh | null;
  crownMesh: Mesh | null;
  eliteLight?: PointLight | null;
  hpBarWidth: number;
  _announced: boolean;
  hazardTimer: number;
  pauseTimer: number;
  detourTimer: number;
  detourAngle: number;
  stuckCounter: number;
  lastX: number;
  lastY: number;
  statusEffect?: StatusEffectInstance | null;
  dying?: boolean;
  deathTimer?: number;
  // ── Fields mutated at runtime by combat.ts AI logic ──
  actionState?: 'idle' | 'chase' | 'attack' | 'detour' | 'dying';
  attackAnimTimer?: number;
  hasDealtDamage?: boolean;
  attackCooldown?: number;
  rangedAttackResetTimer?: number;
  _berserkApplied?: boolean;
}

export interface Projectile {
  x: number;
  y: number;
  dx: number;
  dy: number;
  mesh: Mesh;
  isEnemy: boolean;
  isPet?: boolean;
  isBoss?: boolean;
  damage?: number;
  radius?: number;
  type?: string;
  colorHex?: string;
  life?: number;
}

export interface Obstacle {
  x: number;
  y: number;
  r: number;
  h?: number;
}

export interface CollectibleItem {
  x: number;
  y: number;
  mesh: Mesh;
  taken: boolean;
  type: string;
}

export interface LootDrop {
  x: number;
  y: number;
  mesh: Mesh;
  taken: boolean;
  type: string;
  item?: { id: string; name: string; value: number; color: number; icon: string };
}

export interface Interactable {
  type: string;
  x: number;
  y: number;
  mesh: TransformNode | Mesh;
  hp?: number;
  scene: SceneName;
  looted?: boolean;
  exploded?: boolean;
  isVFX?: boolean;
}

export interface ParticleInstance {
  mesh: Mesh;
  dx: number;
  dy: number;
  dz: number;
  life: number;
  decay: number;
}

export interface Villager {
  id: string;
  name: string;
  role: string;
  modelKey: string;
  x: number;
  z: number;
  mesh: TransformNode | null;
  patrol: Array<{ x: number; z: number }>;
  patrolIdx: number;
  speed: number;
  walkCycle: number;
  speech: string[];
  legL: TransformNode | null;
  legR: TransformNode | null;
  armL: TransformNode | null;
  armR: TransformNode | null;
  head: TransformNode | null;
  talking?: boolean;
  talkTimer?: number;
  currentTarget?: { x: number; z: number } | null;
  waitTimer?: number;
  walkSpeed?: number;
  bobOffset?: number;
  baseY?: number;
}

export interface VillageAnimal {
  type: 'dog' | 'chicken';
  name?: string;
  x: number;
  z: number;
  mesh: TransformNode & { tail?: Mesh; head?: TransformNode };
  angle?: number;
  speed?: number;
  center?: { x: number; y: number };
  radius?: number;
  headingOffset?: number;
  barkTimer?: number;
  cluckTimer?: number;
  peckTimer?: number;
}

/** Decorative portal made of torus ring + disc + beam + ribbons + light. */
export interface Portal {
  group: TransformNode;
  ring: Mesh;
  disc: Mesh;
  beam: Mesh;
  ribbons: Mesh[];
  color: number;
}

export interface SwordScale {
  x: number;
  y: number;
  z: number;
}

// ── Portal-ribbon animation data (attached to ribbon meshes as a property) ──
export interface PortalAnimData {
  offsetY: number;
  speed: number;
  scalePhase: number;
  baseOffset: number;
}

export interface NpcDef {
  mesh: TransformNode;
  name: string;
  dialogue: string[];
  walkTimer: number;
  walkTargetX: number;
  walkTargetY: number;
  isMoving: boolean;
  type: string;
  x?: number;
  y?: number;
}

// ── Data-table shapes (constants.ts) ──
export interface WeaponDef {
  name: string;
  damage: number;
  cost: number;
  color: number;
  minLevel: number;
}

export interface ArmorDef {
  name: string;
  hp: number;
  cost: number;
  color: number;
  minLevel: number;
}

export interface BootDef {
  name: string;
  speed: number;
  cost: number;
  color: number;
  minLevel: number;
}

export interface EnemyTemplate {
  hp: number;
  speed: number;
  r: number;
  damage: number;
  typeStr: string;
  charKey: string;
  isFlying?: boolean;
}

export interface EliteTemplate {
  name: string;
  title: string;
  auraColor: number;
  scaleBonus: number;
  hpMultiplier: number;
  damageMultiplier: number;
  speedMultiplier: number;
  ability: string;
  bonusGold: number;
  bonusExp: number;
  icon: string;
}

export interface LootDef {
  id: string;
  name: string;
  value: number;
  color: number;
  icon: string;
}

export interface ConsumableDef {
  id: string;
  name: string;
  icon: string;
  effect: string;
  value: number;
  cooldown: number;
}

export interface CraftingRecipe {
  result: string;
  count: number;
  ingredients: Record<string, number>;
}

// ── Save schema: mirrors server.js column list exactly ──
// If a field is added here it must ALSO be added to server.js
// (ALTER TABLE + UPDATE + INSERT) — see CLAUDE.md "save/load DB schema gotcha"
export interface SaveData {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  attackDamage: number;
  gold: number;
  potions: number;
  crystalCount: number;
  currentWeapon: number;
  currentArmor: number;
  currentHelmet: number;
  currentBoots: number;
  ownedWeapons: string;
  ownedArmors: string;
  ownedHelmets: string;
  ownedBoots: string;
  level: number;
  exp: number;
  nextExp: number;
  camera_y: number;
  camera_z: number;
  camera_look_y: number;
  current_scene: string;
  inventory: string;
  statPoints: number;
  stats: PlayerStats;
  bountyQuest: string | null;
  bountyQuestProgress: number;
  lastCrystalUse: number;
  critChance: number;
  critMultiplier: number;
  questStage: number;
  questCompleted: string;
  autoHealThreshold: number;
  autoSPThreshold: number;
  autoAttack: number;
  autoAttackSpin: number;
  autoAttackRange: number;
}

export interface SaveResponse {
  success: boolean;
  data?: SaveData;
  message?: string;
}
