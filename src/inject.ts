import {ensureInjectionContext} from "./injection-context";
import type {Token, TokenList} from "./token";
import {invariant} from "./utils/invariant";

export function inject<Values extends unknown[]>(...tokens: TokenList<Values>): Values[number];
export function inject<Value>(...tokens: Token<Value>[]): Value {
  const context = ensureInjectionContext();
  return context.container.resolve(...tokens);
}

export namespace inject {
  export function by<Values extends unknown[]>(thisArg: any, ...tokens: TokenList<Values>): Values[number];
  export function by<Value>(thisArg: any, ...tokens: Token<Value>[]): Value {
    const context = ensureInjectionContext();
    const currentFrame = context.resolution.stack.peek();
    invariant(currentFrame);
    const provider = currentFrame.provider;
    context.resolution.dependents.set(provider, {current: thisArg});
    try {
      return inject(...tokens);
    }
    finally {
      context.resolution.dependents.delete(provider);
    }
  }
}

export function injectAll<Values extends unknown[]>(...tokens: TokenList<Values>): NonNullable<Values[number]>[];
export function injectAll<Value>(...tokens: Token<Value>[]): NonNullable<Value>[] {
  const context = ensureInjectionContext();
  return context.container.resolveAll(...tokens);
}
