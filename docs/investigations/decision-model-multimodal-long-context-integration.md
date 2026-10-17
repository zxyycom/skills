---
title: "决策模型图片、Box 与长上下文的传输及转换边界"
id: "261017-decision-model-multimodal-long-context-integration"
formedAt: "2026-10-17T02:40:36Z"
question: "以 JEV 为基础接入 TypeSafe、OpenRouter 与 OpenAI Decisions 时，图片、Box 和长上下文哪些可执行转换，哪些必须在发送前拒绝？"
tags:
  - "decision-models"
  - "lightweight-judgment"
  - "model-api"
  - "multimodal"
  - "semantic-fidelity"
relations:
  - type: "补充"
    target: "261015-jev-1-14-capabilities-and-comparison"
    summary: "补充图片传输、Box拒绝和长上下文接入边界"
---

## 形成时背景

[前序调查](jev-1-14-capabilities-and-comparison.md)已经确认 Jev 1.14、实验图像、Box 和长上下文的功能定位。本轮用户进一步明确：这些都是实际接入范围，需要判断怎样在现有 `state/questions` 基础载体中完整表达，并接入 TypeSafe 原生、OpenRouter 和 OpenAI Decisions；本轮为接入调查，不修改 CLI。

现有 [CLI 契约](../../skills/lightweight-judgment/references/cli.md)默认 OpenRouter `/api/v1/systemone`、Jev 1.13，只接收 `state/questions/model`，不支持顶层 assets 或 Box；state 中的路径和 URL 只是数据，不会触发文件读取或抓取。本文提出的节点、adapter 和门禁均为**调查建议，尚非当前 skill／CLI 契约**；公开能力不等于实际接入已可用。

## 调查目的

确定图片的载体、字节传输、角色和题目可见性边界；明确 Box 的模型及返回不变量、OAI 无对应原语时的拒绝策略；区分通道长上下文开关、文档容量、实际接收、效果和费用。给出可实施但尚未实施的统一推荐，并划清离线测试与待授权真服务验证。

## 调查范围与依据

本轮于 **2026-10-17 UTC**通过公开网页读取下列官方资料；它们均为读取时的 live 文档，未取得固定 Git revision，故不是永久版本承诺：

