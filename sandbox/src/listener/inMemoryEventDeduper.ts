export interface InMemoryEventDeduper {
  claim: (eventKey: string) => boolean;
  has: (eventKey: string) => boolean;
}

export function createInMemoryEventDeduper(): InMemoryEventDeduper {
  const claimedKeys = new Set<string>();

  return {
    claim(eventKey: string): boolean {
      if (claimedKeys.has(eventKey)) {
        return false;
      }

      claimedKeys.add(eventKey);
      return true;
    },
    has(eventKey: string): boolean {
      return claimedKeys.has(eventKey);
    }
  };
}
