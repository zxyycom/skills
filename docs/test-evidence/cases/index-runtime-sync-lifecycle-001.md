### Case INDEX-RUNTIME-SYNC-LIFECYCLE-001: 跨换行格式检查写入并加载当前索引

Tests:
- `test:41aa9cb805bb7f4c360b901d1471abf57177e21e5e9bab95541ca179ad3598ed`

Tags:
- `index-runtime`

Contract:
- 同步生命周期必须区分缺失、写入和当前状态，并容忍等价换行格式。

Proves:
- 缺失索引经写入后成为当前，CRLF 文本仍可检查和加载。
