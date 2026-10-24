### Case GATE-DECISION-ACQUISITION-CLI-CLOSURE-001: 当前 record consumer 包含来源 CLI 闭包

Tests:
- `test:2d54e5150ae5e7c7b9c0283ebcd856b1bdd199f582184093d77c19f92a94b9ea`

Tags:
- `repository-tooling`

Contract:
- 当前真实执行源码 sync-index 的 record Check 必须保留 strict preparation 与 source CLI 加载闭包，不需生成前置。

Proves:
- strict、CLI/query/maintenance/stage/shared-search 各代表单独变化均使 record consumer execute，并显式排除不必要的统一生成 provider；不替代领域新产品测试。
