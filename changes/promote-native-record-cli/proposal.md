# Proposal

将决策与调查工具切换为原生 CLI 唯一业务入口：先完成 Schema、制品和安装更新链路，再验收交付闭环，最后同步启用正式入口与使用文档。

## Why

原生实现与正式交付链仍相互隔离。现行生成器依赖 TS 工具中的 Schema，安装器按文件覆盖 skill，正式命令与说明也仍指向 TS。完整切换需要先闭合格式、制品和更新依赖，再交接使用入口。

## Outcome

Linux x64 与 Windows x64 上，仓库维护命令和两个独立 skill 均使用原生 CLI。成功安装或升级同时取得匹配的二进制、Schema、入口和说明，旧领域 TS SDK 与旧业务 CLI 退出正式交付。

## Scope

### Intended Change

- 将两域格式 Schema 移交到独立契约源，保持索引 schemaVersion 4、definitionVersion 11 和现有记录格式。
- 以固定源码构建原生资产，独立发布业务包与二进制；准备原生专用 updater、一次性引导安装器和仓库运行时。
- 在私有目标验收新装、支持范围内的升级和失败恢复后，同批切换正式命令、skill 指令、生成与发布映射。
- 清退旧领域 SDK、声明、业务运行时及专属依赖。Node 安装基础设施和仓库轻量调度器保留，业务执行后端只有 Rust。

### Resulting Impacts

- Schema 消费、生成、制品身份和发布输出目录需要交接；两个 skill 保持独立版本。
- 首次升级通过独立引导器完成，旧安装的受管文件按清单验证后退出；用户定制冲突在写前报告。
- CLI JSON、失败恢复、Gate、测试和 Case 改以原生契约为依据；其他 skill 的更新方式保持。

## Success Criteria

1. 准备和私有验收完成前，现行正式 CLI 与使用说明继续有效；候选说明只随隔离制品验证。
2. 两个平台的新装、支持版本升级、同版本修复和失败恢复通过；安装成功时二进制、Schema、入口及说明一致，失败或不完整状态明确。
3. 旧更新器请求原生正式 release 时，在覆盖本地文件前失败，并可通过明确的引导方案升级；原生业务失败不自动换旧后端重跑。
4. 新正式包不提供领域 TS SDK；旧入口、声明、依赖、生成任务、Gate 和 Case 已按实际消费者对账，共享能力及用户定制保持。
5. 原生资产与 skill 包由同一发布身份绑定；当前版本在 Linux 和 Windows 通过适用门禁。真实发布和用户目录安装须在对应授权下执行。

## Affected Owners

| 内容 | Owner |
| --- | --- |
| 原生运行时、协议与构建 | [Record CLI](../../tools/record-cli/README.md)、[机器协议](../../tools/record-cli/protocol.md)、[交付入口](../../tools/record-cli/delivery/README.md) |
| 格式与制品契约 | [Index Runtime](../../tools/index-runtime/README.md)、拟新增的纯数据格式 owner `tools/record-contracts/`、`tools/skill-package/` |
| 生成、发布与安装 | [源码生成与分发](../../docs/tooling-distribution.md)、[发布操作](../../docs/tooling-delivery.md)、[Skill Updater](../../tools/skill-updater/README.md) |
| 使用与验证 | [Decision Records](../../skills/decision-records/SKILL.md)、[Investigation Report](../../skills/investigation-report/SKILL.md)、[测试维护](../../docs/test-maintenance.md)、[Gate](../../docs/gate-execution.md) |
