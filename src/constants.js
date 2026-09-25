// Immutable constants and data tables used across modules.

export const mapSize = 4000;

export const weaponList = [
  { name: "Wooden Sword", damage: 0, cost: 0, color: 0xeeeeee },
  { name: "Iron Sword", damage: 2, cost: 100, color: 0xaaaaaa },
  { name: "Golden Sword", damage: 5, cost: 300, color: 0xffd700 },
  { name: "Fire Blade", damage: 10, cost: 800, color: 0xff4400 },
];

export const armorList = [
  { name: "Rusted Armor", hp: 0, cost: 0, color: 0xaaaaaa },
  { name: "Knight Armor", hp: 50, cost: 150, color: 0xdddddd },
  { name: "Paladin Armor", hp: 150, cost: 400, color: 0xffcc00 },
  { name: "Dragon Armor", hp: 300, cost: 1000, color: 0x221111 },
];

/** Enemy template definitions — order matches the random type selector. */
export const enemyTemplates = [
  { hp: 3,   speed: 1.5, r: 11, typeStr: 'spike',    charKey: 'char_e' },
  { hp: 1.5, speed: 1.5, r: 9,  typeStr: 'slime',    charKey: 'char_f' },
  { hp: 8,   speed: 1.5, r: 15, typeStr: 'golem',    charKey: 'char_g' },
  { hp: 4,   speed: 1.5, r: 9,  typeStr: 'archer',   charKey: 'char_h' },
  { hp: 2,   speed: 1.5, r: 9,  typeStr: 'kamikaze', charKey: 'char_i' },
  { hp: 5,   speed: 1.5, r: 8,  typeStr: 'ghost',    charKey: 'char_j' },
];

export const lootTable = {
  spike: { id: 'wood_scrap', name: 'Wood Scrap', value: 2, color: 0x8b5a2b },
  slime: { id: 'slime_gel', name: 'Slime Gel', value: 5, color: 0x00ff00 },
  golem: { id: 'golem_core', name: 'Golem Core', value: 25, color: 0x888888 },
  archer: { id: 'broken_arrow', name: 'Broken Arrow', value: 4, color: 0xddddaa },
  kamikaze: { id: 'gunpowder', name: 'Gunpowder', value: 8, color: 0x333333 },
  ghost: { id: 'ectoplasm', name: 'Ectoplasm', value: 10, color: 0xaabbff },
};
