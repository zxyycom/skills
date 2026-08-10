### Case TEST-EVIDENCE-LEDGER-FIXED-LAYOUT-001: Ledger 只接受固定平面布局
Entry:
- `tools/test-evidence/tests/ledger-source.test.ts > ledger roots enforce the fixed flat regular-file layout`
- `bun test --test-name-pattern="^ledger roots enforce the fixed flat regular-file layout$" ./tools/test-evidence/tests/run.ts`
Contract:
- Ledger 根目录与 `cases/` 只允许契约声明的固定成员和一级 Markdown Case 文件。
Proves:
- 未支持的根文件、嵌套或非 Markdown Case 成员及符号链接都会阻止来源加载。
