import type {Container} from "./container";
import {assert} from "./errors";
import type {InstanceRef} from "./instance";
import type {Provider} from "./provider";
import type {Scope} from "./scope";
import {createContext} from "./utils/context";
import {KeyedStack} from "./utils/keyed-stack";
import {WeakValueMap} from "./utils/weak-value-map";

export interface InjectionContext {
  container: Container;
  resolution: Resolution;
}

export interface Resolution {
  stack: KeyedStack<Provider, ResolutionFrame>;
  instances: WeakValueMap<Provider, InstanceRef>;
  dependents: WeakValueMap<Provider, InstanceRef>;
}

export interface ResolutionFrame {
  scope: Exclude<Scope, typeof Scope.Inherited>;
  provider: Provider;
}

// @internal
export function createResolution(): Resolution {
  return {
    stack: new KeyedStack(),
    instances: new WeakValueMap(),
    dependents: new WeakValueMap(),
  };
}

// @internal
export const [withInjectionContext, useInjectionContext] = createContext<InjectionContext>();

// @internal
export function ensureInjectionContext(fn: Function) {
  const context = useInjectionContext();
  assert(context, `${fn.name}() can only be used within an injection context`);
  return context;
}
