// Keep tuning separate from game behaviour so features can be developed independently.
window.COIN_DASH = {
  width: 800,
  height: 500,
  roundSeconds: 45,
  playerSpeed: 240,
  droneSpeed: 105,
  droneCount: 3,
  shrinkIntervalSeconds: 5,
  shrinkAmount: 10,
  minBoardWidth: 320,
  minBoardHeight: 200,
  droneSpeedupIntervalSeconds: 10,
  droneSpeedupFactor: 1.1,
  droneFlickerMs: 100,
  droneFlickerRepeats: 2,
  // Power-up coins (times in seconds).
  powerupDuration: 6,
  powerupCoinPoints: 3,
  droneEatPoints: 5,
  powerupSpawnMin: 6,
  powerupSpawnMax: 10,
  powerupCoinLifetime: 5,
  powerupBlinkSeconds: 1.5,
  speedBoostMultiplier: 1.6,
  freezeFactor: 0.25,
  droneRespawnSeconds: 3,
  colors: {
    background: 0x101c31, player: 0x71e8ce, coin: 0xffd166, drone: 0xff657a,
    droneScared: 0x3b6bff, droneFrozen: 0x9cc8e6,
    powerups: { eater: 0xc77dff, shield: 0x5ab4ff, speed: 0x7cff6b, freeze: 0xe8f6ff }
  }
};
