### Case VERSION-CONTROL-REVISION-PREFIX-CONTENT-001: 修订前缀内容明确完整性

Tests:
- `test:0d45c5680a5e3a98c4daed87a8028482c7ef33cd9987857a3601e44ae04760ba`

Tags:
- `version-control`

Contract:
- 固定revision的前缀读取保持二进制字节并明确complete；空请求不产生文件。

Proves:
- 含 NUL/FF/FE 的 blob 返回精确二进制 prefix、完整性标记与 full bytes；截断 loose blob 压缩尾后，即便已足够取得 prefix 仍报 operation-failed。
