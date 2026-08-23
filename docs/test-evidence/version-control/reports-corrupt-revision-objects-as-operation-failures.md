### Case VERSION-CONTROL-CORRUPTION-001: 将损坏修订对象报告为操作失败
Entry:
- `tools/shared/tests/version-control.test.ts > reports corrupt revision objects as operation failures`
- `bun test --test-name-pattern="^reports corrupt revision objects as operation failures$" ./tools/shared/tests/version-control.test.ts`
Contract:
- 只有 Git 明确确认 revision 或文件不存在时才能返回对应缺失语义；Git 查询或对象读取失败必须保留为操作错误。
Proves:
- 损坏 blob 的单文件与批量 revision 读取，以及损坏 commit 解析都返回带操作上下文的 `operation-failed`；损坏 commit 不会被降级为 `revision-not-found`。
