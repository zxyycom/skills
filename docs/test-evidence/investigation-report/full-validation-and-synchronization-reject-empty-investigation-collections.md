### Case INVESTIGATION-EMPTY-COLLECTION-001: 完整校验与同步拒绝空调查集合

Entry:
- `tools/investigation-report/tests/parsing-directory.test.ts > full validation and synchronization reject empty investigation collections`
- `bun test --test-name-pattern="^full validation and synchronization reject empty investigation collections$" ./tools/investigation-report/tests/run.ts`

Contract:
- 完整调查集合必须至少包含一个合法主题；完整校验和索引同步不能把零主题集合视为有效，也不能为它物化空索引。

Proves:
- 完整校验与同步分别返回包含 `investigation collection must contain at least one topic` 的唯一操作诊断，主题计数保持为零。
- 同步结果声明 `changed: false`，且目标 `investigation-index.json` 不存在。
- 即使手工放入结构合法、空 entries 与空资源 metadata 对应 revision 一致的索引，公共查询仍从实时 source revision 读取返回零主题诊断、空 entries 和 `total: 0`，而不是把空集合当成成功的空查询结果。
