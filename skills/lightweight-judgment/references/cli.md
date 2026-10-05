# CLI 操作契约

本文是随 skill 分发的 CLI 操作 owner，定义运行、配置、输入输出、校验和错误处理。可选 SQLite 留存与恢复由 [调用日志](call-logging.md) 承接，离线统计由[统计契约](statistics.md)承接。

使用 Node.js 24.18 或更新版本直接运行 `scripts/lightweight-judgment.mjs`，无需全局安装或项目依赖。下列绝对路径均为占位示例，调用前替换为实际路径；仓库内使用 `bun run lightweight-judgment -- <command> [参数]`。

## 职责与通道

CLI 负责配置、输入、鉴权、请求发送、响应校验、可选调用持久化与结构化输出；业务问题、结果采用和后续动作由 agent 负责。

默认通道为 OpenRouter `https://openrouter.ai/api/v1/systemone`，默认模型 `typesafe/jev-1.13`；自定义 endpoint 也须兼容原生 System One 请求与响应。每次 `json` 或 `ask` 接收一个 state 与一组问题，本地校验通过后发送一次 HTTP 请求。不同 state 分次调用；拆题、后续调用与模型／服务选择由调用方显式决定。

首次正式调用按“配置 → `doctor` → `json --dry-run`／`ask --dry-run` → 正式调用 → 检查输出与退出码”核对。只需预览请求时直接使用 `--dry-run`，无需密钥或先通过 `doctor`。`doctor` 和预览均离线，不能证明服务可用；历史统计按 `stats` 路径执行。

## 配置

### 文件与默认值

配置文件按优先级选择一个，不跨文件合并：

1. 全局 `--config <path>`。
2. 环境变量 `LIGHTWEIGHT_JUDGMENT_CONFIG`。
3. 用户目录的 `.config/lightweight-judgment/config.json`。

显式选择的文件缺失时报错；默认文件缺失时使用默认值。选中的现有文件不可读或无效均报错。字段可省略，未知字段拒绝；默认值如下：

```json
{
  "endpoint": "https://openrouter.ai/api/v1/systemone",
  "model": "typesafe/jev-1.13",
  "apiKeyEnv": "OPENROUTER_API_KEY",
  "timeoutMs": 15000,
  "logging": {
    "enabled": false,
    "databasePath": "~/.local/share/lightweight-judgment/calls.sqlite3",
    "saveRequest": false,
    "saveResponse": true
  }
}
```

### 连接与凭据

`endpoint` 须为完整 URL，不自动拼接路径；`--endpoint <URL>` 可覆盖本次调用，配置值仍须合法。允许 HTTPS，以及 `localhost`、`127.0.0.1`、`[::1]` 的 HTTP；拒绝 URL 中的用户名、密码、查询参数与片段。自定义服务仍须满足本契约的请求、响应和 JEV 型号规则；更换接收方须先确认外发授权。

凭据来源按以下顺序选择：

1. 配置中的可选 `apiKey`；提供时直接使用，不回退到环境密钥。
2. 未提供 `apiKey` 时，读取 `apiKeyEnv` 指定的环境变量。变量名须以字母或下划线开头，后接字母、数字或下划线。

两种来源的密钥均须为非空、无空白的可打印 ASCII 字符；显式空值报错。优先用环境变量避免明文配置留存；确需 `apiKey` 时使用仓库外的私有文件，不放入版本控制。CLI 不提供会暴露于进程参数的 `--api-key`，不输出密钥值。

所有调用均非交互式，配置创建和凭据注入由使用者显式完成。请求数据不能覆盖 endpoint、凭据来源、超时或日志设置；CLI 不自动加载项目 `.env`、写入配置、跟随重定向转发凭据或尝试其他账号。

### 模型与超时

`model` 接受 bare `jev-*`、作者前缀 `typesafe/jev-*` 与 namespaced alias `~typesafe/jev-*` 形状的 JEV 标识，原样发送；本地形状校验不证明该标识当前可用。

`model` 优先级为 `--model` > 请求中的 model > 配置；各来源须先通过自身校验，覆盖只决定发送值。实际版本以响应为准。

