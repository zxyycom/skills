await import("./runtime/protocol-failure.test.ts");
await import("./runtime/preflight.test.ts");
await import("./runtime/runtime.test.ts");
await import("./protocol/response.test.ts");
await import("./distribution/distribution.test.ts");
await import("./protocol/review-regressions.test.ts");
await import("./protocol/mapping-regressions.test.ts");
await import("./logging/logging.test.ts");
await import("./runtime/connection-config.test.ts");
await import("./logging/http-retention.test.ts");
await import("./logging/logging-safety.test.ts");

await import("./statistics/statistics-storage.test.ts");
await import("./statistics/statistics-schema.test.ts");
await import("./statistics/statistics-summary.test.ts");
await import("./statistics/statistics-batches.test.ts");

await import("./adapters/adapter-configuration.test.ts");
await import("./adapters/adapter-openai.test.ts");
await import("./adapters/images/adapter-images.test.ts");
await import("./adapters/adapter-jev.test.ts");
await import("./adapters/adapter-logging.test.ts");
await import("./adapters/adapter-distribution.test.ts");
await import("./adapters/adapter-transport.test.ts");

await import("./adapters/adapter-regressions.test.ts");
await import("./adapters/images/adapter-image-validation.test.ts");
