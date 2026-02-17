/* eslint-disable @typescript-eslint/no-require-imports */
const { parentPort } = require("worker_threads");

let cachedScriptSource = null;
let cachedScript = null;

function installMacrosTrusted(macroData) {
  globalThis.__macroData = macroData;
  if (!Array.isArray(globalThis.__macroWrites)) {
    globalThis.__macroWrites = [];
  }
  if (globalThis.__macroInitialized) {
    return;
  }
  globalThis.__macroInitialized = true;

  const toRegex = (pattern) => {
    const escaped = String(pattern)
      .replace(/[.+^$()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*")
      .replace(/\?/g, ".");
    return new RegExp("^" + escaped + "$", "i");
  };

  globalThis.Asset = {
    get: (path) => globalThis.__macroData.assetsByPath[path] ?? null,
    getById: (id) => globalThis.__macroData.assetsById[id] ?? null,
    list: () => Object.values(globalThis.__macroData.assetsByPath),
    query: (pattern) => {
      const regex = toRegex(pattern);
      return Object.entries(globalThis.__macroData.assetsByPath)
        .filter(([path]) => regex.test(path))
        .map(([, asset]) => asset);
    },
    getHierarchy: (path) => {
      if (!path) return [];
      const parts = String(path).split(".").filter(Boolean);
      const result = [];
      for (let i = 0; i < parts.length; i += 1) {
        const currentPath = parts.slice(0, i + 1).join(".");
        const asset = globalThis.__macroData.assetsByPath[currentPath];
        if (!asset) break;
        result.push({ path: currentPath, ...asset });
      }
      return result;
    },
  };

  globalThis.Attribute = {
    get: (path) => globalThis.__macroData.attributesByPath[path] ?? null,
    list: (assetPath) => {
      if (!assetPath) {
        return Object.values(globalThis.__macroData.attributesByPath);
      }
      return globalThis.__macroData.attributesByAssetPath[assetPath] ?? [];
    },
    getMany: (paths) => (Array.isArray(paths) ? paths : []).map((path) => ({
      path,
      value: globalThis.__macroData.attributesByPath[path] ?? null,
    })),
    set: (path, value) => {
      globalThis.__macroWrites.push({ path, value });
      return true;
    },
    setMany: (items) => {
      if (!Array.isArray(items)) return 0;
      items.forEach((item) => {
        if (item && item.path) {
          globalThis.__macroWrites.push({ path: item.path, value: item.value });
        }
      });
      return items.length;
    },
  };

  globalThis.Historian = {
    insertMany: (items) => {
      if (!Array.isArray(items)) return 0;
      items.forEach((item) => {
        if (item && item.path) {
          globalThis.__macroWrites.push({
            path: item.path,
            value: item.value,
            ts: item.ts || null,
            target: "historian",
          });
        }
      });
      return items.length;
    },
    getMany: (paths, start, end, bucket, options) => {
      if (!Array.isArray(paths)) return [];
      const format = options && typeof options === "object"
        ? options.format || (options.iso ? "iso" : undefined)
        : undefined;
      globalThis.__macroWrites.push({
        target: "historianQuery",
        paths,
        start,
        end,
        bucket,
        format,
        iso: options && typeof options === "object" ? options.iso === true : undefined,
      });
      return [];
    },
  };

  const uuidv4 = () =>
    "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });

  globalThis.Event = {
    get: (id) => (id ? globalThis.__macroData.eventsById[id] ?? null : null),
    generate: (payload) => {
      if (!payload || !payload.asset) return null;
      const id = payload.id || uuidv4();
      globalThis.__macroWrites.push({
        target: "eventGenerate",
        id,
        timestamp: payload.timestamp || null,
        parentEventId: payload.parentEventId || null,
        asset: payload.asset,
        eventCode: payload.eventCode || null,
        status: payload.status || null,
        context: payload.context || null,
      });
      return id;
    },
    end: (payload) => {
      if (!payload || !payload.id) return false;
      globalThis.__macroWrites.push({
        target: "eventEnd",
        id: payload.id,
        timestamp: payload.timestamp || null,
      });
      return true;
    },
  };
}

function runScript({ script, bindings }) {
  const bindingKeys = Object.keys(bindings || {});
  for (const key of bindingKeys) {
    globalThis[key] = bindings[key];
  }

  if (script !== cachedScriptSource) {
    cachedScriptSource = script;
    cachedScript = new Function(`return ${script}`);
  }

  const result = cachedScript();

  const writes = Array.isArray(globalThis.__macroWrites)
    ? globalThis.__macroWrites
    : [];
  globalThis.__macroWrites = [];

  for (const key of bindingKeys) {
    delete globalThis[key];
  }

  return { result, writes };
}

parentPort.on("message", async (payload) => {
  const { id, script, bindings, macroData } = payload;
  try {
    installMacrosTrusted(macroData);
    const payloadResult = runScript({ script, bindings });
    parentPort.postMessage({ id, result: payloadResult });
  } catch (error) {
    parentPort.postMessage({
      id,
      error: error && error.message ? error.message : String(error),
    });
  }
});