`timeoutMs` 须为 1–2147483647 的整数；`--timeout-ms` 仅覆盖本次等待。15 秒是操作默认值而非实测最优值或 SLA。

### 可选调用日志

日志默认关闭；设置 `logging.enabled: true` 后，真实推理通过输入和凭据校验才创建或打开 SQLite 库。`help`、`doctor`、`dry-run` 均不访问数据库。开启前按 [调用日志](call-logging.md) 确认正文留存、私有路径与数据权限。

启用后先提交发送意图，再调用 HTTP；检查结果时同时检查 `meta.persistence` 和退出码。存储失败使用退出 4，保留已知远端结果，具体处理见下方“技术失败”。

## 命令与输入

### `doctor`：本地前置检查

```bash
node /absolute/path/lightweight-judgment/scripts/lightweight-judgment.mjs doctor
node /absolute/path/lightweight-judgment/scripts/lightweight-judgment.mjs --config /absolute/private/judgment.json doctor
```

成功时报告配置位置、endpoint、模型、超时、密钥变量名、`credentialSource`（config／environment）、密钥存在及解析后的 logging 设置；秘密值、长度和前后缀均不输出。配置非法或本地密钥缺失／无效时返回 `configuration`、退出 2，attempts 为 0；普通推理具有同一前置行为。此命令只证明本地配置与凭据前置满足，不证明服务可用或存储可写。

### `json`：完整请求

输入恰选一种，stdin 须显式指定 `-`：

```bash
node /absolute/path/lightweight-judgment/scripts/lightweight-judgment.mjs json --file /absolute/path/request.json
node /absolute/path/lightweight-judgment/scripts/lightweight-judgment.mjs json - < /absolute/path/request.json
node /absolute/path/lightweight-judgment/scripts/lightweight-judgment.mjs json --json '{"state":"请回退版本","questions":{"rollback":{"type":"noul","instructions":"是否明确请求回退版本？"}}}'
```

输入为 UTF-8 单个 JSON 对象，不接受 JSONL；顶层接受 `state`、非空 `questions` 和可选 `model`。CLI 补齐 model 后发送原生 System One 请求，保留输入类型、文本与候选顺序，不增加聊天 messages 包装或隐式转换 state。

- `state` 为字符串、对象或数组；其中的路径与 URL 仅作数据，不触发文件读取或网络抓取。
- 每题仅接受 `type`、`instructions`、`criteria`；必填前两项，`instructions` 为字符串、对象或数组。`type` 为 `choice`、`score` 或 `noul`，对应 criteria 如下。
- JSON 最大嵌套 128 层；数值须有限、整数须安全且能按十进制值无损往返 JSON；拒绝下溢、负零与额外精度。需要精确数值时使用字符串。
- 非法 UTF-8、非法 JSON、重复对象键、封闭字段集合中的未知字段、非法 state、空问题集合、非法题型或 criteria 均拒绝，错误定位字段路径；超出实现精度或范围的值拒绝而非改写。

| type | criteria |
| --- | --- |
| `choice` | 必填候选映射，1–255 个候选；候选值为字符串、对象、数组或 null |
| `score` | 必填有序等级数组，2–10 个等级；等级为字符串、对象或数组 |
| `noul` | 可省略；提供时为只含 `true`／`false` 的对象，两字段均可省略，条件为字符串、对象或数组 |

共享 state 的双题示例，可保存后通过 `json --file` 发送：

```json
{
  "state": { "message": "升级后启动失败，提示配置字段不存在。" },
  "questions": {
    "category": {
      "type": "choice",
      "instructions": "根据 message，选择最适合的问题类别。",
      "criteria": {
        "configuration": "配置字段、格式或配置兼容性问题",
        "network": "连接、域名解析或服务可达性问题",
        "other": "信息足够，但不属于以上类别",
        "unclear": "信息不足，无法判断类别"
      }
    },
    "requests_rollback": {
      "type": "noul",
      "instructions": "message 是否明确请求回退旧版本？只判断是否提出请求。"
    }
  }
}
```

两题共享材料、独立作答：`category` 的 `unclear` 与 `other` 分别保留缺证和无匹配出口；`requests_rollback` 只判断是否提出请求。具体路由与回退授权由原任务决定。

