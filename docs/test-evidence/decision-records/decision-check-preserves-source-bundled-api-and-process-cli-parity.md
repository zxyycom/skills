### Case DECISION-CHECK-PARITY-001: Check 保持源码、bundle 与进程 CLI 一致

Entry:
- `tools/decision-records/tests/queries.test.ts > decision check preserves source, bundled API, and process CLI parity`
- `bun test --test-name-pattern="^decision check preserves source, bundled API, and process CLI parity$" ./tools/decision-records/tests/run.ts`

Contract:
- 同一 workspace 的源码 API、分发 API 与 Node 进程 CLI 必须保持 check 结果一致。

Proves:
- 比较两个 API 结果并运行分发 CLI。
