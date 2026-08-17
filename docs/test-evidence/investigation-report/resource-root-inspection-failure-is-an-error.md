### Case INVESTIGATION-RESOURCE-ROOT-001: 无法检查资源根目录时验证失败

Entry:
- `tools/investigation-report/tests/resources.test.ts > a resource root that cannot be inspected makes validation an error`
- `bun test --test-name-pattern="^a resource root that cannot be inspected makes validation an error$" ./tools/investigation-report/tests/run.ts`

Contract:
- 完整资源验证无法枚举 `_resources` 根目录时，不得降级为成功或 warning。

Proves:
- `_resources` 为普通文件而非目录时，验证返回指向资源根或未完成资源检查的 error。
