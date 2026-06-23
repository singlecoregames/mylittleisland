import Phaser from 'phaser';
import type { RunState } from '../state/RunState';
import type { WeaponSystem } from './WeaponSystem';
import { WEAPONS, MAX_WEAPON_SLOTS } from '../data/weapons';

// One selectable level-up card.
export interface UpgradeChoice {
  id: string;
  name: string;
  desc: string;
  category: 'weapon' | 'weaponLevel' | 'passive' | 'structure';
  weight: number;
  apply: () => void;
}

// Builds weighted 3-choice card sets from the current run state. Weapon
// acquire/upgrade options are generated dynamically; passive stat boosts are
// always available.
export class UpgradeSystem {
  constructor(
    private run: RunState,
    private weapons: WeaponSystem,
    private grantBuildCredit: () => void,
  ) {}

  apply(choice: UpgradeChoice): void {
    choice.apply();
  }

  // Returns up to `n` distinct weighted-random choices. Falls back to a "heal"
  // card if the pool is somehow empty.
  getChoices(n: number): UpgradeChoice[] {
    const pool = this.buildPool();
    const chosen: UpgradeChoice[] = [];
    while (chosen.length < n && pool.length > 0) {
      const pick = this.weightedPick(pool);
      chosen.push(pick);
      pool.splice(pool.indexOf(pick), 1);
    }
    if (chosen.length === 0) {
      chosen.push({
        id: 'heal',
        name: '휴식',
        desc: '체력을 25 회복',
        category: 'passive',
        weight: 1,
        apply: () => {
          this.run.hp = Math.min(this.run.maxHp, this.run.hp + 25);
        },
      });
    }
    return chosen;
  }

  private buildPool(): UpgradeChoice[] {
    const out: UpgradeChoice[] = [];
    const rs = this.run;

    for (const def of Object.values(WEAPONS)) {
      const level = rs.weapons.get(def.id) ?? 0;
      if (level === 0) {
        if (rs.weapons.size < MAX_WEAPON_SLOTS) {
          out.push({
            id: `get-${def.id}`,
            name: `${def.name} 획득`,
            desc: this.weaponDesc(def.kind),
            category: 'weapon',
            weight: 10,
            apply: () => this.weapons.addOrUpgrade(def.id),
          });
        }
      } else if (level < def.maxLevel) {
        out.push({
          id: `up-${def.id}`,
          name: `${def.name} Lv.${level + 1}`,
          desc: '데미지 +25%, 일정 레벨마다 효과 강화',
          category: 'weaponLevel',
          weight: 8,
          apply: () => this.weapons.addOrUpgrade(def.id),
        });
      }
    }

    out.push(
      {
        id: 'pas-spd',
        name: '이동 속도 +10%',
        desc: '더 빠르게 움직인다',
        category: 'passive',
        weight: 6,
        apply: () => {
          rs.moveSpeed *= 1.1;
        },
      },
      {
        id: 'pas-dmg',
        name: '공격력 +15%',
        desc: '모든 무기 데미지 증가',
        category: 'passive',
        weight: 6,
        apply: () => {
          rs.damageMult *= 1.15;
        },
      },
      {
        id: 'pas-cdr',
        name: '쿨다운 -8%',
        desc: '무기 발동이 빨라진다',
        category: 'passive',
        weight: 5,
        apply: () => {
          rs.cooldownMult *= 0.92;
        },
      },
      {
        id: 'pas-hp',
        name: '최대 체력 +20',
        desc: '최대 체력 증가 + 20 회복',
        category: 'passive',
        weight: 5,
        apply: () => {
          rs.maxHp += 20;
          rs.hp = Math.min(rs.maxHp, rs.hp + 20);
        },
      },
      {
        id: 'pas-pickup',
        name: '획득 범위 +20%',
        desc: '경험치 흡수 범위 증가',
        category: 'passive',
        weight: 4,
        apply: () => {
          rs.pickupRadius *= 1.2;
        },
      },
      {
        id: 'pas-proj',
        name: '투사체 +1',
        desc: '발사형 무기의 투사체 수 증가',
        category: 'passive',
        weight: 3,
        apply: () => {
          rs.extraProjectiles += 1;
        },
      },
      {
        id: 'struct-cannon',
        name: '수련 포탑 설치권',
        desc: '빌드 버튼으로 땅에 자동 포탑을 1개 설치',
        category: 'structure',
        weight: 5,
        apply: () => this.grantBuildCredit(),
      },
    );

    return out;
  }

  private weaponDesc(kind: string): string {
    switch (kind) {
      case 'projectile':
        return '가장 가까운 적에게 자동 발사';
      case 'melee':
        return '근접한 적을 자동 타격';
      case 'aura':
        return '주변 적에게 지속 광역 피해';
      default:
        return '';
    }
  }

  private weightedPick(pool: UpgradeChoice[]): UpgradeChoice {
    const total = pool.reduce((s, c) => s + c.weight, 0);
    let r = Phaser.Math.FloatBetween(0, total);
    for (const c of pool) {
      r -= c.weight;
      if (r <= 0) return c;
    }
    return pool[pool.length - 1];
  }
}
