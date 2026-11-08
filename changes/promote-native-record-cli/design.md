# Design

采用独立 Schema、分离的源码包与原生资产、显式首次引导和分阶段激活，保证交付能力就绪后才切换正式入口。

## Context

现有入口、Schema 导出、打包及 updater 的源码审计与只读探针见[审计依据](resources/audit.md)。其中两个事实决定交接方案：旧 updater 下载完包才进入安装，但不会准备可执行权限或清理旧 SDK；旧打包器会清空调用方给出的输出目录。

[候选协议](../../tools/record-cli/protocol.md)采用顺序本地运行模型，现行 skill 仍描述 TS 保证。该范围的生产交接与正式指令在切换阶段共同更新。

## Goals / Non-Goals

首批支持 `x86_64-unknown-linux-gnu`（Ubuntu 22.04 / glibc 2.35 基线）与 `x86_64-pc-windows-msvc`（沿 Windows Server 2022 x64 CI）。两域保留独立 skill 和现有持久格式，业务后端统一为原生 CLI。

Node 仅承接安装更新和仓库跨平台调度，不提供领域 SDK。macOS、ARM、新公开 SDK 及额外性能调优不在本次范围。真实发布和用户目录安装由执行时授权控制。

## Decisions

### Intended Change

#### 固定方案

1. **Schema**：以 `tools/record-contracts/schemas/` 下的两个纯 JSON Schema 为两域格式源，旧导出器与新生成器消费同一份数据；Rust 校验以契约样例核对，普通业务调用不加载外部 Schema。通用 Index Runtime 保持原职责。
2. **制品**：skill ZIP 继续只包含 Git pending 中的文件，原生二进制作为独立 release 资产。包内 `native-runtime.json` 绑定角色、原生版本、源码摘要和支持目标；release 的原生扩展绑定具体资产及 hash。
3. **首次交接**：两个原生 skill 使用 `<skill>-native.zip`，独立 `record-native-installer.zip` 完成首次安装。原生 release 不提供它们的旧名 `<skill>.zip`，旧 updater 在下载前拒绝，现有安装保持；其他 skill 保持原资产名和更新入口。
4. **后续更新**：原生专用 updater 先准备并验证包与二进制，再激活文档，最后清理受管旧文件。同版本也检查资产与清理状态；业务命令仅使用已准备的运行时。
5. **仓库调用**：安装 skill 的指令直接使用原生程序；仓库短命令由仅依赖 Node 内置模块的轻量调度器定位已准备程序，透传参数、stdio、信号和退出码。调度器不加载领域运行时或解释业务 JSON。

版本字段、源码绑定、升级支持边界及激活流程见[交付契约](resources/delivery-contract.md)；实施时与本设计共同读取。

#### 实施顺序

| 阶段 | 产出 | 退出门禁 |
| --- | --- | --- |
| A：准备 | 独立 Schema、隔离构建和发布目录、原生协议扩展、安装器/updater、仓库运行时及候选包 | 现行 CLI 与正式说明继续可用，候选制品可独立验收 |
| B：私有验收 | 两个平台的新装、引导升级、后续升级及故障证据 | tasks 的 2.1–2.3 全部通过，才允许正式接线 |
| C：启用与退役 | 正式命令、skill 指令、操作契约及发布映射共同切换，旧 SDK 与专属链路退出 | 全部最终门禁通过；远端发布和真实安装另取授权 |

A/B 可以更新新能力的维护说明，正式业务使用文档仅在 C 启用。候选说明随隔离包验证；“同批”指交付身份与成功判定一致，不表示多文件天然原子。

### Resulting Impacts

| 影响 | 处理 |
| --- | --- |
| 旧 SDK 仍承载 Schema、fixture 和消费者 | A 先交接格式源并盘点消费者，C 将调用者改为 CLI JSON；共享模块保留仍被其他工具使用的部分 |
| 原生代码不在 skill ZIP/hash 输入内 | 冻结源码摘要进入包内描述符及版本门禁；二进制 hash 在发布扩展校验，源码包 hash 与 ZIP 同清单的规则保持 |
| 打包会清空输出目录，发布器只收集 ZIP | 使用独立 release staging；显式收集两个 native skill ZIP、四个原生 ZIP、引导 ZIP 和 manifest，清理仅限本轮 staging |
| 旧 updater 不了解原生交付 | 原生资产改名；引导器和原生 updater 使用专用扩展解析器，保留现有基础 manifest 解析及其他 skill 的通用 updater |
| 生效后的失败与旧保证不同 | C 同步两域操作、恢复、暂存、共同模型及生产取舍；旧业务后端不作为失败重试策略 |
| 旧测试、Gate 和 Case 依赖 TS | 按契约重新裁决并衔接原生、CLI、真实 Git 与分发测试；退出只服务旧接口或已取消保证的项，历史调查材料保持 |

## Risks / Trade-offs

- 首次升级需要显式引导，换取旧 updater 在写入前安全失败；不以保留旧 SDK 兼容实现降低迁移成本。
- 源码摘要绑定冻结清单，可能因测试或维护材料变化触发保守版本更新；优先可追溯性，本次不推导最小编译闭包。
- 用户定制或未知旧版本会阻断原地清理，应选择明确的新装目标或取得针对性处置授权；安装器不猜测删除归属。
- Ubuntu 基线和 Windows 的安装/恢复均需当前版本实际运行。未完成 B 阶段时，不以能编译或本机测试替代切换门禁。

## Open Questions

无阻止开始 A 阶段的设计待决项。格式冲突、超出清单的定制文件和发布权限按对应任务的停止条件处理。
