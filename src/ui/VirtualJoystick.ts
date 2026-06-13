import Phaser from 'phaser';
import { TEX } from '../config';

// A dynamic on-screen joystick: appears where the left half of the screen is
// first touched, follows the drag, and reports a normalized direction vector.
// Lives in screen space (scrollFactor 0) so the camera never moves it.
export class VirtualJoystick {
  private base: Phaser.GameObjects.Image;
  private thumb: Phaser.GameObjects.Image;
  private pointerId = -1;
  private originX = 0;
  private originY = 0;
  private maxRadius = 40;

  readonly vector = new Phaser.Math.Vector2(0, 0);

  constructor(private scene: Phaser.Scene) {
    this.base = scene.add
      .image(0, 0, TEX.JOY_BASE)
      .setScrollFactor(0)
      .setDepth(1000)
      .setVisible(false);
    this.thumb = scene.add
      .image(0, 0, TEX.JOY_THUMB)
      .setScrollFactor(0)
      .setDepth(1001)
      .setVisible(false);

    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    // Only claim the left half of the screen for movement.
    if (this.pointerId !== -1) return;
    if (pointer.x > this.scene.scale.width / 2) return;
    this.pointerId = pointer.id;
    this.originX = pointer.x;
    this.originY = pointer.y;
    this.base.setPosition(pointer.x, pointer.y).setVisible(true);
    this.thumb.setPosition(pointer.x, pointer.y).setVisible(true);
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.pointerId) return;
    const dx = pointer.x - this.originX;
    const dy = pointer.y - this.originY;
    const len = Math.hypot(dx, dy);
    const clamped = Math.min(len, this.maxRadius);
    const angle = Math.atan2(dy, dx);
    this.thumb.setPosition(
      this.originX + Math.cos(angle) * clamped,
      this.originY + Math.sin(angle) * clamped,
    );
    // Deadzone so a tiny twitch doesn't drift the frog.
    if (len < 6) {
      this.vector.set(0, 0);
    } else {
      this.vector.set(Math.cos(angle), Math.sin(angle)).scale(clamped / this.maxRadius);
    }
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.pointerId) return;
    this.pointerId = -1;
    this.vector.set(0, 0);
    this.base.setVisible(false);
    this.thumb.setVisible(false);
  }
}
