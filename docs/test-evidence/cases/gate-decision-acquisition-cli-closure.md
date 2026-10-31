### Case GATE-DECISION-ACQUISITION-CLI-CLOSURE-001: 当前 record consumer 包含来源 CLI 闭包

Tests:
- `test:c074737f7a2237fae9e3021b21c9965a95127c2b147b032f57f033a77aea9c2f`

Tags:
- `repository-tooling`

Contract:
- 当前真实执行源码 sync-index 的 record Check 必须保留 strict preparation 与 source CLI 加载闭包，不需生成前置。

Proves:
- strict、CLI/query/maintenance/stage/shared-search 各代表单独变化均使 record consumer execute；Definition 未声明统一生成 provider 前置。
