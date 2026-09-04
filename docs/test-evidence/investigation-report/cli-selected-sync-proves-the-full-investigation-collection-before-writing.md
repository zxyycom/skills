### Case INVESTIGATION-CLI-SELECTED-SYNC-001: CLI selected sync proves the full investigation collection before writing

Entry:
- `tools/investigation-report/tests/cli-generated.test.ts > CLI selected sync proves the full investigation collection before writing`
- `bun test --test-name-pattern="^CLI selected sync proves the full investigation collection before writing$" ./tools/investigation-report/tests/run.ts`

Contract:
- Investigation `sync-index --select` 在 collection lock 内完整验证正式报告集合，并以 ID-first selector 限制本次可接纳变化。

Proves:
- 未选择来源变化的 write 保持 index 原字节；name selector 的 check 返回 stale。
- 原始 `.md` name selector 与解析后的标准日期 ID 同时出现在文本结果；完整 projection 字节等于 full sync。
