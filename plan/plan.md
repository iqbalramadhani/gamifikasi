# Rebuild 3D RPG Game — TypeScript + Vite + Babylon.js

## Context
Existing 3D top-down RPG "The Lost Kingdom" built in plain JS ES modules (`src/`, ~11.5k lines across 12 files) + Babylon.js UMD/ESM dual-hierarchy workaround, Vite dev server, Express+SQLite backend (`server.js`). User wants a clean **TypeScript rewrite from scratch** so type-checking/validation is reliable, **reusing the existing 3D assets in `public/`**, keeping Babylon.js as the engine, and **deleting the old JS engine code** (`src/` JS + `js/` legacy) once the rewrite works. `server.js` (Express+SQLite on port 3001) stays as-is.

Confirmed user decisions:
- **Keep `server.js`** backend (Express + SQLite) for save/load — not localStorage.
- **Port ALL features** faithfully (3 scenes: hometown/wilds/wilds2, all enemy types + 17 elites + 2 bosses, full combat: melee/dash/spin/triple/projectiles/AI, day-night cycle, weather, particles, pets, shop/blacksmith/stats/quests/crafting/auto-potions/minimap/full-map/auto-attack, Indonesian UI text unchanged).
- **Babylon ESM from npm** + `@babylonjs/loaders` for GLB/FBX/GLTF — no UMD `window.BABYLON`, no `containerToNode` workaround.

---

## Architecture

### Directory structure (new)
Replace the current `src/` JS files. Keep the same top-level folder name (`src/`) so Vite's default root + `index.html` entry works without reconfig, but every file becomes `.ts`. Add a `types/` folder and a `tsconfig.json` at root.

```
game/
├── index.html              ← unchanged (already has all UI markup + inline onclick)
├── style.css               ← unchanged
├── vite.config.ts          ← new (TS, dev proxy /api → :3001, Babylon loader plugin not needed)
├── tsconfig.json           ← new (strict, moduleResolution bundler, target ES2022)
├── tsconfig.node.json      ← for vite.config.ts / server.js typecheck
├── package.json            ← updated (add typescript, @types/node, @types/express, @types/cors)
├── server.js               ← UNCHANGED (Express+SQLite, CJS) — keep as-is, no typecheck needed
├── public/                 ← UNCHANGED (all GLB/FBX/GLTF assets)
├── CHANGELOG_FIXES.md      ← UNCHANGED (reference for known fixes, esp. Fix #34 UMD/ESM crash)
├── CLAUDE.md               ← update after rewrite to reflect new TS structure
├── src/                    ← rewritten in TypeScript
│   ├── main.ts             ← entry: Bootstrap, game loop, keyboard input, wiring inline HTML handlers
│   ├── types/
│   │   ├── state.ts        ← GameState interface + initial state factory
│   │   ├── entity.ts       ← Enemy, Projectile, LootDrop, Particle, Boss, Villager, Npc types
│   │   └── save.ts         ← SaveData schema (mirrors server.js columns exactly)
│   ├── constants.ts        ← all data tables (weapons, armors, enemies, loot, crafting, status fx)
│   ├── state.ts            ← `export const state: GameState = createInitialState()`
│   ├── model-loader.ts     ← GLB/FBX/GLTF loader via @babylonjs/loaders ESM only (no UMD workaround)
│   ├── scenes.ts           ← initSetup, initHometown, initMap(wilds), initWilds2, NPC/portal/terrain fns
│   ├── combat.ts           ← move, attack, dash, spin, triple, projectiles, enemy AI, boss logic
│   ├── environment.ts      ← day-night, weather, particles, pet, teleportTo, autoUsePotions, useConsumable
│   ├── ui.ts               ← HUD, minimap, full map, shop, blacksmith, stats, quests, inventory, crafting
│   ├── helpers.ts          ← blocked(), checkItems(), spawnParticles(), spawnDamageText(), spawnBoss()
│   ├── landmarks.ts        ← treasure chests, barrels, ruins, arena
│   ├── audio.ts            ← WebAudio oscillator SFX + procedural BGM (unchanged logic)
│   └── persistence.ts      ← saveGame()/loadGame() → POST/GET /api/save, /api/load (via fetch relative)
└── dist/                   ← build output
```

