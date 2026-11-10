### Case NATIVE-RECORD-SELECTOR-WORK-001: 批量名称索引的投影工作

Tests:
- `test:40cf79fe82b27c293b73fc53ef44109ee8cd2595333c35386b447833c6f0e238`

Tags:
- `record-rust`

Contract:
- 同次批量名称选择不应按每个选择器重复投影全部记录名称。

Proves:
- 500 个名称查询得到对应 ID，记录名称投影调用次数等于 500 条输入；不证明命令墙钟耗时。
