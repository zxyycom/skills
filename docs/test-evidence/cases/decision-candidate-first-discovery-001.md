### Case DECISION-CANDIDATE-FIRST-DISCOVERY-001: 首个候选无需既有索引即可发现

Tests:
- `test:9cf4ca56878dc7d1b57ad41748391234ec4030145947cc585033abd42f30a6df`

Tags:
- `decision-records`

Contract:
- 真正没有 established records 且没有 index 时，首个合法 candidate scaffold 仍可从来源发现。

Proves:
- 仅有一条 candidate 的 workspace 返回该候选。
