// "babylonjs" is the monolithic UMD bundle (window.BABYLON).
// All scene/node creation in scenes.js / combat.js uses `new BABYLON.TransformNode()`
// etc. from the UMD bundle. @babylonjs/loaders (ESM) loads GLTF/FBX via
// @babylonjs/core ESM classes. The two class hierarchies are incompatible —
// re-parenting an ESM Mesh to a UMD TransformNode corrupts internal child arrays.
//
// containerToNode() therefore builds an ESM TransformNode root, and the caller
// (scenes.js cloneModel) uses that ESM node. All node clones produced by
// .clone() are ESM instances, and when added to the UMD Scene they're
// registered into the UMD scene's node arrays via duck-typing (no instanceof
// gate in addMesh/addTransformNode), so they render correctly.
import "babylonjs";
import { registerBuiltInLoaders } from "@babylonjs/loaders";
registerBuiltInLoaders(); // v9: no longer auto-registered on import — explicit call required
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader.js";
import { TransformNode as ESMTransformNode } from "@babylonjs/core/Meshes/transformNode.js";
export { ESMTransformNode }; // re-export so other modules can create ESM nodes
import { state } from "./state.js";

// Phase 1 note: animation skeleton layer is not ported yet (that's Phase 2).
// `createEnemyMixer` below returns a null-safe, no-op shape matching the
// original Three.js AnimationMixer/Action API surface so that all existing
// call sites (`e.mixer.update`, `actions.walk.fadeIn(...)`, etc.) keep
// working without crashing — they simply do nothing visually in Phase 1.

export const loadedModels = {
  player: null, sword: null, enemy: null, tree: null, house: null,
  player_model: null, idle_anim: null, run_anim: null, attack_anim: null,
  tree_high: null, plant: null, fence: null,
  building_struct: null, building_roof: null, building_platform: null,
  rocks_high: null, rocks_low: null, stones: null,
  target: null, patch_dirt: null, tent: null,
  char_a: null, char_b: null, char_c: null, char_d: null,
  char_e: null, char_f: null, char_g: null,
  char_h: null, char_i: null, char_j: null,
  char_k: null, char_l: null, char_m: null,
  char_n: null, char_o: null, char_p: null,
  char_q: null, char_r: null,
  blob_alien: null, blob_birb: null, blob_cactoro: null,
  blob_green: null, blob_green_spiky: null, blob_mushnub: null,
  blob_pink: null, blob_yeti: null,
  fly_dragon: null, fly_ghost: null, fly_squidle: null,
  // Kenney Mini Arena pack
  arena_wall: null, arena_wall_corner: null, arena_wall_gate: null,
  arena_border: null, arena_border_corner: null, arena_column: null,
  arena_column_damaged: null, arena_stairs: null, arena_stairs_corner: null,
  arena_floor_detail: null, arena_banner: null, arena_statue: null,
  arena_trophy: null, arena_tree: null, arena_bricks: null,
  arena_block: null, arena_weapon_rack: null, arena_weapon_sword: null,
  arena_weapon_spear: null, arena_soldier: null,
};

