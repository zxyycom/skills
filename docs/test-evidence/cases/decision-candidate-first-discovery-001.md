### Case DECISION-CANDIDATE-FIRST-DISCOVERY-001: 首个候选无需既有索引即可发现

Tests:
- `test:ee99bbf712188ad6b33526e3875d9a4b8f9c3953ea2f9063c469ce25fe84e143`

Tags:
- `decision-records`

Contract:
- 真正没有 established records 且没有 index 时，首个合法 candidate scaffold 仍可从来源发现。

Proves:
- 仅有一条 candidate 的 workspace 返回该候选。
