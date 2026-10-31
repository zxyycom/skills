### Case TEST-EVIDENCE-PROJECT-SCAN-SCOPE-001: 项目注册扫描包含 MTS 与被 suppression 标记的 TypeScript

Tests:
- `test:6bf534cf2b74318a59ef9cf7961154f924bac52a38d49570b1eb17e22e1ce0a2`

Tags:
- `repository-tooling`

Contract:
- 项目注册采集按自己的固定规则发现 TypeScript 与 MTS 闭包中的测试，不由工作区 ast-grep 配置或 suppression 注释删去合法注册。

Proves:
- fixture 设置指向不存在目录的 sgconfig.yml，并导入 MTS 与带 ast-grep-ignore 的 TypeScript 测试；快照仍精确产生两个注册实体，分别保留各自真实来源 locator。