const modelsToLoad = [
  { key: "player",     url: "/models/player.glb" },
  { key: "sword",      url: "/models/weapon-arrow.glb" },
  { key: "enemy",      url: "/models/enemy.glb" },
  { key: "tree",       url: "/models/tree.glb" },
  { key: "tree_high",  url: "/models/tree-high.glb" },
  { key: "plant",      url: "/models/plant.glb" },
  { key: "house",      url: "/models/house.glb" },
  { key: "fence",      url: "/models/fence.glb" },
  { key: "building_struct",    url: "/models/building-structure.glb" },
  { key: "building_roof",      url: "/models/building-roof.glb" },
  { key: "building_platform",  url: "/models/building-platform.glb" },
  { key: "rocks_high", url: "/models/rocks-high.glb" },
  { key: "rocks_low",  url: "/models/rocks-low.glb" },
  { key: "stones",     url: "/models/stones.glb" },
  { key: "target",     url: "/models/target.glb" },
  { key: "patch_dirt", url: "/models/patch-dirt.glb" },
  { key: "char_a", url: "/kenney_blocky-characters_20/Models/GLB format/character-a.glb" },
  { key: "char_b", url: "/kenney_blocky-characters_20/Models/GLB format/character-b.glb" },
  { key: "char_c", url: "/kenney_blocky-characters_20/Models/GLB format/character-c.glb" },
  { key: "char_d", url: "/kenney_blocky-characters_20/Models/GLB format/character-d.glb" },
  { key: "char_e", url: "/kenney_blocky-characters_20/Models/GLB format/character-e.glb" },
  { key: "char_f", url: "/kenney_blocky-characters_20/Models/GLB format/character-f.glb" },
  { key: "char_g", url: "/kenney_blocky-characters_20/Models/GLB format/character-g.glb" },
  { key: "char_h", url: "/kenney_blocky-characters_20/Models/GLB format/character-h.glb" },
  { key: "char_i", url: "/kenney_blocky-characters_20/Models/GLB format/character-i.glb" },
  { key: "char_j", url: "/kenney_blocky-characters_20/Models/GLB format/character-j.glb" },
  { key: "char_k", url: "/kenney_blocky-characters_20/Models/GLB format/character-k.glb" },
  { key: "char_l", url: "/kenney_blocky-characters_20/Models/GLB format/character-l.glb" },
  { key: "char_m", url: "/kenney_blocky-characters_20/Models/GLB format/character-m.glb" },
  { key: "char_n", url: "/kenney_blocky-characters_20/Models/GLB format/character-n.glb" },
  { key: "char_o", url: "/kenney_blocky-characters_20/Models/GLB format/character-o.glb" },
  { key: "char_p", url: "/kenney_blocky-characters_20/Models/GLB format/character-p.glb" },
  { key: "char_q", url: "/kenney_blocky-characters_20/Models/GLB format/character-q.glb" },
  { key: "char_r", url: "/kenney_blocky-characters_20/Models/GLB format/character-r.glb" },
  { key: "tent",     url: "/models/tent.glb" },
  { key: "blob_alien", url: "/monsterl1_10/Blob/glTF/Alien.gltf" },
  { key: "blob_birb", url: "/monsterl1_10/Blob/glTF/Birb.gltf" },
  { key: "blob_cactoro", url: "/monsterl1_10/Blob/glTF/Cactoro.gltf" },
  { key: "blob_green", url: "/monsterl1_10/Blob/glTF/GreenBlob.gltf" },
  { key: "blob_green_spiky", url: "/monsterl1_10/Blob/glTF/GreenSpikyBlob.gltf" },
  { key: "blob_mushnub", url: "/monsterl1_10/Blob/glTF/Mushnub.gltf" },
  { key: "blob_pink", url: "/monsterl1_10/Blob/glTF/PinkBlob.gltf" },
  { key: "blob_yeti", url: "/monsterl1_10/Blob/glTF/Yeti.gltf" },
  { key: "fly_dragon",  url: "/monsterl1_10/Flying/glTF/Dragon.gltf" },
  { key: "fly_ghost",   url: "/monsterl1_10/Flying/glTF/Ghost.gltf" },
  { key: "fly_squidle", url: "/monsterl1_10/Flying/glTF/Squidle.gltf" },
  // Kenney Mini Arena pack (map 2 — Scorched Dunes)
  { key: "arena_wall",           url: "/models/kenney_mini-arena/Models/GLB format/wall.glb" },
  { key: "arena_wall_corner",   url: "/models/kenney_mini-arena/Models/GLB format/wall-corner.glb" },
  { key: "arena_wall_gate",     url: "/models/kenney_mini-arena/Models/GLB format/wall-gate.glb" },
  { key: "arena_border",        url: "/models/kenney_mini-arena/Models/GLB format/border-straight.glb" },
  { key: "arena_border_corner", url: "/models/kenney_mini-arena/Models/GLB format/border-corner.glb" },
  { key: "arena_column",        url: "/models/kenney_mini-arena/Models/GLB format/column.glb" },
  { key: "arena_column_damaged",url: "/models/kenney_mini-arena/Models/GLB format/column-damaged.glb" },
  { key: "arena_stairs",        url: "/models/kenney_mini-arena/Models/GLB format/stairs.glb" },
  { key: "arena_stairs_corner", url: "/models/kenney_mini-arena/Models/GLB format/stairs-corner.glb" },
  { key: "arena_floor_detail",  url: "/models/kenney_mini-arena/Models/GLB format/floor-detail.glb" },
  { key: "arena_banner",        url: "/models/kenney_mini-arena/Models/GLB format/banner.glb" },
  { key: "arena_statue",        url: "/models/kenney_mini-arena/Models/GLB format/statue.glb" },
  { key: "arena_trophy",        url: "/models/kenney_mini-arena/Models/GLB format/trophy.glb" },
  { key: "arena_tree",          url: "/models/kenney_mini-arena/Models/GLB format/tree.glb" },
  { key: "arena_bricks",        url: "/models/kenney_mini-arena/Models/GLB format/bricks.glb" },
  { key: "arena_block",         url: "/models/kenney_mini-arena/Models/GLB format/block.glb" },
  { key: "arena_weapon_rack",   url: "/models/kenney_mini-arena/Models/GLB format/weapon-rack.glb" },
  { key: "arena_weapon_sword",  url: "/models/kenney_mini-arena/Models/GLB format/weapon-sword.glb" },
  { key: "arena_weapon_spear",  url: "/models/kenney_mini-arena/Models/GLB format/weapon-spear.glb" },
  { key: "arena_soldier",       url: "/models/kenney_mini-arena/Models/GLB format/character-soldier.glb" },
];

