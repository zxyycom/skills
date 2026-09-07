### Case INDEX-RUNTIME-SYNC-UTF8-001: 同步检查拒绝损坏编码并由写入修复

Tests:
- `test:fecb49a6bf22308ae74915b49b53da048e0be803bb24e07a9e4f9d216ba405af`

Tags:
- `index-runtime`

Contract:
- State index 同步必须区分合法的 U+FFFD UTF-8 字节序列与被宽松解码为相同 JavaScript 字符串的非法字节序列。

Proves:
- Check 将宽松解码结果相同的损坏索引报告为 `state-index.index-encoding-invalid`；write 通过原子路径恢复预期 UTF-8 字节，并使下一次 check 返回 `current`。
