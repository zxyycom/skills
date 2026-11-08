### Case INVESTIGATION-STAGE-DELETION-UNKNOWN-IDENTITY-001: 局部删除不发现未知位置的未同步身份

Tests:
- `test:3c17c60e7fc532b4845e02492c2f2b6d71feed66d78ac5159c0bf645fe115d72`

Tags:
- `investigation-report`

Contract:
- domain stage 删除仅处理已知位置，不把未知 W 位置的来源自动纳入 pending。

Proves:
- 真实 Git 中 W 索引删除 ID、已知旧路径不存在而未知路径重现同 ID：stage 暂存旧路径删除，未知路径不纳入 pending 且原字节保持。节点不计数文件读取，也未执行全量 check/sync。