const fbxModelsToLoad = [
  { key: "sword_idle", url: "/animations/sword_idle.fbx" },
  { key: "sword_run", url: "/animations/sword_run.fbx" },
  { key: "sword_slash", url: "/animations/sword_slash.fbx" },
  { key: "sword_slash_3", url: "/animations/sword_slash_3.fbx" },
  { key: "player_model", url: "/models/player_model.fbx" },
  { key: "idle_anim", url: "/models/idle.fbx" },
  { key: "run_anim", url: "/models/run.fbx" },
  { key: "attack_anim", url: "/models/attack.fbx" },
];

/**
 * Flatten an AssetContainer into a single root TransformNode that owns all
 * loaded meshes, mimicking the Three.js `gltf.scene` root + `gltf.animations`
 * clip array shape the rest of the codebase expects.
 */
function containerToNode(container, scene) {
  if (!container || !container.meshes || container.meshes.length === 0) return null;
  // Use ESM TransformNode so the entire subtree stays in the @babylonjs/core
  // class hierarchy (consistent with the ESM meshes that LoadAssetContainerAsync produces).
  const root = new ESMTransformNode("modelRoot", scene);
  const allMeshes = [...(container.meshes || []), ...(container.transformNodes || [])];
  for (const m of allMeshes) {
    m.parent = root;
  }
  root.animations = container.animationGroups ? container.animationGroups.map(g => g.name) : [];
  return root;
}

/**
 * Load all GLTF models in parallel. On failure a model stays null and
 * callers fall back to procedural geometry.
 */
export async function loadAllModels() {
  const s = state;
  if (!s.scene) return; // scene may not be created yet depending on call order

  const loadGLTF = (item) =>
    LoadAssetContainerAsync("", item.url, s.scene)
      .then(container => container)
      .catch(err => { console.warn("[model-loader] GLTF failed:", item.key, item.url, err); return null; });

  const loadFBX = (item) =>
    LoadAssetContainerAsync("", item.url, s.scene, "fbx")
      .then(container => container)
      .catch(err => { console.warn("[model-loader] FBX failed:", item.key, item.url, err); return null; });

  const promises = modelsToLoad.map(item =>
    loadGLTF(item).then(container => {
      const node = containerToNode(container, s.scene);
      if (node) {
        node.setEnabled(false); // keep memory but don't render the "template" instance
        loadedModels[item.key] = node;
      }
    })
  );

  const fbxPromises = fbxModelsToLoad.map(item =>
    loadFBX(item).then(container => {
      const node = containerToNode(container, s.scene);
      if (node) {
        node.setEnabled(false);
        loadedModels[item.key] = node;
      }
    })
  );

  await Promise.all([...promises, ...fbxPromises]);

  // Log how many models actually loaded vs. how many failed
  const loaded = Object.values(loadedModels).filter(Boolean).length;
  const total = modelsToLoad.length + fbxModelsToLoad.length;
  if (loaded < total) {
    console.warn(`[model-loader] ${total - loaded}/${total} models failed to load`);
  }
}

/**
 * Creates an animation no-op controller for an instantiated enemy or boss
 * model. Phase 1: returns a shape matching the Three.js AnimationMixer API
 * surface (mixer, actions, currentAction) but does nothing — the actual
 * skeleton animation port is Phase 2.
 */
export function createEnemyMixer(charKey, gltfEnemy) {
  void charKey; void gltfEnemy;
  const noOpAction = {
    fadeIn() { return noOpAction; },
    fadeOut() { return noOpAction; },
    play() { return noOpAction; },
    stop() { return noOpAction; },
    reset() { return noOpAction; },
    setLoop() { return noOpAction; },
    isRunning() { return false; },
    getClip() { return null; },
    time: 0,
    timeScale: 1,
    clampWhenFinished: false,
  };
  const noOpMixer = {
    update() {},
    stopAllAction() {},
    uncacheRoot() {},
  };
  const actions = {
    walk: noOpAction,
    idle: noOpAction,
    attack: noOpAction,
    hit: noOpAction,
    death: noOpAction,
  };
  const currentAction = noOpAction;
  return { mixer: noOpMixer, actions, currentAction };
}
