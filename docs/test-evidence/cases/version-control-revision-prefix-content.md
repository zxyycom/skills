### Case VERSION-CONTROL-REVISION-PREFIX-CONTENT-001: 修订前缀内容明确完整性

Tests:
- `test:f9d8b76db2c6a2f879374cd2744de65e374cd655704c994e7300ee9d580a68ef`

Tags:
- `version-control`

Contract:
- 固定revision的前缀读取保持二进制字节并明确complete；空请求不产生文件。

Proves:
- 有限预算返回正确prefix及complete=false；足够预算返回完整字节，空路径结果为空。
