### Case TEST-EVIDENCE-INVALID-ROOT-INDEX-001: 查询拒绝信任新近失效的根目录
Entry:
- `tools/test-evidence/tests/catalog.test.ts > queries reject newly invalid root layouts instead of trusting a previous index`
- `bun test --test-name-pattern="^queries reject newly invalid root layouts instead of trusting a previous index$" ./tools/test-evidence/tests/catalog.test.ts`
Contract:
- 查询索引前必须确认当前权威根目录仍可合法读取，不能用旧索引掩盖新增目录错误。
Proves:
- 新增不受支持的根文件后查询返回阻断 revision 诊断且不返回 case，同步返回具体目录诊断。
