### Case DECISION-LAYOUT-VALID-001: 扫描器接受根目录和归档布局

Entry:
- `tools/decision-records/tests/layout-index.test.ts > scanner accepts root active records and archive archived records with unique IDs`
- `bun test --test-name-pattern="^scanner accepts root active records and archive archived records with unique IDs$" ./tools/decision-records/tests/run.ts`

Contract:
- 根目录仅承载 active、archive 仅承载 archived，且两处 basename 全局唯一。

Proves:
- fixture 扫描为一个 active、一个 archived，并返回确定的 ID/sourcePath 对。
