### Case TASK-GRAPH-RUNTIME-DIAGNOSTIC-001: 安装诊断先清理秘密再保留 8 KiB 尾部

Entry:
- `tools/task-graph/tests/runtime.test.ts > runtime install failure sanitizes long, chunk-independent JSON and URL secrets before 8 KiB tail`
- `bun test --test-name-pattern="^runtime install failure sanitizes long, chunk-independent JSON and URL secrets before 8 KiB tail$" ./tools/task-graph/tests/run.ts`

Contract:
- npm stdout/stderr 不能因超长值、JSON key、URL userinfo 或控制字符泄漏凭据。

Proves:
- 超长 token、引号值和 URL 凭据都被替换，安全尾部保留且每个流不超过 8 KiB，失败临时目录被清理。
