### Case NATIVE-RECORD-REALLOCATION-COMPONENT-001: 选择性同步重划连通分量

Tests:
- `test:abe26d6eb74b12d2eafadc75fe6dad3b821f1662e797d8a05521096e4012cbbd`

Tags:
- `record-rust`

Contract:
- 选定重划关系时必须包含完整重划连通分量，不包含仅由其他关系连接的记录。

Proves:
- 5 节点链从一端选择得到全部链节点，外部修订关系节点不进入结果。
