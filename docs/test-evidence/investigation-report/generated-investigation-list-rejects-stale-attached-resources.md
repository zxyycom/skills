### Case INVESTIGATION-CLI-RESOURCE-STALE-001: 生成 List 命令拒绝过期的随附资源

Entry:
- `tools/investigation-report/tests/cli-generated.test.ts > generated investigation list rejects stale attached resources`
- `bun test --test-name-pattern="^generated investigation list rejects stale attached resources$" ./tools/investigation-report/tests/run.ts`

Contract:
- 分发 `list` 命令在返回索引主题前必须核对当前资源字节，过期时以资源 ID 诊断失败。

Proves:
- 同步后修改二进制资源会使生成 `list` 返回退出码 1，stdout 为空，stderr 同时指出资源 ID 和内容变化原因。
