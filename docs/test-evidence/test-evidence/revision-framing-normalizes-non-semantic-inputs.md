### Case TEST-EVIDENCE-REVISION-FRAMING-001: Revision Framing 规范化非语义输入
Entry:
- `tools/test-evidence/tests/catalog.test.ts > revision framing normalizes line endings and topic JSON formatting`
- `bun test --test-name-pattern="^revision framing normalizes line endings and topic JSON formatting$" ./tools/test-evidence/tests/catalog.test.ts`
Contract:
- 结构化源 revision 只反映规范化后的 topic 定义、case 源路径与正文，不受非语义载体差异影响。
Proves:
- LF 与 CRLF 产生相同 metadata/entry 指纹，孤立 CR 保持为语义输入并产生不同 entry 指纹。
- topic JSON 纯格式变化不改变当前 revision 清单。
