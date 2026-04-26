/**
 * Ambient declarations for @glazelab/core.
 *
 * `process.env.NODE_ENV` is the standard convention bundlers (tsup,
 * esbuild, webpack, Vite) replace with the literal string at build time.
 * In production builds, dev-only branches dead-code-eliminate. We don't
 * depend on @types/node — this minimal declaration is sufficient for
 * the TypeScript compiler to allow the reference.
 */
declare const process: {
  env: {
    NODE_ENV?: string;
  };
};
