### Case DECISION-LAYOUT-VALID-001: 扫描器接受根目录和归档布局

Tests:
- `test:97c10e4ea00acc962f1c6ca800dfd15739d05896cebe0642c61281beb56deaf2`

Tags:
- `decision-records`

Contract:
- 根目录仅承载 active、archive 仅承载 archived，且两处 frontmatter ID 全局唯一、sourcePath 独占。

Proves:
- fixture 扫描为一个 active、一个 archived，并返回确定的 ID/sourcePath 对。
