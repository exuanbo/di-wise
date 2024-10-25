import {assert, expectNever} from "./errors";
import {createResolution, useInjectionContext, withInjectionContext} from "./injection-context";
import {getMetadata} from "./metadata";
import {isClassProvider, isFactoryProvider, isValueProvider, type Provider} from "./provider";
import {type Registration, type RegistrationOptions, Registry} from "./registry";
import {Scope} from "./scope";
import {type Constructor, isConstructor, type Token, type TokenList} from "./token";

export interface ContainerOptions {
  autoRegister?: boolean;
  defaultScope?: Scope;
  parent?: Container;
}

export interface Container {
  get registry(): Registry;
  clearCache(): void;
  createChild(): Container;
  getCached<Value>(token: Token<Value>): Value | undefined;
  isRegistered<Value>(token: Token<Value>): boolean;
  register<Instance extends object>(Class: Constructor<Instance>): this;
  register<Value>(token: Token<Value>, provider: Provider<Value>, options?: RegistrationOptions): this;
  resetRegistry(): void;
  resolve<Values extends unknown[]>(...tokens: TokenList<Values>): Values[number];
  resolveAll<Values extends unknown[]>(...tokens: TokenList<Values>): NonNullable<Values[number]>[];
  unregister<Value>(token: Token<Value>): this;
}

export function createContainer(options?: ContainerOptions): Container;
export function createContainer({
  autoRegister = false,
  defaultScope = Scope.Inherited,
  parent,
}: ContainerOptions = {}) {
  const registry = new Registry(parent?.registry);

  const container: Container = {
    get registry() {
      return registry;
    },

    createChild() {
      return createContainer({
        autoRegister,
        defaultScope,
        parent: container,
      });
    },

    getCached(token) {
      const registration = registry.get(token);
      const instanceRef = registration?.instance;
      if (instanceRef) {
        return instanceRef.current;
      }
    },

    clearCache() {
      for (const registrations of registry.map.values()) {
        registrations.forEach(({instance, ...registration}, i) => {
          registrations[i] = registration;
        });
      }
    },

    isRegistered(token) {
      return registry.has(token);
    },

    resetRegistry() {
      registry.map.clear();
    },

    unregister(token) {
      registry.map.delete(token);
      return container;
    },

    register<Value>(
      ...args:
        | [Constructor<Value & object>]
        | [Token<Value>, Provider<Value>, RegistrationOptions?]
    ) {
      if (args.length == 1) {
        const [Class] = args;
        const metadata = getMetadata(Class);
        const tokens = [Class, ...metadata.tokens];
        tokens.forEach((token) => {
          const provider = metadata.provider;
          const options = {scope: metadata.scope};
          registry.set(token, {provider, options});
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
        registry.set(token, {provider, options});
      }
      return container;
    },

    resolve<Value>(...tokens: Token<Value>[]): Value {
      for (const token of tokens) {
        const registration = registry.get(token);
        if (registration) {
          return createInstance(registration);
        }
        if (isConstructor(token)) {
          const Class = token;
          const metadata = getMetadata(Class);
          if (metadata.autoRegister ?? autoRegister) {
            container.register(Class);
            return container.resolve(Class);
          }
          return construct(Class);
        }
      }
      throwUnregisteredError(tokens);
    },

    resolveAll<Value>(...tokens: Token<Value>[]): NonNullable<Value>[] {
      for (const token of tokens) {
        const registrations = registry.getAll(token);
        if (registrations) {
          return registrations
            .map((registration) => createInstance(registration))
            .filter((instance) => instance != null);
        }
        if (isConstructor(token)) {
          const Class = token;
          const metadata = getMetadata(Class);
          if (metadata.autoRegister ?? autoRegister) {
            container.register(Class);
            return [container.resolve(Class)];
          }
          return [construct(Class)];
        }
      }
      throwUnregisteredError(tokens);
    },
  };

  return container;

  function construct<T extends object>(Class: Constructor<T>): T {
    const metadata = getMetadata(Class);
    const provider = metadata.provider;
    const options = {scope: resolveScope(metadata.scope)};
    if (options.scope == Scope.Container) {
      throw new Error(`unregistered token ${Class.name} cannot be resolved in container scope`);
    }
    return getScopedInstance({provider, options}, () => new Class());
  }

  function createInstance<T>(registration: Registration<T>): T {
    const provider = registration.provider;
    if (isClassProvider(provider)) {
      const Class = provider.useClass;
      return getScopedInstance(registration, () => new Class());
    }
    if (isFactoryProvider(provider)) {
      const factory = provider.useFactory;
      return getScopedInstance(registration, factory);
    }
    if (isValueProvider(provider)) {
      const value = provider.useValue;
      return value;
    }
    expectNever(provider);
  }

  function getScopedInstance<T>(registration: Registration<T>, instantiate: () => T): T {
    const context = useInjectionContext();

    if (!context || context.container !== container) {
      return withInjectionContext({
        container,
        resolution: createResolution(),
      }, () => getScopedInstance(registration, instantiate));
    }

    const provider = registration.provider;
    const options = registration.options;

    if (context.resolution.stack.has(provider)) {
      const dependentRef = context.resolution.dependents.get(provider);
      assert(dependentRef, "circular dependency detected");
      return dependentRef.current;
    }

    const scope = resolveScope(options?.scope);

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

  function resolveScope(scope = defaultScope) {
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
