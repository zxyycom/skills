### Case INVESTIGATION-EMPTY-COLLECTION-001: 完整校验与同步拒绝空调查集合

Entry:
- `tools/investigation-report/tests/parsing-directory.test.ts > full validation and synchronization reject empty investigation collections`
- `bun test --test-name-pattern="^full validation and synchronization reject empty investigation collections$" ./tools/investigation-report/tests/run.ts`

Contract:
- 完整调查集合必须至少包含一个合法主题；完整校验和索引同步不能把零主题集合视为有效，也不能为它物化空 v5 索引。

Proves:
- 完整校验与同步分别返回 `investigation collection must contain at least one topic` 的唯一操作诊断，主题计数保持为零。
- 同步结果声明 `changed: false`，且目标 `investigation-index.json` 不存在。
- 即使手工放入结构合法、entries 为空且 metadata 为 `{}` 的对应 revision 索引，公共查询仍返回零主题诊断、空 entries 和 `total: 0`，而不把空集合当作成功的空查询。
