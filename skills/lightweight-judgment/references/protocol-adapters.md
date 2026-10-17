# 接入合同、转换与模态

本文承接统一 JEV 载体到各接收方的编译、能力及采用边界。配置、调用、输出和错误见 [CLI 操作契约](cli.md)；日志中的历史合同身份见[调用日志](call-logging.md)。本地合同支持不等于远端账号可用或目标任务质量已验证。

## 数据层与读取范围

| 名称 | 含义与用途 |
| --- | --- |
| carrier（统一载体） | 调用方提供的 JEV `state/questions`，连同最终 model；表达原问题、候选和证据作用域 |
| wire（实际请求） | 所选 adapter 编译后发送的 JSON；可能与 carrier 相同，也可能包含转换模板、assets 或原生 OAI 题目数组 |
| `result`（原答／raw） | 完整有效的 provider 响应 JSON 值，保持原字段与值；不等于 HTTP 响应的原始字节 |
| `normalized`（统一结果） | 从有效原答映回原题 ID 的独立消费层；不覆盖原答，也不证明跨模型行为等价 |

选路先读下一节；构造直接 OpenAI 文本读“文本与结构化输入”，非文本请求再读对应模态节；消费答案读“原答、统一结果与采用”。留存 wire、carrier 或原始响应字节时，另按[调用日志](call-logging.md)取得正文留存权限。

## 选择合同

`adapter` 仅来自可信私有配置；请求正文不能切换合同、接收方、凭据或实验选项。`adapterContract` 为 adapter 值加 `/v1`，版本表达 wire 与转换语义，不是模型或日志 schema 版本。

| adapter | 实际 wire | 支持范围 |
| --- | --- | --- |
| `openrouter-systemone` | OpenRouter System One state/questions | 文本 Choice、Score、Noul |
| `typesafe` | TypeSafe state/questions；图片另编译为 UUID 引用与 assets | JEV 文本、图片及符合条件的 Box |
| `openrouter-decisions` | OpenRouter alpha state/questions | JEV 文本、嵌套图片与符合条件的 Box；指定 OpenAI 型号受下述限制 |
| `openai-decisions` | OpenAI Decisions input/questions | Choice、Score、Noul 自动编译；图片仅限共享 state，无 Box |

