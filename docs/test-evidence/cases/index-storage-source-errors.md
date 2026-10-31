### Case INDEX-STORAGE-SOURCE-ERRORS-001: 内部source与普通text保持失败诊断

Tests:
- `test:4c99613c3714fe32e1f70bf6cbc615c13da6271d8dba027be0db2780b16faa67`
- `test:bfc2554d06fc14a684fcbe55ee41037b7ab8cb43b483007944c50318564e6ad3`

Tags:
- `index-runtime`

Contract:
- 提取原始字节消费责任不能改变普通索引读取的缺失和UTF8失败分类。

Proves:
- missing与非法UTF8输入在两个入口返回完全相同错误对象，code分别为index-missing和index-encoding-invalid。
