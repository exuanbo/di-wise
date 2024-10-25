import {afterEach, describe, expect, it} from "vitest";

import {AutoRegister, Build, createContainer, inject, Injectable, InjectAll, Scope, Scoped, Type, Value} from "..";
import {useInjectionContext} from "../injection-context";

describe("Container", () => {
  const container = createContainer();

  afterEach(() => {
    container.resetRegistry();
  });

  it("should handle hierarchical injection", () => {
    const container = createContainer({
      defaultScope: Scope.Container,
      autoRegister: true,
    });

    const Env = Type<string>("Env");
    container.register(Env, {useValue: "production"});

    const child = container.createChild();
    expect(child.isRegistered(Env)).toBe(true);
    expect(child.resolve(Env)).toBe("production");
    expect(child.resolveAll(Env)).toEqual(["production"]);
  });

  it("should clear the cache but keep the registrations", () => {
    class Wizard {}

    container.register(
      Wizard,
      {useClass: Wizard},
      {scope: Scope.Container},
    );

    const wizard = container.resolve(Wizard);
    expect(container.getCached(Wizard)).toBe(wizard);

    container.clearCache();
    expect(container.isRegistered(Wizard)).toBe(true);
    expect(container.getCached(Wizard)).toBeUndefined();
    expect(container.resolve(Wizard)).not.toBe(wizard);
  });

  it("should reset registry", () => {
    const container = createContainer({
      defaultScope: Scope.Container,
      autoRegister: true,
    });

    class Wizard {}

    const wizard = container.resolve(Wizard);
    expect(container.resolve(Wizard)).toBe(wizard);

    container.resetRegistry();
    expect(container.isRegistered(Wizard)).toBe(false);
    expect(container.resolve(Wizard)).not.toBe(wizard);
  });

  it("should register all tokens", () => {
    const Character = Type<{}>("Character");

    @Injectable(Character)
    class Wizard {}

    container.register(Wizard);
    expect(container.isRegistered(Character)).toBe(true);
    expect(container.isRegistered(Wizard)).toBe(true);
  });

  it("should use the same provider for the same class", () => {
    const Character = Type<{}>("Character");
    const Hero = Type<{}>("Hero");

    class Wizard {}

    container.register(Character, {useClass: Wizard});
    container.register(Hero, {useClass: Wizard});

    const characterRegistration = container.registry.get(Character)!;
    const heroRegistration = container.registry.get(Hero)!;
    expect(characterRegistration.provider).toBe(heroRegistration.provider);
  });

  it("should get the options from the class", () => {
    @Scoped(Scope.Container)
    @AutoRegister()
    class Wizard {}

    container.resolve(Wizard);
    const registration = container.registry.get(Wizard)!;
    expect(registration.options?.scope).toBe(Scope.Container);
  });

  it("should override the options on re-register", () => {
    @Scoped(Scope.Container)
    class Wizard {}

    container.register(Wizard, {useClass: Wizard});

    container.register(
      Wizard,
      {useClass: Wizard},
      {scope: Scope.Transient},
    );

    const registration = container.registry.get(Wizard)!;
    expect(registration.options?.scope).toBe(Scope.Transient);
  });

  it("should unregister a token", () => {
    const Env = Type<string>("Env");
    container.register(Env, {useValue: "production"});

    expect(container.isRegistered(Env)).toBe(true);
    container.unregister(Env);
    expect(container.isRegistered(Env)).toBe(false);
  });

  it("should throw an error if unregistered class has container scope", () => {
    @Scoped(Scope.Container)
    class Wizard {}

    expect(() => container.resolve(Wizard)).toThrowErrorMatchingInlineSnapshot(
      `[Error: unregistered class Wizard cannot be resolved in container scope]`,
    );
    expect(() => container.resolveAll(Wizard)).toThrowErrorMatchingInlineSnapshot(
      `[Error: unregistered class Wizard cannot be resolved in container scope]`,
    );
  });

  it("should throw error when the token is not registered", () => {
    const Env = Type<string>("Env");

    expect(() => container.resolve(Env)).toThrowErrorMatchingInlineSnapshot(
      `[Error: unregistered token Type<Env>]`,
    );
    expect(() => container.resolveAll(Env)).toThrowErrorMatchingInlineSnapshot(
      `[Error: unregistered token Type<Env>]`,
    );
  });

  it("should resolve all tokens", () => {
    const Character = Type<{name: string}>("Character");

    @Injectable(Character)
    class Wizard {
      name = "Wizard";
    }

    @Injectable(Character)
    class Witch {
      name = "Witch";
    }

    container.register(Wizard);
    container.register(Witch);

    const characters = container.resolveAll(Character);
    expect(characters).toHaveLength(2);
    expect(characters.map(({name}) => name)).toEqual(["Wizard", "Witch"]);
  });

  it("should resolve all tokens with a class fallback", () => {
    const container = createContainer({
      defaultScope: Scope.Container,
      autoRegister: true,
    });

    const Character = Type<{}>("Character");

    class Wizard {}

    expect(container.resolveAll(Character, Wizard)).toEqual([container.resolve(Wizard)]);
  });

  it("should return empty array if null or undefined is resolved", () => {
    const Character = Type<{}>("Character");
    expect(container.resolveAll(Character, Type.Null)).toEqual([]);
    expect(container.resolveAll(Character, Type.Undefined)).toEqual([]);
  });

  it("should resolve factory providers", () => {
    class WizardImpl {}

    const Wizard = Type<WizardImpl>("Wizard");

    container.register(Wizard, {useFactory: () => new WizardImpl()});
    expect(container.resolve(Wizard)).toBeInstanceOf(WizardImpl);
  });

  it("should switch context", () => {
    const child = container.createChild();

    container.resolve(
      Build(() => {
        const context = useInjectionContext()!;

        child.resolve(
          Build(() => {
            const innerContext = useInjectionContext()!;
            expect(innerContext).not.toBe(context);
            expect(innerContext.container).toBe(child);
            expect(innerContext.resolution).not.toBe(context.resolution);
          }),
        );
      }),
    );
  });

  it("should throw error if detected circular dependency", () => {
    class Wand {
      owner = inject(Wizard);
    }

    class Wizard {
      @InjectAll(Wand)
      wand!: Wand[];
    }

    expect(() => container.resolve(Wizard)).toThrowErrorMatchingInlineSnapshot(
      `[Error: circular dependency detected]`,
    );
  });

  it("should resolve resolution scoped providers", () => {
    @Scoped(Scope.Resolution)
    class Decoration {}

    class Wand {
      decoration = inject(Decoration);
    }

    class Wizard {
      wand = inject(Wand);
      decoration = inject(Decoration);
    }

    const wizard = container.resolve(Wizard);
    expect(wizard.wand.decoration).toBe(wizard.decoration);
  });

  it("should resolve a default value", () => {
    const Env = Type<string>("Env");
    const env = container.resolve(Env, Value("development"));
    expect(env).toBe("development");
  });
});
