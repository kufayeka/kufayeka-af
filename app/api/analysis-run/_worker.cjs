const { parentPort } = require("worker_threads");
const ivm = require("isolated-vm");
const { installMacros } = require("./_macros.cjs");

const isolate = new ivm.Isolate({ memoryLimit: 64 });
const contextPromise = isolate.createContext();
let cachedScriptSource = null;
let cachedScript = null;

async function getContext() {
  return contextPromise;
}

async function runScript({ script, bindings, timeout }) {
  const context = await getContext();
  const global = context.global;
  await global.set("global", global.derefInto());

  const bindingKeys = Object.keys(bindings || {});
  for (const key of bindingKeys) {
    await global.set(key, bindings[key], { copy: true });
  }

  if (script !== cachedScriptSource) {
    cachedScriptSource = script;
    cachedScript = await isolate.compileScript(script);
  }

  const result = await cachedScript.run(context, {
    timeout,
    copy: true,
  });

  for (const key of bindingKeys) {
    await global.delete(key);
  }

  return result;
}

parentPort.on("message", async (payload) => {
  const { id, script, bindings, macroData, timeout } = payload;
  try {
    await installMacros({ isolate, context: await getContext(), macroData });
    const result = await runScript({ script, bindings, timeout });
    parentPort.postMessage({ id, result });
  } catch (error) {
    parentPort.postMessage({
      id,
      error: error && error.message ? error.message : String(error),
    });
  }
});
