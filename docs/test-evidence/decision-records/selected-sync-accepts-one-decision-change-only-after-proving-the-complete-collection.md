### Case DECISION-SELECTED-SYNC-001: selected sync accepts one Decision change only after proving the complete collection

Entry:
- `tools/decision-records/tests/index-maintenance.test.ts > selected sync accepts one Decision change only after proving the complete collection`
- `bun test --test-name-pattern="^selected sync accepts one Decision change only after proving the complete collection$" ./tools/decision-records/tests/run.ts`

Contract:
- Decision `sync-index --select` 先按 ID-first 解析 selector 并验证完整 established 集合；只有所选 ID 覆盖全部变化时才可用 `--write` 发布完整投影。

Proves:
- 未选择的 Decision 变化零写入失败；唯一 name 加 `.md` 的 selected check 返回 stale。
- selected 文本结果同时保留原始 `.md` selector 与解析后的 ID，且其完整索引字节与同一来源的 full sync 相同。
