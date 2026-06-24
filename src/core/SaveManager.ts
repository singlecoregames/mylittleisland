// Persists meta (between-run) progression to localStorage. Everything that
// survives a run lives here: the permanent currency (amber) and the set of
// unlocked meta-graph node ids. Reads are defensive so a corrupt or partial
// payload degrades to defaults instead of throwing.
const STORAGE_KEY = 'mli.save.v1';

export interface SaveData {
  version: number;
  amber: number; // permanent currency earned from runs
  nodes: string[]; // unlocked meta-graph node ids (used from M5 step 2)
  muted: boolean; // SFX muted (settings)
}

const DEFAULT: SaveData = { version: 1, amber: 0, nodes: [], muted: false };

export class SaveManager {
  static load(): SaveData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT, nodes: [] };
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      return {
        version: DEFAULT.version,
        amber: typeof parsed.amber === 'number' && parsed.amber >= 0 ? parsed.amber : 0,
        nodes: Array.isArray(parsed.nodes) ? parsed.nodes.filter((n) => typeof n === 'string') : [],
        muted: parsed.muted === true,
      };
    } catch {
      // localStorage blocked (private mode) or malformed JSON — start fresh.
      return { ...DEFAULT, nodes: [] };
    }
  }

  static save(data: SaveData): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Storage unavailable — progress simply won't persist this session.
    }
  }

  // Adds currency and persists, returning the updated save for convenience.
  static addAmber(amount: number): SaveData {
    const data = this.load();
    data.amber = Math.max(0, data.amber + amount);
    this.save(data);
    return data;
  }

  // Spends amber to unlock a meta-graph node, persisting the result. No-op (and
  // returns the unchanged save) if already owned or unaffordable.
  static spendAndUnlock(id: string, cost: number): SaveData {
    const data = this.load();
    if (data.nodes.includes(id) || data.amber < cost) return data;
    data.amber -= cost;
    data.nodes.push(id);
    this.save(data);
    return data;
  }

  // Persists the SFX mute setting, returning the updated save.
  static setMuted(muted: boolean): SaveData {
    const data = this.load();
    data.muted = muted;
    this.save(data);
    return data;
  }

  static reset(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}
