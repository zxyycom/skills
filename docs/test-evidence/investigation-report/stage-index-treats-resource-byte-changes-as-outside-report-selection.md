### Case INVESTIGATION-STAGE-RESOURCE-BYTES-001: stage-index treats resource byte changes as outside report selection

Entry:
- `tools/investigation-report/tests/staging.test.ts > stage-index treats resource byte changes as outside report selection`
- `bun test --test-name-pattern="^stage-index treats resource byte changes as outside report selection$" ./tools/investigation-report/tests/run.ts`

Contract:
- 资源字节变化不扩大报告 entry 的选择范围，也不使 source revision 失效。

Proves:
- 真实资源从 `before` 改为 `after` 后，命令零变更、cached index 和工作树 index 保持原字节，资源改动仍只在未暂存工作树。
