import {inject, injectAll} from "./inject";
import {getMetadata} from "./metadata";
import type {InjectionScope} from "./scope";
import type {Constructor, InjectionToken, InjectionTokens} from "./token";

export type ClassDecorator<Class extends Constructor<object>> = (
  value: Class,
  context: ClassDecoratorContext<Class>,
) => Class | void;

export type ClassFieldDecorator<Value> = <This extends object>(
  value: undefined,
  context: ClassFieldDecoratorContext<This, Value>,
) => ClassFieldInitializer<This, Value> | void;

export type ClassFieldInitializer<This extends object, Value> = (
  this: This,
  initialValue: Value,
) => Value;

export function Injectable<This extends object>(...tokens: InjectionToken<This>[]): ClassDecorator<Constructor<This>> {
  return (Class, _context) => {
    const metadata = getMetadata(Class);
    metadata.tokens.push(...tokens);
  };
}

export function Scoped<This extends object>(scope: InjectionScope): ClassDecorator<Constructor<This>> {
  return (Class, _context) => {
    const metadata = getMetadata(Class);
    metadata.scope = scope;
  };
}

export function AutoRegister<This extends object>(enable = true): ClassDecorator<Constructor<This>> {
  return (Class, _context) => {
    const metadata = getMetadata(Class);
    metadata.autoRegister = enable;
  };
}

export function Inject<Values extends unknown[]>(...tokens: InjectionTokens<Values>): ClassFieldDecorator<Values[number]>;
export function Inject<Value>(...tokens: InjectionToken<Value>[]): ClassFieldDecorator<Value> {
  return (_value, _context) =>
    function (this, _initialValue) {
      return inject.by(this, ...tokens);
    };
}

export function InjectAll<Values extends unknown[]>(...tokens: InjectionTokens<Values>): ClassFieldDecorator<Values[number][]>;
export function InjectAll<Value>(...tokens: InjectionToken<Value>[]): ClassFieldDecorator<Value[]> {
  return (_value, _context) =>
    function (_initialValue) {
      return injectAll(...tokens);
    };
}
