import {ensureInjectionContext, provideInjectionContext, useInjectionContext} from "./injection-context";
import {Build} from "./registry";
import type {Constructor, Token, TokenList, Type} from "./token";

/**
 * Inject an instance of a class.
 */
export function inject<Instance extends object>(Class: Constructor<Instance>): Instance;

/**
 * Inject an instance of a token.
 */
export function inject<Value>(token: Token<Value>): Value;

/**
 * Inject an instance of a token, by checking each token in order until a registered one is found.
 */
export function inject<Values extends unknown[]>(...tokens: TokenList<Values>): Values[number];

export function inject<Value>(...tokens: Token<Value>[]): Value {
  const context = ensureInjectionContext(inject);
  return context.container.resolve(...tokens);
}

export declare namespace inject {
  export var by: typeof injectBy;
}

inject.by = injectBy;

/**
 * Inject an instance of a class.
 *
 * @param thisArg - Used for resolving circular dependencies.
 */
export function injectBy<Instance extends object>(thisArg: any, Class: Constructor<Instance>): Instance;

/**
 * Inject an instance of a token.
 *
 * @param thisArg - Used for resolving circular dependencies.
 */
export function injectBy<Value>(thisArg: any, token: Token<Value>): Value;

/**
 * Inject an instance of a token, by checking each token in order until a registered one is found.
 *
 * @param thisArg - Used for resolving circular dependencies.
 */
export function injectBy<Values extends unknown[]>(thisArg: any, ...tokens: TokenList<Values>): Values[number];

export function injectBy<Value>(thisArg: any, ...tokens: Token<Value>[]): Value {
  const context = ensureInjectionContext(injectBy);
  const resolution = context.resolution;

  const currentFrame = resolution.stack.peek();
  if (!currentFrame) {
    return inject(...tokens);
  }

  const currentRef = {current: thisArg};
  const cleanup = resolution.dependents.set(currentFrame.provider, currentRef);
  try {
    return inject(...tokens);
  }
  finally {
    cleanup();
  }
}

/**
 * Inject instances of a class with all registered providers.
 */
export function injectAll<Instance extends object>(Class: Constructor<Instance>): Instance[];

/**
 * Inject instances of a token with all registered providers.
 *
 * The returned array will not contain `null` or `undefined` values.
 */
export function injectAll<Value>(token: Token<Value>): NonNullable<Value>[];

/**
 * Inject instances of a token with all registered providers, by checking each token in order until a registered one is found.
 *
 * The returned array will not contain `null` or `undefined` values.
 */
export function injectAll<Values extends unknown[]>(...tokens: TokenList<Values>): NonNullable<Values[number]>[];

export function injectAll<Value>(...tokens: Token<Value>[]): NonNullable<Value>[] {
  const context = ensureInjectionContext(injectAll);
  return context.container.resolveAll(...tokens);
}

/**
 * Injector API.
 */
export interface Injector {
  /**
   * Inject an instance of a class.
   */
  inject<Instance extends object>(Class: Constructor<Instance>): Instance;

  /**
   * Inject an instance of a token.
   */
  inject<Value>(token: Token<Value>): Value;

  /**
   * Inject an instance of a token, by checking each token in order until a registered one is found.
   */
  inject<Values extends unknown[]>(...tokens: TokenList<Values>): Values[number];

  /**
   * Inject instances of a class with all registered providers.
   */
  injectAll<Instance extends object>(Class: Constructor<Instance>): Instance[];

  /**
   * Inject instances of a token with all registered providers.
   *
   * The returned array will not contain `null` or `undefined` values.
   */
  injectAll<Value>(token: Token<Value>): NonNullable<Value>[];

  /**
   * Inject instances of a token with all registered providers, by checking each token in order until a registered one is found.
   *
   * The returned array will not contain `null` or `undefined` values.
   */
  injectAll<Values extends unknown[]>(...tokens: TokenList<Values>): NonNullable<Values[number]>[];
}

/**
 * Injector token for dynamic injection.
 *
 * @example
 * ```ts
 * class Wizard {
 *   private injector = inject(Injector);
 *   private wand?: Wand;
 *
 *   getWand() {
 *     return (this.wand ??= this.injector.inject(Wand));
 *   }
 * }
 *
 * const wizard = container.resolve(Wizard);
 * wizard.getWand(); // => Wand
 * ```
 */
export const Injector: Type<Injector> = /*@__PURE__*/ Build(function Injector() {
  const context = ensureInjectionContext(Injector);
  const resolution = context.resolution;

  const dependentFrame = resolution.stack.peek();
  const dependentRef = dependentFrame && resolution.dependents.get(dependentFrame.provider);

  function withCurrentContext<R>(fn: () => R) {
    if (useInjectionContext()) {
      return fn();
    }
    const cleanups = [
      provideInjectionContext(context),
      dependentFrame && resolution.stack.push(dependentFrame.provider, dependentFrame),
      dependentRef && resolution.dependents.set(dependentFrame.provider, dependentRef),
    ];
    try {
      return fn();
    }
    finally {
      cleanups
        .reverse()
        .forEach((cleanup) => cleanup?.());
    }
  }

  return {
    inject: <Value>(...tokens: Token<Value>[]) => withCurrentContext(() => inject(...tokens)),
    injectAll: <Value>(...tokens: Token<Value>[]) => withCurrentContext(() => injectAll(...tokens)),
  };
});
