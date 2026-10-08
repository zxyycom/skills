# 记录维护执行参考

按[维护入口](../record-maintenance-workflow.md)执行；填写任务时读配置与复制步骤，记录结果时读结果分层与对账，选用 JEV 时读局部请求步骤。

## 配置与清单

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

## 复制主代理输入

在 `RUN_DIR` 中选择领域模板和唯一 job ID，复制本地 `inputs`，填写材料并登记 `jobs`；检查题从 `review-bank` 读取。命令校验领域和版本，以独占方式创建文件。

```bash
bun -e '
const [dir, kind, id] = process.argv.slice(1);
const { readFileSync, writeFileSync } = require("node:fs");
const bank = JSON.parse(readFileSync(`${dir}/review-bank.json`, "utf8"));
const run = JSON.parse(readFileSync(`${dir}/run.json`, "utf8"));
if (bank.consumer !== "agent") throw Error("不是主代理审查清单");
for (const key of ["domain", "workflowVersion", "questionSetVersion"]) {
  if (run[key] !== bank[key]) throw Error(`任务与审查清单不匹配：${key}`);
}
if (!bank.templates[kind] || !/^job-[0-9]{4,}$/.test(id)) throw Error("模板或任务 ID 无效");
writeFileSync(`${dir}/evidence/${id}.json`, JSON.stringify(bank.templates[kind].inputs, null, 2) + "\n", { flag: "wx", mode: 0o600 });
' "$RUN_DIR" record job-0001
```

## 准备与调用局部请求

