'use strict';

// Shared by player and monster physical attacks. Round once, after all modifiers.
const CombatRules = Object.freeze({
  physicalDamage({attack, defense, power = 1, critical = false, strong = false, guard = false, roll = Math.random()}) {
    const a = Math.max(0, attack);
    const d = Math.max(0, defense);
    const mitigation = (a + 20) / (a + 20 + 0.8 * d);
    const variance = 0.9 + 0.2 * Math.max(0, Math.min(1, roll));
    const amount = a * Math.max(0, power) * mitigation * variance
      * (critical ? 1.8 : 1) * (strong ? 1.4 : 1) * (guard ? 0.35 : 1);
    return Math.max(0, Math.floor(amount));
  },
  // No target stats enter magic damage or healing calculations.
  magicAmount(wisdom, skill) {
    return Math.max(0, Math.floor(skill.base + Math.max(0, wisdom) * skill.power));
  }
});
