/**
 * 游戏主入口 - 绑定 UI 与游戏逻辑
 */

import { GameLoop, ActionType } from './src/core/game';
import { EventManager } from './src/core/events';
import eventData from './src/data/events.json';

// ============================================================
// 游戏实例
// ============================================================

let game: GameLoop;
let eventManager: EventManager;

// ============================================================
// DOM 元素
// ============================================================

const els = {
  day: document.getElementById('day')!,
  
  // 资源
  sanityBar: document.getElementById('sanity-bar')!,
  sanityValue: document.getElementById('sanity-value')!,
  techdebtBar: document.getElementById('techdebt-bar')!,
  techdebtValue: document.getElementById('techdebt-value')!,
  salaryValue: document.getElementById('salary-value')!,
  colleaguerelBar: document.getElementById('colleaguerel-bar')!,
  colleaguerelValue: document.getElementById('colleaguerel-value')!,
  
  // 行动点
  apDots: document.getElementById('ap-dots')!,
  
  // 事件
  eventCard: document.getElementById('event-card')!,
  eventType: document.getElementById('event-type')!,
  eventTitle: document.getElementById('event-title')!,
  eventDesc: document.getElementById('event-desc')!,
  eventChoices: document.getElementById('event-choices')!,
  
  // 行动按钮
  actionBtns: document.querySelectorAll('.action-btn') as NodeListOf<HTMLButtonElement>,
  
  // 下一天
  nextDayBtn: document.getElementById('next-day')!,
  
  // 日志
  logContent: document.getElementById('log-content')!,
  
  // 游戏结束
  gameOverModal: document.getElementById('game-over-modal')!,
  endingTitle: document.getElementById('ending-title')!,
  endingDesc: document.getElementById('ending-desc')!,
  restartBtn: document.getElementById('restart')!,
};

// ============================================================
// UI 更新
// ============================================================

function updateUI(): void {
  const state = game.serialize();
  const resources = state.resources;
  
  // 天数
  els.day.textContent = state.day.toString();
  
  // 资源条
  updateResourceBar(els.sanityBar, els.sanityValue, resources.sanity, 100);
  updateResourceBar(els.techdebtBar, els.techdebtValue, resources.techDebt, 100);
  updateResourceBar(els.colleaguerelBar, els.colleaguerelValue, resources.colleagueRel, 100);
  
  // 薪资
  els.salaryValue.textContent = resources.salary.toString();
  
  // 行动点
  updateAPDots(state.actionPoints);
  
  // 行动按钮状态
  updateActionButtons(state.actionPoints);
}

function updateResourceBar(bar: HTMLElement, valueEl: HTMLElement, value: number, max: number): void {
  const percentage = (value / max) * 100;
  bar.style.width = `${percentage}%`;
  valueEl.textContent = Math.round(value).toString();
  
  // 低资源警告
  const parent = bar.closest('.resource');
  if (percentage < 20) {
    parent?.classList.add('warning');
  } else {
    parent?.classList.remove('warning');
  }
}

function updateAPDots(current: number): void {
  const dots = els.apDots.querySelectorAll('.ap-dot');
  dots.forEach((dot, index) => {
    dot.classList.toggle('active', index < current);
  });
}

function updateActionButtons(ap: number): void {
  els.actionBtns.forEach(btn => {
    const cost = parseInt(btn.dataset.cost || '0');
    btn.disabled = ap < cost;
  });
}

// ============================================================
// 日志
// ============================================================

function log(message: string, type: 'normal' | 'important' | 'success' | 'danger' = 'normal'): void {
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.textContent = `Day ${game?.day || 1}: ${message}`;
  els.logContent.appendChild(entry);
  els.logContent.scrollTop = els.logContent.scrollHeight;
}

// ============================================================
// 事件处理
// ============================================================