### TypeScript type definitions
```ts
// types/state.ts
export interface GameState {
  // Babylon engine
  scene: BABYLON.Scene | null;
  renderer: BABYLON.Engine | null;
  camera: BABYLON.UniversalCamera | null;
  dirLight: BABYLON.DirectionalLight | null;
  sceneMount: BABYLON.TransformNode | null;
  mainFloor: BABYLON.Mesh | null;
  rainParticles: BABYLON.ParticleSystem | null;

  // Player
  player: PlayerState;
  playerMesh: BABYLON.TransformNode | null;
  playerSwordMesh: BABYLON.TransformNode | null;
  playerBodyMat: BABYLON.StandardMaterial | null;
  playerBladeMat: BABYLON.StandardMaterial | null;
  playerAuraLight: BABYLON.PointLight | null;
  shieldMesh: BABYLON.Mesh | null;

  // Camera
  cameraOffsetY: number;
  cameraOffsetZ: number;
  cameraLookAtY: number;
  cameraAngle: number;
  cameraShake: number;
  zoomLevel: number;

  // Game flags
  currentScene: 'hometown' | 'wilds' | 'wilds2';
  isPaused: boolean;
  isGameStarted: boolean;
  gameOver: boolean;
  shopOpen: boolean;
  blacksmithOpen: boolean;

  // Auto-use thresholds
  autoHealThreshold: number;
  autoSPThreshold: number;
  autoAttack: boolean;
  autoAttackSpin: boolean;
  autoAttackRange: number;

  // Inventory / equipment
  inventory: Record<string, number>;
  potions: number;
  gold: number;
  crystalCount: number;
  currentWeapon: number;
  currentArmor: number;
  currentHelmet: number;
  currentBoots: number;
  ownedWeapons: number[];
  ownedArmors: number[];
  ownedHelmets: number[];
  ownedBoots: number[];
  critChance: number;
  critMultiplier: number;

  // Quests
  bountyQuest: QuestDef | null;
  bountyQuestProgress: number;
  questStage: number;
  questCompleted: number[];

  // Collections
  enemies: Enemy[];
  dyingEnemies: Enemy[];
  projectiles: Projectile[];
  particles: ParticleInstance[];
  lootDrops: LootDrop[];
  coinItems: CollectibleItem[];
  expOrbs: CollectibleItem[];
  potionItems: CollectibleItem[];
  interactables: Interactable[];
  villagers: Villager[];
  villageAnimals: VillageAnimal[];

  // Scene groups
  hometownGroup: BABYLON.TransformNode | null;
  wildsGroup: BABYLON.TransformNode | null;
  wilds2Group: BABYLON.TransformNode | null;
  wildsLoaded: boolean;
  wilds2Loaded: boolean;
  obstaclesHometown: Obstacle[];
  obstaclesWilds: Obstacle[];
  obstaclesWilds2: Obstacle[];

  // Portals / NPCs
  hometownPortal: BABYLON.Mesh | null;
  wildsPortal: BABYLON.Mesh | null;
  desertPortalWilds: BABYLON.Mesh | null;
  desertPortalWilds2: BABYLON.Mesh | null;
  shopNPC: BABYLON.TransformNode | null;
  healerNPC: BABYLON.TransformNode | null;
  blacksmithNPC: BABYLON.TransformNode | null;

  // Boss
  bossActive: boolean;
  bossDefeated: boolean;
  bossMesh: BABYLON.TransformNode | null;
  bossHpGroup: BABYLON.TransformNode | null;
  bossHpFg: BABYLON.Mesh | null;
  bossHp: number;
  bossMaxHp: number;
  bossX: number;
  bossY: number;
  bossPhase: number;
  bossSpawnX: number;
  bossSpawnY: number;

  // Misc
  keys: Record<string, boolean>;
  lockedEnemy: LockedTarget | null;
  tabCooldown: number;
  dayTime: number;
  lastTimestamp: number;
  lastCrystalUse: number;
  petActive: boolean;
  petMesh: BABYLON.TransformNode | null;
  petAngle: number;
  autoWalkTarget: { x: number; y: number } | null;
  waypointMesh: BABYLON.Mesh | null;
  auraBursts: BABYLON.TransformNode | null;
  bgmStarted: boolean;
}

export interface PlayerState {
  x: number; y: number; r: number; speed: number;
  hp: number; maxHp: number; stamina: number; maxStamina: number;
  attackDamage: number;
  facingX: number; facingY: number;
  lastFacingX: number; lastFacingY: number;
  attackCooldown: number; attackHitDelay: number[];
  dashCooldown: number; spinCooldown: number; tripleCooldown: number;
  isDashing: number; isSpinning: number; spinAngle: number; isTripling: number; tripleHitDelay: number[];
  height: number; heightVelocity: number;
  defending: boolean;
  statusEffect: StatusEffectInstance | null;
  walkCycle: number;
  lastFootstep: number;
  level: number; exp: number; nextExp: number;
  statPoints: number;
  stats: { str: number; agi: number; vit: number };
}

export interface Enemy {
  x: number; y: number; r: number; hp: number; maxHp: number;
  speed: number; damage: number;
  typeStr: string; isFlying: boolean;
  charKey: string;
  isElite: boolean;
  elite?: EliteTemplate;
  mesh: BABYLON.TransformNode;
  auraMesh?: BABYLON.Mesh;
  crownMesh?: BABYLON.Mesh;
  eliteLight?: BABYLON.PointLight;
  statusEffect?: StatusEffectInstance;
  dying?: boolean;
  deathTimer?: number;
  // AI
  state: 'idle' | 'chase' | 'detour' | 'dying';
  detourAngle?: number;
  detourTimer?: number;
  attackTimer?: number;
  projectileTimer?: number;
  // animation
  mixer: EnemyMixer;
  actions: Record<string, AnimAction>;
  currentAction: AnimAction | null;
  currentActionName: string;
}
```

