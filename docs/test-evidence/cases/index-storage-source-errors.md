### Case INDEX-STORAGE-SOURCE-ERRORS-001: 内部source与普通text保持失败诊断

Tests:
- `test:aabded5cc5248e8ac84cd9e62970f43667a2c2713232f8d15b2812d3c2aaf5e9`
- `test:babe9ec1375c8b103cde00d78ab3a33b7b114cda47a3ca2db8ec2d05aca45179`

Tags:
- `index-runtime`

Contract:
- 提取原始字节消费责任不能改变普通索引读取的缺失和UTF8失败分类。

Proves:
- missing与非法UTF8输入在两个入口返回完全相同错误对象，code分别为index-missing和index-encoding-invalid。
