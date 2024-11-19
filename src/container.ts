import {assert, expectNever} from "./errors";
import {createResolution, provideInjectionContext, useInjectionContext} from "./injection-context";
import {getMetadata} from "./metadata";
import {
  type ClassProvider,
  type FactoryProvider,
  isClassProvider,
  isFactoryProvider,
  isValueProvider,
  type Provider,
  type ValueProvider,
} from "./provider";
import {isBuilder, type Registration, type RegistrationOptions, Registry} from "./registry";
import {Scope} from "./scope";
import {type Constructor, isConstructor, type Token, type TokenList} from "./token";

/**
 * Options for creating a container.
 */
export interface ContainerOptions {
  /**
   * Whether to automatically register a class when resolving it as a token.
   *
   * @defaultValue false
   */
  autoRegister?: boolean;

  /**
   * The default scope for registrations.
   *
   * @defaultValue Scope.Inherited
   */
  defaultScope?: Scope;

  /**
   * The parent container.
   *
   * @defaultValue undefined
   */
  parent?: Container;
}

/**
 * Container API.
 */
export interface Container {
  /**
   * @internal
   */
  api?: Readonly<Container>;

  /**
   * The underlying registry.
   */
  get registry(): Registry;

  /**
   * Clear the cached instances with container scope.
   *
   * The registered constants with `ValueProvider` are not affected.
   */
  clearCache(): void;

  /**
   * Create a child container with the same configuration.
   */
  createChild(): Container;

  /**
   * Get the cached instance with container scope.
   */
  getCached<Value>(token: Token<Value>): Value | undefined;

  /**
   * Check if a token is registered in the container or its ancestors.
   */
  isRegistered<Value>(token: Token<Value>): boolean;

  /**
   * Register a `ClassProvider` with the token of the class itself.
   *
   * All the tokens specified in the `@Injectable` decorator are also registered.
   */
  register<Instance extends object>(Class: Constructor<Instance>): this;

  /**
   * Register a `ClassProvider` with a token.
   */
  register<Instance extends object>(token: Token<Instance>, provider: ClassProvider<Instance>, options?: RegistrationOptions): this;

  /**
   * Register a `FactoryProvider` with a token.
   */
  register<Value>(token: Token<Value>, provider: FactoryProvider<Value>, options?: RegistrationOptions): this;

  /**
   * Register a `ValueProvider` with a token.
   */
  register<Value>(token: Token<Value>, provider: ValueProvider<Value>): this;

  /**
   * Remove all registrations from the internal registry.
   */
  resetRegistry(): void;

  /**
   * Resolve a class token to an instance.
   */
  resolve<Instance extends object>(Class: Constructor<Instance>): Instance;

  /**
   * Resolve a token to an instance.
   */
  resolve<Value>(token: Token<Value>): Value;

  /**
   * Resolve a token to an instance, by checking each token in order until a registered one is found.
   */
  resolve<Values extends unknown[]>(...tokens: TokenList<Values>): Values[number];

  /**
   * Resolve a class token to instances with all registered providers.
   */
  resolveAll<Instance extends object>(Class: Constructor<Instance>): Instance[];

  /**
   * Resolve a token to instances with all registered providers.
   *
   * The returned array will not contain `null` or `undefined` values.
   */
  resolveAll<Value>(token: Token<Value>): NonNullable<Value>[];

  /**
   * Resolve a token to instances with all registered providers, by checking each token in order until a registered one is found.
   *
   * The returned array will not contain `null` or `undefined` values.
   */
  resolveAll<Values extends unknown[]>(...tokens: TokenList<Values>): NonNullable<Values[number]>[];

  /**
   * Remove a registration from the internal registry.
   */
  unregister<Value>(token: Token<Value>): this;
}

