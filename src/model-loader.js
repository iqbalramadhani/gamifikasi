import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { state } from './state.js';

export const loadedModels = {
  player: null, sword: null, enemy: null, tree: null, house: null,
  tree_high: null, plant: null, fence: null,
  building_struct: null, building_roof: null, building_platform: null,
  rocks_high: null, rocks_low: null, stones: null,
  target: null, patch_dirt: null, tent: null,
  char_b: null, char_c: null, char_d: null,
  char_e: null, char_f: null, char_g: null,
  char_h: null, char_i: null, char_j: null,
};

const modelsToLoad = [
  { key: 'player',     url: '/models/player.glb' },
  { key: 'sword',      url: '/models/sword.glb' },
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
  { key: 'char_b', url: '/kenney_blocky-characters_20/Models/GLB format/character-b.glb' },
  { key: 'char_c', url: '/kenney_blocky-characters_20/Models/GLB format/character-c.glb' },
  { key: 'char_d', url: '/kenney_blocky-characters_20/Models/GLB format/character-d.glb' },
  { key: 'char_e', url: '/kenney_blocky-characters_20/Models/GLB format/character-e.glb' },
  { key: 'char_f', url: '/kenney_blocky-characters_20/Models/GLB format/character-f.glb' },
  { key: 'char_g', url: '/kenney_blocky-characters_20/Models/GLB format/character-g.glb' },
  { key: 'char_h', url: '/kenney_blocky-characters_20/Models/GLB format/character-h.glb' },
  { key: 'char_i', url: '/kenney_blocky-characters_20/Models/GLB format/character-i.glb' },
  { key: 'char_j', url: '/kenney_blocky-characters_20/Models/GLB format/character-j.glb' },
  { key: 'tent',     url: '/models/tent.glb' },
];

/**
 * Load all GLTF models in parallel. On failure a model stays null and
 * callers fall back to procedural geometry.
 */
export async function loadAllModels() {
  const loader = new GLTFLoader();


  const promises = modelsToLoad.map(item =>
    new Promise(resolve => {
      loader.load(
        item.url,
        gltf => {
          loadedModels[item.key] = gltf.scene;
          resolve(true);
        },
        undefined,
        () => {
          resolve(false);
        }
      );
    })
  );

  await Promise.all(promises);
}
