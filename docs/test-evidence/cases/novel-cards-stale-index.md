### Case NOVEL-CARDS-STALE-INDEX-006: 真实来源使旧索引失效

Tests:
- `test:b0fa63f2108d9277f19d582f58cf7176b3d055eb2d799cd147bd1257f5ad5728`

Tags:
- `novel-cards`

Contract:
- 路径和完整卡文本进入来源指纹，陈旧索引不得支持查询，不猜身份。

Proves:
- 文本改变、移动、删除令旧索引失效；重建后移动卡保留 ID，删除后真实 currentSource.records=[]，用该真实集查询返回 card-not-found。
