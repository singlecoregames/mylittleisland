import Phaser from 'phaser';
import { GAME, SCENE_KEYS } from '../config';
import { SaveManager } from '../core/SaveManager';
import {
  META_NODES,
  META_BY_ID,
  FREE_NODE_IDS,
  CATEGORY_COLOR,
  type MetaNode,
} from '../data/metaNodes';

const NODE_RADIUS = 28;
const ZOOM_MIN = 0.6;
const ZOOM_MAX = 2.2;
const DRAG_THRESHOLD = 8; // px of pointer travel before a tap counts as a pan

// Permanent upgrade screen: a fixed-layout node graph the player pans and zooms
// over (drag = pan, wheel/pinch = zoom). Nodes are bought with amber and saved.
// The graph lives on the main camera; a second camera renders the fixed HUD so
// it neither pans nor scales with zoom.
export class MetaScene extends Phaser.Scene {
  private uiCam!: Phaser.Cameras.Scene2D.Camera;
  private unlocked = new Set<string>();
  private amber = 0;

  private graphObjects: Phaser.GameObjects.GameObject[] = [];
  private uiObjects: Phaser.GameObjects.GameObject[] = [];
  private amberText!: Phaser.GameObjects.Text;
  private tooltip!: Phaser.GameObjects.Text;

  private dragDist = 0;
  private pinchDist = 0;

  constructor() {
    super(SCENE_KEYS.META);
  }

  create(): void {
    const save = SaveManager.load();
    this.amber = save.amber;
    this.unlocked = new Set([...FREE_NODE_IDS, ...save.nodes]);

    this.cameras.main.setBackgroundColor('#0b1021');

    // Center the main camera on the graph's bounding box.
    const xs = META_NODES.map((n) => n.position.x);
    const ys = META_NODES.map((n) => n.position.y);
    const midX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const midY = (Math.min(...ys) + Math.max(...ys)) / 2;
    this.cameras.main.centerOn(midX, midY);

    // Second camera for the fixed HUD layer.
    this.uiCam = this.cameras.add(0, 0, GAME.WIDTH, GAME.HEIGHT);

    this.buildUi();
    this.buildGraph();
    this.installControls();
  }

  // --- Fixed HUD (rendered only by uiCam) ---------------------------------

  private buildUi(): void {
    const title = this.add
      .text(GAME.WIDTH / 2, 8, '영구 업그레이드', {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#ffffff',
      })
      .setOrigin(0.5, 0);

    this.amberText = this.add.text(8, 8, '', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#ffd166',
    });

    const hint = this.add
      .text(GAME.WIDTH - 8, 8, '드래그 이동 · 휠/핀치 확대', {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#6b7794',
      })
      .setOrigin(1, 0);