### `types/save.ts` — mirrors server.js columns exactly
```ts
export interface SaveData {
  x: number; y: number;
  hp: number; maxHp: number; attackDamage: number;
  gold: number; potions: number; crystalCount: number;
  currentWeapon: number; currentArmor: number;
  currentHelmet: number; currentBoots: number;
  ownedWeapons: string; ownedArmors: string;
  ownedHelmets: string; ownedBoots: string;
  level: number; exp: number; nextExp: number;
  camera_y: number; camera_z: number; camera_look_y: number;
  inventory: string;
  statPoints: number;
  stats: { str: number; agi: number; vit: number };
  bountyQuest: string | null;
  bountyQuestProgress: number;
  lastCrystalUse: number;
  current_scene: string;
  critChance: number; critMultiplier: number;
  questStage: number; questCompleted: string;
  autoHealThreshold: number; autoSPThreshold: number;
  autoAttack: number; autoAttackSpin: number; autoAttackRange: number;
}
```

---

## Model loader (key design decision)
**No UMD.** Both `babylonjs` and `@babylonjs/loaders` come from npm as ESM. `registerBuiltInLoaders()` from `@babylonjs/loaders` is still required (Babylon v9 change). No `UMDTransformNode`/`UMDMesh` wrapper needed — just use `BABYLON.TransformNode` directly, since there's only one class hierarchy now.

```ts
// model-loader.ts
import * as BABYLON from 'babylonjs';
import { registerBuiltInLoaders } from '@babylonjs/loaders';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import { state } from './state';

registerBuiltInLoaders();

export type ModelKey = 'player' | 'sword' | /* ... */ 'arena_soldier';
export const loadedModels: Record<ModelKey, BABYLON.TransformNode | null> = { /* all keys */ };

async function loadModel(key: ModelKey, url: string, isFbx = false) {
  if (!state.scene) return;
  const container = await LoadAssetContainerAsync(url, state.scene, {
    rootUrl: '',
    ...(isFbx ? { pluginExtension: 'fbx' } : {}),
  }).catch(err => {
    console.warn(`[model-loader] Failed: ${key} (${url})`, err);
    return null;
  });
  if (!container || !container.meshes || container.meshes.length === 0) return;
  const root = new BABYLON.TransformNode(`${key}_root`, state.scene);
  for (const mesh of container.meshes) mesh.parent = root;
  root.setEnabled(false);
  (loadedModels as any)[key] = root;
}

export async function loadAllModels(): Promise<void> {
  const gltf: [ModelKey, string][] = [/* modelsToLoad list, unchanged */];
  const fbx: [ModelKey, string][] = [/* fbxModelsToLoad list, unchanged */];
  await Promise.all([
    ...gltf.map(([k, url]) => loadModel(k, url, false)),
    ...fbx.map(([k, url]) => loadModel(k, url, true)),
  ]);
}
```
Skeletal animation (`createEnemyMixer`) stays a no-op stub, same as Phase 1 — no change.

---

## Vite config
```ts
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://localhost:3001',   // forward /api/* to Express backend in dev
    },
    port: 5173,
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,                 // don't inline assets, keep them in public/
  },
  // No plugin needed for Babylon — it's a regular npm package, not a CSS module
});
```

### `persistence.ts` change
Replace hardcoded `http://localhost:3001` with **relative** `fetch('/api/save')` and `fetch('/api/load')`. Vite's dev proxy handles routing to `localhost:3001` in dev; in production the Express server can be run on port 3001 and Vite's static build can be served by it, or the fetch is relative to whatever port the frontend runs on. No CORS issues since we use the proxy in dev.

