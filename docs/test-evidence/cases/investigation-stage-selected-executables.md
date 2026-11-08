### Case INVESTIGATION-STAGE-SELECTED-EXECUTABLES-001: 暂存修改保留可执行资源表示

Tests:
- `test:ea0eabe85fd39b11c9b53b83ceec8027faf220675694bdaceee5ea66749e892d`

Tags:
- `investigation-report`
- `version-control`

Contract:
- 选择暂存更新资源时保留适用的 Git 可执行表示与当前内容。

Proves:
- core.filemode=false 的真实 Git fixture 中已暂存可执行资源内容更新后，pending 模式仍为 100755 且内容为工作区新字节；覆盖 all 和 domain。
