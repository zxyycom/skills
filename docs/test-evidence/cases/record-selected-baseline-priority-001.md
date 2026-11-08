### Case RECORD-SELECTED-BASELINE-PRIORITY-001: Selected sync 选择器诊断

Tests:
- `test:5e1ac9d0e819b43f19f0357bee8d09f38b09f59988180e4f2e8f8dc22ef9d4fd`
- `test:b9d37870c1b11ff24c9bd2c0dcb9df5d5240aa21ce1d2a242eafac1c07ac198d`

Tags:
- `decision-records`
- `investigation-report`

Contract:
- selected sync 对无效、重复和未命中选择器保留可定位诊断。

Proves:
- 共同选择器层聚合无效及重复输入；DR/IR 未命中输入保留 target 顺序与恢复提示。
