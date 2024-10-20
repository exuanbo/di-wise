import {afterEach, describe, expect, it, vi} from "vitest";

import {Build, Container, Inject, inject, injectAll, Injector, Scope, Scoped} from "..";
import {useInjectionContext} from "../injection-context";

describe("inject", () => {
  const container = new Container();

  afterEach(() => {
    container.resetRegistry();
  });

  it("should error if outside context", () => {
    vi.useFakeTimers();

    class Wand {}

    expect(() => {
      container.resolve(class Wizard {
        constructor() {
          setTimeout(() => inject(Wand));
        }
      });
      vi.runAllTimers();
    }).toThrowErrorMatchingInlineSnapshot(
      `[Error: inject() can only be used within an injection context]`,
    );

    expect(() => {
      container.resolve(class Wizard {
        constructor() {
          setTimeout(() => inject.by(Wand));
        }
      });
      vi.runAllTimers();
    }).toThrowErrorMatchingInlineSnapshot(
      `[Error: injectBy() can only be used within an injection context]`,
    );

    expect(() => {
      container.resolve(class Wizard {
        constructor() {
          setTimeout(() => injectAll(Wand));
        }
      });
      vi.runAllTimers();
    }).toThrowErrorMatchingInlineSnapshot(
      `[Error: injectAll() can only be used within an injection context]`,
    );

    vi.restoreAllMocks();
  });

  it("should handle circular dependencies", () => {
    class Wand {
      owner = inject(Wizard);
    }

    class Wizard {
      wand1 = inject.by(this, Wand);

      @Inject(Wand)
      wand2!: Wand;
    }

    const wizard = container.resolve(Wizard);
    expect(wizard.wand1.owner).toBe(wizard);
    expect(wizard.wand2.owner).toBe(wizard);
  });

  describe("Injector", () => {
    it("should inject injector", () => {
      class Wizard {
        injector = inject(Injector);
      }

      class Wand {
        name = "Elder Wand";
      }

      const wizard = container.resolve(Wizard);
      expect(wizard.injector.inject(Wand)).toBeInstanceOf(Wand);
      expect(wizard.injector.injectAll(Wand)).toEqual([new Wand()]);
    });

    it("should use current context", () => {
      class Wizard {
        injector = inject(Injector);

        context = inject(Build(useInjectionContext));

        constructor() {
          this.injector.inject(
            Build(() => {
              expect(useInjectionContext()).toBe(this.context);
            }),
          );
        }
      }

      container.resolve(Wizard);
    });

    it("should have context of the dependent", () => {
      const container = new Container({
        autoRegister: true,
      });

      class Wand {
        owner = inject(Wizard);
      }

      @Scoped(Scope.Container)
      class Wizard {
        injector = inject.by(this, Injector);
      }

      const wizard = container.resolve(Wizard);
      const wand = wizard.injector.inject(Wand);
      expect(wand.owner).toBe(wizard);
      expect(container.getCached(Wand)).toBe(wand);
    });
  });
});
