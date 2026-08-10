### Case INDEX-RUNTIME-SYNC-UTF8-001: 同步检查拒绝损坏编码并由写入修复
Entry:
- `tools/index-runtime/tests/materialization.test.ts > sync checks reject invalid UTF-8 indexes and writes repair them`
- `bun test --test-name-pattern="^sync checks reject invalid UTF-8 indexes and writes repair them$" ./tools/index-runtime/tests/run.ts`
Contract:
- State index 同步必须用严格 UTF-8 解码区分有效替换字符与产生相同普通字符串的损坏字节。
Proves:
- Check 将解码等价的损坏索引报告为 encoding-invalid，write 通过既有原子路径恢复原字节并使后续 check 成为 current。
