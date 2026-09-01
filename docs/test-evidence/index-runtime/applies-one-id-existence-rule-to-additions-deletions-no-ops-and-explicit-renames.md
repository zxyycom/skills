### Case INDEX-RUNTIME-STAGING-EXISTENCE-001: 注入仓储中用统一 ID 存在性规则表达条目变化

Entry:
- `tools/index-runtime/tests/staging.test.ts > applies one id-existence rule to additions deletions no-ops and explicit renames`
- `bun test --test-name-pattern="^applies one id-existence rule to additions deletions no-ops and explicit renames$" ./tools/index-runtime/tests/run.ts`

Contract:
- 在注入的 repository 边界下，新增、删除、无变化和显式重命名都由选中 ID 在 revision 与工作区索引中的存在状态表达。

Proves:
- 注入仓储记录的目标索引分别正确表达新增、删除和无变化。
- 同时选择旧 ID 与新 ID 完成显式重命名，并安全处理 `__proto__` 与 `constructor` 身份。
- 无实际变化返回 `unchanged`。
