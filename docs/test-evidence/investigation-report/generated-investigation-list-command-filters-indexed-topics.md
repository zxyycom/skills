### Case INVESTIGATION-CLI-LIST-001: 生成 list 命令按索引条件过滤主题
Entry:
- `tools/investigation-report/tests/cli-generated.test.ts > generated investigation list command filters indexed topics`
- `bun test --test-name-pattern="^generated investigation list command filters indexed topics$" ./tools/investigation-report/tests/run.ts`
Contract:
- `list` 命令必须组合 status 与 text 条件，并只输出命中的调查主题。
Proves:
- 成功结果只写入 stdout 且 stderr 为空；暂停的 runtime 调查被列出，未命中的 codex 调查不会泄漏到结果。
