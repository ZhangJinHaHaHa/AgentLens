export interface InMemoryEventDeduper {
  claim: (eventKey: string) => boolean;
  has: (eventKey: string) => boolean;
}

/**
 * 去重集合由单个 ListenerRuntime 实例独占，键通常是 transactionHash:logIndex。
 * claim 的“检查后占用”在同一 JavaScript 调用栈内同步完成，因此并发 Promise 不能在两步之间插入；
 * 但集合不持久化、无过期淘汰，也不了解链重组，因而只防止本进程生命周期内的重复投递。
 * 跨重启恢复依赖持久化游标及链上写回对账，不能据此宣称 exactly-once。
 */
export function createInMemoryEventDeduper(): InMemoryEventDeduper {
  const claimedKeys = new Set<string>();

  return {
    claim(eventKey: string): boolean {
      // 已占用的键不再次进入审计副作用；失败后是否重试由外层持久化队列负责，而不是释放本集合中的键。
      if (claimedKeys.has(eventKey)) {
        return false;
      }

      claimedKeys.add(eventKey);
      return true;
    },
    has(eventKey: string): boolean {
      // has 仅提供只读观测，不承担预留语义；需要互斥的调用方必须使用 claim。
      return claimedKeys.has(eventKey);
    }
  };
}
