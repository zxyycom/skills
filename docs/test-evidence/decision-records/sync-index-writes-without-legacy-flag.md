### Case DECISION-SYNC-INDEX-001: 同步命令直接重建索引并拒绝旧写入选项

Entry:
- `tools/decision-records/tests/cli-args.test.ts > sync-index rebuilds without an option and rejects the former write flag`
- `bun test --test-name-pattern="^sync-index rebuilds without an option and rejects the former write flag$" ./tools/decision-records/tests/run.ts`

Contract:
- `sync-index` 直接从已建立的 Decision Markdown 重建派生索引；`check` 保持独立的只读严格验证入口。
- `--write` 不再是 Decision Records CLI 的公共选项。

Proves:
- `sync-index --help` 说明直接重建索引且不显示 `--write`。
- 使用旧的 `--write` 参数以参数错误退出，并在不进入索引写入流程前报告未知选项。
