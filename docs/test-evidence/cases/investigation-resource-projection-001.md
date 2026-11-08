### Case INVESTIGATION-RESOURCE-PROJECTION-001: report-owned resources validate exact links and permit shared references

Tests:
- `test:4e572abfeea52b35c3c4bffc062551f60a2a20ffd64dd908e460bd7d795d107a`

Tags:
- `investigation-report`

Contract:
- 资源由 owner 报告直接声明后可被其他报告共享。

Proves:
- 索引图中 consumer 声明 owner 资源但 owner 未声明时拒绝，加入 owner 声明后通过。
