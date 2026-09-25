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
  { hp: 3,   speed: 1.6, r: 11, typeStr: 'spike',    charKey: 'char_e' },
  { hp: 1.5, speed: 3.0, r: 9,  typeStr: 'slime',    charKey: 'char_f' },
  { hp: 8,   speed: 0.8, r: 15, typeStr: 'golem',    charKey: 'char_g' },
  { hp: 4,   speed: 1.2, r: 9,  typeStr: 'archer',   charKey: 'char_h' },
  { hp: 2,   speed: 3.5, r: 9,  typeStr: 'kamikaze', charKey: 'char_i' },
  { hp: 5,   speed: 1.0, r: 8,  typeStr: 'ghost',    charKey: 'char_j' },
];
