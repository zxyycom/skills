### Case INVESTIGATION-RESOURCE-CASE-001: 随附资源大小写不一致被定位

Entry:
- `tools/investigation-report/tests/resources.test.ts > validation reports attached resource case mismatches`
- `bun test --test-name-pattern="^validation reports attached resource case mismatches$" ./tools/investigation-report/tests/run.ts`

Contract:
- 资源链接必须与文件系统中每个路径分量的实际大小写一致。

Proves:
- 链接使用小写 ID 但目标文件使用大写名称时，校验必须返回含实际文件名的 `must match actual path casing` 专用诊断，不能用缺失文件诊断替代。
