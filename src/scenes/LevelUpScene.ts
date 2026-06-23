import Phaser from 'phaser';
import { GAME } from '../config';
import type { UpgradeChoice } from '../systems/UpgradeSystem';

export interface LevelUpData {
  choices: UpgradeChoice[];
  onPick: (choice: UpgradeChoice) => void;
}

// Pause overlay: dims the run and presents the 3-choice upgrade cards. Calls
// back into GameScene with the picked choice. The scene is launched once and
// refreshed via showChoices() for each queued level-up (restarting the scene
// mid-tick was unreliable on the web).
export class LevelUpScene extends Phaser.Scene {
  private onPick!: (choice: UpgradeChoice) => void;
  private cardObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('LevelUp');
  }

  create(data: LevelUpData): void {
    this.onPick = data.onPick;

    // Full-screen dim that also blocks input to the scenes beneath. Topmost
    // scene wins input, so this keeps stray HUD taps from leaking through.
    this.input.topOnly = true;
    this.add
      .rectangle(0, 0, GAME.WIDTH, GAME.HEIGHT, 0x000000, 0.6)
      .setOrigin(0, 0)
      .setInteractive();

    this.add
      .text(GAME.WIDTH / 2, 34, 'LEVEL UP!', {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#ffe66d',
      })
      .setOrigin(0.5);

    this.showChoices(data.choices);
  }

  // Replaces the current cards with a fresh set (used for queued level-ups).
  showChoices(choices: UpgradeChoice[]): void {
    this.cardObjects.forEach((o) => o.destroy());
    this.cardObjects = [];

    const cardW = 184;
    const cardH = 200;
    const gap = 14;
    const totalW = choices.length * cardW + (choices.length - 1) * gap;
    const startX = (GAME.WIDTH - totalW) / 2;
    const y = 70;

    choices.forEach((choice, i) => {
      const x = startX + i * (cardW + gap);
      this.createCard(x, y, cardW, cardH, choice, () => this.onPick(choice));
    });
  }

  private createCard(
    x: number,
    y: number,
    w: number,
    h: number,
    choice: UpgradeChoice,
    onSelect: () => void,
  ): void {
    const color = this.categoryColor(choice.category);

    const bg = this.add
      .rectangle(x, y, w, h, 0x1b2440, 1)
      .setOrigin(0, 0)
      .setStrokeStyle(2, color)
      .setInteractive({ useHandCursor: true });

    const stripe = this.add.rectangle(x, y, w, 6, color).setOrigin(0, 0);

    const name = this.add
      .text(x + w / 2, y + 30, choice.name, {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: w - 16 },
      })
      .setOrigin(0.5, 0);

    const desc = this.add
      .text(x + w / 2, y + h - 60, choice.desc, {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#aebbd6',
        align: 'center',
        wordWrap: { width: w - 20 },
      })
      .setOrigin(0.5, 0.5);

    const label = this.add
      .text(x + w / 2, y + h - 18, this.categoryLabel(choice.category), {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: Phaser.Display.Color.IntegerToColor(color).rgba,
      })
      .setOrigin(0.5);

    bg.on(Phaser.Input.Events.POINTER_OVER, () => bg.setFillStyle(0x27345c, 1));
    bg.on(Phaser.Input.Events.POINTER_OUT, () => bg.setFillStyle(0x1b2440, 1));
    // `once` so a single card can't fire twice before the cards are rebuilt.
    bg.once(Phaser.Input.Events.POINTER_DOWN, onSelect);

    this.cardObjects.push(bg, stripe, name, desc, label);
  }

  private categoryColor(category: UpgradeChoice['category']): number {
    switch (category) {
      case 'weapon':
        return 0xffcc33;
      case 'weaponLevel':
        return 0xff7a5f;
      case 'passive':
        return 0x6fcf4f;
      case 'structure':
        return 0x33dd55;
    }
  }

  private categoryLabel(category: UpgradeChoice['category']): string {
    switch (category) {
      case 'weapon':
        return '신규 무기';
      case 'weaponLevel':
        return '무기 강화';
      case 'passive':
        return '패시브';
      case 'structure':
        return '시설';
    }
  }
}
