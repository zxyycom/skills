### Case INVESTIGATION-RENAME-OWNER-SOURCE-001: source owner 终检后的新成员不被递归删除

Entry:
- `tools/investigation-report/tests/rename.test.ts > Investigation rename preserves an old owner member that appears after its final validation`
- `bun test --test-name-pattern="^Investigation rename preserves an old owner member that appears after its final validation$" ./tools/investigation-report/tests/run.ts`

Contract:
- rename 删除旧 owner 只能逐个删除仍匹配预演内容的文件，并从内向外 `rmdir` 空目录；终检后出现的新成员必须停止事务，不得递归删除或伪报完整恢复。

Proves:
- hook 在旧 owner 最后验证后加入成员时，结果是 `partial-or-unknown`。
- 原 owner 文件、新成员与 target 复制均被保留，report/index 回到旧内容且不留下新 report 路径。
