async function installMacros({ isolate, context, macroData }) {
  const global = context.global;
  await global.set("__macroData", macroData, { copy: true });

  const setupScript = await isolate.compileScript(`
    globalThis.Asset = {
      get: (path) => __macroData.assetsByPath[path] ?? null,
    };
    globalThis.Attribute = {
      get: (path) => __macroData.attributesByPath[path] ?? null,
    };
  `);

  await setupScript.run(context);
}

module.exports = { installMacros };
