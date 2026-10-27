# CLI 操作契约

本文是随 skill 分发的 CLI 操作入口，定义日常调用、输入输出、校验和错误处理；[配置与连接](cli-configuration.md)承接配置的精确合同。可选 SQLite 留存与恢复由 [调用日志](call-logging.md) 承接，离线统计由[统计契约](statistics.md)承接。

使用 Node.js 24.18 或更新版本直接运行 `scripts/lightweight-judgment.ts`；兼容依赖复用与独立安装见[工具运行前置](../SKILL.md#工具运行前置)。下列绝对路径均为占位示例，调用前替换为实际路径。

## 职责与通道

CLI 负责配置、输入、鉴权、请求发送、响应校验、可选调用持久化与结构化输出；业务问题、结果采用和后续动作由 agent 负责。

接入合同由可信配置 `adapter` 选择，完整能力与转换见[接入合同与模态](protocol-adapters.md)。缺省为 `openrouter-systemone`：OpenRouter `https://openrouter.ai/api/v1/systemone`、模型 `typesafe/jev-1.13`，保持旧文本行为。每次 `json` 或 `ask` 接收一个 state 与一组问题，本地校验通过后发送一次 HTTP 请求。不同 state 分次调用；拆题、后续调用与模型／服务选择由调用方显式决定。

首次正式调用按“配置 → `doctor` → `json --dry-run`／`ask --dry-run` → 正式调用 → 检查输出与退出码”核对。只需预览请求时直接使用 `--dry-run`，无需密钥或先通过 `doctor`。`doctor` 和预览均离线，不能证明服务可用；历史统计按 `stats` 路径执行。

## 配置

首次调用或配置变化时，先按[配置与连接](cli-configuration.md)选择可信配置，再运行 `doctor` 和离线预览。配置文件只选择一个，不跨文件合并；默认通道与调用顺序见上文。更换接收方须先确认数据外发和费用授权，凭据不得进入请求正文、仓库或用户输出。

### 文件与默认值

配置来源优先级、缺省值和其他 adapter 的必填项见[文件与默认值](cli-configuration.md#文件与默认值)。

### 连接与凭据

地址限制、凭据来源优先级与保密要求见[连接与凭据](cli-configuration.md#连接与凭据)。

### 模型与超时

标识校验、模型选择优先级和超时范围见[模型与超时](cli-configuration.md#模型与超时)；本次覆盖参数见[推理参数](#推理参数与帮助)。

### 可选调用日志

日志默认关闭；启用条件、存储失败和恢复入口见[可选调用日志](cli-configuration.md#可选调用日志)。

## 命令与输入

### `doctor`：本地前置检查

```bash
node /absolute/path/lightweight-judgment/scripts/lightweight-judgment.ts doctor
node /absolute/path/lightweight-judgment/scripts/lightweight-judgment.ts --config /absolute/private/judgment.json doctor
```

成功时报告配置位置、adapterContract、images／longContext 设置、endpoint、模型、超时、密钥变量名、`credentialSource`（config／environment）、密钥存在及解析后的 logging 设置；秘密值、长度和前后缀均不输出。配置非法或本地密钥缺失／无效时返回 `configuration`、退出 2，attempts 为 0；普通推理具有同一前置行为。此命令只证明本地配置与凭据前置满足，不证明服务可用或存储可写。

### `json`：完整请求

输入恰选一种，stdin 须显式指定 `-`：

```bash
node /absolute/path/lightweight-judgment/scripts/lightweight-judgment.ts json --file /absolute/path/request.json
node /absolute/path/lightweight-judgment/scripts/lightweight-judgment.ts json - < /absolute/path/request.json
node /absolute/path/lightweight-judgment/scripts/lightweight-judgment.ts json --json '{"state":"请回退版本","questions":{"rollback":{"type":"noul","instructions":"是否明确请求回退版本？"}}}'
```

输入为 UTF-8 单个 JSON 对象，不接受 JSONL；顶层接受 `state`、非空 `questions` 和可选 `model`。CLI 补齐 model 后按 adapter 编译，保留输入类型、文本与候选顺序；OAI 结构化文本转换、题目映射及模态拒绝见[编译合同](protocol-adapters.md#文本与结构化输入)。请求不接受 assets、adapter、images 或连接配置。

- `state` 为字符串、对象或数组；其中的路径与 URL 仅作数据，不触发文件读取或网络抓取。
- 每题仅接受 `type`、`instructions`、`criteria`；必填前两项，`instructions` 为字符串、对象或数组。`type` 为 `choice`、`score`、`noul` 或 `box`，对应 criteria 如下。
- JSON 最大嵌套 128 层；数值须有限、整数须安全且能按十进制值无损往返 JSON；拒绝下溢、负零与额外精度。需要精确数值时使用字符串。
- 非法 UTF-8、非法 JSON、重复对象键、封闭字段集合中的未知字段、非法 state、空问题集合、非法题型或 criteria 均拒绝，错误定位字段路径；超出实现精度或范围的值拒绝而非改写。

| type | criteria |
| --- | --- |
| `choice` | 必填候选映射，1–255 个候选；候选值为字符串、对象、数组或 null |
| `score` | 必填有序等级数组，2–10 个等级；等级为字符串、对象或数组 |
| `noul` | 可省略；提供时为只含 `true`／`false` 的对象，两字段均可省略，条件为字符串、对象或数组 |
| `box` | 不接受 criteria；须满足[模型／图片前置](protocol-adapters.md#jev-box) |

同一 state 的独立判断可以组合为多题；候选设计和阅读预期见[双题请求示例](request-examples.md#同一材料的独立双题)。

### `ask`：单题参数

必填 `--type choice|score|noul|box` 与 `--question <text>`；`--id` 默认 `answer`，仅关联结果。

上下文恰选一种：`--text`、`--text-file` 形成字符串 state；`--state-json`、`--state-file` 按 JSON 解析并保留原生形状。解析模式由参数而非扩展名决定。

```bash
node /absolute/path/lightweight-judgment/scripts/lightweight-judgment.ts ask --type choice \
  --text-file /absolute/path/message.txt \
  --question "这段文本主要属于哪类请求？" \
  --option "bug=报告软件故障" \
  --option "feature=请求新增能力" \
  --option "other=信息足够，但不属于以上类别" \
  --option "unclear=信息不足"
```

Choice 重复 `--option key=description`，按第一个等号分隔，键唯一；Score 重复 `--level`，顺序即等级。不同题型的 criteria 参数不可混用。Box 不接受 criteria；复杂 instructions、图片 state、结构化 criteria、Noul 的 true／false 定义及多题使用 `json`。

### `stats`：离线日志统计

用 `stats` 汇总已有日志的用量／耗时，并按模型、状态、标签或批次比较。直接运行 `stats` 使用配置中的日志路径；`stats --database /absolute/private/calls.sqlite3` 跳过配置。此命令只读、不要求密钥或发送请求；筛选、分组、分桶、输出和解读见[离线调用统计](statistics.md)。

### 推理参数与帮助

下表按 `json`／`ask` 解释参数；`stats` 的 `--endpoint`、`--run-id`、`--tag` 用于日志筛选，见[统计参数](statistics.md#筛选分组与分桶)。`--help` 适用于所有命令。

| 参数 | 行为 |
| --- | --- |
| `--endpoint <URL>` | 覆盖所选合同的本次完整地址；不切换合同或凭据，受连接规则约束 |
| `--model <id>` | 覆盖本次所选合同的原生模型标识 |
| `--timeout-ms <positive-integer>` | 1–2147483647 毫秒，从发送到完整响应的本次等待上限 |
| `--run-id <id>` / `--run-index <n>` | 仅 json／ask，成对提供的本地批次 ID／从 1 开始的顺序；留存与校验见[本地元数据](statistics.md#记录本地批次与标签) |
| `--tag key=value` | 可重复的本地标签；留存与校验见[本地元数据](statistics.md#记录本地批次与标签) |
| `--dry-run` | 仅用于 `json`／`ask`：解析配置与输入、补齐 model、本地校验，输出所选合同、endpoint、最终 wire 请求及非秘密 header；不读取环境密钥、不要求密钥存在、不联网或建库 |
| `--help` | 展示命令、配置来源、离线示例和退出语义，不读取配置、输入或凭据，不联网 |

例如 `node /absolute/path/lightweight-judgment/scripts/lightweight-judgment.ts json --file /absolute/path/request.json --dry-run`。预览仍读取并校验选中的配置文件，包括其中可选的 apiKey，但不将密钥放入输出；输出含待发正文。长文本与敏感材料优先通过文件或 stdin 输入，输出按数据权限处理，避免命令历史和公共日志泄露。

## 输出与校验

除 `--help` 外，stdout 恰为一个 JSON 对象；诊断走 stderr，并移除秘密和未经处理的远端错误正文。调用方可按授权重定向保存输出，调用日志按配置留存。

推理成功且无存储失败时退出 0。以下为虚构响应：

```json
{
  "ok": true,
  "result": {
    "model": "typesafe/jev-1.13-20260917",
    "answers": { "answer": { "type": "noul", "noul": 0.03 } }
  },
  "normalized": {
    "version": "1",
    "adapterContract": "openrouter-systemone/v1",
    "model": "typesafe/jev-1.13-20260917",
    "completion": "complete",
    "answers": { "answer": { "status": "answered", "type": "noul", "noul": 0.03 } }
  },
  "meta": { "requestModel": "typesafe/jev-1.13", "elapsedMs": 350, "attempts": 1 },
  "error": null
}
```

- `result` 保留完整有效响应：实际 model、answers、各原语的概率／confidence／legend，以及服务端提供的 usage、id、provider。缺失的字段、费用、解释或 confidence 不予补造。
- 顶层 `normalized` 为统一结果，结构与拒答见[原答与采用](protocol-adapters.md#原答统一结果与采用)；`openai-decisions` 的原生 `result.answers` 为数组，不能套用 JEV map shape；OpenRouter 指定 OpenAI 路由仍按自己的 answers map 合同处理。
- `meta.elapsedMs` 为发送前开始计时，至原生校验／统一结果或失败处理完成、最终日志 finish 前冻结的耗时；日志与输出共用，不含输入编译、最终落盘或 stdout。`attempts` 为实际发送次数。
- 推理进入日志写入阶段后，`meta.persistence.status` 为 `recorded` 或 `failed`，表示本次持久化是否完整成功；有调用记录时用 `callId` 关联数据库。存储失败的退出与结果保留规则见下方。
- 否定、`unclear`、低 confidence 与直接 `openai-decisions` 的合法混合／全拒答仍可为有效结果；OR 指定 OpenAI 路由不继承该拒答合同。`ok` 只代表调用有效，业务采用与语义正确性由 agent 复核。

本地命令的 `meta.attempts` 均为 0，不含推理答案；按命令读取 `result`：

| 命令 | `result` 与留存状态 |
| --- | --- |
| `doctor` | 本地配置与凭据前置诊断，不输出凭据值 |
| `json/ask --dry-run` | `{endpoint,adapterContract,request,headers,manifest}`；`request` 是实际 wire，`headers` 仅含非秘密实验头 |
| `stats` | [只读统计](statistics.md#输出与统计口径)，不带 `meta.persistence` |

预览的 `manifest` 包含 renderer、题目 ID／ordinal／type／可选 wire name、图片 path／reference／scope／width／height／bytes 及 longContext，不含凭据。wire 和 manifest 中的输入材料仍受正文权限约束。

原生响应先由所选 adapter 校验，再生成 normalized。直接 `openai-decisions` 按数组顺序和不透明题名关联，predicate／choice／score／refusal 分流，概率按 value 关联而非按返回顺序配对。下列为 state/questions answers map 合同的校验基线：

1. 可解析且 model 可识别；答案 ID 集合与请求一致，type 对应问题。
2. Noul 为有限 0–1 数值；Choice 选中项与概率键对应候选；Score 范围、概率键和 legend 对应等级。
3. `probabilities` 的每项数值与 `confidence` 均为有限 0–1 数值。

CLI 只校验响应 schema 及其与请求的对应关系，不校验概率总和、`choice` 是否为最大概率项或 `score` 是否等于概率加权结果。`score`、`choice`、`probabilities` 和 `confidence` 均原样保留，不重算、归一化或补造；schema 有效不证明模型判断正确。

Score legend 键须为 `"0"` 至 `"n-1"`；字符串等级精确对应，结构化等级匹配与原值保留规则由[原答与统一结果合同](protocol-adapters.md#原答统一结果与采用)承接。

违反上述条件返回 `invalid_response`；不通过改选、归一化或重发制造有效答案。

协议校验失败的 `error.message` 保留固定协议位置与静态原因。答案位置按请求中的原始问题顺序使用从 0 开始的序号，如 `response.answers[0].noul`；JSON 词法、重复键与数值精度错误统一定位为 `response.json`。诊断不输出问题 ID、远端键或字段值。

## 技术失败

推理／前置失败返回 `ok: false`、`result: null`，不提供可采用的 normalized。日志写入失败另按退出 4 处理，不丢弃已经获得的有效服务结果。以下为虚构响应：

```json
{
  "ok": false,
  "result": null,
  "meta": { "attempts": 1, "elapsedMs": 15000 },
  "error": {
    "kind": "timeout",
    "message": "请求等待超时；服务端是否完成处理未知。",
    "httpStatus": null
  }
}
```

| 退出码 | error.kind | 调用方处理 |
| --- | --- | --- |
| 0 | 无 | 消费有效响应，或确认 doctor／dry-run／stats 的本地结果 |
| 2 | `configuration`、`input` | 修正配置或输入，此次未发送 |
| 3 | `authentication` | 核对凭据 |
| 3 | `rate_limit` | 结合服务等待信号和预算决定后续调用 |
| 3 | `timeout`、`network`、`http` | 报告技术失败，评估是否再次发送；可能已处理或计费 |
| 3 | `invalid_response` | 保留异常状态，与模型的否定或不确定答案分开 |
| 4 | `storage`，stats、attempts 为 0、无 persistence | 无法只读打开库或完成统计；按[统计契约](statistics.md)核对已有库、schema、权限与资源预算，未返回截断或空统计 |
| 4 | `storage`，推理、attempts 为 0 | 发送前无法提交记录，此次未发送；核对日志路径、schema、权限、空间或锁占用，旧库按[旧库处理](call-logging.md#当前格式与旧库处理)选择是否保留历史 |
| 4 | 保留原推理 error 或 null，attempts 为 1 | 发送后持久化失败，`meta.persistence.status` 为 `failed`；保留输出并检查数据库，不因日志错误自动重发 |

`error.httpStatus` 有 HTTP 状态码时保留，否则为 null；支持时提供脱敏的 `retryAfterMs`，CLI 仍不自动重试。未知参数、冲突输入来源或缺少必填项均为 `input` 错误。

退出 4 优先于远端退出码：有效响应仍为 `ok: true`、完整 `result`、`error: null`；远端失败仍保留其 `error.kind`。`ok` 描述本地结果／推理是否成功，`meta.persistence` 描述日志写入，不能只检查其中一个。发送前建库失败可能没有 `callId`；发送后的失败保留该 ID。CLI 的 stderr 提醒保存当前输出，但不输出底层数据库异常中的任意数据。

## 验证边界

本地检查与预览只验证配置和请求前置；真实调用还会按上述契约验证响应。它们不证明目标任务的语义正确性或整体收益，采用条件按 [JEV 使用边界与任务验证](jev-characteristics.md)核对。

日志状态仅证明其已提交内容，故障后的可恢复范围按[调用日志](call-logging.md#恢复与只读核对)核对。后续调用、数据保留策略、统计解读和业务动作仍由调用方负责。

维护接口或核对兼容性时，分别核对所选 adapter 的专用协议；JEV 查 [System One 兼容通道](https://openrouter.ai/docs/guides/community/typesafe-sdk)、[API reference](https://docs.typesafe.ai/api) 与 [Primitives](https://docs.typesafe.ai/primitives)，并分别核对当前通道支持与实际响应。