---

## tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "dist",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "preserve"
  },
  "include": ["src/**/*.ts", "src/**/*.d.ts", "vite-env.d.ts"],
  "exclude": ["node_modules", "dist"]
}
```

### `vite-env.d.ts`
```ts
/// <reference types="vite/client" />
```

### `tsconfig.node.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "strict": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["vite.config.ts"]
}
```

---

## `package.json` updates
```json
{
  "dependencies": {
    "babylonjs": "^9.29.0",
    "@babylonjs/loaders": "^9.29.0",
    "express": "^5.2.1",
    "sqlite3": "^6.0.1",
    "cors": "^2.8.6"
  },
  "devDependencies": {
    "vite": "^8.3.0",
    "typescript": "^5.5.0",
    "@types/node": "^22.0.0",
    "@types/express": "^5.0.0",
    "@types/cors": "^2.8.0",
    "@types/babylonjs": "*"
  },
  "scripts": {
    "dev": "vite",
    "server": "node --watch server.js",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit -p tsconfig.json"
  }
}
```
Note: `ci` and `jsdom` can be removed from dependencies (not used). `@types/babylonjs` may not be a real npm package — Babylon ships its own types in `babylonjs` package, so omit it if types are already bundled.

---

## Inline HTML handler wiring strategy
**Keep the inline `onclick="functionName()"` pattern in `index.html`** (lowest risk for a 2400-line ui.js port; no refactor of HTML markup needed). `main.ts` assigns the ~40 functions to `window.*` exactly as `main.js` does today, using a small typed `Window` extension:

```ts
// main.ts
declare global {
  interface Window {
    startGame: () => Promise<void>;
    saveGame: (isAuto?: boolean) => void;
    openSettings: () => void;
    toggleAutoAttack: () => void;
    // ... all ~40 functions
  }
}
```
This makes tsc catch any missing handler assignments and gives IDE autocomplete.

---

## Phased delivery (playable at each checkpoint)

### Phase 1 — Scaffold + Engine + Hometown + Basic Movement
- Create `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `vite-env.d.ts`
- Create `src/types/state.ts`, `src/types/entity.ts`, `src/types/save.ts`
- Create `src/constants.ts` (port all data tables verbatim)
- Create `src/state.ts` (typed initial state)
- Create `src/model-loader.ts` (ESM only, no UMD workaround)
- Create `src/helpers.ts` (blocked, spawnParticles, spawnDamageText)
- Create `src/scenes.ts` (initSetup + initHometown only)
- Create `src/combat.ts` (move + attack + basic enemy spawn/update, no boss yet)
- Create `src/audio.ts` (unchanged logic, typed)
- Create `src/main.ts` (entry: init Babylon, game loop, keyboard handlers, wire all `window.*` handlers that the home page needs)
- **Checkpoint:** `npm run dev` + `node server.js` → move player with WASD in hometown, attack nearby enemies, see HUD update. `tsc --noEmit` clean.

### Phase 2 — Full Combat + Wilds + Wilds2 + Boss
- Port `combat.ts` fully: dash, spin, triple, projectiles, elite spawn logic, detour AI, all enemy types (archer/mage/kamikaze/golem/ghost/slime/warrior + sc_* + flying)
- Port `updateBoss` (Golden Golem + Centurion), phase 2 at 50% HP, ground pound/projectile/spear
- Port `scenes.ts`: `initMap` (wilds), `initWilds2` (desert), `initWildsNPCs`, `initEntities`, portal placement, terrain height functions
- Port `environment.ts`: `teleportTo` (scene switching), `updateDayNightCycle`, `updateWeather`, `updateParticles`, `updatePet`
- Port `landmarks.ts`
- **Checkpoint:** travel between all 3 scenes via portals, fight boss in wilds and wilds2, see day-night cycle, rain in wilds. `tsc --noEmit` clean.

### Phase 3 — Full UI + Shop + Quests + Crafting + Persistence
- Port `ui.ts` fully: minimap, full map + waypoint auto-walk, shop (buy/sell/potion/mystery box), blacksmith (weapon/armor/helmet/boot upgrade), stats + level-up, quest board (3 stages + bounty), inventory/crafting, auto-potion/auto-attack settings
- Port `persistence.ts` (typed SaveData, relative `/api/save` + `/api/load` fetch)
- Port remaining `main.ts` sections: `loadGame()` call on startup, auto-save timer
- **Checkpoint:** buy equipment, complete quests, craft items, save/load game via `server.js`, auto-potions and auto-attack work. `tsc --noEmit` clean.

