### Case INDEX-RUNTIME-SYNC-LIFECYCLE-001: 跨换行格式检查写入并加载当前索引

Tests:
- `test:a3421191b25f27eca51e122277b22a092a5dea7c52b89631a90f3d05852f8033`

Tags:
- `index-runtime`

Contract:
- 同步生命周期必须区分缺失、写入和当前状态，并容忍等价换行格式。

Proves:
- 缺失索引经写入后成为当前，CRLF 文本仍可检查和加载。
