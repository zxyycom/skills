---
status: active
alignment: aligned
createdAt: 2026-07-22T10:50:45Z
---

# 分离可分发工具源码与仓库自动化

## 索引摘要
- 目的: 让可分发工具源码、主仓库自动化和 skill 分发内容拥有清晰、单向的 owner 边界。
- 背景: 项目脚本与可分发工具源码混在 `scripts/`，工具运行时还反向依赖仓库 helper 和 validator。
- 决策: 使用 `tools/` 维护可分发源码及共享协议，`scripts/` 只承接项目自动化，再生成自包含 skill 产物。

## 目的
- 让开发者能够从路径直接判断一段代码是可分发工具实现、仓库构建适配还是已经进入 skill 的交付内容。
- 让多个工具复用同一份源码而不依赖项目自动化，也不在独立安装的 skills 之间建立隐式运行时前置条件。
- 继续提供可导入、可独立执行和可追溯源码的 skill 分发模块，并保持测试 fixture 的真实 Git 证明价值。

## 背景
- 根目录 `scripts/` 同时放置项目级校验、打包与 Git 自动化，以及需要构建后进入 skill 的 CLI 源码、声明、测试和 fixture，目录名无法表达不同变化原因。
- 可分发工具运行时直接导入 `scripts/lib/` 和 `scripts/validators/`，使工具实现依赖仓库编排层；移动目录而不改变依赖方向不能建立真实分层。
- 文件系统、Markdown、主模块识别等能力被多个工具共同使用，skill package 指纹与 lock schema 又必须由发布端和 updater 共同遵守；这些能力需要明确的共享 owner，而不是复制或挂靠任一消费方。
- 已安装 skill 仍需要不依赖主仓库源码和开发依赖的自包含模块，`test-evidence` 测试仍需要可审查的预构建 Git 历史和最小 Node smoke。

## 决策
- 采用: `tools/<tool-name>/src/` 承接可分发工具运行时源码，`api/` 承接公共声明源，`tests/` 承接源码、fixture 和分发模块验证；一个工具维护单元可以生成一个或多个同一责任下的入口。
- 采用: `scripts/` 只承接主仓库命令编排、校验、打包、Git 与 CI 自动化；读取仓库配置并把工具生成到 skill 的适配器集中在 `scripts/build/`，项目级共享实现和 validator 分别留在 `scripts/lib/` 与 `scripts/validators/`。
- 采用: 多个工具真实共享的运行时原语进入 `tools/shared/`；发布端与 updater 共同遵守的指纹和 package lock 协议进入 `tools/skill-package/`，避免共享层成为无语义杂物集合。
- 采用: 具体工具源码只依赖自身、`tools/shared/`、`tools/skill-package/`、目标运行时和显式外部库，不依赖 `scripts/`、`skills/`、`dist/` 或另一个具体工具；这一依赖方向作为架构文档约定维护，不设置 import 扫描或失败门禁。
- 采用: 构建入口继续从同一 TypeScript 源生成 import-safe 的自包含单文件 ESM、同名声明和 linked source map，由 `sync:*` 写入、`check:*` 逐字节比较并提交到 `skills/<skill-name>/`；导入不执行 CLI 或外部副作用，作为主模块运行时才进入 CLI。
- 采用: 源码层共享不改变 skill 分发单元。构建器把实际消费的共享代码内联到每个目标模块，使分别安装的 skill 不需要连接主仓库或其他 skill；产物中的重复字节不形成重复源码 owner。
- 采用: `test-evidence` 的预构建 Git fixture、确定性重建入口、Bun 进程内逻辑验证和最小真实 Git 与 Node smoke 与其源码共同维护在 `tools/test-evidence/tests/`，继续证明真实历史语义和 Node 分发兼容性。
- 采用: 根 TypeScript 配置同时检查 `scripts/`、工具源码和声明源，项目编码规范同时约束 `scripts/` 与 `tools/`；完整项目检查覆盖源码测试、生成漂移和 skill 打包，不把工具依赖方向设为机械验收项。
- 不采用: 在旧 `scripts/<tool-name>/` 路径保留转发模块、兼容副本或第二套调用入口，也不为未独立安装、版本或发布的工具源码建立 npm package 分发模型。

## 关系
- 修订: [让 skill 分发脚本同时提供可导入模块](260720-expose-importable-skill-modules.md)
- 修订: [用预构建 Git fixture 加速 test-evidence 测试](260720-use-prebuilt-git-test-fixtures.md)
