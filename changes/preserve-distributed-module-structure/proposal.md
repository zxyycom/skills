# Proposal

让 skill 分发工具保留自有源码的模块结构，并将第三方依赖单独打包。当前为 Draft。

## Why

当前构建把自有 TypeScript 与第三方依赖合并、压缩为单文件 MJS。Source map 支持定位，
但直接阅读安装后的 skill 时，仍难以辨认模块责任和调用关系。

## Outcome

安装后的自有运行时代码具有清晰、可追溯至维护源码的目录和文件结构，第三方代码独立存放。
现有入口、公开行为与独立运行能力保持兼容，验证成本与新增风险相称。

## Scope

### Intended Change

1. 将运行时依赖闭包内的自有 TS 逐文件转译为可读 MJS，保留目录关系和 source map。
2. 将第三方依赖及其传递依赖集中生成包内 vendor 制品，由自有模块引用。
3. 先以一个工具验证构建路径，再推广至其余可分发工具及 updater，统一正式产物布局。

### Resulting Impacts

1. 生成同步与漂移检查扩展到受管文件树，处理模块引用及过期产物。
2. 保持 CLI 启动、模块位置相关行为、公开导出和声明兼容。
3. 将新增模块纳入既有 hash、zip、版本及覆盖式更新流程。
4. 同步分发契约与测试证据，以少量必要的分发 smoke 补充源码和构建测试。

## Success Criteria

1. 自有运行时文件与维护源码路径可对应，代码未压缩；制品仅包含运行所需内容。
2. 完整 skill 脱离仓库依赖仍可运行，现有 CLI 和公开导入可用，运行前置保持不变。
3. sync 与 check 共用生成路径，能处理新增、缺失、修改及过期受管产物，并保留未受管文件。
4. 声明、source map、hash、zip、受影响 skill 版本与新布局一致，已有安装可通过 updater 更新。
5. 每项分发 smoke 对应低成本测试无法证明的边界；复用既有用例，并记录验证前后的耗时、
   构建次数和 Node 启动次数，按基线确定的预算验收。

## Affected Owners

- [项目工具链](../../docs/tooling.md)与[仓库模型](../../docs/repository-model.md)：构建、分发及独立安装边界。
- `scripts/lib/generated-file.ts` 及相关 helper、`scripts/build/`：共享生成能力与工具适配。
- 受影响的 `tools/` 源码、局部契约和测试，以及对应 `skills/` 生成产物。
- [Skill Updater](../../tools/skill-updater/README.md)：配置注入、默认目标定位及覆盖式更新。
- [Test Evidence Review](../../skills/test-evidence-review/SKILL.md)与
  [Decision Records](../../skills/decision-records/SKILL.md)：测试证据与达到记录门槛的长期判断。
