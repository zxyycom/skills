# CLI 配置与连接

本文供首次配置、更换接收方或核对连接与凭据时使用，承接 CLI 配置来源、默认值与约束。日常调用和输出见 [CLI 操作契约](cli.md)，能力与转换见[接入合同与模态](protocol-adapters.md)。

## 配置

### 文件与默认值

配置文件按优先级选择一个，不跨文件合并：

1. 全局 `--config <path>`。
2. 环境变量 `LIGHTWEIGHT_JUDGMENT_CONFIG`。
3. 用户目录的 `.config/lightweight-judgment/config.json`。

显式选择的文件缺失时报错；默认文件缺失时使用默认值。选中的现有文件不可读或无效均报错。未知字段拒绝；缺省 adapter 的兼容默认值如下：

```json
{
  "adapter": "openrouter-systemone",
  "images": false,
  "longContext": false,
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

`adapter` 另可为 `typesafe`、`openrouter-decisions`、`openai-decisions`。选择这些 adapter 时必须显式提供 endpoint、model，以及 apiKey 或 apiKeyEnv；不继承 `openrouter-systemone` 的默认地址、模型或密钥变量。选合同后再验证各来源，未知合同与非法组合在发送前拒绝。`images`、`longContext` 均为布尔值，默认 false，仅由可信配置设置，没有同名推理 CLI 开关；支持组合见[模态合同](protocol-adapters.md)。

例如仓库外 OAI 私有配置（地址与 model 仍须按实际账号核对，本例不证明可用）：

```json
{
  "adapter": "openai-decisions",
  "endpoint": "https://api.openai.com/v1/decisions",
  "model": "gpt-6-luna",
  "apiKeyEnv": "OPENAI_API_KEY"
}
```

### 连接与凭据

`endpoint` 须为完整 URL，不自动拼接路径；`--endpoint <URL>` 可覆盖本次调用，配置值仍须合法。允许 HTTPS，以及 `localhost`、`127.0.0.1`、`[::1]` 的 HTTP；拒绝 URL 中的用户名、密码、查询参数与片段。自定义服务仍须兼容所选 adapter；endpoint 覆盖不重选合同或凭据，不由 hostname 推断协议；更换接收方须先确认外发授权。

凭据来源按以下顺序选择：

1. 配置中的可选 `apiKey`；提供时直接使用，不回退到环境密钥。
2. 未提供 `apiKey` 时，读取 `apiKeyEnv` 指定的环境变量。变量名须以字母或下划线开头，后接字母、数字或下划线。

两种来源的密钥均须为非空、无空白的可打印 ASCII 字符；显式空值报错。优先用环境变量避免明文配置留存；确需 `apiKey` 时使用仓库外的私有文件，不放入版本控制。CLI 不提供会暴露于进程参数的 `--api-key`，不输出密钥值。

所有调用均非交互式，配置创建和凭据注入由使用者显式完成。请求数据不能覆盖 endpoint、凭据来源、超时或日志设置；CLI 不自动加载项目 `.env`、写入配置、跟随重定向转发凭据或尝试其他账号。

### 模型与超时

JEV 模型接受 bare `jev-*`、作者前缀 `typesafe/jev-*` 与 namespaced alias `~typesafe/jev-*` 形状的 JEV 标识，原样发送；`openrouter-decisions` 另支持 `openai/gpt-6-luna-decisions` 并按其模型级能力门禁，见[选择合同](protocol-adapters.md#选择合同)。直接 OAI 使用自身模型标识，不把 JEV 名翻译为 OAI 名。本地形状校验不证明标识当前可用。

`model` 优先级为 `--model` > 请求中的 model > 配置；各来源须先通过自身校验，覆盖只决定发送值。实际版本以响应为准。

`timeoutMs` 须为 1–2147483647 的整数；`--timeout-ms` 仅覆盖本次等待。15 秒是操作默认值而非实测最优值或 SLA。

### 可选调用日志

日志默认关闭；设置 `logging.enabled: true` 后，真实推理通过输入和凭据校验才创建或打开 SQLite 库。`help`、`doctor`、`dry-run` 均不访问数据库。开启前按 [调用日志](call-logging.md) 确认正文留存、私有路径与数据权限。

启用后先提交发送意图，再调用 HTTP；检查结果时同时检查 `meta.persistence` 和退出码。正常读写只接受当前日志结构；遇到旧库，按[旧库处理](call-logging.md#当前格式与旧库处理)选择重新建库或保留数据的迁移。存储失败使用退出 4，保留已知远端结果，具体处理见 [CLI 技术失败](cli.md#技术失败)。
