### Case INDEX-RUNTIME-SYNC-LIFECYCLE-001: 跨换行格式检查写入并加载当前索引

Tests:
- `test:063b601bf0d9ec7a83d9fd987523cd226a6d2a7e7fab160a410496d7411b07df`

Tags:
- `index-runtime`

Contract:
- 同步生命周期必须区分缺失、写入和当前状态，并容忍等价换行格式。

Proves:
- 缺失索引经写入后成为当前，CRLF 文本仍可检查和加载。
