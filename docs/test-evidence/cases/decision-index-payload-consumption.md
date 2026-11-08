### Case DR-INDEX-PAYLOAD-CONSUMPTION-001: 读取所选 pending 不依赖未选 blob

Tests:
- `test:2fbe89e6f5ed90b7e4ec69190bb45a419312d47de71bb5517c459f13df72c42a`

Tags:
- `decision-records`

Contract:
- 读取所选 pending blob 不以未选 blob 可读为前提。

Proves:
- 真实 Git 中移除未选对象 blob 后，所选内容仍可读取；直接读取缺失的未选 blob 失败。
