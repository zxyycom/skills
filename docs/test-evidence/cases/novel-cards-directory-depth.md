### Case NOVEL-CARDS-DIRECTORY-DEPTH-017: 文件目录深度预算

Tests:
- `test:47752b5e43c7f6e22e53b30dc1aee8dbc92c0afd53f3a10b46ddf14364526b07`

Tags:
- `novel-cards`

Contract:
- 文件扫描目录深度最多100，不代表卡片图的递归深度上限。

Proves:
- 第100层真实目录合法；增加第101层目录以source-limit失败。
