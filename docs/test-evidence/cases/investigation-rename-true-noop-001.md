### Case INVESTIGATION-RENAME-TRUE-NOOP-001: 调查same-ID同路径更名真零写

Tests:
- `test:f6ff24185b298ba8c8384fc03a93551c919bca8d9ae9ac10d85d34424b028733`

Tags:
- `investigation-report`

Contract:
- 同 ID 同位置的正式报告 rename 是不产生更改的操作。

Proves:
- 已记录正式报告未提供历史更名确认时，同 ID 同路径 rename 返回 unchanged，正式正文及索引字节不变。
