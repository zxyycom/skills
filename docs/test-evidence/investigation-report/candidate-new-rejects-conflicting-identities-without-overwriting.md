### Case INVESTIGATION-CANDIDATE-NEW-002: new rejects conflicting or unsafe candidate identities without overwriting

Entry:

- `tools/investigation-report/tests/candidate.test.ts > new rejects invalid, duplicate, and formal-conflicting candidate identities without overwriting files`
- `bun test --test-name-pattern="^new rejects invalid, duplicate, and formal-conflicting candidate identities without overwriting files$" ./tools/investigation-report/tests/run.ts`

Contract:

- `new` 只接受规范 Investigation ID、formedAt、非重复 tags 和直接关系，且不得覆盖已有 candidate、与正式报告共享身份或不安全的候选路径。

Proves:

- 非法 ID、正式身份冲突、集合锁占用和候选符号链接在零写入时返回失败；并发同 ID 创建恰好保留一个候选。
- 重复创建保持既有 candidate 的字节不变。