    this.tooltip = this.add
      .text(GAME.WIDTH / 2, GAME.HEIGHT - 44, '', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#aebbd6',
        align: 'center',
        wordWrap: { width: GAME.WIDTH - 40 },
      })
      .setOrigin(0.5, 1);

    const btnBg = this.add
      .rectangle(GAME.WIDTH / 2, GAME.HEIGHT - 14, 130, 24, 0x33dd55)
      .setOrigin(0.5, 1)
      .setInteractive({ useHandCursor: true });
    const btnText = this.add
      .text(GAME.WIDTH / 2, GAME.HEIGHT - 26, '런 시작 ▶', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#06210f',
      })
      .setOrigin(0.5);

    btnBg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
      if (this.dragDist < DRAG_THRESHOLD) this.scene.start(SCENE_KEYS.GAME);
    });

    this.uiObjects = [title, this.amberText, hint, this.tooltip, btnBg, btnText];
    this.refreshAmber();

    // The main camera must not render the HUD (it would pan/zoom with the graph).
    this.cameras.main.ignore(this.uiObjects);
  }

  private refreshAmber(): void {
    this.amberText.setText(`호박석  ${this.amber}`);
  }

  // --- Graph (rendered only by main camera) -------------------------------

  private buildGraph(): void {
    this.graphObjects.forEach((o) => o.destroy());
    this.graphObjects = [];

    // Edges first so nodes draw on top.
    const edges = this.add.graphics();
    for (const node of META_NODES) {
      for (const reqId of node.requires) {
        const from = META_BY_ID.get(reqId);
        if (!from) continue;
        const lit = this.unlocked.has(node.id) && this.unlocked.has(reqId);
        edges.lineStyle(lit ? 3 : 2, lit ? 0x49c2ff : 0x2a3350, lit ? 0.9 : 0.6);
        edges.lineBetween(from.position.x, from.position.y, node.position.x, node.position.y);
      }
    }
    this.graphObjects.push(edges);

    for (const node of META_NODES) this.graphObjects.push(this.buildNode(node));

    // Keep the HUD camera from rendering the graph.
    this.uiCam.ignore(this.graphObjects);
  }

  private buildNode(node: MetaNode): Phaser.GameObjects.Container {
    const owned = this.unlocked.has(node.id);
    const reqMet = node.requires.every((r) => this.unlocked.has(r));
    const affordable = reqMet && !owned && this.amber >= node.cost;
    const color = CATEGORY_COLOR[node.category];

    const circle = this.add.graphics();
    if (owned) {
      circle.fillStyle(color, 1);
      circle.fillCircle(0, 0, NODE_RADIUS);
      circle.lineStyle(3, 0xffffff, 0.9);
    } else if (reqMet) {
      circle.fillStyle(color, 0.22);
      circle.fillCircle(0, 0, NODE_RADIUS);
      circle.lineStyle(2, color, affordable ? 1 : 0.5);
    } else {
      circle.fillStyle(0x1b2238, 0.9);
      circle.fillCircle(0, 0, NODE_RADIUS);
      circle.lineStyle(2, 0x2a3350, 1);
    }
    circle.strokeCircle(0, 0, NODE_RADIUS);

    const nameColor = owned || reqMet ? '#ffffff' : '#6b7794';
    const name = this.add
      .text(0, -4, node.name, {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: nameColor,
        align: 'center',
        wordWrap: { width: NODE_RADIUS * 2 - 4 },
      })
      .setOrigin(0.5);

    const label = owned ? '✓' : node.cost === 0 ? '' : `◈${node.cost}`;
    const costColor = owned ? '#33dd55' : affordable ? '#ffd166' : '#6b7794';
    const cost = this.add
      .text(0, 12, label, {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: costColor,
      })
      .setOrigin(0.5);

    const container = this.add.container(node.position.x, node.position.y, [circle, name, cost]);
    container.setSize(NODE_RADIUS * 2, NODE_RADIUS * 2);
    container.setInteractive(
      new Phaser.Geom.Circle(0, 0, NODE_RADIUS),
      Phaser.Geom.Circle.Contains,
    );

    container.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
      this.tooltip.setText(`${node.name} — ${node.description}`);
    });
    container.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
      if (this.dragDist >= DRAG_THRESHOLD) return; // it was a pan, not a tap
      this.tryUnlock(node);
    });

    return container;
  }

  private tryUnlock(node: MetaNode): void {
    if (this.unlocked.has(node.id)) {
      this.tooltip.setText(`${node.name} — 이미 해금됨`);
      return;
    }
    if (!node.requires.every((r) => this.unlocked.has(r))) {
      this.tooltip.setText(`${node.name} — 선행 노드 필요`);
      return;
    }
    if (this.amber < node.cost) {
      this.tooltip.setText(`${node.name} — 호박석 부족 (${node.cost} 필요)`);
      return;
    }

    const save = SaveManager.spendAndUnlock(node.id, node.cost);
    this.amber = save.amber;
    this.unlocked = new Set([...FREE_NODE_IDS, ...save.nodes]);
    this.refreshAmber();
    this.buildGraph();
    this.tooltip.setText(`${node.name} 해금!`);
  }

  // --- Pan / zoom controls -------------------------------------------------

  private installControls(): void {
    this.input.on(Phaser.Input.Events.POINTER_DOWN, () => {
      this.dragDist = 0;
    });

    this.input.on(
      Phaser.Input.Events.POINTER_MOVE,
      (pointer: Phaser.Input.Pointer) => {
        if (!pointer.isDown || this.pinchDist > 0) return;
        const dx = pointer.x - pointer.prevPosition.x;
        const dy = pointer.y - pointer.prevPosition.y;
        this.dragDist += Math.abs(dx) + Math.abs(dy);
        const cam = this.cameras.main;
        cam.scrollX -= dx / cam.zoom;
        cam.scrollY -= dy / cam.zoom;
      },
    );

    this.input.on(
      Phaser.Input.Events.POINTER_WHEEL,
      (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
        this.zoomBy(dy > 0 ? 0.9 : 1.1);
      },
    );
  }

  private zoomBy(factor: number): void {
    const cam = this.cameras.main;
    cam.setZoom(Phaser.Math.Clamp(cam.zoom * factor, ZOOM_MIN, ZOOM_MAX));
  }

  update(): void {
    // Pinch-to-zoom (two active pointers).
    const p1 = this.input.pointer1;
    const p2 = this.input.pointer2;
    if (p1.isDown && p2.isDown) {
      const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
      if (this.pinchDist > 0 && dist > 0) this.zoomBy(dist / this.pinchDist);
      this.pinchDist = dist;
      this.dragDist = DRAG_THRESHOLD; // suppress tap-unlock while pinching
    } else {
      this.pinchDist = 0;
    }
  }
}
