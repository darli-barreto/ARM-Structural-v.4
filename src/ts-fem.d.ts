// ts-fem 0.2.0 ships declarations but omits their export condition.
declare module 'ts-fem' {
  export const LinearStaticSolver: typeof import('../node_modules/ts-fem/dist/index').LinearStaticSolver;
  export const DofID: typeof import('../node_modules/ts-fem/dist/index').DofID;
  export type DofID = import('../node_modules/ts-fem/dist/index').DofID;
  export type Beam2D = import('../node_modules/ts-fem/dist/index').Beam2D;
}
