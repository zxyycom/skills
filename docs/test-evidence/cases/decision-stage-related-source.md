### Case DECISION-STAGE-RELATED-SOURCE-001: 全集暂存要求关系依赖的来源配套

Tests:
- `test:ed5dd5659fb2e955b3e2e0db474a1fe46740a1c2e472417c1672aa6fdffdbe5c`

Tags:
- `decision-records`

Contract:
- all scope 的相关依赖来源必须与合成发布图的条目及 revision 配套，不自动刷新其他 owner。

Proves:
- 只 domain 暂存关系目标 B 后，stage A 拒绝其不配套索引且提示补选，pending 不变；显式同选 A/B 后成功。
