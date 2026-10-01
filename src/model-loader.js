import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { state } from './state.js';

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
  { key: 'player',     url: '/models/player.glb' },
  { key: 'sword',      url: '/models/weapon-arrow.glb' },
  { key: 'enemy',      url: '/models/enemy.glb' },
  { key: 'tree',       url: '/models/tree.glb' },
  { key: 'tree_high',  url: '/models/tree-high.glb' },
  { key: 'plant',      url: '/models/plant.glb' },
  { key: 'house',      url: '/models/house.glb' },
  { key: 'fence',      url: '/models/fence.glb' },
  { key: 'building_struct',    url: '/models/building-structure.glb' },
  { key: 'building_roof',      url: '/models/building-roof.glb' },
  { key: 'building_platform',  url: '/models/building-platform.glb' },
  { key: 'rocks_high', url: '/models/rocks-high.glb' },
  { key: 'rocks_low',  url: '/models/rocks-low.glb' },
  { key: 'stones',     url: '/models/stones.glb' },
  { key: 'target',     url: '/models/target.glb' },
  { key: 'patch_dirt', url: '/models/patch-dirt.glb' },
  { key: 'char_a', url: '/kenney_blocky-characters_20/Models/GLB format/character-a.glb' },
  { key: 'char_b', url: '/kenney_blocky-characters_20/Models/GLB format/character-b.glb' },
  { key: 'char_c', url: '/kenney_blocky-characters_20/Models/GLB format/character-c.glb' },
  { key: 'char_d', url: '/kenney_blocky-characters_20/Models/GLB format/character-d.glb' },
  { key: 'char_e', url: '/kenney_blocky-characters_20/Models/GLB format/character-e.glb' },
  { key: 'char_f', url: '/kenney_blocky-characters_20/Models/GLB format/character-f.glb' },
  { key: 'char_g', url: '/kenney_blocky-characters_20/Models/GLB format/character-g.glb' },
  { key: 'char_h', url: '/kenney_blocky-characters_20/Models/GLB format/character-h.glb' },
  { key: 'char_i', url: '/kenney_blocky-characters_20/Models/GLB format/character-i.glb' },
  { key: 'char_j', url: '/kenney_blocky-characters_20/Models/GLB format/character-j.glb' },
  { key: 'char_k', url: '/kenney_blocky-characters_20/Models/GLB format/character-k.glb' },
  { key: 'char_l', url: '/kenney_blocky-characters_20/Models/GLB format/character-l.glb' },
  { key: 'char_m', url: '/kenney_blocky-characters_20/Models/GLB format/character-m.glb' },
  { key: 'char_n', url: '/kenney_blocky-characters_20/Models/GLB format/character-n.glb' },
  { key: 'char_o', url: '/kenney_blocky-characters_20/Models/GLB format/character-o.glb' },
  { key: 'char_p', url: '/kenney_blocky-characters_20/Models/GLB format/character-p.glb' },
  { key: 'char_q', url: '/kenney_blocky-characters_20/Models/GLB format/character-q.glb' },
  { key: 'char_r', url: '/kenney_blocky-characters_20/Models/GLB format/character-r.glb' },
  { key: 'tent',     url: '/models/tent.glb' },
  { key: 'blob_alien', url: '/monsterl1_10/Blob/glTF/Alien.gltf' },
  { key: 'blob_birb', url: '/monsterl1_10/Blob/glTF/Birb.gltf' },
  { key: 'blob_cactoro', url: '/monsterl1_10/Blob/glTF/Cactoro.gltf' },
  { key: 'blob_green', url: '/monsterl1_10/Blob/glTF/GreenBlob.gltf' },
  { key: 'blob_green_spiky', url: '/monsterl1_10/Blob/glTF/GreenSpikyBlob.gltf' },
  { key: 'blob_mushnub', url: '/monsterl1_10/Blob/glTF/Mushnub.gltf' },
  { key: 'blob_pink', url: '/monsterl1_10/Blob/glTF/PinkBlob.gltf' },
  { key: 'blob_yeti', url: '/monsterl1_10/Blob/glTF/Yeti.gltf' },
  { key: 'fly_dragon',  url: '/monsterl1_10/Flying/glTF/Dragon.gltf' },
  { key: 'fly_ghost',   url: '/monsterl1_10/Flying/glTF/Ghost.gltf' },
  { key: 'fly_squidle', url: '/monsterl1_10/Flying/glTF/Squidle.gltf' },
  // Kenney Mini Arena pack (map 2 — Scorched Dunes)
  { key: 'arena_wall',           url: '/models/kenney_mini-arena/Models/GLB format/wall.glb' },
  { key: 'arena_wall_corner',   url: '/models/kenney_mini-arena/Models/GLB format/wall-corner.glb' },
  { key: 'arena_wall_gate',     url: '/models/kenney_mini-arena/Models/GLB format/wall-gate.glb' },
  { key: 'arena_border',        url: '/models/kenney_mini-arena/Models/GLB format/border-straight.glb' },
  { key: 'arena_border_corner', url: '/models/kenney_mini-arena/Models/GLB format/border-corner.glb' },
  { key: 'arena_column',        url: '/models/kenney_mini-arena/Models/GLB format/column.glb' },
  { key: 'arena_column_damaged',url: '/models/kenney_mini-arena/Models/GLB format/column-damaged.glb' },
  { key: 'arena_stairs',        url: '/models/kenney_mini-arena/Models/GLB format/stairs.glb' },
  { key: 'arena_stairs_corner', url: '/models/kenney_mini-arena/Models/GLB format/stairs-corner.glb' },
  { key: 'arena_floor_detail',  url: '/models/kenney_mini-arena/Models/GLB format/floor-detail.glb' },
  { key: 'arena_banner',        url: '/models/kenney_mini-arena/Models/GLB format/banner.glb' },
  { key: 'arena_statue',        url: '/models/kenney_mini-arena/Models/GLB format/statue.glb' },
  { key: 'arena_trophy',        url: '/models/kenney_mini-arena/Models/GLB format/trophy.glb' },
  { key: 'arena_tree',          url: '/models/kenney_mini-arena/Models/GLB format/tree.glb' },
  { key: 'arena_bricks',        url: '/models/kenney_mini-arena/Models/GLB format/bricks.glb' },
  { key: 'arena_block',         url: '/models/kenney_mini-arena/Models/GLB format/block.glb' },
  { key: 'arena_weapon_rack',   url: '/models/kenney_mini-arena/Models/GLB format/weapon-rack.glb' },
  { key: 'arena_weapon_sword',  url: '/models/kenney_mini-arena/Models/GLB format/weapon-sword.glb' },
  { key: 'arena_weapon_spear',  url: '/models/kenney_mini-arena/Models/GLB format/weapon-spear.glb' },
  { key: 'arena_soldier',       url: '/models/kenney_mini-arena/Models/GLB format/character-soldier.glb' },
];

