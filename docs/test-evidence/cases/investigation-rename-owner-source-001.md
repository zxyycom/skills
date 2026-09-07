### Case INVESTIGATION-RENAME-OWNER-SOURCE-001: source owner 终检后的新成员不被递归删除

Tests:
- `test:f23a4e9139374e733f3f18cf7038989e2f3cb1bf34e515ccd85b420abd903ec0`

Tags:
- `investigation-report`

Contract:
- rename 删除旧 owner 只能逐个删除仍匹配预演内容的文件，并从内向外 `rmdir` 空目录；终检后出现的新成员必须停止事务，不得递归删除或伪报完整恢复。

Proves:
- hook 在旧 owner 最后验证后加入成员时，结果是 `partial-or-unknown`。
- 原 owner 文件、新成员与 target 复制均被保留，report/index 回到旧内容且不留下新 report 路径。
