### Case TEST-EVIDENCE-ROOT-MEMBERSHIP-001: Catalog 根目录拒绝未知 Topic 与额外文件
Entry:
- `tools/test-evidence/tests/catalog.test.ts > catalog roots reject unknown topic directories and unsupported root files`
- `bun test --test-name-pattern="^catalog roots reject unknown topic directories and unsupported root files$" ./tools/test-evidence/tests/catalog.test.ts`
Contract:
- Catalog 根目录只能包含受控 topic 目录和明确允许的根文件。
Proves:
- 未登记 topic 目录与不受支持的根文件分别返回确定诊断。
