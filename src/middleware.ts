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
   *
   * @template Key - The key of the container method to wrap.
   */
  use<Key extends keyof Container>(
    key: Key,
    wrap: Container[Key] extends Function
      ? (next: Container[Key]) => Container[Key]
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
export function applyMiddleware(container: Container, middlewares: Middleware[]): Container;

export function applyMiddleware(container: Container, middlewares: Middleware[]) {
  const composer: MiddlewareComposer = {
    use(key, wrap) {
      container[key] = wrap(container[key]);
      return composer;
    },
  };
  middlewares.forEach((middleware) => middleware(composer, {...container}));
  return container;
}
