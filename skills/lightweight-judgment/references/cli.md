# CLI 操作契约

本文是随 skill 分发的 CLI 操作 owner，定义运行、配置、输入输出、校验和错误处理。使用 Node.js 24.18 或更新版本直接运行 `scripts/lightweight-judgment.mjs`，无需全局安装或项目依赖。下列绝对路径均为占位示例，调用前替换为实际路径；仓库内使用 `bun run lightweight-judgment -- <command> [参数]`。

## 职责与通道

CLI 负责配置、输入、鉴权、请求发送、响应校验与结构化输出；业务问题、结果采用和后续动作由 agent 负责。

当前通道固定为 OpenRouter `https://openrouter.ai/api/v1/systemone`，默认模型 `typesafe/jev-1.13`。每次 `json` 或 `ask` 接收一个 state 与一组问题，本地校验通过后发送一次 HTTP 请求；不自动拆题、重试、投票或切换模型／服务。不同 state 分次调用，输入格式为单个 JSON 对象，不接受 JSONL 批处理。

## 配置

配置文件按优先级选择一个，不跨文件合并：

1. 全局 `--config <path>`。
2. 环境变量 `LIGHTWEIGHT_JUDGMENT_CONFIG`。
3. 用户目录的 `.config/lightweight-judgment/config.json`。

显式选择的文件缺失时报错；默认文件缺失时使用默认值。选中的现有文件不可读或无效均报错。字段可省略，未知字段拒绝；默认值如下：

```json
{
  "model": "typesafe/jev-1.13",
  "apiKeyEnv": "OPENROUTER_API_KEY",
  "timeoutMs": 15000
}
```

`model` 接受 bare `jev-*`、作者前缀 `typesafe/jev-*` 与 namespaced alias `~typesafe/jev-*` 形状的 JEV 标识，原样发送；本地形状校验不证明该标识当前可用。

`model` 优先级为 `--model` > 请求中的 model > 配置；各来源须先通过自身校验，覆盖只决定发送值。实际版本以响应为准。`--timeout-ms` 仅覆盖本次等待，15 秒是操作默认值而非实测最优值或 SLA。

`apiKeyEnv` 须为合法环境变量名（字母或下划线开头，后接字母、数字或下划线）；`timeoutMs` 须为 1–2147483647 的整数。

密钥仅从 `apiKeyEnv` 指定的环境变量读取，配置保存变量名。所有调用均非交互式，配置创建和凭据注入由使用者显式完成。请求数据不能覆盖 endpoint、凭据来源、超时或日志设置；CLI 不自动加载项目 `.env`、写入配置、跟随重定向转发凭据或尝试其他账号。

## 命令与输入

### `doctor`：本地前置检查

```bash
node /absolute/path/lightweight-judgment/scripts/lightweight-judgment.mjs doctor
node /absolute/path/lightweight-judgment/scripts/lightweight-judgment.mjs --config /absolute/private/judgment.json doctor
```

成功时报告配置位置、endpoint、模型、超时、密钥变量名及密钥存在；秘密值、长度和前后缀均不输出。配置非法或本地密钥缺失／空白时返回 `configuration`、退出 2，attempts 为 0；普通推理具有同一前置行为。只有服务实际拒绝鉴权时返回 `authentication`、退出 3。此命令离线执行，成功只证明本地前置满足。

### `json`：完整请求

输入恰选一种，stdin 须显式指定 `-`：

```bash
node /absolute/path/lightweight-judgment/scripts/lightweight-judgment.mjs json --file /absolute/path/request.json
node /absolute/path/lightweight-judgment/scripts/lightweight-judgment.mjs json - < /absolute/path/request.json
node /absolute/path/lightweight-judgment/scripts/lightweight-judgment.mjs json --json '{"state":"请回退版本","questions":{"rollback":{"type":"noul","instructions":"是否明确请求回退版本？"}}}'
```

输入为 UTF-8 单个 JSON 对象，顶层接受 `state`、非空 `questions` 和可选 `model`。CLI 补齐 model 后发送原生 System One 请求，保留输入类型、文本与候选顺序，不增加聊天 messages 包装或隐式转换 state。

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
  --level "希望尽快处理，但未表达无法继续工作" \
  --level "要求立即处理且工作受阻"

node /absolute/path/lightweight-judgment/scripts/lightweight-judgment.mjs ask --type noul \
  --text "请把刚才的版本回退。" \
  --question "是否明确请求回退版本？"
