import {type Middleware, type Token, Type} from "../index";

/**
 * Middleware that makes `resolveAll` return an empty array for unregistered tokens instead of throwing.
 *
 * This middleware modifies the behavior of `resolveAll` to safely handle cases where tokens haven't been
 * registered in the container. Instead of throwing an error, it will return an empty array.
 *
 * @example
 * ```ts
 * import {resolveAllSafe} from "di-wise/middlewares";
 *
 * const container = applyMiddleware(createContainer(), [resolveAllSafe]);
 *
 * container.resolveAll(NonRegisteredToken); // => []
 * ```
 */
export const resolveAllSafe: Middleware = (composer) => {
  composer.use("resolveAll", (next) => <T>(...args: Token<T>[]) => {
    return next(...args, Type.Null);
  });
};
