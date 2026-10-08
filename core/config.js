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

  loadout: {
    rifleDraw: 0.35,       // s to bring the rifle back up after switching
    rifleHolster: 0.1      // s to put the rifle away
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
