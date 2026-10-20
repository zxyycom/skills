### Case DECISION-LAYOUT-VALID-001: 扫描器接受根目录和归档布局

Tests:
- `test:97c10e4ea00acc962f1c6ca800dfd15739d05896cebe0642c61281beb56deaf2`

Tags:
- `decision-records`

Contract:
- 根目录仅承载 active、archive 仅承载 archived，且两处 frontmatter ID 全局唯一、sourcePath 独占。

Proves:
- 真实 fixture 的完整 API 验证无错误，包含两条决策、一 active、一 archived，并按确定顺序返回各自 ID/sourcePath。
