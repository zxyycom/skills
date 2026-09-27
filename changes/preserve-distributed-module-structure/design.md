# Design

以“包自包含、模块可读”组织分发产物。方向已确认，构建选型与包内布局待验证。

## Context

[项目工具链](../../docs/tooling.md#生成与分发)当前约定单文件 ESM 与 linked source map。
共享构建器 `scripts/lib/generated-file.ts` 按单入口返回 code 和 sourceMap；Change Plan 与
updater 的构建适配显式启用 minify。逐文件分发需要调整生成模型，而非仅关闭压缩。

源码、构建适配和分发产物继续遵循[源码与依赖边界](../../docs/tooling.md#源码与依赖边界)。
测试延续[现有分层](../../docs/tooling.md#工具-cli-与-git-fixture-测试边界)：业务矩阵由源码测试承担，
真实 Node smoke 证明分发边界。

## Goals / Non-Goals

- 目标：自有模块的路径、名称与导入关系可直接阅读，第三方代码独立打包，现有使用方式保持兼容。
- 范围边界：本 Change 调整构建与交付形态；业务逻辑、公开 API 范围和通用安装管理职责保持不变。

## Decisions

### Intended Change

1. **自有模块**：逐文件转译运行时依赖闭包，保留目录和可读名称，不压缩，附带 source map。
   共享源码随消费它的 skill 分发；纯类型内容无需独立运行时文件。
2. **第三方依赖**：通过生成的 vendor 导出入口供自有模块引用，保留默认、具名、namespace、
   副作用导入及依赖实例语义。Node 内建模块由运行时提供；既有 optional peer unavailable stub
   与 task-graph 显式 native runtime 扩展沿用原 owner 契约。
3. **暂定布局**：保留 `scripts/<entry>.mjs` 作为公开入口，自有实现位于
   `scripts/runtime/tools/<tool>/...`，第三方代码位于包内 `vendor.mjs`。多个 CLI 与 updater
   的 runtime 根、vendor 共享粒度按真实依赖图确定，使路径归属、依赖版本和实例身份一致。
4. **构建实现**：生成器统一维护源码到产物的映射、包内导入、生成头和 source map。
   导入重写依据语法结构，选型以逐文件保留能力为准。先用一个真实工具验证，再推广至全部 consumer。

### Resulting Impacts

1. **生成集合**：sync 与 check 使用同一预期文件集合。check 比较文件及内容，sync 仅清理已确认
   由该生成器管理的过期产物。保持包内路径约束及依赖解析边界，避免吸收祖先目录的偶然依赖。
2. **入口与位置**：核对 CLI 主模块判断、`import.meta.url`、资源读取、动态 import、updater 配置
   注入及默认目标定位。公开入口保留现有导出与声明；普通 import 仍无 CLI、文件或网络副作用。
3. **调试信息**：逐文件 map 与生成头可追溯至维护源码，使用可移植路径，不包含本机绝对路径。
4. **打包与更新**：复用 pending 快照及 hash/zip 入口，按运行时变化提升受影响 skill 版本。
   [Updater](../../tools/skill-updater/README.md)继续覆盖正式制品路径、保留其他本地文件；
   新入口只引用当前生成集合，验证旧文件共存和更新中断边界。
5. **验证成本**：复用现有测试，按以下分工形成证据：
   - 源码测试覆盖业务矩阵，构建契约测试覆盖路径映射、导入重写、vendor 语义及产物集合。
   - Node smoke 仅覆盖隔离安装后的启动、公开导入与真实模块解析；按不同构建适配的必要边界
     选择最小入口集合，不按模块数、参数组合或相同 updater 模板的分发份数扩增 E2E。
   - 复用构建结果与只读 fixture，写入用例使用私有目录。实施前测量受影响入口的耗时、构建次数
     和 Node 启动次数，据此确定预算；完成后在同等环境比较，每个新增 smoke 说明独有证据。
6. **文档交接**：实施时同步稳定分发契约与生成映射，按相应 skill 维护 Case 和达到门槛的 Decision。

## Risks / Trade-offs

- 多文件使复制、生成比较和更新写入成本上升，需要在真实工具上测量。
- vendor 拆分可能影响初始化顺序、模块实例、CJS/ESM 互操作和动态加载，需由构建契约测试证明。
- updater 自更新涉及正在执行的模块；多文件覆盖可能产生混合版本，需确认覆盖前加载依赖等保护措施。

## Open Questions

转为 Plan 前核对以下事项，再从收敛后的设计派生 tasks.md：

1. 固定构建工具如何实现逐文件转译、导入重写和 source map，是否需要新增构建依赖？
2. 多入口及 updater 的 runtime 与 vendor 如何划分，兼顾生成 owner、依赖版本和实例语义？
3. 首个验证工具与最小 smoke 集合是什么，基线支持怎样的验证成本预算？
4. updater 拆分后如何保持自更新执行安全，并沿用现有文件保留策略？
