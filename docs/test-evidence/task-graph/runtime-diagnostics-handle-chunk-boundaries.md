### Case TASK-GRAPH-RUNTIME-DIAGNOSTIC-CHUNK-001: 流式诊断跨 chunk 识别 secret key

Entry:
- `tools/task-graph/tests/runtime.test.ts > npm command sanitizer handles secret keys split across process output chunks`
- `bun test --test-name-pattern="^npm command sanitizer handles secret keys split across process output chunks$" ./tools/task-graph/tests/run.ts`

Contract:
- 凭据 key 或值跨子进程输出 chunk 时仍必须按同一有界清理状态处理。

Proves:
- `_auth`/`Token` 跨 chunk、JSON token 与 URL userinfo 全部清理，非零退出信息仍可诊断。
