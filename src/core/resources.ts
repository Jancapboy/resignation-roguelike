/**
 * 四维资源系统 - ResourceManager
 *
 * 管理离职模拟器中的核心资源：
 * - sanity: 理智值 (0-100)
 * - techDebt: 技术债 (0-100)
 * - salary: 薪资 (0-∞)
 * - colleagueRel: 同事关系 (0-100)
 */

// ============================================================
// 类型定义
// ============================================================

/** 0-100 范围的资源值（branded type，防止误用） */
export type ResourceValue = number & { __brand: '0-100' };

/** 资源类型 */
export type ResourceType = 'sanity' | 'techDebt' | 'salary' | 'colleagueRel';

/** 资源快照接口 */
export interface IResources {
  sanity: ResourceValue;
  techDebt: ResourceValue;
  salary: number;
  colleagueRel: ResourceValue;
}

/** 资源变化事件 */
export interface IResourceChangeEvent {
  type: ResourceType;
  oldValue: number;
  newValue: number;
  delta: number;
}

/** 资源变化监听器 */
export type ResourceChangeListener = (event: IResourceChangeEvent) => void;

/** 游戏结束原因 */
export type GameOverReason = 'burnout' | 'systemCrash' | 'isolated' | null;

// ============================================================
// 工具函数
// ============================================================

/** 将数值限制在 0-100 范围内 */
export function clampResource(value: number): ResourceValue {
  return Math.max(0, Math.min(100, value)) as ResourceValue;
}

/** 判断单个资源是否超出 0-100 范围 */
export function isValidResourceValue(value: number): boolean {
  return value >= 0 && value <= 100;
}

// ============================================================
// ResourceManager 类
// ============================================================

export class ResourceManager {
  private _resources: IResources;
  private _listeners: ResourceChangeListener[] = [];

  constructor(initial?: Partial<IResources>) {
    this._resources = {
      sanity: clampResource(initial?.sanity ?? 50),
      techDebt: clampResource(initial?.techDebt ?? 20),
      salary: Math.max(0, initial?.salary ?? 8000),
      colleagueRel: clampResource(initial?.colleagueRel ?? 50),
    };
  }

  // ------------------ Getters ------------------

  get sanity(): ResourceValue {
    return this._resources.sanity;
  }

  get techDebt(): ResourceValue {
    return this._resources.techDebt;
  }

  get salary(): number {
    return this._resources.salary;
  }

  get colleagueRel(): ResourceValue {
    return this._resources.colleagueRel;
  }

  /** 获取完整资源快照 */
  getSnapshot(): Readonly<IResources> {
    return { ...this._resources };
  }

  // ------------------ 修改资源 ------------------

  /**
   * 设置指定资源的绝对值
   * @param type 资源类型
   * @param value 目标值（salary 除外会自动 clamp 到 0-100）
   */
  set(type: ResourceType, value: number): void {
    const oldValue = this._resources[type];
    const newValue = type === 'salary' ? Math.max(0, value) : clampResource(value);

    if (oldValue === newValue) return;

    (this._resources[type] as number) = newValue;
    this._emit({
      type,
      oldValue,
      newValue,
      delta: newValue - oldValue,
    });
  }

  /**
   * 按增量修改资源
   * @param type 资源类型
   * @param delta 变化量（正或负）
   */
  modify(type: ResourceType, delta: number): void {
    if (delta === 0) return;
    this.set(type, this._resources[type] + delta);
  }

  /**
   * 批量修改多个资源
   * @param deltas 各资源的变化量
   */
  modifyBatch(deltas: Partial<Record<ResourceType, number>>): void {
    (Object.keys(deltas) as ResourceType[]).forEach((type) => {
      const delta = deltas[type];
      if (delta !== undefined) {
        this.modify(type, delta);
      }
    });
  }

  /**
   * 直接应用事件/行动的效果对象
   * @param effects 效果映射（键与资源名一致）
   */
  applyEffects(effects: Partial<Omit<IResources, 'salary'>> & { salary?: number }): void {
    (Object.keys(effects) as ResourceType[]).forEach((type) => {
      const delta = effects[type];
      if (delta !== undefined) {
        this.modify(type, delta);
      }
    });
  }

  // ------------------ 事件监听 ------------------

  /** 订阅资源变化事件 */
  onChange(listener: ResourceChangeListener): () => void {
    this._listeners.push(listener);
    return () => this.offChange(listener);
  }

  /** 取消订阅 */
  offChange(listener: ResourceChangeListener): void {
    this._listeners = this._listeners.filter((l) => l !== listener);
  }

  private _emit(event: IResourceChangeEvent): void {
    this._listeners.forEach((listener) => listener(event));
  }

  // ------------------ 存档 / 读档 ------------------

  /** 序列化为普通对象（可用于 JSON.stringify） */
  serialize(): IResources {
    return { ...this._resources };
  }

  /** 从存档数据恢复状态 */
  deserialize(data: IResources): void {
    const oldSnapshot = { ...this._resources };

    this._resources = {
      sanity: clampResource(data.sanity),
      techDebt: clampResource(data.techDebt),
      salary: Math.max(0, data.salary),
      colleagueRel: clampResource(data.colleagueRel),
    };

    // 恢复后触发变更事件，让 UI/游戏循环感知
    (Object.keys(this._resources) as ResourceType[]).forEach((type) => {
      const oldValue = oldSnapshot[type];
      const newValue = this._resources[type];
      if (oldValue !== newValue) {
        this._emit({
          type,
          oldValue,
          newValue,
          delta: newValue - oldValue,
        });
      }
    });
  }

  // ------------------ 游戏状态检查 ------------------

  /** 检查是否触发强制离职 */
  checkGameOver(): GameOverReason {
    if (this._resources.sanity <= 0) return 'burnout';
    if (this._resources.techDebt >= 100) return 'systemCrash';
    if (this._resources.colleagueRel <= 0) return 'isolated';
    return null;
  }

  /** 是否已游戏结束 */
  get isGameOver(): boolean {
    return this.checkGameOver() !== null;
  }

  /** 重置为默认值 */
  reset(initial?: Partial<IResources>): void {
    this.deserialize({
      sanity: clampResource(initial?.sanity ?? 50),
      techDebt: clampResource(initial?.techDebt ?? 20),
      salary: Math.max(0, initial?.salary ?? 8000),
      colleagueRel: clampResource(initial?.colleagueRel ?? 50),
    });
  }
}
