### Case GENERATED-FILE-SYMLINK-001: 生成文件同步拒绝符号链接制品路径

Entry:
- `scripts/lib/generated-file.test.ts > generated file sync rejects symbolic-link artifact paths`
- `bun test --test-name-pattern="^generated file sync rejects symbolic-link artifact paths$" ./scripts/lib/generated-file.test.ts`

Contract:
- 生成文件同步只能读取或写入普通文件；预期制品路径是符号链接时，check 与 write 都必须拒绝，不能跟随链接影响其目标。

Proves:
- 对指向受保护文件的生成路径链接，check 与 write 都失败，链接和目标文件内容均保持不变。
