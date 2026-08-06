### Case TASK-GRAPH-CLI-PATH-001: 路径和恢复失败返回 exit 1、单个 LF JSON 且 stderr 为空

Entry:
- `tools/task-graph/tests/cli.test.ts > process CLI maps path and recovery failures to JSON exit one with empty stderr`
- `bun test --test-name-pattern="^process CLI maps path and recovery failures to JSON exit one with empty stderr$" ./tools/task-graph/tests/run.ts`

Contract:
- 真实进程中的路径读取和 generation 恢复失败仍属于协议内错误，不泄漏原始异常到 stderr 或启动级退出码。

Proves:
- 普通文件 root 与非法 reclaimer JSON 都返回 exit 1、单个 LF JSON 且 stderr 为空；后者使用稳定 `LOCK_RECOVERY_REQUIRED`。
