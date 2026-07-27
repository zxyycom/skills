### Case VERSION-CONTROL-REPOSITORY-001: 拒绝非 Git 仓库目录
Entry:
- `tools/shared/tests/version-control.test.ts > rejects directories that are not Git repositories`
- `bun test --test-name-pattern="^rejects directories that are not Git repositories$" ./tools/shared/tests/version-control.test.ts`
Contract:
- 打开版本控制边界前必须确认目标位于 Git 仓库。
Proves:
- 普通目录返回 `not-repository`。