### `ask`：单题参数

必填 `--type choice|score|noul` 与 `--question <text>`；`--id` 默认 `answer`，仅关联结果。

上下文恰选一种：`--text`、`--text-file` 形成字符串 state；`--state-json`、`--state-file` 按 JSON 解析并保留原生形状。解析模式由参数而非扩展名决定。

```bash
node /absolute/path/lightweight-judgment/scripts/lightweight-judgment.mjs ask --type choice \
  --text-file /absolute/path/message.txt \
  --question "这段文本主要属于哪类请求？" \
  --option "bug=报告软件故障" \
  --option "feature=请求新增能力" \
  --option "other=信息足够，但不属于以上类别" \
  --option "unclear=信息不足"

node /absolute/path/lightweight-judgment/scripts/lightweight-judgment.mjs ask --type score \
  --text-file /absolute/path/message.txt \
  --question "这段文本表达的紧迫程度如何？" \
  --level "未提出时限或急迫要求" \
  --level "希望尽快处理，但未要求立即处理" \
  --level "明确要求立即处理"

node /absolute/path/lightweight-judgment/scripts/lightweight-judgment.mjs ask --type noul \
  --text "请把刚才的版本回退。" \
  --question "是否明确请求回退版本？"
```

Choice 重复 `--option key=description`，按第一个等号分隔，键唯一；Score 重复 `--level`，顺序即等级。不同题型的 criteria 参数不可混用。复杂 instructions、结构化 criteria、Noul 的 true／false 定义及多题使用 `json`。

### `stats`：离线日志统计

用 `stats` 汇总已有日志的用量／耗时，并按模型、状态、标签或批次比较。直接运行 `stats` 使用配置中的日志路径；`stats --database /absolute/private/calls.sqlite3` 跳过配置。此命令只读、不要求密钥或发送请求；筛选、分组、分桶、输出和解读见[离线调用统计](statistics.md)。

### 推理参数与帮助

