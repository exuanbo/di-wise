import {beforeEach, describe, expect, it, vi} from "vitest";

import {applyMiddleware, type Container, createContainer, inject, injectAll, type Middleware, type Token} from "..";

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
            log(`[${loggerName}] resolve ${token.name}`);
            const result = next(token);
            log(`[${loggerName}] resolved ${String(result)}`);
            return result;
          })
          .use("resolveAll", (next) => <T>(token: Token<T>) => {
            log(`[${loggerName}] resolveAll ${token.name}`);
            const result = next(token);
            log(`[${loggerName}] resolvedAll [${String(result)}]`);
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

    expect(log).toHaveBeenCalledTimes(12);

    /* eslint-disable @stylistic/no-multi-spaces */
    expect(log).toHaveBeenNthCalledWith(1,  "[B] resolve Wizard");
    expect(log).toHaveBeenNthCalledWith(2,  "[A] resolve Wizard");
    expect(log).toHaveBeenNthCalledWith(3,  "[B] resolve Wand");
    expect(log).toHaveBeenNthCalledWith(4,  "[A] resolve Wand");
    expect(log).toHaveBeenNthCalledWith(5,  "[B] resolveAll Decoration");
    expect(log).toHaveBeenNthCalledWith(6,  "[A] resolveAll Decoration");
    expect(log).toHaveBeenNthCalledWith(7,  "[A] resolvedAll [Decoration {}]");
    expect(log).toHaveBeenNthCalledWith(8,  "[B] resolvedAll [Decoration {}]");
    expect(log).toHaveBeenNthCalledWith(9,  "[A] resolved Wand {decorations: [Decoration {}]}");
    expect(log).toHaveBeenNthCalledWith(10, "[B] resolved Wand {decorations: [Decoration {}]}");
    expect(log).toHaveBeenNthCalledWith(11, "[A] resolved Wizard {wand: Wand {decorations: [Decoration {}]}}");
    expect(log).toHaveBeenNthCalledWith(12, "[B] resolved Wizard {wand: Wand {decorations: [Decoration {}]}}");
    /* eslint-enable @stylistic/no-multi-spaces */
  });
});
