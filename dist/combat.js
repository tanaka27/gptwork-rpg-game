'use strict';

// Dragon Quest-inspired physical damage; this is our own tuning, not a specific title's exact formula.
// Shared by player and monster attacks. Round once, after skill/strong/guard modifiers.
const CombatRules = Object.freeze({
  physicalDamage({attack, defense, power = 1, strong = false, guard = false, roll = Math.random()}) {
    const a = Math.max(0, attack);
    const d = Math.max(0, defense);
    const p = Math.max(0, power);
    if (a === 0 || p === 0) return 0;
    const r = Math.max(0, Math.min(1, roll));
    const base = Math.max(0, a / 2 - d / 4);
    // At very low base damage, allow a 50/50 glancing hit instead of guaranteed immunity.
    const hit = base < 1 ? (r < 0.5 ? 0 : 1) : base * (0.9 + 0.2 * r);
    return Math.max(0, Math.floor(hit * p * (strong ? 1.4 : 1) * (guard ? 0.35 : 1)));
  },
  // No target stats enter magic damage or healing calculations.
  magicAmount(wisdom, skill) {
    return Math.max(0, Math.floor(skill.base + Math.max(0, wisdom) * skill.power));
  }
});