| 来源 | 本轮检查的内容 |
| --- | --- |
| [TypeSafe Images](https://docs.typesafe.ai/images) | assets、引用、JSON Base64、multipart、开关、尺寸与字节预算 |
| [TypeSafe Box](https://docs.typesafe.ai/primitives/box)、[Models](https://docs.typesafe.ai/models)、[API](https://docs.typesafe.ai/api) | 原语字段、坐标、模型别名、上下文、响应与错误 |
| [OpenRouter Multimodal Decisions](https://openrouter.ai/docs/guides/community/multimodal-decisions) | `/alpha/decisions` 图片节点、Jev 特例和通道限制 |
| [OpenRouter TypeSafe SDK](https://openrouter.ai/docs/guides/community/typesafe-sdk)、[Jev 文档](https://openrouter.ai/docs/guides/community/jev)、[alpha Reference](https://openrouter.ai/docs/api/api-reference/alphadecisions/submit-a-decisions-request) | `/v1/systemone` 兼容承诺与 `/alpha/decisions` 的区别、自动长上下文、完整响应 envelope |
| [OpenAI Decisions Guide](https://developers.openai.com/api/docs/guides/decisions)、[Reference](https://developers.openai.com/api/reference/resources/decisions/methods/create) | 图像形式、消息／tool trace、题目字段、返回结构、费用 |
| [GPT-6 Luna 模型页](https://developers.openai.com/api/docs/models/gpt-6-luna)、[通用视觉指南](https://developers.openai.com/api/docs/guides/images-vision) | 对照一般模型规格和专用 Decisions 契约的边界 |

本轮恢复已有协议及能力调查，独立补充前序未覆盖的传输与转换问题，故仅向直接承接的 261015 报告声明补充关系。实际动作限于公开资料读取和文档设计；未读取私有仓库、凭据或账号 console，未发送模型请求、上传图片、安装 SDK、修改 CLI 或部署。没有真实图片接收、费用或质量证据；公开链接足以支持本轮复核，无资源附件。

## 调查结果与边界

### 1. 推荐：统一图片节点，按通道编译

**推荐保留 JEV `state/questions`，以显式 `image_url` 类型节点表达图片位置，由所选 adapter 编译为原生 wire。**TypeSafe assets、OpenRouter image parts、OAI input_image 是三种不同合同；普通字符串、URL 和路径继续作为数据。

| 目标 | 已读官方承诺 | 接入结论（本轮建议，非已实现） |
| --- | --- | --- |
| TypeSafe `/v1/systemone` | assets 登记，字符串引用在 state／instructions／criteria 中展开；JSON 或 multipart | 渲染 image node 为新 UUID 引用并构造 assets；图片／Box 每次启用专用 header |
| OpenRouter `/api/alpha/decisions` | Jev 可识别嵌套 `image_url` parts，包含 instructions／criteria | 使用有专属公开多模态说明的该 adapter，不套用 OAI `input_image` 结构 |
| OpenRouter `/api/v1/systemone` | SDK 文档承诺基本 TypeSafe 请求／响应兼容；示例是文本 | 不能由上述一般兼容承诺证明新版 assets、multipart 或 image parts 已可用；保留文本兼容，多模态路径单列待验证 |
| OAI `/v1/decisions` | `input` 里的 image parts，题目字段是文本 | state 图像可做有明确路径关联的语义重编码；题目局部图像不能直接放入 questions；Box 不可映射 |

第一行依据 [TypeSafe Images](https://docs.typesafe.ai/images)；中两行分别依据 [Multimodal](https://openrouter.ai/docs/guides/community/multimodal-decisions) 与 [SDK](https://openrouter.ai/docs/guides/community/typesafe-sdk)；OAI 依据 [Reference](https://developers.openai.com/api/reference/resources/decisions/methods/create)。这些都是文档支持程度，不是真服务通过结论。

### 2. TypeSafe 原生图片：引用不是文件路径或外链

原生 `assets` 是 reference→asset 映射。asset 以 `data_base64` 加小写 `format` 传 PNG/JPEG，或用 `part` 指向 multipart 文件部分；同时存在时服务采用 part。Base64 必须是标准字母表、padding、无空白且不带 data URL 前缀。引用在字符串值中匹配，完整值优先，句中从左向右且不重叠；对象 key 不替换。每个 asset 必须被用到，否则 400；每次引用出现都增加模型输入与展开预算。嵌入文本的短 key 会误匹配，故生成引用必须检测与原文碰撞，不能只觉得 UUID “大概唯一”。[原生图片合同](https://docs.typesafe.ai/images)

multipart 推荐把首个 `request` part 设为 JSON，余下文件 part 各由一个 asset 唯一引用；缺失、重复、无归属或非法 MIME 都不是部分成功。HTTP 使用原生 Bearer key；JSON 设 `application/json`，multipart boundary 由发送层构造。实验头是 **`TypeSafe-Danger-Zone-Images: true`**，每次有图或 Box 都要带；不是写进 state 的提示词。[上传与开启规则](https://docs.typesafe.ai/images)

| 验证维度 | 读取时的 TypeSafe 文档值 |
| --- | --- |
| 图片 | 静态 PNG/JPEG；单文件解码后至多 16 MiB；宽高各 280–1568；总像素 78,400–2,458,624 |
| 三种独立字节预算 | HTTP body、全部处理后不同图片、每次引用均展开后的请求，各 32 MiB |
| reference | 单个至多 1,024 UTF-8 字节，合计 65,536；非空且非纯空白 |
| 错误 | 无开关、坏图、坏引用／上传通常 400；超大小通常 413；图文 token 超上下文为 400 `max_tokens_exceeded` |

边界均为 inclusive；处理会重编码，可能膨胀，故 body 合格不证明后两预算合格。一图失败使整次失败；服务不自动缩放。元数据会移除且不应用 EXIF 朝向，不能用本地 viewer 的显示替代像素朝向检查；图片也消耗输入 token，尚无可靠公开图片 token 估算公式。[限制与预处理](https://docs.typesafe.ai/images)

**文档差异需要保留：**本轮 TypeSafe 写最小边长 280；OpenRouter 的 Jev 限制仍写 256，且同样要求最小总像素 78,400。前序报告中的 256 不再足以代替当前原生文档。跨通道使用边长至少 280 是本轮保守输入建议，**不是已经实测双方统一执行 280 的结论**。[TypeSafe](https://docs.typesafe.ai/images)、[OpenRouter](https://openrouter.ai/docs/guides/community/multimodal-decisions)

### 3. OpenRouter：显式 image parts 和通道自己的行为

`/alpha/decisions` 的 image part 为 `{type:"image_url",image_url:{url:"data:image/png;base64,..."}}`；Jev 可在 state 任意深度以及题目 instructions／criteria 中识别。普通文本数组成员是字符串，不是 `type:text` parts；OAI `input_image`、顶层 images 或无前缀 Base64 不能冒充该合同。远程 HTTP(S) 不抓取；面向 Jev 的可移植图片范围是 PNG/JPEG。Score legend 可重复原 image part，不能一律校验成 string。[多模态合同](https://openrouter.ai/docs/guides/community/multimodal-decisions)

OpenRouter `/v1/systemone` 是 SDK 指向的兼容入口，接受裸 Jev 模型名并映射；`/alpha/decisions` 的示例使用 namespaced 模型。不能把原生 `jev-1.14.0`、OR `typesafe/jev-1.14` 和响应 snapshot 字符串相互伪装成同一 ID；验收记录实际返回值。`/v1/systemone` 文档说基本字段保持 TypeSafe 形状，并额外返回 `id/provider/usage.cost`，但没有专门说明图片 assets／multipart；本轮未验证其新版图片行为。[SDK 合同](https://openrouter.ai/docs/guides/community/typesafe-sdk)

对于明确公开的 alpha 路径，保存完整返回 envelope：`model`、按题 ID 的 `answers`、`usage.input_tokens/output_tokens/cost`、`id`、`provider`；cost 是通道返回事实，不由原生单价回填成通道账单。Box 对象字段见第 6 节；其他文本原语与结果映射由同轮 [JEV 载体到 OpenAI Decisions](jev-carrier-openai-decisions-mapping.md) 承接。[alpha Reference](https://openrouter.ai/docs/api/api-reference/alphadecisions/submit-a-decisions-request)

### 4. OAI 图片：采用 data URL 交集，保留协议缺口

**Reference 仍允许公开 HTTP(S) 图片 URL，Guide 仍明确拒绝远程 URL，只支持 Base64 data URL；两者都不支持 file_id。**本轮默认选择 data URL 交集，外链不标为已可靠可用，也不因 Reference 的允许就悄悄抓取并转发。`image_url` 的 schema maxLength 是字符串长度，不是图片文件／HTTP body 的可用上限。[Reference](https://developers.openai.com/api/reference/resources/decisions/methods/create)、[Guide](https://developers.openai.com/api/docs/guides/decisions)

| 专用 Reference 合同 | 接入含义 |
| --- | --- |
| `input_image` 的 image_url 是字符串；detail 可为 low/high/auto/original/null，默认 auto | 不套用 OpenRouter 的嵌套 image_url 对象；不能声称各 detail 已验证有相同效果 |
| 最多 128 张／请求 | 按实际 image occurrence 而不是唯一字节文件计数；129 张应本地拒绝 |
| 有序多消息／function 与 custom tool call 和 outputs | 是供评价的轨迹，不是授权 Decisions 执行工具；output 必须匹配 call_id |
| user 和 tool outputs 可图文；system/developer 仅 input_text；assistant 为 output_text/refusal | 不把图像塞到 system 消息，也不把评判材料的角色伪造为高优先指令；system 在该接口渲染成 developer |
| questions 仅 predicate／choice／score，共享 input；1–200 题 | 没有题目局部 image part，也没有 Box |

上述依据 [Reference](https://developers.openai.com/api/reference/resources/decisions/methods/create)。返回 envelope 为 `model/answers/usage`，usage 包含输入、缓存细分、输出、推理细分和 total；答案有序且允许逐题 refusal，原始／normalized 分层和拒答校验见[载体映射调查](jev-carrier-openai-decisions-mapping.md)。

本轮没有在 Decisions 专用文档找到完整解码图片字节、尺寸、body 和图像 token 预算承诺。通用视觉指南当前有更大的图片数／body 数值，却注明特殊模型可用不同限制；**不能把它们搬来覆盖 Decisions 的 128 张或推导服务保证**。同理 `original` 不等于原字节、原尺寸或无重编码保证。[通用视觉指南](https://developers.openai.com/api/docs/guides/images-vision)

### 5. 统一输入推荐及转换不变量

#### 载体选择与识别门禁

推荐的可移植节点为 `{"type":"image_url","image_url":{"url":"data:image/png;base64,..."}}`，JPEG 同理，仅接受内联 PNG/JPEG。它直接表达资源位置，保留现有 state/questions，也与 OR alpha 已公开的嵌套图像形状一致。相比原生 assets＋字符串引用，节点遍历无需复制完整值优先、句中匹配及重叠消歧规则；代价是它**不覆盖原生 assets 的全部表达能力**。原生 assets 导入若以后提供，应作为独立扩展，不与本方案混合解释。

节点由可信本地 images opt-in 激活，精确匹配后作为 opaque image：语义路径指向整个节点，`.image_url.url` 等传输字段不是普通待判断文本。普通 JSON 恰好同形时，须走明确的 literal／escape 合同或拒绝歧义；具体辨识与转义语法仍须输入 owner 在实施前确定。

**images 关闭仍须扫描服务可解释节点。**发送前按所选通道递归检查 state、每题 instructions 及全部 criteria 的可解释位置；发现后默认本地拒绝，`fetch=0`、`attempts=0`，不读资产。同形 JSON 原样透传可能被 OR 再解释为图片，因此不是关闭处理。唯一例外是输入 owner 已认可、且有离线证据证明最终 wire 不再被目标通道解释为图片的 literal 编码；它还须保留题意与结构，不能靠删除字段绕过门禁。

#### 原生渲染与题目可见性

| 目标 | 推荐编译 | 保真与执行条件 |
| --- | --- | --- |
| TypeSafe | 收集节点、路径和全部原文本；生成经碰撞检查的 UUID 引用，整体替换节点，构造 assets | manifest 保存原节点／路径／生成引用／原题 ID、候选键或等级索引；保留重复、顺序与复用关系。节点形状有意变化，不称一般 JSON 类型原样不变 |
| OR alpha | 保留 `image_url` 节点及其原作用域 | 题目局部图仍仅属该题；既有 systemone 新版多模态路径另待验证 |
| OAI 共享 state 图像 | 文本 renderer 以碰撞检测的占位符替换节点；用相邻 input_text 标原 path／占位 ID，再输出 input_image | manifest 回查无歧义，保留数组序、原字符串、类型和每次出现关联；图像实际次数及预算按 occurrence 计算 |
| OAI instructions／criteria 局部图像 | 默认发送前拒绝；可另提供显式逐题执行模式，每题仅含共享 state 图与自己的局部图 | 显示拆分计划、调用次数、重复 state 成本、批次与失败聚合变化；调用方接受表示转换及逐题执行后才发送 |

即使逐题执行，候选／等级图从局部说明进入同题共享 input 仍有上下文表示变化；要求原生局部图槽语义或禁止拆分时，继续拒绝。把多题局部图合并到全题 shared input 会增加别题证据，须另获对可见性改变的明确接受，不能作为自动转换默认行为。多次 HTTP 也不是“一次调用一次发送”契约的隐含扩展。

转换保持像素输入与原路径对应：字符串化节点、只发 asset ID、用 OCR／视觉描述代替像素，均不能算多模态保真。图片默认不裁切、缩放、旋转或改色；占位符和生成引用都需检测原文碰撞。上述保真是信息／作用域层面的设计，不证明不同模型的读法或结果等价；文本 renderer 细节见[载体映射调查](jev-carrier-openai-decisions-mapping.md)。

### 6. Box：原语约束独立于有无图像能力

Jev Box 仅 1.14，固定 `type:box` 与 instructions，不接受 criteria，需请求含图且启用 Images 头。返回题目对象包含 `type:box`、`box:{top,bottom,left,right}`、`confidence`；边坐标以左上为原点归一化，均在 [0,1]，必须 `left < right`、`top < bottom`，confidence 也在 [0,1]。本地应拒绝 NaN、缺边、反向或退化框，不能 clamp 后冒充原答。[Box](https://docs.typesafe.ai/primitives/box)

Box 没有 not-found：目标不存在仍返回四条边。因此可以并行另问 Noul 判目标存在，由应用阈值决定是否消费框；不新增模型没返回的 absent 字段，不以低 Box confidence 自动当作未找到。裁切坐标应对发送时实际像素尺寸求值；缩放、旋转、分块需另存变换与坐标回映，不能套到错误原图。官方没有通用采用阈值。[Box 读取与存在检查](https://docs.typesafe.ai/primitives/box)

OAI Decisions 当前没有 Box。**选择 OAI adapter 而任一题为 Box 时，整次在发送前拒绝**，即使混有可映射文本题。坐标离散、多个 Score／predicate 或其他 API 会改变任务、费用或接收边界，不能静默降级。此为由 [OAI 原语集合](https://developers.openai.com/api/reference/resources/decisions/methods/create) 推导的本轮失败策略。

### 7. 长上下文：上限、开关和通道行为分别记录

| 模型／通道 | 文档承诺 | 采用边界 |
| --- | --- | --- |
| Jev 1.13／1.14 原生 | 默认整请求 64k；state+任一题 32k；每请求 `TypeSafe-Danger-Zone-Long-Context:true` 后两者 262k | token 含图像；不是只比较 state 字符数。单价不变但官方说明更慢且准确率下降 |
| OR Jev 1.14 alpha 文档 | 列表 262,144；约 >32,000 文本字节或任意图片自动走 TypeSafe 长上下文 | 字节阈值不是 token 阈值。不能宣称该自动行为属于所有通道；未授权长上下文时需阻止相应请求，而非以“没带头”假装关闭 |
| OR Jev 1.13 页面 | 本轮直接读取的模型页为图文、262,144 | 仍不支持 Box；页面能力不证明 /systemone 图片路径可用 |
| OAI gpt-6-luna Decisions | 专用 Guide／Reference 未给完整 token 硬上限或长上下文 opt-in | 一般 Luna 模型页 1,050,000 不是本轮已证明的 Decisions 稳定容量；不发 TypeSafe header |

原生依据 [Models](https://docs.typesafe.ai/models)；OR 自动行为依据 [Jev 文档](https://openrouter.ai/docs/guides/community/jev)，1.13 的当前声明见 [该模型页](https://openrouter.ai/typesafe/jev-1.13/)；OAI 依据 [专用 Guide](https://developers.openai.com/api/docs/guides/decisions) 与 [一般模型页](https://developers.openai.com/api/docs/models/gpt-6-luna)。原生别名在本次 Models 仍是 latest→1.13、preview→1.14，不与 OR alias 推断为同一版本；固定模型并保留响应实际版本。

OAI Decisions Guide 的基础输入价 $0.10/M，并声明区域与长上下文倍率适用；Luna 模型页对 >272K 输入列整次输入 2 倍，区域处理另加 10%。这是文档预算参考，不是本轮账单；缓存／输出不能套用一般 Responses 收费覆盖 Decisions 专用零收费说明。[Decisions 费用](https://developers.openai.com/api/docs/guides/decisions)、[Luna 定价](https://developers.openai.com/api/docs/models/gpt-6-luna)

超预算应保留服务原错误，不静默截断 state、丢题或图片；无法精确预估时，显示估算不完整而非保证可接收。客户端 timeout 只说明等待结束，服务是否已处理、是否计费仍可能未知；不自动重试、更换通道或重复上传。**容量、接收成功、利用长程证据的质量和 p95 延迟是四种不同验收证据。**

### 8. 权限与验证交接

以下是接入安全建议和验收要求，不是供应商已经替应用完成的防护：

- 图片读取、远程 URL 访问和外发是不同动作。继续保留 path／普通 URL 为数据；只从显式受权图片输入读字节，禁止凭 state 中的指令读文件、跟随认证链接或访问本机／私网 URL。若以后加下载器，单独约束协议、DNS／重定向、认证、大小、超时及最终目的地址，不能复用 API key 转发。
- 切换 TypeSafe→OpenRouter→OAI 改变接收方；OpenRouter 会转发上游，不因 key 有效就新增外发授权。Images／Long-Context 是可信配置选项，不来自不可信材料；排障 query 数据分享是另一个 opt-in，不随实验开关暗开。
- Base64 仍是完整图像，不是脱敏；dry-run／日志需按请求正文权限留存。诊断可输出尺寸、字节、path、hash 和发生位置，不默认打印全部 data URL、图像像素或敏感 metadata。模型答案不授予裁切写盘、删除或发布权限。

| 离线／mock 可证明 | 必须留待有授权的真服务验证 |
| --- | --- |
| node 辨识／literal 转义；images 关闭时分别覆盖嵌套 state／instructions／criteria 的 image-shaped 节点，断言拒绝且 `fetch=0`、`attempts=0`；PNG/JPEG signature、Base64、格式、尺寸、body 上界；无读盘／抓取副作用 | 实际 codec 接收、EXIF／颜色处理、处理后字节膨胀、图片 token 计量 |
| UUID 不碰撞、manifest 位置／顺序／复用；OAI 128／129 images；局部图拒绝且 attempts=0 | 各通道真实多图排列及 path 理解；局部图重编码的目标质量 |
| alpha 与 systemone endpoint 合同分流；header 不泄到 OAI；响应 envelope／Box 严格不变量；refusal 不伪装答案 | OR systemone 新版图片 assets／multipart 支持；OAI 远程 URL 冲突；detail 实际行为 |
| 本地可信 opt-in、超预算拒绝、无截断；mock timeout 不重试、未知发送／计费状态 | 组织权限／限流、长输入实际硬上限、质量／校准／延迟、真实账单和区域条件 |

输入与结果 renderer 见[载体映射调查](jev-carrier-openai-decisions-mapping.md)，配置、日志恢复与完整验收见[运行时调查](lightweight-judgment-multi-protocol-runtime-boundaries.md)。

实施时需要更新输入／CLI 行为 owner、对应离线测试与 Test Evidence Case，再按项目入口验证。本轮未执行新能力的离线测试或真服务验证，上表是后续验收建议。重新核对触发条件包括供应商文档更新、OR alias／adapter 改变、实验能力转正式、获得受限实测授权，或输入 owner 确定新的图像导入语法。
