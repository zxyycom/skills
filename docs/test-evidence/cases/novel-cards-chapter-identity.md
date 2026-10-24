### Case NOVEL-CARDS-CHAPTER-IDENTITY-020: 章节身份与编号分离

Tests:
- `test:c0cb039380e1b5f043252aeba793c03ea7a3ca7426acf5f15dc0eed659b97f30`

Tags:
- `novel-cards`

Contract:
- 稳定ID不随标题、编号或文件移动改变，生成ID在生成时不得重复当前集合。

Proves:
- 改标题/重排章号与移动文件后仍按稳定 ID 读取；一次 new-id 调用返回合法且可建立/读取的 ID。
