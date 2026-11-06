### Case NATIVE-RECORD-DECISION-FLOW-001: 决策 flow YAML 的局部写入

Tests:
- `test:4a699825dafc2e2a7b6e8e5be3791a96f0cd90da62d97e1396c1bd652971637c`
- `test:dc419f004fb22b9e4c54b3b49be6077faad986b5744b1c8442f4c4b73bfb9cfc`

Tags:
- `record-rust`

Contract:
- 决策发布和身份修改须保留未选正文和文件表示。

Proves:
- 私有事务检查 BOM、换行、未改成员及实际写入后的索引接线。
