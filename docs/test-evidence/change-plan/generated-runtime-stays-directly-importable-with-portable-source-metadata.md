### Case CHANGE-PLAN-GENERATED-ARTIFACTS-001: 生成运行时可直接导入且来源信息可移植
Entry:
- `tools/change-plan/tests/generated-artifacts.test.ts > generated runtime stays directly importable with portable source metadata`
- `bun test --test-name-pattern="^generated runtime stays directly importable with portable source metadata$" ./tools/change-plan/tests/run.ts`
Contract:
- Change Plan 的 MJS 分发运行时必须可直接 import 当前底层函数，并携带可移植的维护来源和 source map；这项能力只验证当前实现表面，不建立稳定 SDK 契约。
Proves:
- 直接 import MJS 后可取得当前的 archive、查询、metadata 读取和五个阶段命令函数；生成头指向维护源码与重建命令，source map 只使用仓库相对源码定位并覆盖 CLI、生命周期和 metadata 源码。
