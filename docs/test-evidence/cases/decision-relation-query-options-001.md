### Case DECISION-RELATION-QUERY-OPTIONS-001: 关系查询拒绝重复单值选项

Tests:
- `test:a29dee226594bd95180764b87f9223fc904007c3cdbf1ee5f0946b80fc026e69`

Tags:
- `decision-records`

Contract:
- list 与 search 的单值 related-to、direction、relation-type 不能被重复值静默覆盖。

Proves:
- 真实原生 CLI 对 list 重复 related-to、search 重复 direction、list 重复 relation-type 各退出 2 并返回 invalid-arguments，无领域目录写入。两个命令使用共享选项解析；没有逐命令穷举。
