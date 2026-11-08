### Case DECISION-REALLOCATION-CLOSURE-001: 重划扩充选择完整后继集合

Tests:
- `test:9bffb128cdc9fc093743a4dac03e6087f745c4c52f29483675891bfb3842e484`

Tags:
- `decision-records`

Contract:
- 修改重划事件须选择其最终连通分量的全部后继。

Proves:
- 已建立两后继重划后，新增第三后继而遗漏一个既有后继，预检失败且索引字节不变；选全两个既有后继后提交，新增边写入索引且最终图有效。此节点不测试此前不相交分量。
