# 测试与测试证据维护

本文承接工具测试边界与项目测试证据覆盖；验证范围见[项目验证模型](validation-model.md)，测试设计和账本格式分别由 [Test Design](../skills/test-design/SKILL.md) 与 [Test Evidence Review](../skills/test-evidence-review/SKILL.md) 承接。

## 工具 CLI 与 Git fixture 测试边界

`test:<tool>` 是工具行为与分发边界的稳定重跑入口；日常验证使用 quick 加本任务相关能力 scope，影响不明或需要全工作区变更验收时才用 `bun run check:changed`，release 使用 `bun run check --tag release`。精确原生测试节点用于定向验证与诊断，不替代这些稳定聚合入口的责任说明。

按待证明契约选择最小充分边界：规则矩阵使用领域/API，来源读取、文件系统身份、Git 历史/index/worktree 和恢复使用必要真实状态，命令接线使用 CLI，分发消费使用生成物。每个上层测试应说明降层后会丢失的不可替代观察；边界数量与执行成本分别报告，不以标签或数量代替证明。fixture-only、Git 与 CLI 支持按职责分离，顶层 import 也是实际输入；收窄 Gate 订阅前须核对完整加载闭包。

1. CLI 的参数组合、领域错误、文本/JSON 输出和退出结果在源码入口测试。入口可以接收局部 `argv`、工作目录和 stdout/stderr writer，但这些测试参数不建立新的公开 SDK。
2. 真实 Node smoke 聚焦分发边界：已安装/分发制品启动、真实 argv 解析、stdout/stderr 分流、退出状态和模块解析；参数矩阵由源码入口承接。同进程 CLI 测试与真实 Node 子进程分别报告。
3. 需要固定 Git 基线的测试在其测试 owner 下提交普通原始 fixture 文件树，而不是提交 `.git/`、bundle、可变工作区或绝对路径。启动 helper 复制该树到 case 私有目录，执行真实 `git init`、固定本地配置、`add` 和基线 `commit`；fixture 原始树是长期输入，helper 是唯一初始化路径。
4. 并行 case 不共享可变 Git 状态：只读查询可以复用只读模板；index、worktree、refs、config、lock 或恢复路径分别使用其隔离所需的私有状态。只有至少两个实际 consumer 共享同一初始化不变量时，才将最小 bootstrap helper 放入 `tools/shared/tests/`。

## 测试证据账本

本仓库使用固定的 `docs/test-evidence/` 根目录、其中的 `cases/` 单 Case 文件和固定派生索引维护测试账本。账本覆盖 `test:*` 稳定入口保留的全部最小原生测试入口；每个 Case 按同一测试意图承接一个或多个可独立选择、单独报告的最小原生测试节点。框架不限，本仓库当前沿用 `node:test` API 定义节点；普通测试通过 `bun test` 执行，task-graph 原生 lock 集成测试通过其声明支持的 Node.js `--test` 执行。测试文件、package script 和完整检查仍只是聚合容器。

Case 使用 Tests、可选 tags、Contract 与 Proves，由测试改动显式维护。工具不扫描源码、自动登记 Case 或执行测试；核心 `check`、查询和 `sync-index` 只读取 Case 与索引。

项目快照与校验按以下边界衔接：

1. `snapshot:test-evidence` 产生 schema v2 实体快照；引用检查必须同时接收独立的 expected source。
2. `check:test-evidence-catalog` 先检查 Case/index，再计算当前项目测试来源 revision。若 `.log/vibe-check/cache/test-evidence-snapshots-v1/<revision>.json` 是通过 schema、expected source 与引用校验的完整 snapshot fact，则复用实体集合；否则重新生成，并以同一 revision 发布可丢弃 cache。
3. 无论是否命中缓存，Case 引用、实体覆盖和结束来源漂移都在本次重新判断。快照引用有效不等同于测试执行通过，未引用实体在通用核心中合法。
4. Case 正文变化后运行 `sync:test-evidence-catalog`；完整检查中的 `check:test-evidence-catalog` 不写回版本管理文件。

项目快照生产和旧账本迁移不属于 `bun run test-evidence` 的常规 Case CLI。需要人工检查或交接快照时，使用 `bun run snapshot:test-evidence -- --output <new-file>`；`migrate:test-evidence` 的 expected source 必须从生成快照所用的同一项目输入边界独立计算或核验，不能直接抄录待验证快照的 source 三字段。迁移命令默认只预演，只有明确追加 `--write` 才写入；支持范围、映射阻断和恢复边界由 [Case 账本契约](../skills/test-evidence-review/references/catalog-contract.md#迁移) 承接。日常查询、同步和检查不得把旧 topic/`Entry:` 当作 fallback 输入。
