import {invariant} from "./invariant";

// @internal
export class WeakRefMap<K, V extends object> {
  private map = new Map<K, WeakRef<V>>();

  get(key: K) {
    const ref = this.map.get(key);
    if (ref) {
      const value = ref.deref();
      if (value) {
        return value;
      }
      this.map.delete(key);
    }
  }

  set(key: K, value: V) {
    invariant(!this.get(key));
    this.map.set(key, new WeakRef(value));
    return () => {
      this.map.delete(key);
    };
  }
}