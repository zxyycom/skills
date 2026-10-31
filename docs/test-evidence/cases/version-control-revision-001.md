### Case VERSION-CONTROL-REVISION-001: 发现仓库根并读取修订快照

Tests:
- `test:f06312d425f1aad77bc2a3723f6d54036fa02a630c4991bfd88f3500da694fc0`

Tags:
- `version-control`

Contract:
- 版本控制适配器必须从嵌套路径发现仓库根，并按修订列举和读取文件。

Proves:
- 当前修订、路径范围、二进制内容和已确认缺失的修订文件均返回准确结果。
