import {assert, expectNever} from "./errors";
import {createResolution, useInjectionContext, withInjectionContext} from "./injection-context";
import {getMetadata} from "./metadata";
import {isClassProvider, isFactoryProvider, isValueProvider, type Provider} from "./provider";
import {type Registration, type RegistrationOptions, Registry} from "./registry";
import {Scope} from "./scope";
import {type Constructor, isConstructor, type Token, type TokenList} from "./token";

/**
 * Options for creating a container.
 */
export interface ContainerOptions {
  /**
   * Whether to automatically register a class when resolving it as a token.
   *
   * @default false
   */
  autoRegister?: boolean;

  /**
   * The default scope for registrations.
   *
   * @default Scope.Inherited - "Inherited"
   */
  defaultScope?: Scope;

  /**
   * The parent container.
   *
   * @default undefined
   */
  parent?: Container;
}

/**
 * The public API of a container.
 */
export interface Container {
  /**
   * The internal registry for testing and debugging.
   */
  get registry(): Registry;

  /**
   * Clears the cached instances with container scope.
   *
   * The registered constants with `ValueProvider` are not affected.
   */
  clearCache(): void;

  /**
   * Creates a child container with the same configuration.
   */
  createChild(): Container;

  /**
   * Gets the cached instance with container scope.
   *
   * @template Value - The type of the token.
   */
  getCached<Value>(token: Token<Value>): Value | undefined;

  /**
   * Checks if a token is registered in the container or its ancestors.
   *
   * @template Value - The type of the token.
   */
  isRegistered<Value>(token: Token<Value>): boolean;

  /**
   * Registers a `ClassProvider` with the token of the class itself.
   *
   * All the tokens specified in the `@Injectable` decorator are also registered.
   *
   * @template Instance - The type of the instance.
   */
  register<Instance extends object>(Class: Constructor<Instance>): this;

  /**
   * Registers a provider with a token.
   *
   * @template Value - The type of the token and the provider.
   */
  register<Value>(token: Token<Value>, provider: Provider<Value>, options?: RegistrationOptions): this;

  /**
   * Removes all registrations from the internal registry.
   */
  resetRegistry(): void;

  /**
   * Resolves a token to an instance.
   *
   * @template Value - The type of the token.
   */
  resolve<Value>(token: Token<Value>): Value;

  /**
   * Resolves tokens to an instance by checking each token in order until a registered one is found.
   *
   * @template Values - Tuple type representing the possible value types
   */
  resolve<Values extends unknown[]>(...tokens: TokenList<Values>): Values[number];

  /**
   * Resolves a token to instances of all registered providers.
   *
   * The returned array will not contain `null` or `undefined` values.
   *
   * @template Value - The type of the token.
   */
  resolveAll<Value>(token: Token<Value>): NonNullable<Value>[];

  /**
   * Resolves tokens to instances of all registered providers by checking each token in order until a registered one is found.
   *
   * The returned array will not contain `null` or `undefined` values.
   *
   * @template Values - Tuple type representing the possible value types
   */
  resolveAll<Values extends unknown[]>(...tokens: TokenList<Values>): NonNullable<Values[number]>[];

  /**
   * Removes a registration from the internal registry.
   *
   * @template Value - The type of the token.
   */
  unregister<Value>(token: Token<Value>): this;
}

/**
 * Creates a new container.
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
          return instantiateProvider(registration);
        }
        if (isConstructor(token)) {
          const Class = token;
          const metadata = getMetadata(Class);
          if (metadata.autoRegister ?? autoRegister) {
            container.register(Class);
            return container.resolve(Class);
          }
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
          const metadata = getMetadata(Class);
          if (metadata.autoRegister ?? autoRegister) {
            container.register(Class);
            return [container.resolve(Class)];
          }
          return [instantiateClass(Class)];
        }
      }
      throwUnregisteredError(tokens);
    },
  };

  return container;

  function instantiateClass<T extends object>(Class: Constructor<T>): T {
    const metadata = getMetadata(Class);
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
    const context = useInjectionContext();

    if (!context || context.container !== container) {
      return withInjectionContext({
        container,
        resolution: createResolution(),
      }, () => resolveScopedInstance(registration, instantiate));
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
