/**
 * This module provides all public APIs of `di-wise`.
 *
 * @module di-wise
 */

export type {Container, ContainerOptions} from "./container";
export {createContainer} from "./container";
export type {ClassDecorator, ClassFieldDecorator, ClassFieldInitializer} from "./decorators";
export {AutoRegister, Inject, Injectable, InjectAll, Scoped} from "./decorators";
export {inject, injectAll, injectBy, Injector} from "./inject";
export type {InstanceRef} from "./instance";
export type {Middleware, MiddlewareComposer} from "./middleware";
export {applyMiddlewares} from "./middleware";
export type {ClassProvider, FactoryProvider, Provider, ValueProvider} from "./provider";
export type {Registration, RegistrationMap, RegistrationOptions, Registry} from "./registry";
export {Build, Value} from "./registry";
export {Scope} from "./scope";
export type {Constructor, Token, TokenList} from "./token";
export {Type} from "./token";
