import {inject, injectAll} from "./inject";
import {getMetadata} from "./metadata";
import type {Scope} from "./scope";
import type {Constructor, Token, TokenList} from "./token";

/**
 * Decorator API for classes.
 *
 * @see {@link https://github.com/tc39/proposal-decorators?tab=readme-ov-file#classes}
 */
export type ClassDecorator<Class extends Constructor<object>> = (
  value: Class,
  context: ClassDecoratorContext<Class>,
) => Class | void;

/**
 * Decorator API for class fields.
 *
 * @see {@link https://github.com/tc39/proposal-decorators?tab=readme-ov-file#class-fields}
 */
export type ClassFieldDecorator<Value> = <This extends object>(
  value: undefined,
  context: ClassFieldDecoratorContext<This, Value>,
) => ((this: This, initialValue: Value) => Value) | void;

/**
 * Decorator for adding additional tokens to a class when registering.
 *
 * @example
 * ```ts
 * ⁤@Injectable(Weapon)
 * class Wand {}
 *
 * container.register(Wand);
 *
 * // Under the hood
 * [Wand, Weapon].forEach((token) => {
 *   container.register(
 *     token,
 *     {useClass: Wand},
 *   );
 * });
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function Injectable<This extends object>(...tokens: Token<This>[]): ClassDecorator<Constructor<This>> {
  return (Class, _context) => {
    const metadata = getMetadata(Class);
    metadata.tokens.push(...tokens);
  };
}

/**
 * Decorator for setting the scope of a class when registering.
 *
 * @example
 * ```ts
 * ⁤@Scoped(Scope.Container)
 * class Wizard {}
 *
 * container.register(Wizard);
 *
 * // Under the hood
 * container.register(
 *   Wizard,
 *   {useClass: Wizard},
 *   {scope: Scope.Container},
 * );
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function Scoped<This extends object>(scope: Scope): ClassDecorator<Constructor<This>> {
  return (Class, _context) => {
    const metadata = getMetadata(Class);
    metadata.scope = scope;
  };
}

/**
 * Decorator for enabling auto-registration of a class.
 *
 * @example
 * ```ts
 * ⁤@AutoRegister()
 * class Wizard {}
 *
 * const wizard = container.resolve(Wizard);
 * container.isRegistered(Wizard); // => true
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function AutoRegister<This extends object>(enable = true): ClassDecorator<Constructor<This>> {
  return (Class, _context) => {
    const metadata = getMetadata(Class);
    metadata.autoRegister = enable;
  };
}

/**
 * Decorator for injecting an instance of a class.
 */
export function Inject<Instance extends object>(Class: Constructor<Instance>): ClassFieldDecorator<Instance>;

/**
 * Decorator for injecting an instance of a token.
 */
export function Inject<Value>(token: Token<Value>): ClassFieldDecorator<Value>;

/**
 * Decorator for injecting an instance of a token, by checking each token in order until a registered one is found.
 */
export function Inject<Values extends unknown[]>(...tokens: TokenList<Values>): ClassFieldDecorator<Values[number]>;

export function Inject<Value>(...tokens: Token<Value>[]): ClassFieldDecorator<Value> {
  return (_value, _context) =>
    function (this, _initialValue) {
      return inject.by(this, ...tokens);
    };
}

/**
 * Decorator for injecting instances of a class with all registered providers.
 */
export function InjectAll<Instance extends object>(Class: Constructor<Instance>): ClassFieldDecorator<Instance[]>;

/**
 * Decorator for injecting instances of a token with all registered providers.
 *
 * The returned array will not contain `null` or `undefined` values.
 */
export function InjectAll<Value>(token: Token<Value>): ClassFieldDecorator<NonNullable<Value>[]>;

/**
 * Decorator for injecting instances of a token with all registered providers, by checking each token in order until a registered one is found.
 *
 * The returned array will not contain `null` or `undefined` values.
 */
export function InjectAll<Values extends unknown[]>(...tokens: TokenList<Values>): ClassFieldDecorator<NonNullable<Values[number]>[]>;

export function InjectAll<Value>(...tokens: Token<Value>[]): ClassFieldDecorator<NonNullable<Value>[]> {
  return (_value, _context) =>
    function (_initialValue) {
      return injectAll(...tokens);
    };
}