先在 `run.probes` 登记 `supports`、模板和来源，按 [JEV 输入要求](jev-local-judgment.md#准备最小充分输入)选段。命令只创建请求骨架，校验启用状态、类型、版本和关联；发送前由主代理核对授权、任务资格、占位值、请求 hash 与剩余预算。

```bash
bun -e '
const [dir, id] = process.argv.slice(1);
const { readFileSync, writeFileSync } = require("node:fs");
const bank = JSON.parse(readFileSync(`${dir}/probe-bank.json`, "utf8"));
const run = JSON.parse(readFileSync(`${dir}/run.json`, "utf8"));
if (bank.consumer !== "jev" || !["trial", "assist"].includes(run.jev.mode)) throw Error("局部判断未启用");
if (run.workflowVersion !== bank.workflowVersion || run.jev.probeSetVersion !== bank.probeSetVersion) throw Error("局部题库版本不匹配");
const matches = run.probes.filter(p => p.probeId === id);
if (matches.length !== 1 || !/^probe-[0-9]{4,}$/.test(id)) throw Error("局部任务 ID 无效");
const probe = matches[0];
if (!run.jev.enabledTemplates.includes(probe.template) || !bank.templates[probe.template]) throw Error("局部模板未启用");
const keys = new Set(run.jobs.flatMap(j => j.questions.map(q => `${j.jobId}/${q.id}`)));
if (!probe.supports.length || probe.supports.some(key => !keys.has(key))) throw Error("缺少主代理检查关联");
if (probe.requestPath !== `requests/${id}.json`) throw Error("请求路径与 ID 不一致");
writeFileSync(`${dir}/${probe.requestPath}`, JSON.stringify(bank.templates[probe.template], null, 2) + "\n", { flag: "wx", mode: 0o600 });
' "$RUN_DIR" probe-0001
```

填好 state 后，按 [Lightweight Judgment](../../skills/lightweight-judgment/SKILL.md)核对配置、凭据与日志留存。以下两项只验证本地前置，attempts 为 0：

```bash
bun run lightweight-judgment -- doctor
bun run lightweight-judgment -- json --file "$RUN_DIR/requests/probe-0001.json" --dry-run
```

获准后按下例保存首个调用；后续更换 index、文件名、probe 路径和模板标签。命令仅发起调用并保存输出，语义与授权检查由主代理负责。

```bash
RUN_ID="$(bun -e 'console.log(JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8")).runId)' "$RUN_DIR/run.json")"
CALL_INDEX=1
(
set -o noclobber
if bun run lightweight-judgment -- json \
  --file "$RUN_DIR/requests/probe-0001.json" \
  --run-id "$RUN_ID" --run-index "$CALL_INDEX" \
  --tag suite=record-maintenance --tag kind=topic_match \
  > "$RUN_DIR/responses/call-0001.json" 2> "$RUN_DIR/responses/call-0001.stderr"; then
  CALL_EXIT=0
else
  CALL_EXIT=$?
fi
printf '%s\n' "$CALL_EXIT" > "$RUN_DIR/responses/call-0001.exit"
)
```

每次调用登记 callRef、probeId、runIndex、退出码、原答和 stderr 路径；actualModel、attempts、persistence 从原答读取。按 [CLI 输出契约](../../skills/lightweight-judgment/references/cli.md#输出与校验)分别核对推理与持久化：有效答案照常保留，日志失败不使其失效。概率、confidence、usage 原样保存，不编造模型解释或合成整体可信度。

超时后的远端完成和计费可能未知；不自动重试。重试须有理由、上限及剩余授权，使用新 callRef/index；无依赖的任务可继续。

## 结果分层

### 主代理检查

每个预定问题一行 checks，以 `jobId/questionId` 唯一定位。status 为：

- issue：有依据的领域问题，或领域清单定义的待维护状态。
- clear：主代理已在实际覆盖范围内确认无问题。
- unresolved：缺证、判断未完成或关键意见冲突，必须列待办。
- not_run：尚未执行，必须列待办。
- not_applicable：对象事实支持无需检查，记录理由。

- `basis` 为 `direct` 或 `probe_assisted`；后者列实际参考的 `probeIds`，`evidence` 与 `rationale` 保存主代理依据。
- `disposition` 为 `keep`、`propose_change`、`need_evidence`、`need_authorization` 或 `pending`；issue 附具体处置或保留理由。
- `status` 为 unresolved / not_run，或 `disposition` 为 pending / need_evidence / need_authorization 时，列入 `pendingCheckKeys`。
- `check.actionIds` 与 `action.checkKeys` 双向对应；已提议但未完成的动作列入 `nextSteps`。

### JEV 局部结果

每个预定 probe 一行 result.probes。observation.status 为 answered、missing_evidence、technical_failure、not_run 或 skipped；只有 answered 才填题库实际 choice，其余为 null。原答从对应模板唯一题目的 `result.answers[questionId]` 取得，callRef 指向实际调用；没有调用时为 null。

review.status 为 pending、confirmed、corrected 或 unresolved；referenceChoice 保存复核认为合理的局部类别，无法确定时留 null，evidence/rationale 解释依据。trial 的参考判断在发送前保存，事后比对仍保留原依据；同一 agent 形成参考与复核时不声称独立验证。

disposition 为 pending、used、rejected 或 bypassed，handlingReason 说明接回结果。used 只代表参考了局部信号，关联的主代理检查仍须独立形成领域结论；uncertain 或技术失败不能 used。主代理直接完成而无需继续局部任务时记 bypassed；试用结果不参与领域判断时记 rejected 或 bypassed。缺证、失败、未执行或 uncertain 尚未被明确接手处理时维持 pending，不能静默移出 pendingProbeIds。

### 动作与验收

actions.kind 只用领域处置表允许的类别。state 为 proposed、ready、applied、verified 或 failed；ready 要求主代理判断与授权齐备。保存精确 before/after、来源版本及 verificationPlan；executionEvidence 与 verificationEvidence 分开。已写入但验证失败仍保留 applied，解释失败；事务结果不明记 failed 并先对账。

## 更新与对账

补证或版本漂移建立新 job，supersedesJobId 指向旧 job；新旧题 ID 集合相同。局部输入改变建立新 probe，supersedesProbeId 指向旧项；新请求使用新文件与 hash，更新 supports 为当前 checkKeys。两类后继链均无环，每个旧项至多一个直接后继；扩查新对象不声明 supersedes。只取链末端作为当前判断，历史输入、原答和行动依据继续保留。重试同一输入保留全部 calls，并说明采用哪次回答。

| 汇总 | 对账规则 |
| --- | --- |
| 对象、jobs | inventory 按唯一 recordKey 统计 selected、context、complete；jobs 按唯一 jobId 统计 |
| plannedChecks、summary.checks | `Σ jobs.questions.length = checks.length`，检查键完全一致；五类 status 之和为 plannedChecks |
| supersededChecks | 已被后继 job 取代的旧题数；历史仍计入总量，当前待办仅看链末端 |
| plannedProbes、probeStatuses | `run.probes.length = result.probes.length`，probeId 集合一致；五类 status 之和为 plannedProbes |
| supersededProbes | 已被后继 probe 取代的旧项数；历史仍保留，当前采用及待办仅看链末端 |
| pendingCheckKeys、pendingProbeIds | 按上节规则列当前未决检查及 disposition=pending 的局部任务；前者与后者不能互相替代 |
| actions | proposedActions 为全部提议数；appliedActions 为 applied + verified；verifiedActions 仅计 verified |
| 限制与后续 | coverageLimitations 汇集查询、候选、维度和执行缺口；nextSteps 列动作、补证和授权待办；processFeedback 保存可复用修正依据 |

各领域分别验收，不合成跨领域语义通过率。调用按 calls 计，usage 每次请求只累计一次；启用日志时，用 `bun run lightweight-judgment -- stats --run-id <本轮ID>` 保存 statisticsEvidence 并与 calls 对账。缺失用量、未知费用或未声明单位如实保留，耗时按实际计量边界报告；结构检查、语义质量和端到端收益分别说明证据。

## 模板维护

运行时填写 inputs/state，不现场重写固定题意。公共数据语义改变递增全部模板的 workflowVersion；领域检查或处置改变递增本领域 run/review 的 questionSetVersion；局部题意改变递增 probe-bank、run.jev 与结果模板的 probeSetVersion。每轮保存实际副本和 hash，既有调用不回填新语义。

修改后检查版本、两域问题映射、两类复制入口隔离、局部请求预览和结果对账；演练 JEV 关闭、局部与全篇结论分开、缺证／uncertain／失败接手、遗漏关系、完整对齐和来源漂移。离线检查与模型效果分别验收。
