### Case GATE-QUERY-ADAPTER-HELPER-OWNER-001: 共同查询适配 helper 不扩散无关检查

Tests:
- `test:c83f882451ce8a8e2b0ee8debc2b1fa2dbdbb53d9535a7631029e9ff31160d07`

Tags:
- `repository-tooling`

Contract:
- 共同测试 helper 只使实际静态加载它的领域测试失效，不冒充共享运行时产品输入。

Proves:
- query-contract.ts 单独变化使 DR query 与 IR CLI execute；两域其它 lifecycle/index/transaction、共同 shared-contract、live collection checks 与 Gate 自测均 reuse。
