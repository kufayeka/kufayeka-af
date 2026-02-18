import IORedis, { type RedisOptions } from "ioredis";

export const redisHost = process.env.REDIS_HOST ?? "127.0.0.1";
export const redisPort = Number(process.env.REDIS_PORT ?? 6379);
export const redisPassword = process.env.REDIS_PASSWORD;
export const redisDb = Number(process.env.REDIS_DB ?? 0);
export const redisAddress = `${redisHost}:${redisPort}/${redisDb}`;

const redisConnectTimeoutMs = Math.max(
  1000,
  Number(process.env.REDIS_CONNECT_TIMEOUT_MS ?? 10000)
);
const redisKeepAliveMs = Math.max(
  1000,
  Number(process.env.REDIS_KEEPALIVE_MS ?? 30000)
);
const redisRetryMaxDelayMs = Math.max(
  1000,
  Number(process.env.REDIS_RETRY_MAX_DELAY_MS ?? 15000)
);

type CreateRedisConnectionOptions = {
  logPrefix: string;
  overrides?: RedisOptions;
};

export function createRedisConnection({
  logPrefix,
  overrides,
}: CreateRedisConnectionOptions) {
  let lastErrorLogAt = 0;
  const client = new IORedis({
    host: redisHost,
    port: redisPort,
    password: redisPassword,
    db: redisDb,
    maxRetriesPerRequest: null,
    connectTimeout: redisConnectTimeoutMs,
    keepAlive: redisKeepAliveMs,
    noDelay: true,
    retryStrategy: (times) => {
      const delay = Math.min(redisRetryMaxDelayMs, 200 + times * 250);
      if (times === 1 || times % 10 === 0) {
        console.warn(
          `${logPrefix} redis reconnect attempt=${times} nextDelayMs=${delay} target=${redisAddress}`
        );
      }
      return delay;
    },
    reconnectOnError: (error) => {
      const message = error.message.toLowerCase();
      return message.includes("read only");
    },
    ...overrides,
  });

  client.on("ready", () => {
    console.log(`${logPrefix} redis ready target=${redisAddress}`);
  });

  client.on("reconnecting", (delay) => {
    console.warn(
      `${logPrefix} redis reconnecting in ${delay}ms target=${redisAddress}`
    );
  });

  client.on("error", (error) => {
    const now = Date.now();
    // Throttle repeating socket errors to avoid log floods during network flaps.
    if (now - lastErrorLogAt >= 2000) {
      console.error(`${logPrefix} redis error target=${redisAddress} - ${error.message}`);
      lastErrorLogAt = now;
    }
  });

  client.on("end", () => {
    console.warn(`${logPrefix} redis connection ended target=${redisAddress}`);
  });

  return client;
}
