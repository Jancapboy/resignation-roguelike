/**
 * 事件系统 - EventManager
 * 
 * 管理随机事件的触发、条件判断、效果应用
 */

import { IResources } from './resources';

// ============================================================
// 类型定义
// ============================================================

/** 事件类型 */
export type EventType = 'normal' | 'crisis' | 'opportunity';

/** 事件条件 */
export interface IEventCondition {
  minSanity?: number;
  maxSanity?: number;
  minTechDebt?: number;
  maxTechDebt?: number;
  minColleagueRel?: number;
  maxColleagueRel?: number;
  minDay?: number;
  maxDay?: number;
}

/** 事件选择 */
export interface IEventChoice {
  text: string;
  effects: Partial<Omit<IResources, 'salary'>> & { salary?: number };
}

/** 事件定义 */
export interface IEvent {
  id: string;
  title: string;
  description: string;
  type: EventType;
  weight: number;              // 出现权重
  conditions?: IEventCondition;
  effects: Partial<Omit<IResources, 'salary'>> & { salary?: number };
  choices?: IEventChoice[];    // 可选，有选择时优先使用选择
}

/** 触发的事件实例 */
export interface ITriggeredEvent extends IEvent {
  triggeredAt: number;         // 时间戳
}

// ============================================================
// EventManager 类
// ============================================================

export class EventManager {
  private _events: Map<string, IEvent> = new Map();
  private _eventHistory: string[] = [];
  private _cooldowns: Map<string, number> = new Map();

  constructor(events?: IEvent[]) {
    if (events) {
      events.forEach(e => this.register(e));
    }
  }

  // ------------------ 事件注册 ------------------

  /** 注册单个事件 */
  register(event: IEvent): void {
    this._events.set(event.id, event);
  }

  /** 批量注册事件 */
  registerBatch(events: IEvent[]): void {
    events.forEach(e => this.register(e));
  }

  /** 从 JSON 加载事件 */
  loadFromJSON(json: { events: IEvent[] }): void {
    this.registerBatch(json.events);
  }

  /** 获取所有事件 */
  getAllEvents(): IEvent[] {
    return Array.from(this._events.values());
  }

  /** 获取指定事件 */
  getEvent(id: string): IEvent | undefined {
    return this._events.get(id);
  }

  // ------------------ 条件检查 ------------------

  /**
   * 检查事件是否满足触发条件
   */
  checkConditions(event: IEvent, resources: IResources, day: number): boolean {
    const cond = event.conditions;
    if (!cond) return true;

    if (cond.minSanity !== undefined && resources.sanity < cond.minSanity) return false;
    if (cond.maxSanity !== undefined && resources.sanity > cond.maxSanity) return false;
    
    if (cond.minTechDebt !== undefined && resources.techDebt < cond.minTechDebt) return false;
    if (cond.maxTechDebt !== undefined && resources.techDebt > cond.maxTechDebt) return false;
    
    if (cond.minColleagueRel !== undefined && resources.colleagueRel < cond.minColleagueRel) return false;
    if (cond.maxColleagueRel !== undefined && resources.colleagueRel > cond.maxColleagueRel) return false;
    
    if (cond.minDay !== undefined && day < cond.minDay) return false;
    if (cond.maxDay !== undefined && day > cond.maxDay) return false;

    // 检查冷却
    const cooldown = this._cooldowns.get(event.id);
    if (cooldown && Date.now() < cooldown) return false;

    return true;
  }

  // ------------------ 事件触发 ------------------

  /**
   * 根据当前状态选择一个随机事件
   * @param resources 当前资源状态
   * @param day 当前天数
   * @returns 触发的事件，或 null（如果没有符合条件的事件）
   */
  pickEvent(resources: IResources, day: number): IEvent | null {
    const eligible: { event: IEvent; weight: number }[] = [];
    
    for (const event of this._events.values()) {
      if (this.checkConditions(event, resources, day)) {
        eligible.push({ event, weight: event.weight });
      }
    }

    if (eligible.length === 0) return null;

    // 加权随机选择
    const totalWeight = eligible.reduce((sum, e) => sum + e.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const { event, weight } of eligible) {
      random -= weight;
      if (random <= 0) {
        return event;
      }
    }

    return eligible[eligible.length - 1].event;
  }

  /**
   * 触发事件并返回效果
   * @param eventId 事件 ID
   * @param choiceIndex 选择索引（如果有选择）
   */
  trigger(eventId: string, choiceIndex?: number): { 
    event: IEvent; 
    effects: Partial<IResources>;
    choice?: IEventChoice;
  } | null {
    const event = this._events.get(eventId);
    if (!event) return null;

    this._eventHistory.push(eventId);
    
    // 设置冷却（同类型事件 3 天内不重复）
    this._cooldowns.set(eventId, Date.now() + 3 * 24 * 60 * 60 * 1000);

    let effects = event.effects;
    let choice: IEventChoice | undefined;

    // 如果有选择且指定了索引
    if (event.choices && choiceIndex !== undefined && event.choices[choiceIndex]) {
      choice = event.choices[choiceIndex];
      effects = choice.effects;
    }

    return { event, effects, choice };
  }

  /**
   * 随机触发一个事件（自动选择）
   */
  triggerRandom(resources: IResources, day: number): ReturnType<typeof this.trigger> {
    const event = this.pickEvent(resources, day);
    if (!event) return null;
    return this.trigger(event.id);
  }

  // ------------------ 查询统计 ------------------

  /** 获取事件历史 */
  getHistory(): string[] {
    return [...this._eventHistory];
  }

  /** 清空历史 */
  clearHistory(): void {
    this._eventHistory = [];
    this._cooldowns.clear();
  }

  /** 获取指定类型的所有事件 */
  getEventsByType(type: EventType): IEvent[] {
    return this.getAllEvents().filter(e => e.type === type);
  }

  // ------------------ 序列化 ------------------

  serialize(): { history: string[]; cooldowns: Record<string, number> } {
    return {
      history: this._eventHistory,
      cooldowns: Object.fromEntries(this._cooldowns)
    };
  }

  deserialize(data: { history: string[]; cooldowns: Record<string, number> }): void {
    this._eventHistory = data.history;
    this._cooldowns = new Map(Object.entries(data.cooldowns).map(([k, v]) => [k, v]));
  }
}
