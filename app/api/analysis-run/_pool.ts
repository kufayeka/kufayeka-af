import { Worker } from "worker_threads";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const WORKER_PATH = join(__dirname, "_worker.cjs");
const POOL_SIZE = Number(process.env.ANALYSIS_POOL_SIZE ?? 10);
const DEFAULT_TIMEOUT = Number(process.env.ANALYSIS_TIMEOUT_MS ?? 1000);

type PendingTask = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

type WorkerWrapper = {
  worker: Worker;
  busy: boolean;
};

let taskId = 0;
const pending = new Map<number, PendingTask>();
const queue: Array<() => void> = [];

const workers: WorkerWrapper[] = Array.from({ length: POOL_SIZE }, () => {
  const worker = new Worker(WORKER_PATH);
  const wrapper: WorkerWrapper = { worker, busy: false };

  worker.on("message", (message: { id: number; result?: unknown; error?: string }) => {
    const task = pending.get(message.id);
    if (!task) {
      return;
    }
    pending.delete(message.id);
    wrapper.busy = false;
    if (message.error) {
      task.reject(new Error(message.error));
    } else {
      task.resolve(message.result);
    }
    runNext();
  });

  worker.on("error", (error) => {
    wrapper.busy = false;
    const entries = Array.from(pending.entries());
    for (const [id, task] of entries) {
      pending.delete(id);
      task.reject(error as Error);
    }
    runNext();
  });

  return wrapper;
});

function runNext() {
  const next = queue.shift();
  if (next) {
    next();
  }
}

function getAvailableWorker() {
  return workers.find((wrapper) => !wrapper.busy) ?? null;
}

export function runInPool(
  script: string,
  bindings: Record<string, unknown>,
  macroData: Record<string, unknown>
) {
  return new Promise((resolve, reject) => {
    const execute = () => {
      const wrapper = getAvailableWorker();
      if (!wrapper) {
        queue.push(execute);
        return;
      }

      wrapper.busy = true;
      const id = ++taskId;
      pending.set(id, { resolve, reject });
      wrapper.worker.postMessage({
        id,
        script,
        bindings,
        macroData,
        timeout: DEFAULT_TIMEOUT,
      });
    };

    execute();
  });
}
