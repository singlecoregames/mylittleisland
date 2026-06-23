import Phaser from 'phaser';
import { GAME } from '../config';
import type { UpgradeChoice } from '../systems/UpgradeSystem';

export interface LevelUpData {
  choices: UpgradeChoice[];
  onPick: (choice: UpgradeChoice) => void;
}

// Pause overlay: dims the run and presents the 3-choice upgrade cards. Calls
// back into GameScene with the picked choice, which applies it and resumes.
export class LevelUpScene extends Phaser.Scene {
  constructor() {
    super('LevelUp');
  }

  create(data: LevelUpData): void {
    const { choices, onPick } = data;

    // Full-screen dim that also blocks input to the scenes beneath.
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

    const cardW = 184;
    const cardH = 200;
    const gap = 14;
    const totalW = choices.length * cardW + (choices.length - 1) * gap;
    const startX = (GAME.WIDTH - totalW) / 2;
    const y = 70;

    choices.forEach((choice, i) => {
      const x = startX + i * (cardW + gap);
      this.createCard(x, y, cardW, cardH, choice, () => onPick(choice));
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

    this.add.rectangle(x, y, w, 6, color).setOrigin(0, 0);

    this.add
      .text(x + w / 2, y + 30, choice.name, {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: w - 16 },
      })
      .setOrigin(0.5, 0);

    this.add
      .text(x + w / 2, y + h - 60, choice.desc, {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#aebbd6',
        align: 'center',
        wordWrap: { width: w - 20 },
      })
      .setOrigin(0.5, 0.5);

    this.add
      .text(x + w / 2, y + h - 18, this.categoryLabel(choice.category), {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: Phaser.Display.Color.IntegerToColor(color).rgba,
      })
      .setOrigin(0.5);

    bg.on(Phaser.Input.Events.POINTER_OVER, () => bg.setFillStyle(0x27345c, 1));
    bg.on(Phaser.Input.Events.POINTER_OUT, () => bg.setFillStyle(0x1b2440, 1));
    bg.on(Phaser.Input.Events.POINTER_DOWN, onSelect);
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
