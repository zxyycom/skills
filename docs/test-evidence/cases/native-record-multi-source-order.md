### Case NATIVE-RECORD-MULTI-SOURCE-ORDER-001: 多源查询保留顺序、重复身份及每源窗口

Tests:
- `test:5ab90863a800391c931fd1ca05fcaf5e3798f64c9bb3310ea5d873321f243fa9`

Tags:
- `investigation-report`
- `record-rust`

Contract:
- 调查 list/search 按配置来源顺序独立运行查询，不建立跨源去重或全局 limit；list 的 offset 也逐源生效。

Proves:
- 两个自定义目录各有两条命中且共享同一 ID；list、content 与 metadata 的 limit=1 在两源均保留该 ID，按配置顺序返回目录；list offset=1 分别选中各源后一条且 total 保持 2。
