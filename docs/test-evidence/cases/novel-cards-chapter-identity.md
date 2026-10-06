### Case NOVEL-CARDS-CHAPTER-IDENTITY-020: 章节身份与编号分离

Tests:
- `test:6800548c6fe106f7b1ac0c120363147f284342e0ec16b184ed77fd4d8756f4d0`

Tags:
- `novel-cards`

Contract:
- 稳定ID不随标题、编号或文件移动改变，生成ID在生成时不得重复当前集合。

Proves:
- 改标题/重排章号并改文件名后仍按原ID读取；new-id返回合法ID且可建立并精确读取该卡。
