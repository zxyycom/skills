### Case VERSION-CONTROL-REVISION-001: 发现仓库根并读取修订快照

Tests:
- `test:7b41b3d3e8434b31123cd16088894ad613017b25c7b85790464dab83882e204e`

Tags:
- `version-control`

Contract:
- 版本控制适配器必须从嵌套路径发现仓库根，并按修订列举和读取文件。

Proves:
- 当前修订、路径范围、二进制内容和已确认缺失的修订文件均返回准确结果。
