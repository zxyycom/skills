### Case INVESTIGATION-CLI-CONTRACTS-001: 生成 check 命令保持验证契约
Entry:
- `tools/investigation-report/tests/cli-generated.test.ts > generated investigation check command preserves validation contracts`
- `bun test --test-name-pattern="^generated investigation check command preserves validation contracts$" ./tools/investigation-report/tests/run.ts`
Contract:
- 生成调查 CLI 的默认 check 命令必须支持完整校验；路径过滤 check 必须校验命中报告的资源引用但不声称已检查全局索引，并以退出码区分有效和无效输入。
Proves:
- 完整与过滤检查输出稳定，过滤检查对存在的引用资源成功并报告 `index not checked`，删除该资源后以精确 ID 诊断和退出码 1 失败；报告结构错误亦返回退出码 1。
