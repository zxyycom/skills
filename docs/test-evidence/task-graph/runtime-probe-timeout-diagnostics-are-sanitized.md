### Case TASK-GRAPH-RUNTIME-PROBE-002: 探针超时诊断完整且先脱敏

Entry:
- `tools/task-graph/tests/runtime.test.ts > runtime install probe preserves sanitized timed-out child diagnostics`
- `bun test --test-name-pattern="^runtime install probe preserves sanitized timed-out child diagnostics$" ./tools/task-graph/tests/run.ts`

Contract:
- 探针超时或信号退出必须保留 exitCode、signal、timedOut 和 stdout/stderr 尾部，并在进入错误 details 前脱敏凭据。

Proves:
- 注入 timedOut + SIGKILL 的探针结果后，probe 阶段错误逐项保留进程字段与安全文本，同时移除 token 和 URL userinfo 原文。
