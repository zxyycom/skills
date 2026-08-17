### Case INVESTIGATION-CLI-CONTRACTS-001: 生成 Check 命令保持验证契约

Entry:
- `tools/investigation-report/tests/cli-generated.test.ts > generated investigation check command preserves validation contracts`
- `bun test --test-name-pattern="^generated investigation check command preserves validation contracts$" ./tools/investigation-report/tests/run.ts`

Contract:
- 生成调查 CLI 的默认 check 必须执行完整校验；路径过滤 check 只校验命中报告及其引用资源，不声称已检查全局资源池或索引，并以退出码区分有效与无效输入。

Proves:
- 完整与过滤检查成功时只向 stdout 写结果且 stderr 为空；过滤检查报告 `index not checked`。
- 删除目标报告引用的资源或破坏报告结构后，命令以退出码 1 失败、stdout 为空，并给出对应诊断。
