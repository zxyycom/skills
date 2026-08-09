### Case INDEX-RUNTIME-STAGING-EXISTENCE-001: 用统一 ID 存在性规则表达条目变化

Entry:
- `tools/index-runtime/tests/staging.test.ts > applies one id-existence rule to additions deletions no-ops and explicit renames`
- `bun test --test-name-pattern="^applies one id-existence rule to additions deletions no-ops and explicit renames$" ./tools/index-runtime/tests/run.ts`

Contract:
- 新增、删除、无变化和显式重命名都由选中 ID 在 revision 与工作区索引中的存在状态表达。

Proves:
- 同一公共操作正确产生新增、删除和无变化结果。
- 同时选择旧 ID 与新 ID 完成显式重命名，并安全处理 `__proto__` 与 `constructor` 身份。
- 无实际变化返回 `unchanged`。
