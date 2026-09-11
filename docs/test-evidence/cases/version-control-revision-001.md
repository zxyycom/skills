### Case VERSION-CONTROL-REVISION-001: 发现仓库根并读取修订快照

Tests:
- `test:e4fe6e722bdece0b0a5b22bc348eb3b1932e199eca7d0f657e665cc5389f85bf`

Tags:
- `version-control`

Contract:
- 版本控制适配器必须从嵌套路径发现仓库根，并按修订列举和读取文件。

Proves:
- 当前修订、路径范围、二进制内容和已确认缺失的修订文件均返回准确结果。
