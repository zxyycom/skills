### Case CHANGE-PLAN-GENERATED-ARTIFACTS-001: 生成运行时可直接导入且来源信息可移植
Entry:
- `tools/change-plan/tests/generated-artifacts.test.ts > generated runtime stays directly importable with portable source metadata`
- `bun test --test-name-pattern="^generated runtime stays directly importable with portable source metadata$" ./tools/change-plan/tests/run.ts`
Contract:
- Change Plan 的 MJS 分发运行时可直接 import 当前命令与领域函数，并携带不依赖构建机绝对路径的维护来源和 source map；这项能力只验证当前实现表面，不建立稳定 SDK 契约。
Proves:
- 直接 import MJS 后可取得 archive、plan、单项与集合检查、list、show、metadata parser/reader 和 CLI 入口共九个函数。
- 生成头只包含可移植维护来源、重建命令和 source map 引用，不包含当前仓库绝对路径。
- Source map 使用仓库相对路径，覆盖 CLI、lifecycle、metadata 及可移植的 `write-file-atomic` source content。
