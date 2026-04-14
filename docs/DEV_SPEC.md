# 开发规范文档

## 1. 项目结构

```
resignation-roguelike/
├── docs/                  # 文档
│   ├── PRD.md            # 产品需求
│   ├── GDD.md            # 游戏设计 (后续)
│   └── API.md            # 接口文档
├── src/                   # 源代码
│   ├── core/             # 核心系统
│   │   ├── resources.ts  # 资源管理
│   │   ├── events.ts     # 事件系统
│   │   └── game.ts       # 主循环
│   ├── entities/         # 实体
│   │   ├── player.ts
│   │   ├── event.ts
│   │   └── action.ts
│   ├── data/             # 数据配置
│   │   ├── events.json   # 事件表
│   │   ├── careers.json  # 职业数据
│   │   └── endings.json  # 结局数据
│   ├── ui/               # 界面
│   │   ├── hud.ts        # 主界面
│   │   ├── event-card.ts # 事件卡片
│   │   └── modal.ts      # 弹窗
│   └── utils/            # 工具
│       ├── save.ts       # 存档
│       ├── random.ts     # 随机
│       └── i18n.ts       # 国际化
├── assets/                # 资源
│   ├── images/
│   ├── audio/
│   └── fonts/
├── tests/                 # 测试
├── .github/workflows/     # CI/CD
│   ├── test.yml
│   └── deploy.yml
└── package.json          # 或 project.godot 等
```

## 2. 编码规范

### 2.1 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 文件 | kebab-case | `event-system.ts` |
| 类 | PascalCase | `EventManager` |
| 函数 | camelCase | `triggerEvent()` |
| 常量 | UPPER_SNAKE | `MAX_SANITY` |
| 接口 | PascalCase + I | `IEventConfig` |
| 枚举 | PascalCase | `CareerLevel` |

### 2.2 TypeScript 规范

```typescript
// 强类型，禁止 any
interface IGameState {
  sanity: number;
  techDebt: number;
  salary: number;
  colleagueRel: number;
  day: number;
  career: CareerLevel;
}

// 函数必须有返回类型
function calculateStress(state: IGameState): number {
  return state.techDebt * 0.3 + (100 - state.sanity) * 0.2;
}

// 使用 readonly 保护不变量
readonly MAX_ACTION_POINTS = 5;

// 错误处理用 Result 类型
type Result<T, E = Error> = 
  | { ok: true; value: T }
  | { ok: false; error: E };
```

### 2.3 资源约束范围

```typescript
// 所有资源必须是 0-100 (salary 除外)
type ResourceValue = number & { __brand: '0-100' };

function clampResource(value: number): ResourceValue {
  return Math.max(0, Math.min(100, value)) as ResourceValue;
}
```

## 3. 事件系统规范

### 3.1 事件数据结构

```typescript
interface IEvent {
  id: string;
  title: string;
  description: string;
  type: 'normal' | 'crisis' | 'opportunity';
  weight: number;              // 出现权重
  conditions?: {               // 触发条件
    minSanity?: number;
    maxTechDebt?: number;
    careerLevel?: CareerLevel[];
  };
  effects: {                   // 效果
    sanity?: number;
    techDebt?: number;
    salary?: number;
    colleagueRel?: number;
  };
  choices?: IChoice[];         // 多选项
}

interface IChoice {
  text: string;
  effects: {
    sanity?: number;
    techDebt?: number;
    salary?: number;
    colleagueRel?: number;
  };
  nextEvent?: string;          // 连锁事件
}
```

### 3.2 事件配置示例

```json
{
  "id": "prod_incident_3am",
  "title": "凌晨3点线上故障",
  "description": "监控报警，核心服务挂了，用户正在微博骂街...",
  "type": "crisis",
  "weight": 10,
  "conditions": {
    "minSanity": 20,
    "careerLevel": ["junior", "mid", "senior"]
  },
  "effects": {
    "sanity": -15,
    "techDebt": 5
  },
  "choices": [
    {
      "text": "起床处理",
      "effects": { "sanity": -10, "colleagueRel": 5 }
    },
    {
      "text": "假装没看见",
      "effects": { "sanity": 5, "colleagueRel": -20 }
    }
  ]
}
```

## 4. 存档系统规范

### 4.1 存档结构

```typescript
interface ISaveData {
  version: string;           // 存档版本，用于兼容
  timestamp: number;
  checksum: string;          // 防篡改
  
  state: IGameState;
  history: IDayRecord[];     // 每日记录
  unlocked: string[];        // 已解锁内容
  achievements: string[];    // 成就
}

interface IDayRecord {
  day: number;
  actions: IActionRecord[];
  events: string[];
  resourcesSnapshot: IResources;
}
```

### 4.2 存储方式

```typescript
// 使用 LocalStorage + 导出文件
class SaveManager {
  private readonly KEY = 'resignation_rl_save';
  
  save(data: ISaveData): void {
    const serialized = JSON.stringify(data);
    localStorage.setItem(this.KEY, serialized);
  }
  
  export(): string {
    // 生成可下载的 JSON 文件
    return btoa(JSON.stringify(this.load()));
  }
  
  import(base64: string): ISaveData {
    return JSON.parse(atob(base64));
  }
}
```

## 5. 测试规范

### 5.1 单元测试

```typescript
// 测试资源计算
describe('ResourceManager', () => {
  it('should clamp values to 0-100', () => {
    const result = clampResource(150);
    expect(result).toBe(100);
  });
  
  it('should trigger game over when sanity reaches 0', () => {
    const state = createGameState({ sanity: 5 });
    applyEffect(state, { sanity: -10 });
    expect(isGameOver(state)).toBe(true);
    expect(getEnding(state)).toBe('burnout');
  });
});
```

### 5.2 集成测试

```typescript
// 测试完整游戏循环
describe('GameLoop', () => {
  it('should complete 30-day cycle', async () => {
    const game = new Game();
    for (let i = 0; i < 30; i++) {
      await game.processDay();
    }
    expect(game.day).toBe(30);
    expect(game.ending).toBeDefined();
  });
});
```

## 6. CI/CD 流程

### 6.1 GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build
      
  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

## 7. 协作分工

### 7.1 角色分配

| 任务 | 负责人 | 说明 |
|------|--------|------|
| 架构设计 | Lobster | 整体架构、模块划分 |
| 核心系统 | Hermes | 资源管理、游戏循环 |
| 事件系统 | 协作 | Lobster 设计，Hermes 实现 |
| UI/UX | Lobster | 界面、交互设计 |
| 测试 | Hermes | 单元测试、集成测试 |
| CI/CD | Lobster | GitHub Actions |
| 文档 | 协作 | 各自负责部分 |

### 7.2 工作流

1. **创建 Issue** → 描述需求/bug
2. **分配任务** → 标记负责人
3. **开发** → 本地分支
4. **PR** → 代码审查
5. **合并** → CI 自动部署

## 8. 提交规范

```
feat: 添加新功能
fix: 修复 bug
docs: 文档更新
style: 代码格式efactor: 重构
test: 测试
ci: CI/CD
chore: 其他

示例:
feat(events): 添加 10 个基础职场事件
fix(resources): 修复 sanity 可能为负数的问题
```

---

版本: 1.0  
日期: 2026-04-15
