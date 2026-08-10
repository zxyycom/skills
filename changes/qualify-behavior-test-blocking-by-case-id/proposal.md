# Proposal

本 draft change 定义统一的测试阻断资格：正式测试结果只有在符合版本化 JSON 协议、每个 Test ID 都能从闭合账本解析到至少一个 Case ID 时，才有资格形成行为结论；当前文档只确定方案和验证边界，不授权实施。

## Why

本 change 调查时，仓库有 13 个稳定 `test:*` package scripts 和 416 个已登记 Case。现行 catalog 只校验显式 Case，不扫描测试源码、不执行 `Entry:`，也不证明本次 runner 结果与 Case 的对应关系。项目检查只消费各测试容器的聚合退出码，因此无法区分合法行为失败、未登记测试、身份错配和 runner 故障。

测试只有在意义可描述、可审计并关联语义 Case 时，才有资格约束实现。未登记、无身份或无法追溯 Case 的测试不是普通行为失败，而是测试完整性错误；该错误必须硬阻断正式门禁，不能只警告。

为了避免 test-evidence 核心逐一适配 Bun、Node 或未来 runner，本 change 选择统一生产者协议：每个正式测试入口在协议模式下输出同一版本化 JSON，test-evidence 能力只校验和消费该协议。Runner 差异只存在于边缘 producer，不进入统一 consumer。

## Outcome

- 正式门禁只接受一个符合受支持 Schema 的 JSON 文档；文档必须完整列出本次实际产生的原生结果，每项结果都携带唯一测试实体 ID（以下简称 Test ID）。
- Test ID 从当前测试实体索引取得；Case ID 只由 consumer 从同一份闭合 ledger 快照派生，不写入测试源码或 producer JSON。
- Consumer 先按 Test ID 识别并汇报有问题的测试实体，再为能够解析关系的 Test 自动附加全部关联 Case ID；已资格化 Test 的失败才形成行为回归。
- 非 JSON、Schema 或版本非法、Test ID 缺失/未知/重复、结果集合不闭合、账本陈旧或 Test 无 Case，统一形成 `test-integrity` 硬阻断，不形成行为回归。
- JSON producer 或底层 runner 无法启动、被终止或超时，形成独立的 runner/基础设施失败。
- Test-evidence consumer 只实现一次协议校验、预期/实际集合核对、Test → Case 查询、分类和诊断，不包含 runner 专属分支。
- 稳定 `test:*`、`bun run check` 和 CI 使用同一资格语义；raw runner 可以提供本地反馈，但没有项目级行为阻断资格。
- 完整性诊断以问题 Test 实体为中心，提供稳定 reason code、来源步骤、可用 locator/显示名、Test ID、派生 Case ID 和修复方向；结果缺少 Test ID 时只能报告可用定位信息，不能伪造 Case 关联。

## Scope

后续获准实施时纳入：

- 定义版本化 JSON Schema、兼容策略、stdout/stderr 纪律、invocation identity、闭合结果状态、producer error 和诊断结构。
- 消费 `task-000035` 最终确定的 Test ID、locator、测试发现新鲜度与 `sourceRevision`，不复制其身份 owner。
- 建立严格 consumer，并为当前 Bun 与 Node native test 各自需要的生产边缘提供 JSON producer。
- 从资格快照派生预期 Test ID 集合，执行 producer，严格核对 JSON 实际集合，复核 revision，再派生 Case ID 和最终分类。
- 收口正式测试阻断面，使稳定 `test:*`、check 测试步骤和 CI 测试调用不能绕过统一协议。
- 先试点一个小范围测试容器，证明协议后再迁移其余容器，并覆盖直接 script、quick/full check 和 CI。
- 验证只删除关系、只删除实体、只删除实现和完整自洽删除的不同边界。

当前 draft 不纳入：

- 不实施测试框架、producer、consumer、manifest、CI 或 test-evidence 行为变更。
- 不修改 `task-000026` 已完成的 ledger 机制，或替 `task-000035` 决定 Test ID 与真实测试发现。
- 不在测试源码、测试名、runner 配置、JSON 或独立 manifest 中重复保存 Case ID。
- 不让 test-evidence 核心解析 TAP、JUnit、console 文本或任何 runner 专属事件格式。
- 不把 package script、测试文件、suite、runner 或 CI job 当作 Test 或 Case 身份。
- 不引入 Case 级 pass/fail、AND/OR、权重、顺序、主次或 quorum。
- 不通过日志猜测、进程监控或执行沙箱声称能够识别任意外部隐藏测试。
- 不机械判断一次完整且自洽的 Test/Case 删除是否具有产品正当性；该判断仍属于代码审查。

## Success Criteria

- 正式协议模式的 stdout 恰好包含一个受支持版本的 JSON 文档；空输出、混杂日志、多个 JSON 值、NDJSON、未知版本和 Schema 非法均被确定性拒绝。
- Producer JSON 完整覆盖本次实际产生的原生 Test 结果，每项都携带唯一 Test ID 和协议最终确定的运行结果；显示名、路径和退出码不能替代身份。
- Consumer 能以同一实现处理不同 producer 的合法 JSON，并从同一 ledger 快照为每个 Test ID 派生非空 Case ID 集合。
- 行为回归、`test-integrity`、runner/基础设施失败和非测试工程检查失败具有互斥的主分类与可行动诊断。
- 新增无 JSON producer 的 `test:*`、check 裸 runner 或 CI 测试旁路不能取得行为阻断资格。
- 只删除 Case 关系、测试实体或测试实现会被相应闭合/新鲜度检查发现；完整自洽删除不虚构结构错误，也不引入第二策略状态。
- 稳定 script、quick/full check 与 CI 对同一输入得到同一资格分类；test-evidence consumer 中不存在 runner 专属分支。
- 试点覆盖合法结果、协议非法、身份非法、集合不闭合、来源漂移和 producer 故障，并通过受影响目标检查与项目统一检查。
- `task-000035` 的 Test ID、locator 和发现契约完成并复核前，本 change 保持 draft，不进入 plan 或 implementation。

## Affected Owners

| Owner | 后续责任 | 当前边界 |
| --- | --- | --- |
| [`establish-many-to-many-test-case-relations`](../establish-many-to-many-test-case-relations/) 与 `task-000035` | Test ID、测试实体来源、Case `Tests:` 关系和闭合查询 | 本 change 只消费最终契约 |
| [`skills/test-evidence-review/`](../../skills/test-evidence-review/) 与其可分发工具 | JSON Schema、严格 consumer、Test → Case 资格查询、分类和维护指导 | 当前 skill 尚不拥有运行门禁；本 draft 不修改它 |
| Runner 侧 JSON producer | 读取框架原生结果、绑定 Test ID、映射协议状态并输出一个 JSON 文档 | 不查询或输出 Case ID；实现技术待试点 |
| [`scripts/check.ts`](../../scripts/check.ts)、[`scripts/lib/check-plan.ts`](../../scripts/lib/check-plan.ts) 与 [`docs/tooling.md`](../../docs/tooling.md) | 资格前置、阻断步骤分类、producer/consumer 编排和 quick/full 门禁 | 不解析 runner 专属格式或复制协议 Schema |
| [`package.json`](../../package.json) 中的 `test:*` | 稳定直接测试入口 | 后续统一调用资格链路；本 draft 不改脚本 |
| [Package Skills workflow](../../.github/workflows/package-skills.yml) | 调用并展示 `bun run check --full` 结果 | 不生产、转换或重新解释测试协议 |
