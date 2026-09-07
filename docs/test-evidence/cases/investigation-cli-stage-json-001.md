### Case INVESTIGATION-CLI-STAGE-JSON-001: CLI stage-index rejects JSON output

Tests:
- `test:5e66709e1783db4e70cd83fe64a33556c75a196a1b9563805e54e2b0ef5ec08e`

Tags:
- `investigation-report`

Contract:
- 直接调用的源码 CLI 入口 不为 `stage-index` 提供 JSON 输出协议。

Proves:
- 传入 `--json` 返回退出码 2、stdout 为空、stderr 给出未知选项诊断，且派生 index 字节不变。
