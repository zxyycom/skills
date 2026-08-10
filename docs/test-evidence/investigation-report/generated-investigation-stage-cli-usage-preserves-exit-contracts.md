### Case INVESTIGATION-STAGE-CLI-USAGE-001: 生成暂存 CLI 保留帮助与参数错误契约
Entry:
- `tools/investigation-report/tests/cli-generated.test.ts > generated investigation stage CLI usage preserves exit contracts`
- `bun test --test-name-pattern="^generated investigation stage CLI usage preserves exit contracts$" ./tools/investigation-report/tests/run.ts`
Contract:
- 生成 CLI 必须展示 `stage-index` 的主题选择与领域文件边界，并对空选择、禁用的筛选参数及 `--json` 用错命令返回稳定用法错误。
Proves:
- 帮助返回 0，只向 stdout 展示 `stage-index` 用法及其领域文件边界，stderr 为空。
- 空主题选择以 JSON 返回 `selection-invalid` 和退出码 2；`stage-index` 使用筛选参数及非暂存命令使用 `--json` 时返回退出码 2、保持 stdout 为空，并在 stderr 给出可行动诊断。
