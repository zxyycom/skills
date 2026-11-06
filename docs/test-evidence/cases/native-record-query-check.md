### Case NATIVE-RECORD-QUERY-CHECK-001: 双域检查的诊断与覆盖范围

Tests:
- `test:17fc9af448c7eba1839b8e6356d23dcf4151a2c02ea4b6ca38f2b02b40f39b28`
- `test:398e9d0f7d82933d4600f613a50fa29cf9016eccf39ca0dc81e15d0e6d53b0be`
- `test:45bcc3e6a72baeb54b20a069f8ed5b66bac8984524604a227343fae706f8a1b1`
- `test:a39bae902c83f1d8e80b3c32b6e3e47d8d6b85d10dd164f85a603ea93775b9ff`

Tags:
- `record-rust`

Contract:
- 检查须报告选定范围中的实际来源及独立错误，不把部分结果当完整成功。

Proves:
- 真实 CLI 与私有源分别核对诊断聚合、索引差异和非法字符输入。
