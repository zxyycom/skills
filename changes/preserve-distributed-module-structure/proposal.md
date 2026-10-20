# Proposal

以纯 TypeScript 交付 skill 运行时，让安装后的代码可直接阅读、运行和调整。

## Why

当前业务实现与第三方依赖合并为单文件制品，就地阅读和修改需要回到维护源码并重新构建。
源码分发配合标准包管理器，可以缩短这条反馈路径，并保持独立安装能力。

## Outcome

用户取得单个 skill 后，可按随包锁文件安装依赖并直接运行 TS，修改业务实现无需构建。
已有环境中可复用宿主的兼容依赖；独立安装提供可复现的保底路径。

## Scope

### Intended Change

1. 将领域工具、updater 及所需共享源码按纯 TS 交付，公开 CLI/import 入口统一为 TS。
2. 为运行依赖提供独立 manifest、pnpm 锁文件和 Git 忽略规则，采用 pnpm 原生安装与链接。
3. 沿用现有源码 owner、单 skill 版本与 zip/release/updater 分发主线。

### Resulting Impacts

1. 同步运行前置、入口调用方、公开类型与资源定位，以及 updater 的依赖恢复流程。
2. 调整同步检查、制品输入、版本校验和 Gate/CI，使其消费新的分发内容。
3. 更新相关行为说明、测试证据及需要长期回放的分发决策。

## Success Criteria

1. 自有运行时和入口（含 updater）为 TS，包内业务修改无需构建即可生效。
2. 干净环境中按固定版本 pnpm 和随包锁文件可独立安装运行，锁文件保持不变；
   不同 skill 或版本的独立安装互不改写。
3. 兼容宿主依赖可以正常复用，包括与锁文件精确版本不同、未建立本地依赖目录的情况。
4. CLI、程序化调用与必要类型入口按 TS 路径使用，接口语义、资源和 native/optional 契约成立。
5. 正式制品符合[分发设计](design.md#intended-change)，依赖目录与缓存留在本地；
   同步、hash/zip、独立版本和 Git 忽略分别有验证证据。
6. 更新、依赖失败与恢复路径可执行，文件覆盖/保留符合 updater 契约；
   相关检查通过，验证成本符合 Readiness 确定的预算。

## Affected Owners

- [仓库模型](../../docs/repository-model.md)与[工具链](../../docs/tooling.md)：分发和运行前置；
  `tools/` 与对应 `skills/`：维护源码、行为说明和正式内容。
- `scripts/build/`、共享生成/打包/版本 helper、根配置与 CI：同步、发布输入及 Gate 集成。
- [Skill Updater](../../tools/skill-updater/README.md)：TS 自更新、配置、目标定位和恢复。
- [Test Evidence Review](../../skills/test-evidence-review/SKILL.md)与
  [Decision Records](../../skills/decision-records/SKILL.md)：证据和长期判断交接。
