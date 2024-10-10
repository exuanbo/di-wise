// @ts-expect-error: readonly property
Symbol.metadata ||= Symbol('Symbol.metadata')

export type {InjectionConfig} from './config'
export type {ContainerOptions} from './container'
export {Container} from './container'
export type {ClassDecorator, ClassFieldDecorator, ClassFieldInitializer} from './decorators'
export {Deferred, Inject, Injectable, Scoped} from './decorators'
export {ErrorMessage} from './errors'
export {inject} from './inject'
export type {
  ClassProvider,
  FactoryProvider,
  InjectionProvider,
  Providable,
  TokenProvider,
  ValueProvider,
} from './provider'
export type {Resolvable} from './resolver'
export {InjectionScope} from './scope'
export type {Constructor, InjectionToken} from './token'
export {InjectableType} from './token'
