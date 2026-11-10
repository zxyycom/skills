### Case IR-RESOURCE-BINARY-HEADER-001: 非文本资源优先识别后仅做必要读取

Tests:
- `test:829c284d0d9c7d087df5c0face075082a240b698f5873f31bd2fa9e7013814c6`

Tags:
- `investigation-report`
- `record-rust`

Contract:
- 类型识别先于深度内容读取，已知非文本且没有完整副本比较需求时仅使用有限头部。

Proves:
- 2 MiB PNG 在单文件、无重复候选的扫描中完成类型观察，只预留 8192 字节且没有压缩观察。
