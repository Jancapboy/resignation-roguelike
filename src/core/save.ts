/**
 * 存档管理器 - SaveManager
 * 
 * 处理游戏存档的保存、加载、导出
 */

import { IGameState } from './game';

export interface ISaveData {
  version: string;
  timestamp: number;
  checksum: string;
  state: IGameState;
}

export class SaveManager {
  private readonly SAVE_KEY = 'resignation_rl_save';
  private readonly VERSION = '0.1.0';

  /** 保存游戏 */
  save(state: IGameState): void {
    const data: ISaveData = {
      version: this.VERSION,
      timestamp: Date.now(),
      checksum: this.generateChecksum(state),
      state
    };
    
    try {
      localStorage.setItem(this.SAVE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('存档失败:', e);
    }
  }

  /** 加载游戏 */
  load(): IGameState | null {
    try {
      const saved = localStorage.getItem(this.SAVE_KEY);
      if (!saved) return null;
      
      const data: ISaveData = JSON.parse(saved);
      
      // 版本检查
      if (data.version !== this.VERSION) {
        console.warn('存档版本不匹配');
        return null;
      }
      
      // 校验和检查
      if (data.checksum !== this.generateChecksum(data.state)) {
        console.warn('存档校验失败，可能已损坏');
        return null;
      }
      
      return data.state;
    } catch (e) {
      console.error('读档失败:', e);
      return null;
    }
  }

  /** 导出存档为文件 */
  export(state: IGameState): string {
    const data: ISaveData = {
      version: this.VERSION,
      timestamp: Date.now(),
      checksum: this.generateChecksum(state),
      state
    };
    return btoa(JSON.stringify(data));
  }

  /** 从文件导入存档 */
  import(base64: string): IGameState | null {
    try {
      const data: ISaveData = JSON.parse(atob(base64));
      
      if (data.checksum !== this.generateChecksum(data.state)) {
        throw new Error('校验失败');
      }
      
      return data.state;
    } catch (e) {
      console.error('导入失败:', e);
      return null;
    }
  }

  /** 检查是否有存档 */
  hasSave(): boolean {
    return localStorage.getItem(this.SAVE_KEY) !== null;
  }

  /** 删除存档 */
  delete(): void {
    localStorage.removeItem(this.SAVE_KEY);
  }

  /** 生成简单校验和 */
  private generateChecksum(state: IGameState): string {
    // 简单的校验和，实际项目可使用 SHA256
    const str = JSON.stringify(state);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }
}
