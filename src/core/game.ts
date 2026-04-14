/**
 * 游戏主循环 - GameLoop
 * 
 * 管理游戏状态、每日循环、行动系统
 */

import { ResourceManager, IResources, ResourceType } from './resources';

// ============================================================
// 类型定义
// ============================================================

/** 行动类型 */
export type ActionType = 
  | 'code'        // 写代码
  | 'refactor'    // 重构
  | 'meeting'     // 开会
  | 'slack'       // 摸鱼
  | 'social'      // 社交
  | 'learn'       // 学习
  | 'overtime';   // 加班

/** 行动配置 */
export interface IAction {
  type: ActionType;
  name: string;
  description: string;
  cost: number;           // 行动点消耗
  effects: Partial<Omit<IResources, 'salary'>> & { salary?: number };
  unlockCondition?: (state: IGameState) => boolean;
}

/** 游戏状态 */
export interface IGameState {
  day: number;
  actionPoints: number;
  maxActionPoints: number;
  resources: IResources;
  isGameOver: boolean;
  gameOverReason?: string;
  history: IDayRecord[];
}

/** 每日记录 */
export interface IDayRecord {
  day: number;
  actions: IActionRecord[];
  events: string[];
  resourcesSnapshot: IResources;
}

/** 行动记录 */
export interface IActionRecord {
  action: ActionType;
  timestamp: number;
  effects: Partial<IResources>;
}

/** 游戏配置 */
export interface IGameConfig {
  maxDays: number;
  initialResources: Partial<IResources>;
}

/** 游戏事件 */
export interface IGameEvent {
  type: 'dayStart' | 'dayEnd' | 'action' | 'gameOver' | 'gameWin';
  data?: any;
}

type GameEventListener = (event: IGameEvent) => void;

// ============================================================
// 行动配置表
// ============================================================

export const ACTIONS: Record<ActionType, IAction> = {
  code: {
    type: 'code',
    name: '写代码',
    description: '产出功能，但会产生技术债',
    cost: 2,
    effects: { sanity: -2, techDebt: 3 }
  },
  refactor: {
    type: 'refactor',
    name: '重构',
    description: '偿还技术债，但很耗费精力',
    cost: 3,
    effects: { sanity: -5, techDebt: -8 }
  },
  meeting: {
    type: 'meeting',
    name: '开会',
    description: '沟通进度，人际关系随机波动',
    cost: 1,
    effects: { sanity: -1 }  // colleagueRel 随机 ±3
  },
  slack: {
    type: 'slack',
    name: '摸鱼',
    description: '恢复理智，但项目进度停滞',
    cost: 1,
    effects: { sanity: 5 }
  },
  social: {
    type: 'social',
    name: '社交',
    description: '和同事搞好关系',
    cost: 2,
    effects: { sanity: 2, colleagueRel: 8 }
  },
  learn: {
    type: 'learn',
    name: '学习',
    description: '提升技能，为未来投资',
    cost: 2,
    effects: { sanity: 1 }
  },
  overtime: {
    type: 'overtime',
    name: '加班',
    description: '额外产出，但 sanity 大减',
    cost: -2,  // 额外获得 2 点行动点
    effects: { sanity: -8 }
  }
};

// ============================================================
// GameLoop 类
// ============================================================

export class GameLoop {
  private _resources: ResourceManager;
  private _day: number = 1;
  private _actionPoints: number = 5;
  private _maxActionPoints: number = 5;
  private _history: IDayRecord[] = [];
  private _todayActions: IActionRecord[] = [];
  private _listeners: GameEventListener[] = [];
  private _isGameOver: boolean = false;
  private _gameOverReason?: string;

  constructor(initialResources?: Partial<IResources>) {
    this._resources = new ResourceManager(initialResources);
    
    // 监听资源变化，检测游戏结束
    this._resources.onChange(() => {
      this._checkGameOver();
    });
  }

  // ------------------ Getters ------------------

  get day(): number { return this._day; }
  get actionPoints(): number { return this._actionPoints; }
  get resources(): ResourceManager { return this._resources; }
  get isGameOver(): boolean { return this._isGameOver; }
  get gameOverReason(): string | undefined { return this._gameOverReason; }
  get history(): Readonly<IDayRecord[]> { return this._history; }

  /** 获取当前可用行动列表 */
  getAvailableActions(): IAction[] {
    return Object.values(ACTIONS).filter(action => {
      // 加班需要至少还有 1 点行动点才能触发
      if (action.type === 'overtime') {
        return this._actionPoints >= 1 && this._actionPoints < 5;
      }
      return action.cost <= this._actionPoints;
    });
  }

  // ------------------ 游戏事件 ------------------

  on(event: IGameEvent['type'], listener: GameEventListener): () => void {
    const wrapped: GameEventListener = (e) => {
      if (e.type === event) listener(e);
    };
    this._listeners.push(wrapped);
    return () => {
      this._listeners = this._listeners.filter(l => l !== wrapped);
    };
  }

  private _emit(event: IGameEvent): void {
    this._listeners.forEach(l => l(event));
  }

  // ------------------ 行动系统 ------------------

