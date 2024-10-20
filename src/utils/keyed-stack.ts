// @internal
export class KeyedStack<K, V> {
  private entries = new Array<{key: K; value: V}>();

  private keys = new Set<K>();

  has(key: K) {
    return this.keys.has(key);
  }

  peek(n = 0) {
    const entry = this.entries.at(-(n + 1));
    return entry?.value;
  }

  pop() {
    const entry = this.entries.pop();
    if (entry) {
      this.keys.delete(entry.key);
      return entry.value;
    }
  }

  /**
   * @invariant `!this.has(key)`
   */
  push(key: K, value: V) {
    this.keys.add(key);
    this.entries.push({key, value});
  }
}
