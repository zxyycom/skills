### Case TEST-EVIDENCE-SYNC-SELECTOR-RAW-001: selected sync preserves invalid raw Case selectors in schema-valid failures

Entry:
- `tools/test-evidence/tests/catalog.test.ts > selected sync preserves invalid raw Case selectors in schema-valid failures`
- `bun test --test-name-pattern="^selected sync preserves invalid raw Case selectors in schema-valid failures$" ./tools/test-evidence/tests/catalog.test.ts`

Contract:
- Test Evidence sync 的结果须保留原始 selector；即使 selector 不能解析为 Case ID，失败 JSON 仍须符合公开 schema。

Proves:
- API 与 CLI `--select` 对非法原始 selector 返回 selection-invalid，保留输入文本，并能由 `testEvidenceIndexSyncResultSchema` 验证。
