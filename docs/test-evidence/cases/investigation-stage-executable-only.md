### Case INVESTIGATION-STAGE-EXECUTABLE-ONLY-001: 仅执行位变化参与暂存结果

Tests:
- `test:81b4a71435a8139f928f7675b1326de1f1c4fecf5b1ddc5f773f225aaff54504`
- `test:ea0eabe85fd39b11c9b53b83ceec8027faf220675694bdaceee5ea66749e892d`

Tags:
- `investigation-report`
- `version-control`

Contract:
- 启用 core.filemode 时，选中资源仅执行位变化也须进入 pending，重复相同暂存无变化。

Proves:
- Unix 共享 Git 发布节点在相同 bytes 下将选中 mode 从 100644 更新到 100755、OID 保持，二次发布无变化。
- IR all/domain 真实 Git stage 另覆盖所选资源暂存；源码使用同一 workspace_file_mode 与 SourcePublication。本组合不声称 IR fixture 自身只改变执行位。
