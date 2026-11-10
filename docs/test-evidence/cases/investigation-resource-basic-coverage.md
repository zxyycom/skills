### Case IR-RESOURCE-BASIC-COVERAGE-001: 基础类型覆盖先于深度读取预算

Tests:
- `test:e6457c19e83b0aaff09f8becc506c61ad0f7c11c54fdb2d6cb1964decc62c4f9`

Tags:
- `investigation-report`
- `record-rust`

Contract:
- 扫描先在共享预算内取得各文件基础观察，再投入深度检查；后者不足时保留已取得的类型并如实报告未完成。

Proves:
- 16392 字节预算覆盖两个 64 KiB 文本和末尾 PNG 的头部；深度检查不足的两个文本仍有类型，PNG 正常识别，skippedFiles 为 2 且预留量恰为预算。
