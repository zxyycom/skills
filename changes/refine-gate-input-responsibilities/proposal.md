# Proposal

按实际消费者收紧 Gate 输入与测试责任；本文件是随 Change 结项退出的临时计划。

## Why

共享搜索输出实现变更会触发不消费该内容的项目校验和生成文件原语测试，也会带入偏宽的领域测试矩阵。前轮证据见 `.log/vibe-check/shared-gate-after-git40-20261021/analysis.md`。本轮以减少无关工作为目标，不预设墙钟收益。

## Outcome

共享搜索输出实现变更不再触发两项无关检查；决策记录与调查报告只运行实际证明契约要求的领域覆盖。公共输入按真实消费者收紧，未闭合的依赖继续保守执行。

## Scope

### Intended Change

1. 收紧 `script:validate` 与 `script:test:generated-file` 的输入及订阅。
2. 整理决策记录生命周期、查询、分发及调查报告命令行的测试和加载边界。
3. 审计公共输入消费者，至少完成有证据的局部收紧。

### Resulting Impacts

- 输入闭包、Check 身份、catalog fixture 和成功证明版本随行为同步。
- 测试层级变化同步 Case 与索引，保留完整 source fingerprint 和必要 Git、真实 Node、CLI、失败及恢复断言。
- 调整源码或生成边界时运行公开同步入口；消费生成物的检查继续依赖统一生成 provider。
- 稳定维护知识回到工具链、测试或行为 owner；本 Change 只保存临时设计、进度和验证证据。

## Success Criteria

1. 共享 renderer 场景中，两项无关检查复用，相关搜索、协议及生成一致性覆盖继续执行；无关领域矩阵实质减少。
2. 公共输入收紧有消费者和传递依赖证据；未收紧部分说明实际保守原因。
3. 每个受影响测试入口和 Case 可追溯到实际证明契约，必要边界与断言完整保留。
4. 通过阶段正确性审查、独立 AI 可读性与编码规范优化，以及适用直接验证和 `bun run check`。
5. 保持原生 learned 调度、每轮原生材料政策和统一生成 provider，不以新增框架或硬秒门槛换取结果。

## Affected Owners

- `docs/gate-check-authoring.md`：输入证明与检查接入。
- `docs/tooling.md`、`docs/coding-style.md`：运行、测试、生成与编码边界。
- `scripts/lib/vibe-gate/`、catalog fixture 与测试：输入、订阅及 Check 声明。
- `tools/decision-records/`、`tools/investigation-report/` 及其生成物：领域测试和加载边界。
- `skills/test-evidence-review/`、`docs/test-evidence/`：最小原生入口与 Case 证据。
