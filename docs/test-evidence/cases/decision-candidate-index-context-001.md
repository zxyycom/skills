### Case DECISION-CANDIDATE-INDEX-CONTEXT-001: 已建立索引缺失无效或漂移时候选收集继续服务来源

Tests:
- `test:4255307c6565c4f12adf93835e182fc2faa8e92d2f64e8ab5b4dac56ef0e29d2`

Tags:
- `decision-records`

Contract:
- 已存在 established records 时，无论已建立 index 缺失、无效还是来源漂移，candidates collection 都必须从来源继续服务；`candidates` 和 `show-candidate` 均成功返回候选。

Proves:
- missing、invalid、stale 三种 index 状态下两个查询均零退出并在 stdout 返回该候选。
