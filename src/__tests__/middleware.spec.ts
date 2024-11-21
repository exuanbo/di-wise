import {beforeEach, describe, expect, it, vi} from "vitest";

import {
  applyMiddleware,
  type Container,
  createContainer,
  inject,
  injectAll,
  type Middleware,
  type Token,
  Type,
} from "..";
import {resolveAllSafe} from "../middlewares";

describe("Middleware", () => {
  let container: Container;

  beforeEach(() => {
    container = createContainer();
  });

  it("should apply middleware", () => {
    const log = vi.fn();

    function getLogger(loggerName: string): Middleware {
      return (composer) => {
        composer
          .use("resolve", (next) => <T>(token: Token<T>) => {
            log(`[${loggerName}] pre  resolve    ${token.name}`);
            const result = next(token);
            log(`[${loggerName}] post resolve    ${String(result)}`);
            return result;
          })
          .use("resolveAll", (next) => <T>(token: Token<T>) => {
            log(`[${loggerName}] pre  resolveAll ${token.name}`);
            const result = next(token);
            log(`[${loggerName}] post resolveAll [${String(result)}]`);
            return result;
          });
      };
    }

    applyMiddleware(
      container,
      [getLogger("A"), getLogger("B")],
    );

    class Decoration {
      toString() {
        return "Decoration {}";
      }
    }

    class Wand {
      decorations = injectAll(Decoration);

      toString() {
        return `Wand {decorations: [${String(this.decorations)}]}`;
      }
    }

    class Wizard {
      wand = inject(Wand);

      toString() {
        return `Wizard {wand: ${String(this.wand)}}`;
      }
    }

    const wizard = container.resolve(Wizard);

    expect(wizard).toBeInstanceOf(Wizard);
    expect(wizard.wand).toBeInstanceOf(Wand);
    expect(wizard.wand.decorations).toEqual([new Decoration()]);

    expect(log.mock.calls).toEqual([
      ["[B] pre  resolve    Wizard"],
      ["[A] pre  resolve    Wizard"],
      ["[B] pre  resolve    Wand"],
      ["[A] pre  resolve    Wand"],
      ["[B] pre  resolveAll Decoration"],
      ["[A] pre  resolveAll Decoration"],
      ["[A] post resolveAll [Decoration {}]"],
      ["[B] post resolveAll [Decoration {}]"],
      ["[A] post resolve    Wand {decorations: [Decoration {}]}"],
      ["[B] post resolve    Wand {decorations: [Decoration {}]}"],
      ["[A] post resolve    Wizard {wand: Wand {decorations: [Decoration {}]}}"],
      ["[B] post resolve    Wizard {wand: Wand {decorations: [Decoration {}]}}"],
    ]);
  });

  describe("resolveAllOptional", () => {
    it("should resolve all tokens to empty array if they are not provided", () => {
      applyMiddleware(container, [resolveAllSafe]);

      const NonRegistered = Type("NonRegistered");
      expect(container.resolveAll(NonRegistered)).toEqual([]);

      const Registered = Type<string>("Registered");
      container.register(Registered, {useValue: "Success"});

      expect(container.resolveAll(Registered)).toEqual(["Success"]);
    });
  });
});
