### Case INVESTIGATION-RESOURCE-TYPE-001: 随附资源目标必须是普通文件

Entry:
- `tools/investigation-report/tests/resources.test.ts > validation rejects attached resource targets that are not regular files`
- `bun test --test-name-pattern="^validation rejects attached resource targets that are not regular files$" ./tools/investigation-report/tests/run.ts`

Contract:
- 报告只能引用资源池中的普通文件，目录或其他文件系统对象不能作为资源。

Proves:
- 资源 ID 指向目录时，局部校验返回包含该 ID 的普通文件诊断。
