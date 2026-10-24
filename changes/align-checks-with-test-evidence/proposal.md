# Proposal

本临时计划将全仓测试与 Check 普查中已确认的问题落实为责任清楚、输入完整、证据有效的验收体系；实施处置与最终验收分别留证。

## Why

普查发现：部分 Check 的真实消费越过输入声明或缺少生成成功前置；显示名和测试归属没有准确呈现责任；共同协议重复注册、少量无效或同源断言、未命中的故障注入与资源回收缺口削弱证据。宽输入和不必要的真实进程准备还增加维护与执行成本。整改以行为 owner、独立错误观察和必要真实边界为依据，数量与耗时只作结果测量。

审计基线之后仓库已增加 image/video 与 Windows 视频交付责任，本计划以当前源码和 owner 为准；审计记录是静态发现，不是当前通过或运行时错误的证明。

## Outcome

本次普查全部已确认发现均有可追溯处置；保留测试能从最小原生入口、独立预期和必要真实边界证明其承诺，Check 名称、命令、输入、成功前置和 Case 与实际责任一致。完成目标测试和项目级验收，保留既有 quick/changed/CI/release 与 Windows 视频交付承诺，最终改动通过正确性复核及文档／代码可维护性优化。

## Scope

### Intended Change

- 修复七组、涉及八个 Check 的输入／统一生成 provider 缺口；核对当前真实加载及 TypeScript program 闭包。
- 按独立证明责任归位测试和 Check，校准显示名与测试名；允许有依据地拆合，不固定审计时的 Check 数量，不为措辞变化改稳定身份。
- 将十对无领域参数的共同事务证明集中为共同 owner 的唯一后继，分别保留两域真实 adapter；收窄已证不消费的输入、下沉纯规则矩阵与无关 fixture 准备。
- 补强无效、同源、竞争、恢复和只读证据，隔离 fixture、约束等待并回收参与方；把 orphan validate 回归接入合适既有入口。
- 用 findings 处置表闭合 A–F 与两份独立复核，包括已有 updater/publisher/性能 CLI/catalog 解析建议。

### Resulting Impacts

- 同步 Gate Definition/catalog fixture、能力／订阅／输入契约版本、聚合入口、最小测试实体与 Case/index；检查 receipt 失效及 provider 实际带入，不将旧 receipt 当新契约证据。
- 如源码／生成适配发生必要变化，从 owner 修改并同步生成产物及独立 skill 版本；不直接修改分发副本，也不因纯测试改动自动提升全部版本。
- 同步当前工具链与 Gate 编写文档中的职责、数量和路径，按需记录达到门槛的长期决策；审计明细与临时来源只留在本 Change，不沉淀进长期 owner。
- 保留当前 image/video、新增检查和 Linux release → 同 revision Windows 视频源码／同次 zip → publish 链路，并取得对应本地与远端证据。
- 最终按 AI-Ready Docs 优化本次受影响文档的消费路径，按编码规范优化本次实现及直接影响边界；不顺手重写无关材料。

## Success Criteria

1. findings 每项均记录采用、收窄、保留或不实施的依据、实际后继与验证；没有以“统一优化”替代逐项闭合。
2. 输入遗漏及生成前置缺口有目标回归；裁剪输入保持 leaf 删除／存在性等实际消费事实、必要传递加载、ignored 和漂移保护。
3. 被迁移、拆合、下沉或删除的测试都有明确保留的证明后继；必要 Git、Node、worker、锁、文件系统、安装和生产硬上限证据不丢失。保留入口均可被 runner 选择并单独报告，Case 与实体引用／覆盖通过。
4. 阶段正确性复核完成；最终受影响文档通过代表性 AI 阅读检查，代码符合现有编码规范，未新增无现实责任的框架／抽象。
5. 目标入口、`test:check`、quick、`check:changed` 与 Linux 冷 release 已按实际影响运行；同一最终受测 revision 的远端 `package` 与 `video-windows` 成功及必要合并保护证据得到核对。未取得的外部证据不能标成完成。

## Affected Owners

- `scripts/lib/vibe-gate/`、Gate CLI／invocation、catalog fixtures 与对应测试：Definition、输入证明、provider、执行结果及性能消费。
- `scripts/` 的环境、validate、publisher、项目配置与 Test Evidence 采集入口；`package.json` 和当前 CI workflow。
- `tools/decision-records/`、`tools/investigation-report/`、`tools/record-operations/`、`tools/index-runtime/`、`tools/shared/` 的测试／fixtures及必要现有实现边界。
- `tools/task-graph/`、`tools/test-evidence/`、`tools/change-plan/`、`tools/novel-cards/`、`tools/lightweight-judgment/`、`tools/mcpshell-workspace-bridge/`、`tools/skill-updater/`、`tools/skill-validator/` 的相关测试与局部契约。
- `docs/test-evidence/cases/`、派生 index、`docs/tooling.md`、`docs/gate-check-authoring.md`、必要局部 README／长期决策；生成与版本按项目工具链处理。
