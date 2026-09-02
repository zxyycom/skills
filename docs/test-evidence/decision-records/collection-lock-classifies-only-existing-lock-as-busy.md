### Case DECISION-COLLECTION-LOCK-DIAGNOSTIC-001: 集合锁只把已存在的锁报告为 busy

Entry:
- `tools/decision-records/tests/transaction-recovery.test.ts > decision collection lock reports busy only for an existing lock`
- `bun test --test-name-pattern="^decision collection lock reports busy only for an existing lock$" ./tools/decision-records/tests/run.ts`

Contract:
- Decision Records collection mutation lock 只有 exclusive create 确认 `EEXIST` 时才表示 busy；访问拒绝和未知 I/O 必须保留各自可行动诊断，且未取得锁时不写入。

Proves:
- `EEXIST` 失败输出 `decision-records.collection-lock-busy` 和 `causeCategory: busy`。
- `EACCES` 输出 access-denied 诊断，未知 I/O 不伪称 busy，三种情况都保持 stdout 为空并退出失败。
