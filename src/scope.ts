export const Scope = {
  Inherited: "Inherited",
  Transient: "Transient",
  Resolution: "Resolution",
  Container: "Container",
} as const;

export type Scope = typeof Scope[keyof typeof Scope];
