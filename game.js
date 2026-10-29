/* global Phaser, COIN_DASH */
const POWERUPS = {
  eater: { label: 'EATER', mark: 'E' },
  shield: { label: 'SHIELD', mark: 'S' },
  speed: { label: 'SPEED', mark: '>' },
  freeze: { label: 'FREEZE', mark: '*' }
};
const hex = color => '#' + color.toString(16).padStart(6, '0');

class CoinDash extends Phaser.Scene {
  constructor() { super('CoinDash'); }

  create() {
    const c = COIN_DASH;
    this.score = 0;
    this.finished = false;
    this.powerups = {}; // active power-up type -> expiry time
    this.deadline = this.time.now + c.roundSeconds * 1000;
    this.board = new Phaser.Geom.Rectangle(0, 44, c.width, c.height - 44);
    this.physics.world.setBounds(this.board.x, this.board.y, this.board.width, this.board.height);
    this.add.grid(c.width / 2, c.height / 2, c.width, c.height, 40, 40,
      c.colors.background, 1, 0x24334b, 0.45);
    this.shade = this.add.graphics();
    this.drawBoard();
    this.hud = this.add.text(18, 12, '', { font: '18px monospace', color: '#ffffff' });
    this.puHud = this.add.text(c.width - 18, 12, '', { font: '18px monospace', color: '#ffffff' })
      .setOrigin(1, 0);
    this.player = this.add.rectangle(c.width / 2, c.height / 2, 24, 24, c.colors.player);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);
    this.shieldRing = this.add.circle(0, 0, 22).setStrokeStyle(3, c.colors.powerups.shield).setVisible(false);
    this.coin = this.add.circle(100, 100, 9, c.colors.coin);
    this.physics.add.existing(this.coin);
    this.coin.body.setCircle(9);
    this.puCoin = this.add.circle(0, 0, 11, 0xffffff);
    this.physics.add.existing(this.puCoin);
    this.puCoin.body.setCircle(11);
    this.puMark = this.add.text(0, 0, '', { font: 'bold 14px monospace', color: '#101c31' }).setOrigin(0.5);
    this.hidePowerupCoin();
    this.nextPowerupAt = this.time.now
      + Phaser.Math.FloatBetween(c.powerupSpawnMin, c.powerupSpawnMax) * 1000;
    this.placeCoin();
    this.droneSpeed = c.droneSpeed; // grows with each speedup
    this.drones = this.physics.add.group();
    for (let i = 0; i < c.droneCount; i++) {
      const drone = this.add.rectangle(90 + i * 270, 100, 26, 26, c.colors.drone);
      this.drones.add(drone);
      drone.body.setCollideWorldBounds(true).setBounce(1, 1);
      const angle = (35 + i * 105) * Math.PI / 180;
      drone.body.setVelocity(Math.cos(angle) * c.droneSpeed, Math.sin(angle) * c.droneSpeed);
      drone.speedFactor = 1;
      drone.eatenUntil = 0;
    }
    this.speedup = this.time.addEvent({
      delay: c.droneSpeedupIntervalSeconds * 1000,
      loop: true,
      callback: () => {
        const drones = this.drones.getChildren();
        this.droneSpeed *= c.droneSpeedupFactor;
        drones.forEach(d => d.body.velocity.scale(c.droneSpeedupFactor));
        this.tweens.add({ targets: drones, alpha: 0.3, duration: c.droneFlickerMs, yoyo: true,
          repeat: c.droneFlickerRepeats });
      }
    });
    this.physics.add.overlap(this.player, this.coin, () => {
      if (this.finished) return;
      this.score++;
      this.placeCoin();
    });
    this.physics.add.overlap(this.player, this.puCoin, () => this.collectPowerup());
    this.physics.add.overlap(this.player, this.drones, (player, drone) => this.hitDrone(drone));
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,R');
    this.input.keyboard.on('keydown-R', () => this.scene.restart());
    this.shrinkTimer = this.time.addEvent({
      delay: c.shrinkIntervalSeconds * 1000, loop: true, callback: this.shrinkBoard, callbackScope: this
    });
  }

  shrinkBoard() {
    const c = COIN_DASH, b = this.board;
    const step = Math.floor(Math.min(c.shrinkAmount,
      (b.width - c.minBoardWidth) / 2, (b.height - c.minBoardHeight) / 2));
    if (this.finished || step <= 0) return this.shrinkTimer.remove();
    b.setTo(b.x + step, b.y + step, b.width - step * 2, b.height - step * 2);
    this.physics.world.setBounds(b.x, b.y, b.width, b.height);
    this.drawBoard();
    [this.player, this.coin, ...this.drones.getChildren()].forEach(obj => this.keepInside(obj));
    if (this.puType) {
      this.keepInside(this.puCoin);
      this.puMark.setPosition(this.puCoin.x, this.puCoin.y);
    }
  }

  keepInside(obj) {
    const b = this.board, { halfWidth: hw, halfHeight: hh, velocity } = obj.body;
    const x = Phaser.Math.Clamp(obj.x, b.left + hw, b.right - hw);
    const y = Phaser.Math.Clamp(obj.y, b.top + hh, b.bottom - hh);
    if (x === obj.x && y === obj.y) return;
    const v = velocity.clone();
    obj.body.reset(x, y);
    obj.body.velocity.copy(v);
  }

  drawBoard() {
    const c = COIN_DASH, b = this.board;
    this.shade.clear().fillStyle(0x000000, 0.6)
      .fillRect(0, 44, c.width, b.top - 44)
      .fillRect(0, b.bottom, c.width, c.height - b.bottom)
      .fillRect(0, b.top, b.left, b.height)
      .fillRect(b.right, b.top, c.width - b.right, b.height)
      .lineStyle(2, c.colors.drone, 0.7)
      .strokeRectShape(b);
  }

  // Random spot at least minDist from the player and clear of any visible object in `avoid`.
  freeSpot(minDist, avoid = []) {
    const b = this.board;
    let x, y;
    for (let tries = 0; tries < 100; tries++) {
      x = Phaser.Math.Between(b.left + 25, b.right - 25);
      y = Phaser.Math.Between(b.top + 25, b.bottom - 25);
      if (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) >= minDist
        && avoid.every(o => !o.visible || Phaser.Math.Distance.Between(x, y, o.x, o.y) >= 50)) break;
    }
    return { x, y };
  }

  placeCoin() {
    const { x, y } = this.freeSpot(60, [this.puCoin]);
    this.coin.setPosition(x, y);
    this.coin.body.reset(x, y);
  }

  isOn(type) { return this.time.now < (this.powerups[type] || 0); }

  spawnPowerupCoin() {
    const c = COIN_DASH;
    this.puType = Phaser.Utils.Array.GetRandom(Object.keys(POWERUPS));
    this.puExpires = this.time.now + c.powerupCoinLifetime * 1000;
    // Interval counts from this spawn; it exceeds the lifetime, so coins never overlap.
    this.nextPowerupAt = this.time.now
      + Phaser.Math.FloatBetween(c.powerupSpawnMin, c.powerupSpawnMax) * 1000;
    const { x, y } = this.freeSpot(120, [this.coin]);
    this.puCoin.setPosition(x, y).setFillStyle(c.colors.powerups[this.puType]).setVisible(true);
    this.puCoin.body.enable = true;
    this.puCoin.body.reset(x, y);
    this.puMark.setText(POWERUPS[this.puType].mark).setPosition(x, y).setVisible(true);
  }

  hidePowerupCoin() {
    this.puType = null;
    this.puCoin.setVisible(false).setAlpha(1);
    this.puCoin.body.enable = false;
    this.puMark.setVisible(false).setAlpha(1);
  }

  collectPowerup() {
    if (this.finished || !this.puType) return;
    const c = COIN_DASH, type = this.puType;
    this.score += c.powerupCoinPoints;
    this.powerups[type] = this.time.now + c.powerupDuration * 1000; // re-collecting refreshes
    this.popup(this.puCoin.x, this.puCoin.y, `+${c.powerupCoinPoints} ${POWERUPS[type].label}`,
      c.colors.powerups[type]);
    this.hidePowerupCoin();
  }

  hitDrone(drone) {
    if (this.finished || drone.eatenUntil) return;
    const c = COIN_DASH;
    if (this.isOn('eater')) {
      this.score += c.droneEatPoints;
      this.popup(drone.x, drone.y, `+${c.droneEatPoints}`, c.colors.droneScared);
      drone.eatenUntil = this.time.now + c.droneRespawnSeconds * 1000;
      drone.body.stop();
      drone.body.enable = false;
      drone.setVisible(false);
    } else if (!this.isOn('shield')) this.finish('A drone caught you!');
  }

  respawnDrone(drone, factor) {
    const s = this.droneSpeed * factor;
    const { x, y } = this.freeSpot(250);
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    drone.eatenUntil = 0;
    drone.setPosition(x, y).setVisible(true);
    drone.body.enable = true;
    drone.body.reset(x, y);
    drone.body.setVelocity(Math.cos(angle) * s, Math.sin(angle) * s);
    drone.speedFactor = factor;
  }

  updateDrones(now) {
    const c = COIN_DASH;
    const factor = this.isOn('freeze') ? c.freezeFactor : 1;
    const eater = this.isOn('eater');
    const eaterLeft = eater ? this.powerups.eater - now : 0;
    const flash = eater && eaterLeft < c.powerupBlinkSeconds * 1000 && Math.floor(eaterLeft / 150) % 2;
    this.drones.getChildren().forEach(drone => {
      if (drone.eatenUntil) {
        if (now >= drone.eatenUntil) this.respawnDrone(drone, factor);
        else return;
      }
      // Rescale the current (possibly bounced) velocity so direction is kept across freeze on/off.
      if (drone.speedFactor !== factor) {
        drone.body.velocity.scale(factor / drone.speedFactor);
        drone.speedFactor = factor;
      }
      if (eater) {
        const away = new Phaser.Math.Vector2(drone.x - this.player.x, drone.y - this.player.y);
        if (away.lengthSq() > 0) {
          away.normalize().scale(this.droneSpeed * factor);
          drone.body.setVelocity(away.x, away.y);
        }
      }
      drone.setFillStyle(eater && !flash ? c.colors.droneScared
        : factor < 1 ? c.colors.droneFrozen : c.colors.drone);
    });
  }

  popup(x, y, text, color) {
    const t = this.add.text(x, y - 14, text, { font: 'bold 16px monospace', color: hex(color) }).setOrigin(0.5);
    this.tweens.add({ targets: t, y: y - 50, alpha: 0, duration: 900, onComplete: () => t.destroy() });
  }

  update() {
    if (this.finished) return;
    const c = COIN_DASH, now = this.time.now;
    for (const type in this.powerups) if (now >= this.powerups[type]) delete this.powerups[type];
    const dx = Number(this.cursors.right.isDown || this.keys.D.isDown)
      - Number(this.cursors.left.isDown || this.keys.A.isDown);
    const dy = Number(this.cursors.down.isDown || this.keys.S.isDown)
      - Number(this.cursors.up.isDown || this.keys.W.isDown);
    const speed = c.playerSpeed * (this.isOn('speed') ? c.speedBoostMultiplier : 1);
    const direction = new Phaser.Math.Vector2(dx, dy).normalize().scale(speed);
    this.player.body.setVelocity(direction.x, direction.y);
    this.shieldRing.setPosition(this.player.x, this.player.y).setVisible(this.isOn('shield'));
    if (!this.puType) {
      if (now >= this.nextPowerupAt) this.spawnPowerupCoin();
    } else if (now >= this.puExpires) this.hidePowerupCoin();
    else {
      const left = this.puExpires - now;
      const alpha = left < c.powerupBlinkSeconds * 1000 && Math.floor(left / 125) % 2 ? 0.2 : 1;
      this.puCoin.setAlpha(alpha);
      this.puMark.setAlpha(alpha);
    }
    this.updateDrones(now);
    const seconds = Math.max(0, Math.ceil((this.deadline - now) / 1000));
    this.hud.setText(`Score: ${this.score}     Time: ${seconds}s`);
    this.puHud.setText(Object.keys(POWERUPS).filter(t => t in this.powerups)
      .map(t => `${POWERUPS[t].label} ${Math.ceil((this.powerups[t] - now) / 1000)}s`).join('  '));
    if (seconds === 0) this.finish('Time is up!');
  }

  finish(reason) {
    if (this.finished) return;
    this.finished = true;
    this.shrinkTimer.remove();
    this.physics.pause();
    this.speedup.remove();
    this.tweens.killTweensOf(this.drones.getChildren());
    this.drones.setAlpha(1);
    this.hidePowerupCoin();
    const c = COIN_DASH;
    this.add.rectangle(c.width / 2, c.height / 2, 460, 150, 0x0a1120, 0.95);
    this.add.text(c.width / 2, c.height / 2,
      `${reason}\n${this.score} points\nPress R to try again`,
      { font: '24px monospace', color: '#ffffff', align: 'center', lineSpacing: 12 }
    ).setOrigin(0.5);
  }
}
window.coinDashGame = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: COIN_DASH.width,
  height: COIN_DASH.height,
  backgroundColor: COIN_DASH.colors.background,
  physics: { default: 'arcade', arcade: { debug: false } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY },
  scene: CoinDash
});
