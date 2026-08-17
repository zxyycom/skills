### Case INVESTIGATION-RESOURCE-OWNER-PREFIX-001: 局部验证拒绝非 Kebab Owner 前缀的资源链接

Entry:
- `tools/investigation-report/tests/resources.test.ts > scoped validation rejects resource links with non-kebab owner prefixes`
- `bun test --test-name-pattern="^scoped validation rejects resource links with non-kebab owner prefixes$" ./tools/investigation-report/tests/run.ts`

Contract:
- 资源 ID 的 owner 前缀必须为可解析的 kebab-case 主题路径；局部验证也必须执行该资源引用格式边界。

Proves:
- 局部验证含非 kebab owner 前缀资源链接的主题时，返回包含资源 ID 和 kebab-case owner prefix 原因的 error。
