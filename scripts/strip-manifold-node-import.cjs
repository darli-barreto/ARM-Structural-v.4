module.exports = function stripNodeOnlyImport(source) {
  return source.replace(
    /await import\(["']node:module["']\)/g,
    'await Promise.resolve({ createRequire: () => () => { throw new Error("Node.js modules are unavailable in the browser") } })',
  );
};
