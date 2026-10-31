### Case GATE-MARKDOWN-CAPACITY-001: 完整链接容量与失败边界

Tests:
- `test:60bddbced988ef0814c76f437580c607fad01f0dae40341cc0be45a4eb1562e3`

Tags:
- `gate`
- `markdown`

Contract:
- Markdown 链接检查覆盖维护材料中的全部逻辑目标引用，使用有限容量并保留阻断性链接规则。

Proves:
- 4,096 个本地目标引用可完整验证；容量内缺失目标仍失败，超量返回 unavailable 而非截断成功。
