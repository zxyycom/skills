### Case INVESTIGATION-STAGE-UNSELECTED-REPRESENTATIONS-001: 保留未选可执行资源与链接快照

Tests:
- `test:20ad9f1001408d13e8eb929189f5535672bd3c836d4b0162e88ad6020e39cf32`
- `test:ea0eabe85fd39b11c9b53b83ceec8027faf220675694bdaceee5ea66749e892d`

Tags:
- `investigation-report`
- `version-control`

Contract:
- 选择暂存时未选 pending 可执行文件和符号链接表示必须保持。

Proves:
- 共享 Git 发布测试在未选 pending 放入 100755 和 120000 条目，发布后 ls-files --stage 的 mode 和 OID 保持。
- 真实 IR all/domain stage 调用同一 SourcePublication 并保留未选 pending OID；本组合不声称 IR fixture 自身覆盖两种模式。
