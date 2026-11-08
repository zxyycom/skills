### Case INVESTIGATION-ACQUISITION-QUERIES-001: 快照发现不获取正式或候选来源

Tests:
- `test:045ca118cdb50dc7cd62c08d5230734cbd8e026b3e21144f29aa83e99afdd2b4`
- `test:8ad09f135902ceb10e7afd2f94bbfbd10c422906f74101b2e94a7e79c44bd1b0`
- `test:8f7d4e88a44f15b8b43b3150b2746fd965c22ba80c1d50679402762dcf9fe1ad`

Tags:
- `investigation-report`

Contract:
- list、trace 和 metadata search 的索引投影不依赖报告或候选正文。

Proves:
- 三个独立节点仅构造内存索引即成功计算列表、追溯拆分预算与 metadata 匹配；这些投影入口源码只接收快照和查询参数，不接收工作区根。
