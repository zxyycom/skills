### Case INDEX-RUNTIME-SYNC-LIFECYCLE-001: 跨换行格式检查写入并加载当前索引
Entry:
- `tools/index-runtime/tests/materialization.test.ts > checks, writes, and reloads current indexes across line endings`
- `bun test --test-name-pattern="^checks, writes, and reloads current indexes across line endings$" ./tools/index-runtime/tests/run.ts`
Contract:
- 同步生命周期必须区分缺失、写入和当前状态，并容忍等价换行格式。
Proves:
- 缺失索引经写入后成为当前，CRLF 文本仍可检查和加载。
