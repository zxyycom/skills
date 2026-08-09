### Case INVESTIGATION-PUBLIC-OPTIONS-001: 公共 API 将非法运行时选项转换为诊断

Entry:
- `tools/investigation-report/tests/parsing-directory.test.ts > public APIs diagnose malformed runtime options without throwing`
- `bun test --test-name-pattern="^public APIs diagnose malformed runtime options without throwing$" ./tools/investigation-report/tests/run.ts`

Contract:
- 调查校验、索引同步和索引查询的公共异步 API 必须安全处理 JavaScript 调用方传入的非法运行时选项，以带字段路径的结果诊断失败而不是抛出异常；未知选项不能被静默忽略。

Proves:
- 校验 API 收到 `null` 选项后返回 `options must be an object` 诊断。
- 同步 API 收到非字符串 `workspaceRoot` 后返回对应类型诊断；查询 API 收到未知状态后只返回 `statuses.0 unknown investigation status: 未知`。
- 在存在有效索引的工作区中，查询 API 收到拼错的 `statues` 键后返回唯一的未知选项诊断，结果条目与总数均为零，证明没有退化成无过滤查询。
