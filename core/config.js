/* SNIPER DUEL — tuning. Every number that shapes how the game feels lives here.
   Pure data: shared by the browser client, the Node tests and (later) the game server. */
(function (root) {
'use strict';
const SD_CONFIG = {
  // Fixed simulation rate. Movement, weapon and bullets advance in steps of 1/TICK s,
  // so the result does not depend on the player's FPS. The server will use the same rate.
  TICK: 120,

  move: {
    walk: 4.6,            // m/s, normal run speed
    backMul: 0.85,        // backpedal multiplier
    sprint: 7.0,          // m/s
    crouch: 2.4,          // m/s
    adsMul: 0.5,          // speed multiplier while scoped
    reloadMul: 0.9,
    groundAccel: 58,      // m/s² when speeding up / changing direction
    groundDecel: 60,      // m/s² when releasing all input (how fast you stop)
    overspeedDecel: 11,   // m/s² when going faster than the target speed (after sprint or slide): momentum bleeds off smoothly
    airAccel: 11,         // m/s² of steering in the air
    airDrag: 0.12,        // 1/s, tiny air drag
    gravity: 20,          // m/s²
    fallMul: 1.35,        // extra gravity while falling: short airtime, not floaty
    jumpV: 6.3,           // m/s → ~1.0 m jump height
    maxFall: 32,
    coyote: 0.1,          // s you can still jump after walking off an edge
    jumpBuffer: 0.12,     // s a jump press is remembered before landing
    slideMinSpeed: 5.6,   // m/s needed to start a slide
    slideBoost: 2.4,      // m/s added on slide start (explosive start)
    slideMax: 9.8,        // m/s cap
    slideFriction: 5,     // m/s² constant slide friction
    slideDrag: 0.7,       // 1/s, speed-proportional slide friction
    slideMinEnd: 3.2,     // slide ends below this speed
    slideMaxTime: 0.7,    // s (short and explosive: ~0.68 s)
    slideSteer: 1.4,      // rad/s of steering during a slide
    slideCooldown: 0.55,  // s before another slide
    slideJumpCap: 8.6,    // m/s max carried into a slide-jump
    landSlowFrom: 7.5,    // m/s fall speed above which landing costs momentum
    landSlowMul: 0.88,
    eyeStand: 1.62, eyeCrouch: 1.0, eyeSlide: 0.85,
    eyeSpeed: 7,          // m/s camera height change
    radius: 0.35, step: 0.45, heightStand: 1.8, heightCrouch: 1.2
  },

  rifles: {
    halcon: {
      name: 'HALCÓN R7',
      mag: 5,
      raise: 0.5,          // s to bring the rifle up after spawning
      bolt: 0.95,          // s between shots (whole bolt cycle)
      reload: 2.35,        // s
      adsTime: 0.2,        // s hip → scope
      adsOutTime: 0.1,     // s scope → hip
      scopeAt: 0.85,       // ADS progress at which the scope picture appears AND the shot becomes perfectly accurate
      sprintOut: 0.1,      // s after sprinting before you can fire (a press in between is kept)
      fireBuffer: 0.12,    // s a trigger press is remembered (fires the instant the bolt locks)
      hipSpread: 0.05,     // rad, hip-fire cone
      adsSpreadMin: 0.4,   // spread multiplier right before the scope appears
      moveSpread: 0.03,    // rad added at 7 m/s (hip/transition only)
      airSpread: 0.07,     // rad added in the air (hip/transition only)
      crouchSpreadMul: 0.75,
      dmg: { head: 250, torso: 85, legs: 55 },
      speed: 600,          // muzzle velocity m/s
      gravity: 15.7,       // bullet gravity m/s² (exaggerated so drop is readable)
      zero: 50,            // m where the bullet crosses the reticle
      maxRange: 450,
      sway: 0.0042,        // rad scope sway amplitude
      swayMoveMul: 0.35,   // per m/s
      swayCrouchMul: 0.55,
      swayAirMul: 3,
      breathHold: 3.5,     // s of steady aim
      breathRecover: 3.2,  // s to refill
      exhaustTime: 2.6,    // s of shaky aim after running out
      exhaustMul: 2.4,
      holdMul: 0.03,
      recoil: {            // visual only: never changes where the bullet goes
        pitch: 0.068,      // rad peak camera kick when scoped
        pitchHip: 0.095,
        yaw: 0.012,
        stiffness: 420,    // spring: higher = faster recovery (~0.28 s back to rest)
        damping: 1.0,      // 1 = no overshoot, lower = bouncier
        viewKick: 1        // viewmodel kick strength
      },
      zooms: [4, 8],
      // animation keys as fractions of the bolt cycle (sounds fire on the same keys)
      boltKeys: { lift: [0.10, 0.26], back: [0.28, 0.44], eject: 0.42, fwd: [0.50, 0.66], down: [0.74, 1.0] },
      // fractions of the reload
      reloadKeys: { magOut: [0.12, 0.28], magIn: [0.38, 0.55], bolt: [0.62, 0.94] }
    }
  },

  // melee weapons (extensible: add another entry for a new knife or skin)
  knives: {
    tactica: {
      name: 'NAVAJA TÁCTICA',
      draw: 0.25,          // s to equip
      holster: 0.08,       // s to put away
      interval: 0.40,      // s between attacks
      hitAt: 0.12,         // s into the swing when the hit is checked
      attackBuffer: 0.15,  // s a click is remembered before the next swing is allowed
      range: 2.0,          // m from your body to the target's body
      cone: 0.7,           // rad half-angle in front of you that the blade covers
      closeDist: 0.9,      // m: inside this distance the cone widens…
      closeCone: 1.2,      // …to this half-angle
      dmgFront: 50,
      dmgBack: 100,
      backArc: 1.05,       // rad: attacker within ±60° of the target's back = backstab
      moveMul: 1.08,       // +8 % movement speed while the knife is out
      inspect: 1.8         // s inspect animation (F)
    }
  },

  // secondary weapon. Same state machine as the rifle (core/weapon.js): 'bolt' is the slide
  // cycle, the scope never appears (scopeAt > 1: iron sights, ADS only tightens the spread)
  pistols: {
    vibora: {
      name: 'VÍBORA 9',
      mag: 12,
      raise: 0.3,
      bolt: 0.17,          // s slide cycle = fastest semi-auto rate (~5.9 shots/s, one per press)
      reload: 1.45,        // s (much quicker than switching back and reloading the rifle)
      adsTime: 0.12, adsOutTime: 0.08,
      scopeAt: 2,          // never: iron sights
      ironZoom: 1.3,       // FOV divided by this at full ADS
      sprintOut: 0.06, fireBuffer: 0.1,
      hipSpread: 0.026,    // rad
      adsSpreadMin: 0.3,   // full ADS: 30 % of the hip cone
      moveSpread: 0.014, airSpread: 0.045, crouchSpreadMul: 0.8,
      bloomPerShot: 0.012, // rad added to the cone by each shot (mechanical recoil: spamming spreads)
      bloomMax: 0.04, bloomDecay: 0.03,  // rad/s back to calm: a shot every 0.4 s stays accurate, spamming does not
      climb: 0.026,        // rad the muzzle (and your view) climbs per shot; you pull it back down
      dmg: { head: 90, torso: 34, legs: 26 },   // 2 to the head or 3 to the body
      falloff: { from: 18, to: 55, min: 0.6 },  // damage × 1 up to 18 m, × 0.6 from 55 m
      speed: 380, gravity: 9.8, zero: 20, maxRange: 150,
      moveMul: 1.04,       // a touch quicker on your feet than with the rifle
      sway: 0.0028, swayMoveMul: 0.3, swayCrouchMul: 0.6, swayAirMul: 2.5,
      breathHold: 3.5, breathRecover: 3.2, exhaustTime: 2.6, exhaustMul: 2.4, holdMul: 1,
      recoil: { pitch: 0.03, pitchHip: 0.04, yaw: 0.014, stiffness: 600, damping: 0.85, viewKick: 0.8 },
      zooms: [1],
      boltKeys: { lift: [0, 0.01], back: [0.0, 0.35], eject: 0.18, fwd: [0.35, 0.85], down: [0.01, 0.02] },
      reloadKeys: { magOut: [0.08, 0.3], magIn: [0.42, 0.62], bolt: [0.74, 0.94] }
    }
  },

  // close-range primary, chosen instead of the rifle before a match (or for the next spawn).
  // Same state machine: 'bolt' is the pump cycle; the reload puts the shells in one by one
  // and a trigger press stops it as soon as there is a shell in the tube.
  shotguns: {
    furia: {
      name: 'FURIA 12',
      mag: 6,
      raise: 0.45,
      bolt: 0.78,          // s pump cycle between shots
      adsTime: 0.16, adsOutTime: 0.1,
      scopeAt: 2,          // never: bead and rear notch (iron sights)
      ironZoom: 1.15,
      sprintOut: 0.08, fireBuffer: 0.15,
      hipSpread: 0.012,    // rad: cone of the CENTRE of the pattern (the pellets spread around it)
      adsSpreadMin: 0.5,
      moveSpread: 0.012, airSpread: 0.03, crouchSpreadMul: 0.85,
      pellets: 9,          // centre + inner ring of 3 + outer ring of 5 (fixed pattern, turned each shot)
      pelletSpread: 0.065, // rad radius of the outer ring from the hip…
      pelletAdsMul: 0.7,   // …× 0.7 aiming down the sights
      climb: 0.03,
      dmg: { head: 24, torso: 15, legs: 11 },   // PER PELLET: 7+ pellets in the body up close = kill
      falloff: { from: 7, to: 24, min: 0.25 },  // × 1 up to 7 m, × 0.25 from 24 m
      // result (centre of the chest, standing): one shot kills up to ~5 m from the hip and ~7 m
      // aiming; two shots at 12 m aiming; beyond ~18 m it barely scratches
      speed: 330, gravity: 9.8, zero: 15, maxRange: 35,   // pellets vanish after 35 m
      moveMul: 0.98,
      sway: 0.003, swayMoveMul: 0.3, swayCrouchMul: 0.6, swayAirMul: 2.5,
      breathHold: 3.5, breathRecover: 3.2, exhaustTime: 2.6, exhaustMul: 2.4, holdMul: 1,
      recoil: { pitch: 0.06, pitchHip: 0.085, yaw: 0.02, stiffness: 380, damping: 0.9, viewKick: 1.3 },
      zooms: [1],
      // pump: back (eject) then forward, as fractions of the cycle
      boltKeys: { lift: [0, 0.01], back: [0.1, 0.42], eject: 0.3, fwd: [0.48, 0.8], down: [0.01, 0.02] },
      shells: { start: 0.32, each: 0.4, end: 0.3 },  // s: hands to the port, per shell, back to the pump
      reloadKeys: { magOut: [0.08, 0.3], magIn: [0.42, 0.62], bolt: [0.74, 0.94] },  // unused (shell reload)
      reload: 0.32 + 6 * 0.4 + 0.3                   // s for a full tube from empty (HUD / tests)
    }
  },

  loadout: {
    rifleDraw: 0.35,       // s to bring the rifle back up after switching
    rifleHolster: 0.1,     // s to put the rifle away
    pistolDraw: 0.28,      // the sidearm comes out fast: quicker than reloading the rifle
    pistolHolster: 0.08,
    shotgunDraw: 0.4,
    shotgunHolster: 0.12
  },

  // free training in the shooting range: unarmed bots that move like players
  training: {
    area: { minX: -15, maxX: 15, minZ: 68, maxZ: 166 },
    easy:   { count: 3, speedMul: 0.6, run: 0,    changeMin: 1.8,  changeMax: 3.2, slide: 0,    jump: 0,    cover: 0,    crouch: 0.1 },
    normal: { count: 4, speedMul: 1,   run: 0.35, changeMin: 0.9,  changeMax: 1.8, slide: 0.25, jump: 0.05, cover: 0.35, crouch: 0.15 },
    hard:   { count: 5, speedMul: 1,   run: 0.6,  changeMin: 0.45, changeMax: 1.1, slide: 0.5,  jump: 0.15, cover: 0.5,  crouch: 0.2 }
  },

  feel: {
    fovDesktop: 75, fovTouch: 70,
    sprintFov: 5, slideFov: 6,
    bob: 0.031,           // camera head-bob (hip only; zero when scoped)
    vmBob: 0.7,           // viewmodel bob multiplier
    shake: 0.012,
    landKick: 0.018,      // camera dip per m/s of landing speed
    headshotFovPunch: 0.06,
    headshotSlowmo: 0.16  // s; slows only particles and tracers, never the simulation
  }
};
if (typeof module !== 'undefined' && module.exports) module.exports = SD_CONFIG; else root.SD_CONFIG = SD_CONFIG;
})(typeof window !== 'undefined' ? window : globalThis);
