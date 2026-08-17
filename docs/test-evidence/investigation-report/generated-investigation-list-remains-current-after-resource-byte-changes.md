### Case INVESTIGATION-CLI-LIST-FRESHNESS-001: 生成 List 命令不因随附资源字节变化而过期

Entry:
- `tools/investigation-report/tests/cli-generated.test.ts > generated investigation list remains current after attached resource byte changes`
- `bun test --test-name-pattern="^generated investigation list remains current after attached resource byte changes$" ./tools/investigation-report/tests/run.ts`

Contract:
- 分发 `list` 命令以主题 Markdown 的 v5 来源 revision 判断索引新鲜度，不把随附资源原始字节纳入该判断。

Proves:
- 同步后修改已引用二进制资源的字节，`list` 仍以退出码 0 返回主题，且 stderr 为空。
