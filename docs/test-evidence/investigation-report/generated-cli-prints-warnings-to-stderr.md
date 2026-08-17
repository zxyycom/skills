### Case INVESTIGATION-CLI-WARNINGS-001: 生成 CLI 将 Warnings 写入 Stderr 而不改变退出语义

Entry:
- `tools/investigation-report/tests/cli-generated.test.ts > generated CLI prints warnings to stderr without changing success or error exits`
- `bun test --test-name-pattern="^generated CLI prints warnings to stderr without changing success or error exits$" ./tools/investigation-report/tests/run.ts`

Contract:
- 生成 CLI 必须把非阻断 warnings 输出到 stderr；只有 errors 才改变命令失败结果，warnings 不得吞掉同时存在的 error。

Proves:
- 只有未引用资源 warning 的 check 与 sync 仍以退出码 0 成功，stdout 保留成功结果，stderr 包含资源 ID。
- 同时存在报告错误与未引用资源 warning 时，命令以退出码 1 失败、stdout 为空，stderr 同时保留失败说明和 warning。
