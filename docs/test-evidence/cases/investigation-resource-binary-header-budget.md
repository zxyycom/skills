### Case IR-RESOURCE-BINARY-HEADER-001: 非文本资源优先识别后仅做必要读取

Tests:
- `test:6a78b733c02fb4e9a32b0c2300b3d4b9a7b692a6c42d2b9eb7b427a176dcfcdd`
- `test:829c284d0d9c7d087df5c0face075082a240b698f5873f31bd2fa9e7013814c6`

Tags:
- `investigation-report`
- `record-rust`

Contract:
- 类型识别先于深度内容读取，非文本且没有完整副本比较需求时仅使用有限头部；存在副本候选时仍需完整字节确认。

Proves:
- 1 MiB + 1 byte 的 PNG 超过默认全文压缩上限，单文件、无副本候选时只预留 8192 字节且没有压缩观察。
- 三个等长 16 KiB PNG 中，两份字节相同，第三份仅在头部以外不同；扫描预留 49152 字节，仅将前两份确认为副本，三份均完成完整比较且没有压缩观察。
