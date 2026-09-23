export class Sfx {
  constructor() { (globalThis as any).__log.push('sfx:new'); }
}
for (const m of ['unlock','shoot','enemyShoot','explode','ufo','playerHit','shieldHit','wave']) {
  (Sfx.prototype as any)[m] = function () { (globalThis as any).__log.push('sfx:' + m); };
}
