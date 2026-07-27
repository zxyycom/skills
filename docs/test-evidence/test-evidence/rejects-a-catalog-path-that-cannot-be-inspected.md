### Case TEST-EVIDENCE-CONFIG-PATH-001: 不可检查的 catalog 路径被拒绝
Entry:
- `tools/test-evidence/tests/config-path.test.ts > rejects a catalog path that cannot be inspected`
- `bun test --test-name-pattern="^rejects a catalog path that cannot be inspected$" ./tools/test-evidence/tests/run.ts`
Contract:
- Test evidence 配置必须拒绝无法安全检查的 uninspectable catalog 路径。
Proves:
- 该路径返回 blocking `config.path-inspection-failed` 诊断且不写入索引。
