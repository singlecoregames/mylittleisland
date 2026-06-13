import Phaser from 'phaser';

// Unifies keyboard (PC) and virtual-joystick (mobile) movement into a single
// normalized vector. The joystick vector is written into the game registry by
// UIScene under `joyVec`, keeping the two scenes decoupled.
export class InputController {
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;

  constructor(private scene: Phaser.Scene) {
    const kb = scene.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.wasd = {
      W: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
  }

  // Returns a normalized (or zero) movement direction for this frame.
  getMoveVector(out: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    let x = 0;
    let y = 0;
    if (this.cursors.left.isDown || this.wasd.A.isDown) x -= 1;
    if (this.cursors.right.isDown || this.wasd.D.isDown) x += 1;
    if (this.cursors.up.isDown || this.wasd.W.isDown) y -= 1;
    if (this.cursors.down.isDown || this.wasd.S.isDown) y += 1;

    if (x !== 0 || y !== 0) {
      return out.set(x, y).normalize();
    }

    // Fall back to the joystick vector from UIScene.
    const joy = this.scene.registry.get('joyVec') as { x: number; y: number } | undefined;
    if (joy && (joy.x !== 0 || joy.y !== 0)) {
      return out.set(joy.x, joy.y);
    }
    return out.set(0, 0);
  }
}
