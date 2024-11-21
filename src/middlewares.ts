import {type Middleware, type Token, Type} from "./index";

/**
 * Middleware that makes `resolveAll` return an empty array for unregistered tokens.
 *
 * By default, `resolveAll` throws an error when trying to resolve unregistered tokens.
 * This middleware modifies that behavior to return an empty array instead,
 * making it safe to resolve optional dependencies.
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