/**
 * Create a new container.
 */
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

    clearCache() {
      for (const registrations of registry.map.values()) {
        registrations.forEach(({instance, ...registration}, i) => {
          registrations[i] = registration;
        });
      }
    },

    getCached(token) {
      const registration = registry.get(token);
      const instanceRef = registration?.instance;
      if (instanceRef) {
        return instanceRef.current;
      }
    },

    isRegistered(token) {
      return !!registry.get(token);
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
          registry.set(token, {
            provider: metadata.provider,
            options: {scope: metadata.scope},
          });
        });
      }
      else {
        const [token, provider, options] = args;
        if (isClassProvider(provider)) {
          const Class = provider.useClass;
          const metadata = getMetadata(Class);
          registry.set(token, {
            provider: metadata.provider,
            options: {scope: metadata.scope, ...options},
          });
        }
        else {
          registry.set(token, {provider, options});
        }
      }
      return container;
    },

    resolve<Value>(...tokens: Token<Value>[]): Value {
      for (const token of tokens) {
        const registration = registry.get(token);
        if (registration) {
          return instantiateProvider(registration);
        }
        if (isConstructor(token)) {
          const Class = token;
          return instantiateClass(Class);
        }
      }
      throwUnregisteredError(tokens);
    },

    resolveAll<Value>(...tokens: Token<Value>[]): NonNullable<Value>[] {
      for (const token of tokens) {
        const registrations = registry.getAll(token);
        if (registrations) {
          return registrations
            .map((registration) => instantiateProvider(registration))
            .filter((instance) => instance != null);
        }
        if (isConstructor(token)) {
          const Class = token;
          return [instantiateClass(Class)];
        }
      }
      throwUnregisteredError(tokens);
    },
  };

  return container;

  function instantiateClass<T extends object>(Class: Constructor<T>): T {
    const metadata = getMetadata(Class);
    if (metadata.autoRegister ?? autoRegister) {
      container.register(Class);
      return container.resolve(Class);
    }
    const provider = metadata.provider;
    const options = {scope: resolveScope(metadata.scope)};
    assert(options.scope != Scope.Container, `unregistered class ${Class.name} cannot be resolved in container scope`);
    return resolveScopedInstance({provider, options}, () => new Class());
  }

  function instantiateProvider<T>(registration: Registration<T>): T {
    const provider = registration.provider;
    if (isClassProvider(provider)) {
      const Class = provider.useClass;
      return resolveScopedInstance(registration, () => new Class());
    }
    if (isFactoryProvider(provider)) {
      const factory = provider.useFactory;
      return resolveScopedInstance(registration, factory);
    }
    if (isValueProvider(provider)) {
      const value = provider.useValue;
      return value;
    }
    expectNever(provider);
  }

  function resolveScopedInstance<T>(registration: Registration<T>, instantiate: () => T): T {
    let context = useInjectionContext();

    if (!context || context.container !== container) {
      context = {
        container,
        resolution: createResolution(),
      };
    }

    const resolution = context.resolution;

    const provider = registration.provider;
    const options = registration.options;

    if (resolution.stack.has(provider)) {
      const dependentRef = resolution.dependents.get(provider);
      assert(dependentRef, "circular dependency detected");
      return dependentRef.current;
    }

    const scope = resolveScope(options?.scope, context);

    const cleanups = [
      provideInjectionContext(context),
      !isBuilder(provider) && resolution.stack.push(provider, {provider, scope}),
    ];
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
        const instanceRef = resolution.instances.get(provider);
        if (instanceRef) {
          return instanceRef.current;
        }
        const instance = instantiate();
        resolution.instances.set(provider, {current: instance});
        return instance;
      }
      if (scope == Scope.Transient) {
        return instantiate();
      }
      expectNever(scope);
    }
    finally {
      cleanups
        .reverse()
        .forEach((cleanup) => cleanup && cleanup());
    }
  }

  function resolveScope(scope = defaultScope, context = useInjectionContext()) {
    if (scope == Scope.Inherited) {
      const dependentFrame = context?.resolution.stack.peek();
      return dependentFrame?.scope || Scope.Transient;
    }
    return scope;
  }
}

function throwUnregisteredError(tokens: Token[]): never {
  const tokenNames = tokens.map((token) => token.name);
  assert(false, `unregistered token ${tokenNames.join(", ")}`);
}