const fbxModelsToLoad = [
  { key: 'sword_idle', url: '/animations/sword_idle.fbx' },
  { key: 'sword_run', url: '/animations/sword_run.fbx' },
  { key: 'sword_slash', url: '/animations/sword_slash.fbx' },
  { key: 'player_model', url: '/models/player_model.fbx' },
  { key: 'idle_anim', url: '/models/idle.fbx' },
  { key: 'run_anim', url: '/models/run.fbx' },
  { key: 'attack_anim', url: '/models/attack.fbx' },
];

/**
 * Load all GLTF models in parallel. On failure a model stays null and
 * callers fall back to procedural geometry.
 */
export async function loadAllModels() {
  const loader = new GLTFLoader();


  const fbxLoader = new FBXLoader();

  const promises = modelsToLoad.map(item =>
    new Promise(resolve => {
      loader.load(
        item.url,
        gltf => {
          gltf.scene.traverse(child => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          loadedModels[item.key] = gltf.scene;
          if (gltf.animations && gltf.animations.length > 0) {
            loadedModels[item.key].animations = gltf.animations;
          }
          resolve(true);
        },
        undefined,
        () => {
          resolve(false);
        }
      );
    })
  );

  const fbxPromises = fbxModelsToLoad.map(item =>
    new Promise(resolve => {
      fbxLoader.load(
        item.url,
        fbx => {
          fbx.traverse(child => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          loadedModels[item.key] = fbx;
          resolve(true);
        },
        undefined,
        () => {
          resolve(false);
        }
      );
    })
  );

  await Promise.all([...promises, ...fbxPromises]);
}