function showEvent(eventId: string): void {
  const event = eventManager.getEvent(eventId);
  if (!event) return;
  
  els.eventType.textContent = event.type;
  els.eventType.className = `event-type ${event.type}`;
  els.eventTitle.textContent = event.title;
  els.eventDesc.textContent = event.description;
  
  // 清空并生成选项
  els.eventChoices.innerHTML = '';
  
  if (event.choices && event.choices.length > 0) {
    event.choices.forEach((choice, index) => {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.textContent = choice.text;
      btn.onclick = () => chooseEventOption(eventId, index);
      els.eventChoices.appendChild(btn);
    });
  } else {
    // 没有选择，自动应用效果
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.textContent = '继续';
    btn.onclick = () => {
      game.resources.applyEffects(event.effects);
      hideEvent();
      updateUI();
      log(`事件: ${event.title}`, 'important');
    };
    els.eventChoices.appendChild(btn);
  }
  
  els.eventCard.style.display = 'block';
  els.actionsPanel.style.display = 'none';
}

function hideEvent(): void {
  els.eventCard.style.display = 'none';
  els.actionsPanel.style.display = 'grid';
}

function chooseEventOption(eventId: string, choiceIndex: number): void {
  const result = eventManager.trigger(eventId, choiceIndex);
  if (result) {
    game.resources.applyEffects(result.effects);
    log(`选择: ${result.choice?.text || '默认选项'}`, 'important');
  }
  hideEvent();
  updateUI();
}

// ============================================================
// 游戏结束
// ============================================================

function showGameOver(reason: string): void {
  els.endingTitle.textContent = game.serialize().isGameOver ? '游戏结束' : '30天评估';
  els.endingDesc.textContent = reason;
  els.gameOverModal.style.display = 'flex';
}

// ============================================================
// 初始化
// ============================================================

function initGame(): void {
  // 创建游戏实例
  game = new GameLoop();
  eventManager = new EventManager();
  eventManager.loadFromJSON(eventData);
  
  // 绑定事件监听
  game.on('action', (e) => {
    const actionName = e.data?.action?.name || '行动';
    log(`执行: ${actionName}`);
    updateUI();
  });
  
  game.on('dayStart', (e) => {
    log(`第 ${e.data.day} 天开始`, 'important');
    
    // 30% 概率触发随机事件
    if (Math.random() < 0.3) {
      const event = eventManager.pickEvent(game.resources.getSnapshot(), game.day);
      if (event) {
        showEvent(event.id);
      }
    }
    
    updateUI();
  });
  
  game.on('gameOver', (e) => {
    log(`游戏结束: ${game.gameOverReason}`, 'danger');
    showGameOver(game.gameOverReason || '游戏结束');
  });
  
  game.on('gameWin', (e) => {
    log(`结局: ${game.gameOverReason}`, 'success');
    showGameOver(game.gameOverReason || '恭喜通关');
  });
  
  // 绑定行动按钮
  els.actionBtns.forEach(btn => {
    const actionType = btn.dataset.action as ActionType;
    btn.dataset.cost = actionType === 'overtime' ? '0' : 
      actionType === 'code' ? '2' :
      actionType === 'refactor' ? '3' :
      actionType === 'meeting' || actionType === 'slack' ? '1' : '2';
    
    btn.onclick = () => {
      if (game.performAction(actionType)) {
        // 加班特殊处理
        if (actionType === 'overtime') {
          log('选择加班，获得 2 额外行动点', 'important');
        }
      }
    };
  });
  
  // 绑定下一天按钮
  els.nextDayBtn.onclick = () => {
    game.nextDay();
  };
  
  // 绑定重新开始
  els.restartBtn.onclick = () => {
    els.gameOverModal.style.display = 'none';
    game.reset();
    log('游戏重新开始', 'important');
    updateUI();
  };
  
  // 初始化 UI
  updateUI();
  log('欢迎来到离职模拟器！目标：撑过 30 天', 'success');
}

// 启动游戏
document.addEventListener('DOMContentLoaded', initGame);

// 类型声明
const els_actionsPanel: HTMLElement = document.querySelector('.actions-panel') as HTMLElement;