```

Choice 重复 `--option key=description`，按第一个等号分隔，键唯一；Score 重复 `--level`，顺序即等级。不同题型的 criteria 参数不可混用。复杂 instructions、结构化 criteria、Noul 的 true／false 定义及多题使用 `json`。

### 通用参数

| 参数 | 行为 |
| --- | --- |
| `--model <id>` | 覆盖本次 JEV 请求标识 |
| `--timeout-ms <positive-integer>` | 1–2147483647 毫秒，从发送到完整响应的本次等待上限 |
| `--dry-run` | 仅用于 `json`／`ask`：解析配置与输入、补齐 model、本地校验，输出 endpoint 与最终请求；不读取密钥值、不要求密钥存在、不联网 |
| `--help` | 仅展示用法，不读取配置或凭据、不联网 |

例如 `node /absolute/path/lightweight-judgment/scripts/lightweight-judgment.mjs json --file /absolute/path/request.json --dry-run`。预览仍要求选中的配置文件有效，其输出含待发正文。长文本与敏感材料优先通过文件或 stdin 输入，输出按数据权限处理，避免命令历史和公共日志泄露。

## 输出与校验

除 `--help` 外，stdout 恰为一个 JSON 对象；诊断走 stderr，并移除秘密和未经处理的远端错误正文。CLI 默认不持久化正文、响应、日志数据库或结果文件；调用方可按授权重定向保存。

推理成功退出 0。以下为虚构响应：

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
- `doctor` 的 result 为配置诊断；`--dry-run` 的 result 为 `{ "endpoint": ..., "request": ... }`。二者 attempts 为 0，不含 answers。
- 否定、`unclear` 或低 confidence 仍是有效结果；`ok` 只代表调用有效，业务采用与语义正确性由 agent 复核。

有效响应须满足：

1. 可解析且 model 可识别；答案 ID 集合与请求一致，type 对应问题。
2. Noul 为有限 0–1 数值；Choice 选中项与概率键对应候选；Score 范围、概率键和 legend 对应等级。
3. 概率和 confidence 数值有效；概率归一化、Choice 最大项和 Score 加权结果一致性按明确容差检查，容差仅吸收舍入误差。

绝对容差统一为 `1e-6`（再容纳浮点 epsilon），只接受舍入量级偏差，不归一化概率；confidence 仅验证 0–1 范围，不按公式补造或重算。Score legend 键须为 `"0"` 至 `"n-1"`，值须为字符串；字符串等级精确对应，结构化等级的服务端 legend 文本编码未由官方定义，因此只检查键与值类型，不猜测其序列化。

违反上述条件返回 `invalid_response`；不通过改选、归一化或重发制造有效答案。

协议校验失败的 `error.message` 保留固定协议位置与静态原因。答案位置按请求中的原始问题顺序使用从 0 开始的序号，如 `response.answers[0].noul`；JSON 词法、重复键与数值精度错误统一定位为 `response.json`。诊断不输出问题 ID、远端键或字段值。

## 技术失败

失败返回 `ok: false`、`result: null`。以下为虚构响应：

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
| 0 | 无 | 消费有效响应，或确认 doctor／dry-run 的本地结果 |
| 2 | `configuration`、`input` | 修正配置或输入，此次未发送 |
| 3 | `authentication` | 核对凭据 |
| 3 | `rate_limit` | 结合服务等待信号和预算决定后续调用 |
| 3 | `timeout`、`network`、`http` | 报告技术失败，评估是否再次发送；可能已处理或计费 |
| 3 | `invalid_response` | 保留异常状态，与模型的否定或不确定答案分开 |

`error.httpStatus` 有 HTTP 状态码时保留，否则为 null；支持时提供脱敏的 `retryAfterMs`，CLI 仍不自动重试。未知参数、冲突输入来源或缺少必填项均为 `input` 错误。

## 验证边界

本地源码测试、模拟网络和独立 Node 进程验证 CLI 接口与分发边界。它们不证明真实服务的鉴权、余额、延迟或当前模型语义表现；采用结果时另按 [JEV 证据](jev-characteristics.md) 的任务与版本边界验证。

- 文件、stdin、内联 JSON 和等义单题参数构造相同请求，类型与顺序保留。
- 单题／共享 state 多题正确关联，后者只发送一次；配置与 model 优先级符合约定。
- 非法输入与缺密钥在联网前失败，数据不能改变接收方；doctor／dry-run 离线，dry-run 无须密钥。
- 否定、未知、低 confidence、协议异常、鉴权、限流及超时分别符合输出与退出码。
- CLI 保持单次请求与显式输出；后续调用、结果留存和业务动作由调用方负责。

维护接口或核对兼容性时查 [System One 兼容通道](https://openrouter.ai/docs/guides/community/typesafe-sdk)、[API reference](https://docs.typesafe.ai/api) 与 [Primitives](https://docs.typesafe.ai/primitives)，并分别核对当前通道支持与实际响应。
