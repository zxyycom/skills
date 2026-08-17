### Case INVESTIGATION-SYNC-VALIDATED-SNAPSHOT-001: 全量同步拒绝资源校验开始后变更的主题引用

Entry:
- `tools/investigation-report/tests/index-query.test.ts > full synchronization rejects topic references changed after resource validation begins`
- `bun test --test-name-pattern="^full synchronization rejects topic references changed after resource validation begins$" ./tools/investigation-report/tests/run.ts`

Contract:
- `sync-index` 在完成全量资源校验后只能写入同一份已校验主题快照；写入前主题 Markdown 的资源引用发生变化时，必须因 source drift 拒绝写入，而不是物化未经校验的新引用。

Proves:
- 资源成员查询期间将已验证主题改为引用缺失资源后，同步返回 `changed: false` 和 source-changed error，现有索引字节保持不变。
- 随后的完整验证发现新资源引用缺失，证明同步未绕过资源完整性校验。
