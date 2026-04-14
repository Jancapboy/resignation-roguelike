/**
 * 结局系统 - EndingManager
 * 
 * 管理游戏结局的判定与展示
 */

import { IResources } from './resources';
import { IGameState } from './game';

// ============================================================
// 结局类型定义
// ============================================================

export type EndingType = 
  | 'financial_freedom'    // 财务自由
  | 'burnout'              // 精神崩溃
  | 'fired'                // 被辞退
  | 'survived'             // 平稳着陆
  | 'burnout_risk';        // 勉强支撑

export interface IEnding {
  type: EndingType;
  title: string;
  description: string;
  emoji: string;
  color: string;
  condition: (resources: IResources, day: number, history: any[]) => boolean;
}

export interface IEndingResult {
  ending: IEnding;
  stats: {
    totalDays: number;
    finalSalary: number;
    savings: number;
    techDebtFinal: number;
    actionsTaken: number;
    eventsEncountered: number;
  };
}

// ============================================================
// EndingManager 类
// ============================================================

export class EndingManager {
  private _endings: Map<EndingType, IEnding> = new Map();
  private _priority: EndingType[] = [];

  constructor() {
    this._initEndings();
  }

  private _initEndings(): void {
    const endings: IEnding[] = [
      {
        type: 'burnout',
        title: '💔 精神崩溃',
        description: '长期高压工作终于压垮了你。你提交了辞呈，买了去西藏的火车票，决定给自己一年时间疗伤。',
        emoji: '💔',
        color: '#e94560',
        condition: (r) => r.sanity <= 0
      },
      {
        type: 'fired',
        title: '📦 被辞退',
        description: '同事关系恶化到无法挽回，HR 找你谈话了。收拾东西走人时，你发现自己的工牌已经失效。',
        emoji: '📦',
        color: '#e74c3c',
        condition: (r) => r.colleagueRel <= 0
      },
      {
        type: 'financial_freedom',
        title: '🏆 财务自由！',
        description: '30天过去，你攒够了第一桶金。你辞职创业，或者可能只是先休息一年。无论如何，你自由了。',
        emoji: '🏆',
        color: '#f1c40f',
        condition: (r, d) => d >= 30 && (r.salary * d) > 200000
      },
      {
        type: 'survived',
        title: '🌟 平稳着陆',
        description: '30天过去，你依然神志清醒，技术债可控，同事关系良好。这是属于打工人的胜利。',
        emoji: '🌟',
        color: '#4ecca3',
        condition: (r, d) => d >= 30 && r.sanity > 60 && r.techDebt < 50
      },
      {
        type: 'burnout_risk',
        title: '😰 勉强支撑',
        description: '30天过去，你熬过来了，但代价不小。也许该考虑换个环境，或者至少休个长假。',
        emoji: '😰',
        color: '#ffc93c',
        condition: (r, d) => d >= 30
      }
    ];

    // 按优先级排序：失败结局 > 成功结局 > 默认结局
    this._priority = ['burnout', 'fired', 'financial_freedom', 'survived', 'burnout_risk'];
    
    endings.forEach(e => this._endings.set(e.type, e));
  }

  /**
   * 判定结局
   */
  checkEnding(resources: IResources, day: number, history: any[]): IEndingResult | null {
    for (const type of this._priority) {
      const ending = this._endings.get(type);
      if (ending && ending.condition(resources, day, history)) {
        return {
          ending,
          stats: this._calculateStats(resources, day, history)
        };
      }
    }
    return null;
  }

  /**
   * 获取特定结局
   */
  getEnding(type: EndingType): IEnding | undefined {
    return this._endings.get(type);
  }

  /**
   * 获取所有结局
   */
  getAllEndings(): IEnding[] {
    return Array.from(this._endings.values());
  }

  /**
   * 计算结局统计
   */
  private _calculateStats(resources: IResources, day: number, history: any[]): IEndingResult['stats'] {
    const actionsTaken = history.reduce((sum, h) => sum + (h.actions?.length || 0), 0);
    const eventsEncountered = history.reduce((sum, h) => sum + (h.events?.length || 0), 0);
    
    return {
      totalDays: day,
      finalSalary: resources.salary,
      savings: resources.salary * day,
      techDebtFinal: resources.techDebt,
      actionsTaken,
      eventsEncountered
    };
  }

  /**
   * 格式化结局展示
   */
  formatEndingResult(result: IEndingResult): string {
    const { ending, stats } = result;
    return `
${ending.emoji} ${ending.title}

${ending.description}

📊 数据统计:
• 存活天数: ${stats.totalDays}
• 最终月薪: ¥${stats.finalSalary.toLocaleString()}
• 累计储蓄: ¥${stats.savings.toLocaleString()}
• 最终技术债: ${stats.techDebtFinal.toFixed(1)}
• 执行行动: ${stats.actionsTaken} 次
• 遭遇事件: ${stats.eventsEncountered} 次
    `.trim();
  }
}
