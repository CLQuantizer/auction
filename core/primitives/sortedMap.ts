function findInsertionIndex<K>(
  keys: K[],
  key: K,
  comparator: (a: K, b: K) => number
): number {
  let low = 0;
  let high = keys.length;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const midKey = keys[mid]!;
    if (comparator(key, midKey) < 0) {
      high = mid;
    } else {
      low = mid + 1;
    }
  }
  return low;
}

export class SortedMap<K, V> {
  private map: Map<string, V> = new Map();
  private sortedKeys: K[] = [];

  constructor(
    private readonly keyToString: (key: K) => string,
    private readonly comparator: (a: K, b: K) => number
  ) {}

  public set(key: K, value: V): void {
    const keyStr = this.keyToString(key);
    if (!this.map.has(keyStr)) {
      const index = findInsertionIndex(this.sortedKeys, key, this.comparator);
      this.sortedKeys.splice(index, 0, key);
    }
    this.map.set(keyStr, value);
  }

  public get(key: K): V | undefined {
    return this.map.get(this.keyToString(key));
  }
  
  public delete(key: K): boolean {
    const keyStr = this.keyToString(key);
    if (this.map.delete(keyStr)) {
      const index = this.sortedKeys.findIndex((k) => this.keyToString(k) === keyStr);
      if (index > -1) {
        this.sortedKeys.splice(index, 1);
      }
      return true;
    }
    return false;
  }
  
  public values(): Readonly<V[]> {
    return this.sortedKeys.map((k) => this.map.get(this.keyToString(k))!);
  }

  public get isEmpty(): boolean {
    return this.map.size === 0;
  }
  
  public clear() {
    this.map.clear();
    this.sortedKeys = [];
  }
}
