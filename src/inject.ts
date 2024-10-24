import {ensureInjectionContext, useInjectionContext, withInjectionContext} from "./injection-context";
import {Build} from "./registry";
import type {Token, TokenList, Type} from "./token";
import {invariant} from "./utils/invariant";

export function inject<Values extends unknown[]>(...tokens: TokenList<Values>): Values[number];
export function inject<Value>(...tokens: Token<Value>[]): Value {
  const context = ensureInjectionContext(inject);
  return context.container.resolve(...tokens);
}

export declare namespace inject {
  export var by: typeof injectBy;
}

inject.by = injectBy;

export function injectBy<Values extends unknown[]>(thisArg: any, ...tokens: TokenList<Values>): Values[number];
export function injectBy<Value>(thisArg: any, ...tokens: Token<Value>[]): Value {
  const context = ensureInjectionContext(injectBy);

  const currentFrame = context.resolution.stack.peek();
  invariant(currentFrame);

  const currentProvider = currentFrame.provider;
  context.resolution.dependents.set(currentProvider, {current: thisArg});
  try {
    return inject(...tokens);
  }
  finally {
    context.resolution.dependents.delete(currentProvider);
  }
}

export function injectAll<Values extends unknown[]>(...tokens: TokenList<Values>): NonNullable<Values[number]>[];
export function injectAll<Value>(...tokens: Token<Value>[]): NonNullable<Value>[] {
  const context = ensureInjectionContext(injectAll);
  return context.container.resolveAll(...tokens);
}

export interface Injector {
  inject<Values extends unknown[]>(...tokens: TokenList<Values>): Values[number];
  injectAll<Values extends unknown[]>(...tokens: TokenList<Values>): NonNullable<Values[number]>[];
}

export const Injector: Type<Injector> = /*@__PURE__*/ Build(function Injector() {
  const context = ensureInjectionContext(Injector);

  const dependentFrame = context.resolution.stack.peek(1);
  invariant(dependentFrame);

  const dependentProvider = dependentFrame.provider;
  const dependentRef = context.resolution.dependents.get(dependentProvider);

  const withCurrentContext = <R>(fn: () => R) => {
    if (useInjectionContext()) {
      return fn();
    }
    return withInjectionContext(context, () => {
      context.resolution.stack.push(dependentProvider, dependentFrame);
      if (dependentRef)
        context.resolution.dependents.set(dependentProvider, dependentRef);
      try {
        return fn();
      }
      finally {
        context.resolution.dependents.delete(dependentProvider);
        context.resolution.stack.pop();
      }
    });
  };

  return {
    inject: (...tokens) => withCurrentContext(() => inject(...tokens)),
    injectAll: (...tokens) => withCurrentContext(() => injectAll(...tokens)),
  };
});
