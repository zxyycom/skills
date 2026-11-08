### Case INVESTIGATION-STAGE-DOMAIN-DELETED-INDEX-001: domain 保留 pending 索引删除

Tests:
- `test:20ad9f1001408d13e8eb929189f5535672bd3c836d4b0162e88ad6020e39cf32`
- `test:ea0eabe85fd39b11c9b53b83ceec8027faf220675694bdaceee5ea66749e892d`
- `test:f4ff48ad89f95e41a332cbdf37d6245e3d75a6dbf722c0374c8706a6796fb3ee`

Tags:
- `investigation-report`

Contract:
- domain 刷新领域文件但不修复或重写 pending 索引，包含缺失状态。

Proves:
- 共享索引合成节点验证 domain 且 pending 索引缺失时不生成索引更新；共享 Git 发布节点验证未选条目的 pending 删除保持，IR 真实 Git domain 服务节点验证所选正文/资源刷新及索引投影不变。源码确认 IR domain 经过相同合成与发布层；未单独运行 IR 索引已 staged 删除的端到端 fixture。
