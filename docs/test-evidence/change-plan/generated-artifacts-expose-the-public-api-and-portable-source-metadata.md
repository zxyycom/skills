### Case CHANGE-PLAN-GENERATED-ARTIFACTS-001: 生成制品公开 API 与来源信息
Entry:
- `tools/change-plan/tests/generated-artifacts.test.ts > generated artifacts expose the public API and portable source metadata`
- `bun test --test-name-pattern="^generated artifacts expose the public API and portable source metadata$" ./tools/change-plan/tests/run.ts`
Contract:
- Change Plan 分发制品必须从实现和 metadata schema 机械生成公开声明，并携带可移植维护来源；内部 metadata writer 不进入公共 API。
Proves:
- 声明入口与可达 SDK 文件公开查询、读取、阶段转换、稳定错误码和目标阶段结果，schema-derived metadata 类型不依赖 Valibot 且不暴露 writer，JSON Schema 保留严格字段、安全整数和规范字符串约束，source map 使用仓库相对源码定位。
