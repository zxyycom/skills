### Case GATE-SELECTED-CODE-UNION-001: 多领域指标范围取维护代码并集

Tests:
- `test:019f0ba5d4c26255b5ede2b71f18ef9eee152f158335fe3b6df70216337bc420`

Tags:
- `repository-tooling`

Contract:
- selected 联合选择多个领域时，file/function metrics 对各领域维护代码取并集并去重，不带入共同的额外依赖或生成副本。

Proves:
- task-graph、novel-cards 与重复的 task-graph 通过真实 Definition 原生 options 和 collectProjectFiles 恰好选中两域各自的一份 TypeScript/JavaScript。
- 相邻决策领域、index-runtime 依赖与 Novel Cards 技能生成副本均不进入结果，独立路径列表同时检验遗漏、泄漏与重复。
