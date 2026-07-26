# Investigation Report

### Case INVESTIGATION-VALIDATION-FILTER-001: 调查校验按类别与路径筛选
Entry:
- `tools/investigation-report/tests/parsing-directory.test.ts > validation filters reports by category and path`
- `bun test --test-name-pattern="^validation filters reports by category and path$" ./tools/investigation-report/tests/run.ts`
Contract:
- 调查校验必须按 category 和目录路径限制目标报告。
Proves:
- 仅匹配范围的报告参与结果和诊断。

### Case INVESTIGATION-DIRECTORY-PATH-001: 调查目录路径规则被执行
Entry:
- `tools/investigation-report/tests/parsing-directory.test.ts > validation enforces investigation directory path rules`
- `bun test --test-name-pattern="^validation enforces investigation directory path rules$" ./tools/investigation-report/tests/run.ts`
Contract:
- 调查报告必须位于配置允许且身份对齐的目录路径。
Proves:
- 越界、别名和无效目录结构产生路径诊断。

### Case INVESTIGATION-INFORMATION-FIELDS-001: 无效信息字段不阻断有效范围
Entry:
- `tools/investigation-report/tests/parsing-directory.test.ts > validation reports invalid information fields without blocking valid scopes`
- `bun test --test-name-pattern="^validation reports invalid information fields without blocking valid scopes$" ./tools/investigation-report/tests/run.ts`
Contract:
- 校验必须报告无效信息字段，同时保留其他有效查询范围。
Proves:
- 字段诊断准确出现，未受影响的报告仍可处理。

### Case INVESTIGATION-STRUCTURE-CHRONOLOGY-001: 完整报告结构与时间顺序受约束
Entry:
- `tools/investigation-report/tests/parsing-directory.test.ts > validation enforces complete report structure and chronology`
- `bun test --test-name-pattern="^validation enforces complete report structure and chronology$" ./tools/investigation-report/tests/run.ts`
Contract:
- 完整调查报告必须具备必需章节，并保持事件时间顺序。
Proves:
- 缺失结构和逆序时间线分别产生对应诊断。

### Case INVESTIGATION-INDEX-QUERY-001: 索引查询筛选并分页调查状态
Entry:
- `tools/investigation-report/tests/index-query.test.ts > index queries return filtered and paginated investigation states`
- `bun test --test-name-pattern="^index queries return filtered and paginated investigation states$" ./tools/investigation-report/tests/run.ts`
Contract:
- 调查索引查询必须支持状态筛选、稳定排序和分页。
Proves:
- 查询返回正确 total、offset 和目标报告集合。

### Case INVESTIGATION-INDEX-INTEGRITY-001: 索引加载拒绝过期与篡改内容
Entry:
- `tools/investigation-report/tests/index-query.test.ts > index loading rejects stale and tampered investigation indexes`
- `bun test --test-name-pattern="^index loading rejects stale and tampered investigation indexes$" ./tools/investigation-report/tests/run.ts`
Contract:
- 调查索引加载必须验证源新鲜度和内容完整性。
Proves:
- 过期或篡改索引不会被当作当前可信状态使用。

### Case INVESTIGATION-BUNDLED-PARITY-001: Bundled 调查 API 与源码一致
Entry:
- `tools/investigation-report/tests/cli-generated.test.ts > bundled investigation APIs preserve source implementation parity`
- `bun test --test-name-pattern="^bundled investigation APIs preserve source implementation parity$" ./tools/investigation-report/tests/run.ts`
Contract:
- 分发的调查 API 必须与维护源码实现保持行为一致。
Proves:
- 相同输入在源码与 bundled 入口得到相同结果。

### Case INVESTIGATION-CLI-CONTRACTS-001: 生成 CLI 保持命令与退出契约
Entry:
- `tools/investigation-report/tests/cli-generated.test.ts > generated investigation CLI preserves command and exit contracts`
- `bun test --test-name-pattern="^generated investigation CLI preserves command and exit contracts$" ./tools/investigation-report/tests/run.ts`
Contract:
- 生成调查 CLI 必须保留命令、输出模式和退出码契约。
Proves:
- 成功、诊断与参数错误路径返回预期结果。

### Case INVESTIGATION-GENERATED-METADATA-001: 生成调查制品携带可移植元数据
Entry:
- `tools/investigation-report/tests/cli-generated.test.ts > generated investigation artifacts expose portable metadata`
- `bun test --test-name-pattern="^generated investigation artifacts expose portable metadata$" ./tools/investigation-report/tests/run.ts`
Contract:
- 调查分发制品必须暴露维护来源且不包含机器绝对路径。
Proves:
- Banner、声明和 source map 使用仓库可移植路径。

### Case INVESTIGATION-SCALE-INDEX-001: 千份调查报告可同步并查询
Entry:
- `tools/investigation-report/tests/scale.test.ts > index synchronizes and queries one thousand investigation reports`
- `bun test --test-name-pattern="^index synchronizes and queries one thousand investigation reports$" ./tools/investigation-report/tests/run.ts`
Contract:
- 调查索引必须支持至少一千份报告的同步与查询。
Proves:
- 规模夹具完整写入索引并返回正确筛选结果。
