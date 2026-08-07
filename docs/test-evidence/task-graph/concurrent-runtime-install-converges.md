### Case TASK-GRAPH-RUNTIME-INSTALL-CONCURRENCY-001: 并发 runtime 安装收敛到 installed 与 reused

Entry:
- `tools/task-graph/tests/runtime.test.ts > concurrent native runtime installation converges to installed and reused with a real probe`
- `bun test --test-name-pattern="^concurrent native runtime installation converges to installed and reused with a real probe$" ./tools/task-graph/tests/run.ts`

Contract:
- 独立安装进程使用唯一临时目录，发布竞争后验证最终 runtime，不另建 bootstrap 锁。

Proves:
- 显式 Node 下两个安装分别返回 installed/reused，真实 check 与重复 reuse 成功，普通完成不残留 `.install-*`。
