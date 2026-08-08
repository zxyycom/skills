### Case CHANGE-PLAN-CLI-ARGS-001: CLI 帮助与参数错误稳定
Entry:
- `tools/change-plan/tests/cli.test.ts > CLI help and argument errors use stable exit contracts`
- `bun test --test-name-pattern="^CLI help and argument errors use stable exit contracts$" ./tools/change-plan/tests/run.ts`
Contract:
- 帮助请求必须公开完整生命周期命令，生命周期参数错误必须与其他用法错误使用相同退出契约。
Proves:
- Help 成功列出查询、阶段转换和归档命令；缺失路径、空搁置原因及未知阶段以参数错误退出。
