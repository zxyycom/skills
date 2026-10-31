### Case DECISION-LAYOUT-INVALID-001: 扫描器拒绝无效物理布局

Tests:
- `test:34f322fc10fb5eba4ce011fc03a2f2539412a849d50d04d24e01e7438ab2192d`

Tags:
- `decision-records`

Contract:
- 扫描器必须同时拒绝状态与物理 sourcePath 不匹配、根目录嵌套目录以及跨位置重复 Decision ID。

Proves:
- 断言三类输入分别产生 status/sourcePath、unsupported nested directory 和 duplicate ID 诊断。
