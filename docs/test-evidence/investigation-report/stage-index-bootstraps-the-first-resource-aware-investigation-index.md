### Case INVESTIGATION-STAGE-BOOTSTRAP-001: 首次暂存完整保留资源感知索引
Entry:
- `tools/investigation-report/tests/staging.test.ts > stage-index bootstraps the first resource-aware investigation index`
- `bun test --test-name-pattern="^stage-index bootstraps the first resource-aware investigation index$" ./tools/investigation-report/tests/run.ts`
Contract:
- revision 尚无调查索引时，合法的首次主题选择可以创建 pending 索引，并保留工作区索引的资源 metadata 与主题资源引用；领域文件不随索引进入 pending。
Proves:
- bundled API 从含二进制随附资源的首个主题生成 pending 索引，SHA-256 与报告级引用正确，pending 路径只有派生索引。