下表按 `json`／`ask` 解释参数；`stats` 的 `--endpoint`、`--run-id`、`--tag` 用于日志筛选，见[统计参数](statistics.md#筛选分组与分桶)。`--help` 适用于所有命令。

| 参数 | 行为 |
| --- | --- |
| `--endpoint <URL>` | 覆盖本次完整 System One 地址，受连接规则约束 |
| `--model <id>` | 覆盖本次 JEV 请求标识 |
| `--timeout-ms <positive-integer>` | 1–2147483647 毫秒，从发送到完整响应的本次等待上限 |
| `--run-id <id>` / `--run-index <n>` | 仅 json／ask，成对提供的本地批次 ID／从 1 开始的顺序；留存与校验见[本地元数据](statistics.md#记录本地批次与标签) |
| `--tag key=value` | 可重复的本地标签；留存与校验见[本地元数据](statistics.md#记录本地批次与标签) |
| `--dry-run` | 仅用于 `json`／`ask`：解析配置与输入、补齐 model、本地校验，输出 endpoint 与最终请求；不读取环境密钥、不要求密钥存在、不联网或建库 |
| `--help` | 展示命令、配置来源、离线示例和退出语义，不读取配置、输入或凭据，不联网 |

例如 `node /absolute/path/lightweight-judgment/scripts/lightweight-judgment.mjs json --file /absolute/path/request.json --dry-run`。预览仍读取并校验选中的配置文件，包括其中可选的 apiKey，但不将密钥放入输出；输出含待发正文。长文本与敏感材料优先通过文件或 stdin 输入，输出按数据权限处理，避免命令历史和公共日志泄露。

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
  "meta": { "requestModel": "typesafe/jev-1.13", "elapsedMs": 350, "attempts": 1 },
  "error": null
}
```

- `result` 保留完整有效响应：实际 model、answers、各原语的概率／confidence／legend，以及服务端提供的 usage、id、provider。缺失的字段、费用、解释或 confidence 不予补造。
- `meta.elapsedMs` 为本次客户端请求耗时，`attempts` 为实际发送次数。
- 推理进入日志写入阶段后，`meta.persistence.status` 为 `recorded` 或 `failed`，表示本次持久化是否完整成功；有调用记录时用 `callId` 关联数据库。存储失败的退出与结果保留规则见下方。
- `stats` 的 result 为[只读统计](statistics.md#输出与统计口径)，attempts 为 0，不带 `meta.persistence`。`doctor` 的 result 为配置诊断；`--dry-run` 的 result 为 `{ "endpoint": ..., "request": ... }`。二者 attempts 为 0，不含 answers。
- 否定、`unclear` 或低 confidence 仍是有效结果；`ok` 只代表调用有效，业务采用与语义正确性由 agent 复核。

有效响应须满足：

1. 可解析且 model 可识别；答案 ID 集合与请求一致，type 对应问题。
2. Noul 为有限 0–1 数值；Choice 选中项与概率键对应候选；Score 范围、概率键和 legend 对应等级。
3. `probabilities` 的每项数值与 `confidence` 均为有限 0–1 数值。

CLI 只校验响应 schema 及其与请求的对应关系，不校验概率总和、`choice` 是否为最大概率项或 `score` 是否等于概率加权结果。`score`、`choice`、`probabilities` 和 `confidence` 均原样保留，不重算、归一化或补造；schema 有效不证明模型判断正确。

Score legend 键须为 `"0"` 至 `"n-1"`，值须为字符串；字符串等级精确对应，结构化等级的服务端 legend 文本编码未由官方定义，因此只检查键与值类型，不猜测其序列化。

违反上述条件返回 `invalid_response`；不通过改选、归一化或重发制造有效答案。

协议校验失败的 `error.message` 保留固定协议位置与静态原因。答案位置按请求中的原始问题顺序使用从 0 开始的序号，如 `response.answers[0].noul`；JSON 词法、重复键与数值精度错误统一定位为 `response.json`。诊断不输出问题 ID、远端键或字段值。

## 技术失败

推理／前置失败返回 `ok: false`、`result: null`。日志写入失败另按退出 4 处理，不丢弃已经获得的有效服务结果。以下为虚构响应：

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
| 4 | `storage`，推理、attempts 为 0 | 发送前无法提交记录，此次未发送；修复日志路径、权限、空间或锁占用 |
| 4 | 保留原推理 error 或 null，attempts 为 1 | 发送后持久化失败，`meta.persistence.status` 为 `failed`；保留输出并检查数据库，不因日志错误自动重发 |

`error.httpStatus` 有 HTTP 状态码时保留，否则为 null；支持时提供脱敏的 `retryAfterMs`，CLI 仍不自动重试。未知参数、冲突输入来源或缺少必填项均为 `input` 错误。

退出 4 优先于远端退出码：有效响应仍为 `ok: true`、完整 `result`、`error: null`；远端失败仍保留其 `error.kind`。`ok` 描述本地结果／推理是否成功，`meta.persistence` 描述日志写入，不能只检查其中一个。发送前建库失败可能没有 `callId`；发送后的失败保留该 ID。CLI 的 stderr 提醒保存当前输出，但不输出底层数据库异常中的任意数据。

## 验证边界

本地源码测试、模拟网络和独立 Node 进程验证 CLI 接口与分发边界。它们不证明真实服务的鉴权、余额、延迟或当前模型语义表现；采用结果时另按 [JEV 证据](jev-characteristics.md) 的任务与版本边界验证。

- 输入与配置：各输入方式等价，类型和顺序保留；配置优先级正确，非法输入与缺密钥在联网前失败，离线命令不发送请求。
- 调用与响应：每次只发送一次，共享 state 多题正确关联；有效的否定／未知／低 confidence 与协议、鉴权、限流、超时失败分别处理。
- 持久化：覆盖日志开关、正文独立留存、自动建库、发送前提交、并发追加、SIGKILL 后读取和存储失败结果保留。

后续调用、数据保留策略、统计解读和业务动作仍由调用方负责。

维护接口或核对兼容性时查 [System One 兼容通道](https://openrouter.ai/docs/guides/community/typesafe-sdk)、[API reference](https://docs.typesafe.ai/api) 与 [Primitives](https://docs.typesafe.ai/primitives)，并分别核对当前通道支持与实际响应。
