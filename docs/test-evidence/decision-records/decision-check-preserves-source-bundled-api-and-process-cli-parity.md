### Case DECISION-CHECK-PARITY-001: 决策检查保持源码、分发 API 与进程 CLI 一致
Entry:
- `tools/decision-records/tests/queries.test.ts > decision check preserves source, bundled API, and process CLI parity`
- `bun test --test-name-pattern="^decision check preserves source, bundled API, and process CLI parity$" ./tools/decision-records/tests/run.ts`
Contract:
- 决策集合的严格检查必须在源码 API、分发 API、默认 CLI 与独立 Node 进程入口中返回一致成功结果。
Proves:
- 合法 fixture 的计数与状态投影一致，分发 API 和源码 API 返回相同报告。
- 默认命令与显式 check 命令都以成功输出完成。
