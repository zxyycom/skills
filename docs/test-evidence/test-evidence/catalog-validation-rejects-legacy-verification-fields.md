### Case TEST-EVIDENCE-LEGACY-FIELD-001: Catalog 拒绝旧 Verification 字段
Entry:
- `tools/test-evidence/tests/catalog.test.ts > catalog validation rejects legacy verification fields`
- `bun test --test-name-pattern="^catalog validation rejects legacy verification fields$" ./tools/test-evidence/tests/catalog.test.ts`
Contract:
- 测试专用 catalog 不接受已经移除的 `Verification` 分类字段。
Proves:
- `test` 与 `check` 两种旧字段值都产生结构诊断。
