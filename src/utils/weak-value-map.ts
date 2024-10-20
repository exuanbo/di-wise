import {invariant} from "./invariant";

// @internal
export class WeakValueMap<K, V extends object> {
  private map = new Map<K, WeakRef<V>>();

  delete(key: K) {
    this.map.delete(key);
  }

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
  }
}
