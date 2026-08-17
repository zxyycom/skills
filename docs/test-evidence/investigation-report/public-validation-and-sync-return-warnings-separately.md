### Case INVESTIGATION-VALIDATION-WARNINGS-001: 公共 Check 与 Sync 将稳定 Warnings 与 Errors 分开返回

Entry:
- `tools/investigation-report/tests/cli-generated.test.ts > public check and sync return deterministic warnings separately from errors`
- `bun test --test-name-pattern="^public check and sync return deterministic warnings separately from errors$" ./tools/investigation-report/tests/run.ts`

Contract:
- 公共验证与同步 API 必须将非阻断的资源池 warnings 与 errors 分离，并以确定性排序保留同一组 warnings。

Proves:
- 未引用资源不会产生 errors，check 的 warnings 按稳定词法顺序返回。
- sync 返回与 check 相同的 warnings，且在索引无需变更时保持 `changed: false`。