  /**
   * 执行行动
   * @param actionType 行动类型
   * @returns 是否执行成功
   */
  performAction(actionType: ActionType): boolean {
    if (this._isGameOver) {
      console.warn('游戏已结束，无法执行行动');
      return false;
    }

    const action = ACTIONS[actionType];
    
    // 检查行动点
    if (action.type === 'overtime') {
      // 加班：消耗当前剩余行动点，获得 2 额外行动点
      if (this._actionPoints < 1) return false;
    } else {
      if (this._actionPoints < action.cost) return false;
    }

    // 计算实际效果
    let effects = { ...action.effects };
    
    // 特殊处理：开会随机影响同事关系
    if (actionType === 'meeting') {
      const randomRel = Math.random() > 0.5 ? 3 : -3;
      effects.colleagueRel = randomRel;
    }

    // 应用效果
    this._resources.applyEffects(effects);
    
    // 消耗/增加行动点
    if (actionType === 'overtime') {
      this._actionPoints += 2;  // 加班获得 2 点
    } else {
      this._actionPoints -= action.cost;
    }

    // 记录行动
    const record: IActionRecord = {
      action: actionType,
      timestamp: Date.now(),
      effects
    };
    this._todayActions.push(record);

    // 触发事件
    this._emit({ type: 'action', data: { action, effects, record } });

    // 检查游戏结束
    this._checkGameOver();

    return true;
  }

  /**
   * 快速执行行动（通过名称）
   */
  do(actionName: string): boolean {
    const action = Object.values(ACTIONS).find(a => a.name === actionName || a.type === actionName);
    if (action) {
      return this.performAction(action.type);
    }
    return false;
  }

  // ------------------ 天数推进 ------------------

  /**
   * 结束当天，进入下一天
   */
  nextDay(): boolean {
    if (this._isGameOver) return false;

    // 保存今日记录
    const dayRecord: IDayRecord = {
      day: this._day,
      actions: [...this._todayActions],
      events: [],  // TODO: 添加随机事件
      resourcesSnapshot: this._resources.getSnapshot()
    };
    this._history.push(dayRecord);

    // 每日结算效果
    this._applyDailyEffects();

    // 天数 +1
    this._day++;
    this._actionPoints = this._maxActionPoints;
    this._todayActions = [];

    // 触发事件
    this._emit({ type: 'dayStart', data: { day: this._day } });

    // 检查 30 天结局
    if (this._day > 30) {
      this._triggerEnding();
    }

    return true;
  }

  /** 每日自动效果 */
  private _applyDailyEffects(): void {
    // 技术债每日轻微增长
    this._resources.modify('techDebt', 1);
    
    // 低同事关系每日影响 sanity
    if (this._resources.colleagueRel < 20) {
      this._resources.modify('sanity', -2);
    }
  }

  // ------------------ 游戏结束 ------------------

  private _checkGameOver(): void {
    if (this._isGameOver) return;

    const reason = this._resources.checkGameOver();
    if (reason) {
      this._isGameOver = true;
      this._gameOverReason = this._getGameOverText(reason);
      this._emit({ type: 'gameOver', data: { reason, day: this._day } });
    }
  }

  private _getGameOverText(reason: string): string {
    const texts: Record<string, string> = {
      'burnout': '💔 精神崩溃 - 你辞职去西藏疗伤',
      'systemCrash': '💥 系统崩溃 - 公司倒闭，全员解散',
      'isolated': '😶 被孤立 - 同事集体投票让你离职'
    };
    return texts[reason] || '游戏结束';
  }

  /** 30 天结局 */
  private _triggerEnding(): void {
    const savings = this._resources.salary * this._day;  // 简化计算
    
    if (savings > 200000) {
      this._gameOverReason = '🏆 财务自由！你攒够了钱，提前退休';
      this._emit({ type: 'gameWin', data: { ending: 'financial_freedom' } });
    } else if (this._resources.sanity > 60) {
      this._gameOverReason = '🌟 平稳着陆 - 30天过去，你依然清醒';
      this._emit({ type: 'gameWin', data: { ending: 'survived' } });
    } else {
      this._gameOverReason = '😰 勉强支撑 - 你需要一个长假';
      this._emit({ type: 'gameOver', data: { ending: 'burnout_risk' } });
    }
    this._isGameOver = true;
  }

  // ------------------ 存档 / 读档 ------------------

  serialize(): IGameState {
    return {
      day: this._day,
      actionPoints: this._actionPoints,
      maxActionPoints: this._maxActionPoints,
      resources: this._resources.getSnapshot(),
      isGameOver: this._isGameOver,
      gameOverReason: this._gameOverReason,
      history: this._history
    };
  }

  deserialize(state: IGameState): void {
    this._day = state.day;
    this._actionPoints = state.actionPoints;
    this._maxActionPoints = state.maxActionPoints;
    this._resources.deserialize(state.resources);
    this._isGameOver = state.isGameOver;
    this._gameOverReason = state.gameOverReason;
    this._history = [...state.history];
  }

  // ------------------ 重置 ------------------

  reset(initialResources?: Partial<IResources>): void {
    this._day = 1;
    this._actionPoints = 5;
    this._maxActionPoints = 5;
    this._history = [];
    this._todayActions = [];
    this._isGameOver = false;
    this._gameOverReason = undefined;
    this._resources.reset(initialResources);
  }
}
