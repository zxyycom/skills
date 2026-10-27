# 记录维护批次数据填写契约

本参考供填写批次配置、清单与证据时使用；完整流程、结果对账与调用边界见[执行参考](execution-reference.md)。

`__FILL_...__` 为待填值；rowTemplates 是样板，复制到对应数组后才成为本轮数据。未计算的计数保持 null。

| 字段 | 填写规则 |
| --- | --- |
| `runId`、`objective` | 无空白的唯一批次 ID 和目标；抽样 seed 默认同 runId |
| `domain`、版本 | run、review-bank、result 的 domain、workflowVersion、questionSetVersion 一致；probe-bank 与 run.jev、result 的 probeSetVersion 一致，共享同一 workflowVersion |
| `scope` | recordIds 为本领域完整 ID；allEstablished=true 且列表为空表示本领域全部正式记录，false 且为空表示范围待定 |
| `dimensions` | 沿用领域默认维度；缩减时列未覆盖项，问题映射见领域页 |
| `mode`、`authorization` | 默认 review，allowedChanges 为空；维护用 maintain 并填具体授权来源。配置不替代真实授权 |
| `jev` | 默认 off；trial、assist 的资格见 [JEV 局部判断](jev-local-judgment.md)。enabledTemplates 明确选择局部模板；assist 的 validationEvidence 按 probeValidation 样板记录 |
| `authorization.external` | 选用 JEV 后，记录获准接收方、正整数 maxCalls、费用边界；授权材料引用当前请求或生效规则 |
| `artifacts` | 私有目录和验收后留存安排 |
| `baseline` | 保存 HEAD、dirtyPaths、两套题库 hash、领域 ownerSources 及基线检查证据 |
| `inventory` | 唯一 recordKey 为 `decision:<ID>` 或 `investigation:<ID>`；selected 是本轮对象，context 是补入材料；complete 须有原文件字节 SHA-256，未取到记 unavailable |
| `jobs` | 主代理审查任务；kind 对应 review-bank 模板，inputPath/inputSha256 指本地完整证据输入，questions 只选本轮维度对应的固定题 |
| `questions.readiness` | ready / missing_evidence / not_applicable；后两者写理由，仍留在清单 |
| `probes` | 可选局部任务；supports 只关联领域页允许辅助的主代理 checkKeys，sourceRefs 定位实际原文；一个 probe 对应一个局部模板和请求 |
| `probes.readiness` | ready / missing_evidence / not_applicable；后两者不发送，分别记局部结果 missing_evidence / skipped 并说明理由 |
| `coverageGaps` | 使用 coverageGap 样板；uncovered 或有事实支持的 not_applicable，附对象、维度、理由及下一步 |

- 仓库来源路径相对仓库根，运行产物路径相对本轮目录；证据使用路径或“路径#章节／行号”，与领域 ID 分开。
- 全文、关键材料及版本保存在本轮 `evidence` 或可恢复快照中；外部事实附取得时点与证明边界。
- `discoveryEvidence` 保存检索词、命中及覆盖；ownerSources、验证与动作数组使用对应样板。
