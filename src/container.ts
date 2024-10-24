import {assert, expectNever} from "./errors";
import {createResolution, useInjectionContext, withInjectionContext} from "./injection-context";
import {getMetadata} from "./metadata";
import {isClassProvider, isFactoryProvider, isValueProvider, type Provider} from "./provider";
import {type Registration, type RegistrationOptions, Registry} from "./registry";
import {Scope} from "./scope";
import {type Constructor, isConstructor, type Token, type TokenList} from "./token";

export interface ContainerOptions {
  parent?: Container;
  defaultScope?: Scope;
  autoRegister?: boolean;
}

export class Container {
  readonly parent?: Container;
  readonly registry: Registry;

  autoRegister: boolean;
  defaultScope: Scope;

  constructor(options?: ContainerOptions);
  constructor({
    parent,
    autoRegister = false,
    defaultScope = Scope.Inherited,
  }: ContainerOptions = {}) {
    this.parent = parent;
    this.registry = new Registry(parent?.registry);
    this.registry.set(Container, {
      provider: {useValue: this},
    });
    this.autoRegister = autoRegister;
    this.defaultScope = defaultScope;
  }

  createChild(): Container {
    return new Container({
      parent: this,
      defaultScope: this.defaultScope,
    });
  }

  getCached<Value>(token: Token<Value>): Value | undefined {
    const registration = this.registry.get(token);
    const instanceRef = registration?.instance;
    if (instanceRef) {
      return instanceRef.current;
    }
  }

  clearCache(): void {
    for (const registrations of this.registry.map.values()) {
      registrations.forEach(({instance, ...registration}, i) => {
        registrations[i] = registration;
      });
    }
  }

  resetRegistry(): void {
    this.registry.map.clear();
    this.registry.set(Container, {
      provider: {useValue: this},
    });
  }

  isRegistered<Value>(token: Token<Value>): boolean {
    return this.registry.has(token);
  }

  register<Instance extends object>(Class: Constructor<Instance>): this;
  register<Value>(
    token: Token<Value>,
    provider: Provider<Value>,
    options?: RegistrationOptions,
  ): this;
  register<Value>(
    ...args:
      | [Constructor<Value & object>]
      | [Token<Value>, Provider<Value>, RegistrationOptions?]
  ): this {
    if (args.length == 1) {
      const [Class] = args;
      const metadata = getMetadata(Class);
      const tokens = [Class, ...metadata.tokens];
      tokens.forEach((token) => {
        const provider = metadata.provider;
        const options = {scope: metadata.scope};
        this.registry.set(token, {provider, options});
      });
    }
    else {
      const [token] = args;
      let [, provider, options] = args;
      if (isClassProvider(provider)) {
        const Class = provider.useClass;
        const metadata = getMetadata(Class);
        provider = metadata.provider;
        options = {scope: metadata.scope, ...options};
      }
      this.registry.set(token, {provider, options});
    }
    return this;
  }

  unregister<Value>(token: Token<Value>): this {
    this.registry.map.delete(token);
    return this;
  }

  resolve<Values extends unknown[]>(...tokens: TokenList<Values>): Values[number];
  resolve<Value>(...tokens: Token<Value>[]): Value {
    for (const token of tokens) {
      const registration = this.registry.get(token);
      if (registration) {
        return this.createInstance(registration);
      }
      if (isConstructor(token)) {
        const Class = token;
        const metadata = getMetadata(Class);
        if (metadata.autoRegister ?? this.autoRegister) {
          this.register(Class);
          return this.resolve(Class);
        }
        return this.construct(Class);
      }
    }
    throwUnregisteredError(tokens);
  }

  resolveAll<Values extends unknown[]>(...tokens: TokenList<Values>): NonNullable<Values[number]>[];
  resolveAll<Value>(...tokens: Token<Value>[]): NonNullable<Value>[] {
    for (const token of tokens) {
      const registrations = this.registry.getAll(token);
      if (registrations) {
        return registrations
          .map((registration) => this.createInstance(registration))
          .filter((instance) => instance != null);
      }
      if (isConstructor(token)) {
        const Class = token;
        const metadata = getMetadata(Class);
        if (metadata.autoRegister ?? this.autoRegister) {
          this.register(Class);
          return [this.resolve(Class)];
        }
        return [this.construct(Class)];
      }
    }
    throwUnregisteredError(tokens);
  }

  private construct<T extends object>(Class: Constructor<T>): T {
    const metadata = getMetadata(Class);
    const provider = metadata.provider;
    const options = {scope: this.resolveScope(metadata.scope)};
    if (options.scope == Scope.Container) {
      throw new Error(`unregistered token ${Class.name} cannot be resolved in container scope`);
    }
    return this.getScopedInstance({provider, options}, () => new Class());
  }

  private createInstance<T>(registration: Registration<T>): T {
    const provider = registration.provider;
    if (isClassProvider(provider)) {
      const Class = provider.useClass;
      return this.getScopedInstance(registration, () => new Class());
    }
    if (isFactoryProvider(provider)) {
      const factory = provider.useFactory;
      return this.getScopedInstance(registration, factory);
    }
    if (isValueProvider(provider)) {
      const value = provider.useValue;
      return value;
    }
    expectNever(provider);
  }

  private getScopedInstance<T>(registration: Registration<T>, instantiate: () => T): T {
    const context = useInjectionContext();

    if (!context || context.container !== this) {
      return withInjectionContext({
        container: this,
        resolution: createResolution(),
      }, () => this.getScopedInstance(registration, instantiate));
    }

    const provider = registration.provider;
    const options = registration.options;

    if (context.resolution.stack.has(provider)) {
      const dependentRef = context.resolution.dependents.get(provider);
      assert(dependentRef, "circular dependency detected");
      return dependentRef.current;
    }

    const scope = this.resolveScope(options?.scope);

    context.resolution.stack.push(provider, {provider, scope});
    try {
      if (scope == Scope.Container) {
        const instanceRef = registration.instance;
        if (instanceRef) {
          return instanceRef.current;
        }
        const instance = instantiate();
        registration.instance = {current: instance};
        return instance;
      }
      if (scope == Scope.Resolution) {
        const instanceRef = context.resolution.instances.get(provider);
        if (instanceRef) {
          return instanceRef.current;
        }
        const instance = instantiate();
        context.resolution.instances.set(provider, {current: instance});
        return instance;
      }
      if (scope == Scope.Transient) {
        return instantiate();
      }
      expectNever(scope);
    }
    finally {
      context.resolution.stack.pop();
    }
  }

  private resolveScope(scope = this.defaultScope) {
    let resolvedScope = scope;
    if (resolvedScope == Scope.Inherited) {
      const context = useInjectionContext();
      const dependentFrame = context?.resolution.stack.peek();
      resolvedScope = dependentFrame?.scope || Scope.Transient;
    }
    return resolvedScope;
  }
}

function throwUnregisteredError(tokens: Token[]): never {
  const tokenNames = tokens.map((token) => token.name);
  assert(false, `unregistered token ${tokenNames.join(", ")}`);
}
