### Case TEST-EVIDENCE-REVISION-FRAMING-001: Revision Framing 规范化非语义输入
Entry:
- `tools/test-evidence/tests/run.ts > revision framing normalizes line endings and topic JSON formatting`
- `bun test --test-name-pattern="^revision framing normalizes line endings and topic JSON formatting$" ./tools/test-evidence/tests/run.ts`
Contract:
- 源 revision 只反映规范化后的 topic 定义、case 源路径与正文及固定 case ID 规则，不受非语义载体差异影响。
Proves:
- LF 与 CRLF 产生相同 revision，topic JSON 纯格式变化不改变当前 revision。
