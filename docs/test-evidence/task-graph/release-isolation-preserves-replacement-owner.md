### Case TASK-GRAPH-LOCK-RELEASE-003: 已提交写入的释放竞争不得删除替换 owner

Entry:
- `tools/task-graph/tests/store.test.ts > release isolation never removes a replacement owner after commit`
- `bun test --test-name-pattern="^release isolation never removes a replacement owner after commit$" ./tools/task-graph/tests/run.ts`

Contract:
- lock release 在隔离 canonical directory 前必须最终复验 owner token；提交后发现 owner 已换代时不得隔离新锁，并必须按未知写入结果返回候选 revision。

Proves:
- mutation 已提交后、release rename 前 canonical owner 被替换时，操作返回 `WRITE_OUTCOME_UNKNOWN` 且报告 revision 1，新 owner 保持不变，已提交 scope 可从索引读回。