### Phase 4 — Polish + Cleanup
- Port `landmarks.ts` fully (treasure chests, explosive barrels, mystic ruin, arena ruin)
- Verify all `public/` asset references still resolve (no 404s in browser console)
- **Delete old JS files:** `src/audio.js`, `src/combat.js`, `src/constants.js`, `src/environment.js`, `src/helpers.js`, `src/landmarks.js`, `src/main.js`, `src/model-loader.js`, `src/persistence.js`, `src/scenes.js`, `src/state.js`, `src/ui.js`
- **Delete legacy folder:** `js/` (8 files)
- **Delete scratch files:** `test.js`, `test-blocked.js`, `test_glb.js`
- **Delete** `dist/` (stale build)
- Keep: `public/`, `server.js`, `game_save.sqlite`, `CHANGELOG_FIXES.md`, `CHANGELOG.md`, `CLAUDE.md`, `documentation.md`, `AI_CODING_GUIDE.md`, `edit_scenes.py`, `lazy_load.py` (reference/legacy tools)
- Update `CLAUDE.md` to reflect new TS structure and remove references to `js/` legacy folder
- **Final verification:**
  - `npx tsc --noEmit` → zero errors
  - `npm run build` → clean production build to `dist/`
  - `npm run dev` + `node server.js` → full game playable in browser
  - Browser test: play through all 3 scenes, defeat both bosses, test save/load round-trip, open shop/blacksmith/quest board/crafting/auto-potion settings, use minimap + full map + waypoint, trigger auto-attack mode

---

## Files to modify/create
| File | Action |
|---|---|
| `vite.config.ts` | create |
| `tsconfig.json` | create |
| `tsconfig.node.json` | create |
| `vite-env.d.ts` | create |
| `package.json` | update (add typescript, @types/*; remove ci, jsdom) |
| `src/types/state.ts` | create |
| `src/types/entity.ts` | create |
| `src/types/save.ts` | create |
| `src/constants.ts` | create (from constants.js) |
| `src/state.ts` | create (from state.js, typed) |
| `src/model-loader.ts` | create (ESM-only, no UMD) |
| `src/helpers.ts` | create (from helpers.js) |
| `src/scenes.ts` | create (from scenes.js) |
| `src/combat.ts` | create (from combat.js) |
| `src/environment.ts` | create (from environment.js) |
| `src/landmarks.ts` | create (from landmarks.js) |
| `src/audio.ts` | create (from audio.js) |
| `src/ui.ts` | create (from ui.js) |
| `src/persistence.ts` | create (from persistence.js, relative URL) |
| `src/main.ts` | create (from main.js) |
| `src/*.js` (12 files) | **delete** after Phase 4 verification |
| `js/` (8 files) | **delete** |
| `test.js`, `test-blocked.js`, `test_glb.js` | **delete** |
| `dist/` | **delete** (stale) |

## Files unchanged
| File | Reason |
|---|---|
| `index.html` | Already has all UI markup; no changes needed (inline onclick pattern preserved) |
| `style.css` | No CSS changes needed |
| `public/` | All 3D assets, no changes |
| `server.js` | Express+SQLite backend, CJS, no changes |
| `game_save.sqlite` | Existing save data, no changes |
| `CHANGELOG_FIXES.md` | Historical fix log, reference only |
| `CLAUDE.md` | Update in Phase 4 |

---

## Top 3 Risks & Mitigations
1. **`ui.ts` port (2417 lines)** — highest volume, most tightly coupled to `state` + `combat` + `constants` + DOM. Mitigation: port it last (Phase 3), after combat + persistence are solid; run `tsc --noEmit` after every sub-block; the ~40 `window.*` handler assignments are already enumerated in `main.js` so they're mechanical.
2. **Model loader UMD→ESM migration** — must NOT reintroduce the "class hierarchy crash" documented in CHANGELOG_FIXES.md Fix #34. Mitigation: use `registerBuiltInLoaders()` from `@babylonjs/loaders` + `BABYLON.TransformNode` from `babylonjs` npm (both same ESM hierarchy), no `window.BABYLON` global, no UMD wrapper. This eliminates the root cause of Fix #34 entirely.
3. **Vite proxy vs. production** — dev proxy handles `/api` → `:3001` cleanly, but production build doesn't have a proxy. Mitigation: `persistence.ts` uses relative `/api/save` + `/api/load`; in production the user runs `npm run build` + serves `dist/` on a port alongside `server.js` (or the Express server can serve `dist/` — note this as a TODO but out of scope).
