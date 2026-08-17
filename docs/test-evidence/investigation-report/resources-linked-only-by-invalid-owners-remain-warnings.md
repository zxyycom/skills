### Case INVESTIGATION-RESOURCE-INVALID-OWNER-WARNING-001: 仅由无效 Owner 主题链接的可见资源仍是未引用 Warning

Entry:
- `tools/investigation-report/tests/resources.test.ts > resources linked only by invalid owner topics remain unreferenced warnings`
- `bun test --test-name-pattern="^resources linked only by invalid owner topics remain unreferenced warnings$" ./tools/investigation-report/tests/run.ts`

Contract:
- 无效 owner 主题的资源链接不建立全量资源引用关系；可见资源仍须作为未引用成员给出 warning，同时保留主题结构 error。

Proves:
- 完整验证同时返回无效 owner 主题的 error，以及包含资源 ID 和 owner-reference 原因的未引用 warning。
