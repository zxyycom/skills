### Case INVESTIGATION-STAGE-SOURCE-PATH-MOVE-001: 同一报告移动位置时同时暂存旧路径删除与新路径新增

Tests:
- `test:f2b43c8533be87250da085e8620a8f2b17af591ce4da24693af71fdc2a99b596`

Tags:
- `investigation-report`

Contract:
- 同一报告移动 sourcePath 时，domain scope 使用 HEAD 旧路径和工作区索引新路径。

Proves:
- 真实 Git 中 HEAD 旧路径在 pending 删除，新路径保存所选 ID 的完整正文；索引 pending 和未选 pending 保持。
