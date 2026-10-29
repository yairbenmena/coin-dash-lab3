/* global Phaser, COIN_DASH */
class CoinDash extends Phaser.Scene {
  constructor() { super('CoinDash'); }

  create() {
    const c = COIN_DASH;
    this.score = 0;
    this.finished = false;
    this.deadline = this.time.now + c.roundSeconds * 1000;
    this.board = new Phaser.Geom.Rectangle(0, 44, c.width, c.height - 44);
    this.physics.world.setBounds(this.board.x, this.board.y, this.board.width, this.board.height);
    this.add.grid(c.width / 2, c.height / 2, c.width, c.height, 40, 40,
      c.colors.background, 1, 0x24334b, 0.45);
    this.shade = this.add.graphics();
    this.drawBoard();
    this.hud = this.add.text(18, 12, '', { font: '18px monospace', color: '#ffffff' });
    this.player = this.add.rectangle(c.width / 2, c.height / 2, 24, 24, c.colors.player);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);
    this.coin = this.add.circle(100, 100, 9, c.colors.coin);
    this.physics.add.existing(this.coin);
    this.coin.body.setCircle(9);
    this.placeCoin();
    this.drones = this.physics.add.group();
    for (let i = 0; i < c.droneCount; i++) {
      const drone = this.add.rectangle(90 + i * 270, 100, 26, 26, c.colors.drone);
      this.drones.add(drone);
      drone.body.setCollideWorldBounds(true).setBounce(1, 1);
      const angle = (35 + i * 105) * Math.PI / 180;
      drone.body.setVelocity(Math.cos(angle) * c.droneSpeed, Math.sin(angle) * c.droneSpeed);
    }
    this.speedup = this.time.addEvent({
      delay: c.droneSpeedupIntervalSeconds * 1000,
      loop: true,
      callback: () => {
        const drones = this.drones.getChildren();
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
    this.physics.add.overlap(this.player, this.drones, () => this.finish('A drone caught you!'));
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

  placeCoin() {
    const b = this.board;
    // Avoid spawning the next coin directly underneath the player (give up after a few tries).
    let x, y, tries = 0;
    do {
      x = Phaser.Math.Between(b.left + 25, b.right - 25);
      y = Phaser.Math.Between(b.top + 25, b.bottom - 25);
    } while (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < 60 && ++tries < 30);
    this.coin.setPosition(x, y);
    this.coin.body.reset(x, y);
  }

  update() {
    if (this.finished) return;
    const dx = Number(this.cursors.right.isDown || this.keys.D.isDown)
      - Number(this.cursors.left.isDown || this.keys.A.isDown);
    const dy = Number(this.cursors.down.isDown || this.keys.S.isDown)
      - Number(this.cursors.up.isDown || this.keys.W.isDown);
    const direction = new Phaser.Math.Vector2(dx, dy).normalize().scale(COIN_DASH.playerSpeed);
    this.player.body.setVelocity(direction.x, direction.y);
    const seconds = Math.max(0, Math.ceil((this.deadline - this.time.now) / 1000));
    this.hud.setText(`Coins: ${this.score}                       Time: ${seconds}s`);
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
    const c = COIN_DASH;
    this.add.rectangle(c.width / 2, c.height / 2, 460, 150, 0x0a1120, 0.95);
    this.add.text(c.width / 2, c.height / 2,
      `${reason}\n${this.score} coins collected\nPress R to try again`,
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
