import {assert} from "./errors";
import type {InstanceRef} from "./instance";
import {NullProvider, type Provider, UndefinedProvider} from "./provider";
import {Scope} from "./scope";
import {type Token, Type} from "./token";
import {getTypeName} from "./utils/type-name";

export type RegistrationMap = Omit<
  Map<Token, Registration[]>,
  keyof Registry
>;

export interface Registration<T = any> {
  options?: RegistrationOptions;
  instance?: InstanceRef<T>;
  provider: Provider<T>;
}

/**
 * Registration options.
 */
export interface RegistrationOptions {
  /**
   * The scope of the registration.
   */
  readonly scope?: Scope;
}

export class Registry {
  private _map = new Map<Token, Registration[]>();

  constructor(
    private parent: Registry | undefined,
  ) {}

  get map(): RegistrationMap {
    return this._map;
  }

  get<T>(token: Token<T>): Registration<T> | undefined {
    return this.getAll(token)?.at(-1);
  }

  getAll<T>(token: Token<T>): Registration<T>[] | undefined {
    const internal = internals.get(token);
    return (
      (internal && [internal])
      || this._getAll(token)
    );
  }

  private _getAll<T>(token: Token<T>): Registration<T>[] | undefined {
    const registrations = this._map.get(token);
    return (
      registrations
      || this.parent?._getAll(token)
    );
  }

  set<T>(token: Token<T>, registration: Registration<T>): void {
    assert(!internals.has(token), `cannot register reserved token ${token.name}`);
    let registrations = this._map.get(token);
    if (!registrations) {
      registrations = [];
      this._map.set(token, registrations);
    }
    registrations.push(registration);
  }
}

// @internal
export function isBuilder(provider: Provider) {
  return builders.has(provider);
}

/**
 * Create a one-off type token from a factory function.
 *
 * @example
 * ```ts
 * class Wizard {
 *   wand = inject(
 *     Build(() => {
 *       const wand = inject(Wand);
 *       wand.owner = this;
 *       // ...
 *       return wand;
 *     }),
 *   );
 * }
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function Build<Value>(factory: (...args: []) => Value): Type<Value> {
  const token = Type<Value>(`Build<${getTypeName(factory)}>`);
  const provider = {useFactory: factory};
  internals.set(token, {
    provider,
    options: {scope: Scope.Transient},
  });
  builders.add(provider);
  return token;
}

/**
 * Create a one-off type token from a value.
 *
 * Used for providing default values.
 *
 * @example
 * ```ts
 * class Wizard {
 *   name = inject(Name, Value("Harry"));
 * }
 *
 * const wizard = container.resolve(Wizard);
 * wizard.name; // => "Harry"
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function Value<T>(value: T): Type<T> {
  const token = Type<T>(`Value<${getTypeName(value)}>`);
  const provider = {useValue: value};
  internals.set(token, {provider});
  return token;
}

const internals = new WeakMap<Token, Registration>([
  [Type.Null, {provider: NullProvider}],
  [Type.Undefined, {provider: UndefinedProvider}],
]);

const builders = new WeakSet<Provider>();
