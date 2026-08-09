### Case INVESTIGATION-RESOURCE-SCOPE-001: 完整检查拒绝孤儿资源而局部检查保持局部

Entry:
- `tools/investigation-report/tests/resources.test.ts > full validation rejects orphan resources while scoped validation remains local`
- `bun test --test-name-pattern="^full validation rejects orphan resources while scoped validation remains local$" ./tools/investigation-report/tests/run.ts`

Contract:
- 完整检查必须拒绝未被任何报告引用的资源文件；按路径的局部检查只验证命中报告的引用，不声称全局孤儿或索引新鲜度。

Proves:
- 新增孤儿文件后，命中主题的局部检查成功且 `indexChecked` 为 false。
- 同一集合的完整检查返回包含孤儿资源 ID 的阻断诊断。
