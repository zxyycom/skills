### Case INVESTIGATION-BUNDLED-PARITY-001: Bundled 调查 API 与源码一致
Entry:
- `tools/investigation-report/tests/cli-generated.test.ts > bundled investigation APIs preserve source implementation parity`
- `bun test --test-name-pattern="^bundled investigation APIs preserve source implementation parity$" ./tools/investigation-report/tests/run.ts`
Contract:
- 分发的调查 API 必须与维护源码实现保持行为一致，包括随附资源关系与完整性结果。
Proves:
- 包含资源引用的相同输入在源码与 bundled 入口得到相同验证结果，且 bundled 查询保留报告级资源关系。
