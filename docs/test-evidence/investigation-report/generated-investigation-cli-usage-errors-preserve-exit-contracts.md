### Case INVESTIGATION-CLI-USAGE-001: 生成 CLI 的帮助与参数错误保留退出契约
Entry:
- `tools/investigation-report/tests/cli-generated.test.ts > generated investigation CLI usage errors preserve exit contracts`
- `bun test --test-name-pattern="^generated investigation CLI usage errors preserve exit contracts$" ./tools/investigation-report/tests/run.ts`
Contract:
- 帮助请求必须成功展示可选随附资源、完整资源池检查及各命令约束；未知选项、非法 limit、命令禁用筛选、空暂存选择和 `--json` 用错命令必须返回用法错误。
Proves:
- 帮助返回 0，只向 stdout 说明局部与完整资源边界、`stage-index` 用法及其领域文件边界，stderr 为空。
- 未知选项、非法 limit、sync-index/stage-index 过滤参数和非暂存命令使用 `--json` 都返回退出码 2 与可行动诊断；空主题选择以 JSON 返回稳定 `selection-invalid` 结果和退出码 2。
