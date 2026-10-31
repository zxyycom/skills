### Case DECISION-LAYOUT-VALID-001: 扫描器接受根目录和归档布局

Tests:
- `test:30473b507c00f29363fd5f0338d49a10cf65bb058f4faecbfe029a5a43eabed2`

Tags:
- `decision-records`

Contract:
- 根目录仅承载 active、archive 仅承载 archived，且两处 frontmatter ID 全局唯一、sourcePath 独占。

Proves:
- 真实 fixture 的完整 API 验证无错误，包含两条决策、一 active、一 archived，并按确定顺序返回各自 ID/sourcePath。
