### Case CHANGE-PLAN-QUERY-CACHE-LIFETIME-001: Git 快照缓存只在单次查询内有效

Tests:
- `test:ea225f79c1ae97f3653b9081ac9d667a6caa8f4966b9bf512499484a4b24a31a`

Tags:
- `change-plan`

Contract:
- list 的 Git 查询缓存不跨调用保留，下一次查询必须重新观察当前 HEAD。

Proves:
- 同一进程先查询两个零距离 Plan，再提交一行项目变化；下一次查询的两个 Plan 都返回一提交、一行变化及更新的 HEAD。
