### Case IR-INDEX-PAYLOAD-SCOPE-001: 来源 stage 不读取未选 pending 资源 blob

Tests:
- `test:ea0eabe85fd39b11c9b53b83ceec8027faf220675694bdaceee5ea66749e892d`

Tags:
- `investigation-report`

Contract:
- all 与 domain scope 不因未选 pending 资源 blob 不可读而阻断所选刷新，也不替换该未选条目。

Proves:
- 真实 Git fixture 移除未选资源的对象文件后，两种 scope 均成功暂存所选报告与资源，未选资源的 pending OID 保持。
