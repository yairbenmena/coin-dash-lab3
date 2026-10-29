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
  colors: { background: 0x101c31, player: 0x71e8ce, coin: 0xffd166, drone: 0xff657a }
};