缺省 adapter 为 `openrouter-systemone`，沿用其默认 endpoint、model 与凭据环境变量；其他三个 adapter 均须显式提供完整 endpoint、目标服务原生 model，以及 apiKey 或 apiKeyEnv，见 [CLI 配置](cli.md#配置)。自定义地址表示调用方声明兼容，hostname 不决定 adapter。切换合同或接收方须在当前外发、费用与数据权限内；OpenRouter 还会转发上游。

`openrouter-decisions` 除 JEV 标识外，另支持 `openai/gpt-6-luna-decisions` 的 OpenRouter state/questions 与 answers map 合同；它不是直接 OAI wire，也不走下节的 input/questions 编译。该型号限制为至多 200 题、Choice 至少 2 候选、至多 128 张共享 state 图片，拒绝局部图片、Box 和 longContext=true。远端 HTTP 错误按 [CLI 技术失败](cli.md#技术失败)处理，不能作为有效模型答案采用。

## 文本与结构化输入

JEV 通道与 `openrouter-decisions` 的指定 OpenAI 路由均保持 state/questions wire。以下编译规则仅指直接 OAI adapter `openai-decisions`：按原问题顺序生成题目数组及不透明题名，再在本地映回原 ID，不要求模型复述身份。转换保持完整值与原序，不摘取 `question`、`focus` 等特权字段：

- 字符串保留字面内容；对象／数组完整编码成带类型与引用规则的 JSON 文本。`state.*` 仍指原共享根，结构化 instructions 内引用仍指局部根；数组不会被猜成聊天 messages。
- Choice 原键成为 string value，null 候选说明保持“无额外说明”，不删除候选；OAI 须 2–255 候选，单候选整次拒绝。
- Score 保留等级顺序；结构化等级通过完整 description 表达，标签不代替身份；不得用重算 score 或 provider label 替换原 rubric。
- Noul 映射 predicate；可省略、显式空及单侧 true/false criteria 不混同，不反转肯定极性。
- 直接 OAI 每次 1–200 题；instructions、候选 description、Score label／description 各至多 1,048,576 个 UTF-16 code unit，input_text 至多 10,485,760 个 UTF-16 code unit；不自动拆分超限请求。严格 JSON 的原成员序、类型、重复键与精度约束继续适用。

这种转换保持可恢复信息，不证明不同模型的读法、概率校准或业务阈值等价。输入中的任务改写、shell、路径或 URL 始终是被判断数据，不成为执行指令。

## 图片节点与作用域

仅支持下列显式节点；`url` 为完整内联 PNG 或 JPEG data URL，不是文件路径、远程链接或无前缀 Base64：

```json
{"type":"image_url","image_url":{"url":"data:image/png;base64,..."}}
```

示例中的 `...` 是占位，不是合法图片。图片由可信配置 `images: true` 启用；普通字符串、路径和 URL 不读盘或抓取。遍历范围包括 state、每题 instructions 与全部 criteria；关闭时仍扫描潜在可解释图像节点并在发送前拒绝，不原样透传后假称已关闭。同形 JSON 若本意是普通数据，当前无 literal 转义入口，须改用无歧义表示或停止。

- `typesafe` 收集显式节点并以不与原字符串碰撞的 UUID 引用替换，生成 JSON assets；发送 `TypeSafe-Danger-Zone-Images: true`。
- `openrouter-decisions` 的 JEV 模型保留节点和所属题目，不把局部图片提升为全题共享证据；OpenAI 型号拒绝局部图。
- `openai-decisions` 将 state 图片编译为带路径关联的共享 input_image；按实际出现次数限制为至多 128 张。instructions／criteria 有局部图片时整次拒绝，不暗中全题共享或逐题发送。
- `openrouter-systemone` 图片整次拒绝。该拒绝是本工具合同边界，不宣称服务端永远不支持图片。

只接受静态 PNG/JPEG，不裁切、缩放、旋转或以 OCR／文字描述替代像素。Base64 仍包含完整图像；dry-run、carrier、wire 与日志均按正文权限处理。本地对全部通道采用单图解码后 16 MiB 的保守上限，不声称这是 OAI 服务公开硬限；TypeSafe／OR JEV 另要求宽高各 280–1568、总像素 78,400–2,458,624。签名、尺寸或本地 body 检查不保证远端 codec、重编码后预算、朝向、图像 token 计量或质量。

## JEV Box

Box 使用 `type: "box"` 与 instructions，不接受 criteria；须选支持它的 JEV 1.14 模型、启用图片且请求实际含图。通过 `json` 提交复杂材料。OAI 或 legacy 合同任一题为 Box 时整次拒绝；不以其他题型、离散坐标或另一 API 降级。

有效 Box 原答包含归一化 `top,bottom,left,right`（均在 [0,1]，`left < right`、`top < bottom`）及 [0,1] confidence；不 clamp、补边或重排冒充原答。Box 没有 not-found：框不证明目标存在，必要时另问 Noul 并验证采用阈值。坐标只能应用于实际发送像素，后续裁图、保存或发布仍服从原任务授权。

## 长上下文

`longContext` 为可信配置布尔值，默认 false；不由 state 或题目指令开启，不提供隐式截断、丢题、重试或换服务。

- `typesafe` 显式开启时发送 `TypeSafe-Danger-Zone-Long-Context: true`；关闭时不发送该头。
- `openrouter-decisions` 的 JEV 模型使用图片或完整 carrier JSON 超过 32,000 UTF-8 字节时，本工具要求 `longContext: true`，以显式接受上游自动长上下文；这是保守的整载体字节门禁，不是纯文本字节或 token 窗口估算。
- 直接 OAI 与 OR 的指定 OpenAI 路由不接收 TypeSafe 实验头，并拒绝 longContext=true，因为没有本工具支持的此类 opt-in；不由此限制实际原生容量，也不从一般模型页推导保证。legacy 的任一实验开关 true 也以 configuration 拒绝。

服务公布容量、HTTP 接收、长程证据利用、延迟和费用是不同证据。长输入与图片可能增加费用／耗时；本地校验无法精确证明全部服务预算，超限保留技术失败而不修改请求。

## 原答、统一结果与采用

`result` 保留完整有效 provider 响应；顶层 `normalized` 单列 `version: "1"`、`adapterContract`、实际 `model`、`completion` 与原题 ID 的 answers。每个 answered 答案显式标 `status: "answered"` 与原题 type。

统一答案值按原题型读取：

| type | answered 字段（除 status/type） |
| --- | --- |
| `noul` | noul |
| `choice` | choice、probabilities、confidence |
| `score` | score、probabilities、confidence、requestRubric，以及下述合同专属等级字段 |
| `box` | box:{top,bottom,left,right}、confidence |

### Score 的原量尺与服务字段

- `requestRubric` 保存原请求的完整有序等级数组，来源是请求，不是服务返回。
- state/questions 的 answers map 合同另保留原生 `legend`。字符串等级须精确对应；结构化等级接受匹配的 JSON 值或服务渲染字符串。JSON 对象成员重排不改变匹配，数组顺序仍有意义；请求发送保留原成员序，`result` 与 `normalized.legend` 保留服务原值及成员序。
- 仅直接 `openai-decisions` 以 `providerLabels` 记录索引到服务标签的映射；服务标签不替代 `requestRubric`。

### 完成度与逐题拒答

仅直接 `openai-decisions` 的原生数组合同支持逐题 refusal：统一为 `status: "refused"`、`requestedType`，不填 false、0、0.5、低 confidence 或替代候选。其 `completion` 为 `complete`（全答）、`partial`（混合）或 `refused`（全拒）；合法混合／全拒可为 `ok: true`、退出 0 和日志 succeeded。消费时先检查完成度与逐题状态，再读取 answered 值。

state/questions 的 answers map 合同只接受相应题型的完整答案集；这包括 OR 的指定 OpenAI 路由，不因模型属于 OpenAI 就继承直接 OAI 的 refusal 合同。收到 map `type: "refusal"` 会按 invalid_response 拒绝。所有合同的缺题、关联错、重复候选或非法数值也都是 invalid_response，不作为合法部分结果采用。

### 保真与采用边界

原概率、choice、score、confidence 和 usage 保持原值，不归一化或补造；校准与采用阈值按[目标任务验证](jev-characteristics.md#按目标任务验证)分别核对。原生未知字段保留在 `result`，统一层不替代原生响应证据；响应原始字节仅由获授权的正文日志留存。
