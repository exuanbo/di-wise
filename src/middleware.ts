import type {Container} from "./container";

/**
 * Middleware function that can be used to extend the container.
 *
 * @example
 * ```ts
 * const logger: Middleware = (composer, _api) => {
 *   composer
 *     .use("resolve", (next) => (...args) => {
 *       console.log("resolve", args);
 *       return next(...args);
 *     })
 *     .use("resolveAll", (next) => (...args) => {
 *       console.log("resolveAll", args);
 *       return next(...args);
 *     });
 * };
 * ```
 */
export interface Middleware {
  (composer: MiddlewareComposer, api: Readonly<Container>): void;
}

/**
 * Composer API for middleware functions.
 */
export interface MiddlewareComposer {
  /**
   * Add a middleware function to the composer.
   */
  use<MethodKey extends keyof Container>(
    key: MethodKey,
    wrap: Container[MethodKey] extends Function
      ? (next: Container[MethodKey]) => Container[MethodKey]
      : never
  ): MiddlewareComposer;
}

/**
 * Apply middleware functions to a container.
 *
 * Middlewares are applied in array order, but execute in reverse order.
 *
 * @example
 * ```ts
 * const container = applyMiddleware(
 *   createContainer(),
 *   [A, B],
 * );
 * ```
 *
 * The execution order will be:
 *
 * 1. B before
 * 2. A before
 * 3. original function
 * 4. A after
 * 5. B after
 *
 * This allows outer middlewares to wrap and control the behavior of inner middlewares.
 */
export function applyMiddleware(container: Container, middlewares: Middleware[]): Container {
  const composer: MiddlewareComposer = {
    use(key, wrap) {
      container[key] = wrap(container[key]);
      return composer;
    },
  };
  const api = container.api ||= {...container};
  middlewares.forEach((middleware) => middleware(composer, api));
  return container;
}
