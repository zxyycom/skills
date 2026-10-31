---
title: "JEV 载体跨协议运行时：配置隔离、日志恢复与统计边界"
id: "261017-lightweight-judgment-multi-protocol-runtime-boundaries"
formedAt: "2026-10-17T02:39:15Z"
question: "以 JEV 为基础载体接入 OpenAI Decisions、图片、Box 与长上下文时，当前 CLI 的配置、留存、统计和离线验收需要哪些最小正确边界？"
tags:
  - "lightweight-judgment"
  - "model-api"
  - "runtime-contract"
  - "sqlite"
relations: []
---

## 形成时背景

`lightweight-judgment` 当前把 JEV 请求和响应直接作为 CLI 输入输出。目标是继续使用 JEV 形状的基础载体，由 CLI 自动转换到 OpenAI Decisions，并容纳图片、JEV Box 和长上下文。可用字段相似不等于运行时可以直接替换：当前 model、正文校验、发送、日志与统计共同假定一次原生 System One JSON 交换。

既有[OpenAI 接口调查](openai-decisions-api-contract.md)与[Jev 1.14 调查](jev-1-14-capabilities-and-comparison.md)保存公开协议及能力认识，尚未回答转换后如何选择连接且不误用凭据、怎样恢复与计量。[WAL 初始化调查](lightweight-judgment-wal-init-contention.md)回答的是数据库准备阶段的锁竞争，不是多协议日志身份。本文独立承接跨协议运行时问题。

## 调查目的

恢复 JEV 耦合位置及其影响链，确定基础载体、接入合同、原始响应和标准化结果的责任；判断配置、日志 schema 与统计哪些必须变化、哪些可以沿用；给出离线可证与真实调用待证的验收条件。**本文为运行时设计建议，未实施 CLI、日志迁移或收费调用；它不替代当前 skill／CLI 契约。**

## 调查范围与依据

2026-10-17 检查 Git `eb3a27b8b6ec1b144b51b2bdc3b3d589cbfad87e` 的工作树；开始时目标工具源码无 Git 改动。运行环境为 Node.js `v26.8.2`、Bun `1.4.2`。恢复相关调查后读取以下依据：

- 行为 owner：[SKILL.md](../../skills/lightweight-judgment/SKILL.md)、[CLI](../../skills/lightweight-judgment/references/cli.md)、[调用日志](../../skills/lightweight-judgment/references/call-logging.md)、[统计](../../skills/lightweight-judgment/references/statistics.md)及[v1→v2 显式迁移](../../skills/lightweight-judgment/migrations/log-v1-to-v2/README.md)。
- 实现：[configuration.ts](../../tools/lightweight-judgment/src/configuration.ts)、[request.ts](../../tools/lightweight-judgment/src/protocol/request.ts)、[response.ts](../../tools/lightweight-judgment/src/protocol/response.ts)、[cli.ts](../../tools/lightweight-judgment/src/cli.ts)、[transport.ts](../../tools/lightweight-judgment/src/adapters/transport.ts)、[call-log.ts](../../tools/lightweight-judgment/src/logging/call-log.ts)、[call-schema.ts](../../tools/lightweight-judgment/src/logging/call-schema.ts)、[statistics-data.ts](../../tools/lightweight-judgment/src/statistics/statistics-data.ts)、[statistics-summary.ts](../../tools/lightweight-judgment/src/statistics/statistics-summary.ts)、[statistics-batches.ts](../../tools/lightweight-judgment/src/statistics/statistics-batches.ts)、[output.ts](../../tools/lightweight-judgment/src/output.ts)。通过当前 CodeGraph files/node 取得结构与源码；不精确的跨工具同名调用关系不作为证据。
- 分发 owner：[工具链](../tooling.md#源码与依赖边界)与[构建适配](../../scripts/build/lightweight-judgment.ts)：tools 是源码，scripts/build 是适配，skill 内 MJS、map 和迁移 SQL 是分发产物。

本轮执行一次全合成进程内 runCli 探查：readFile 返回内存配置、home 为虚构路径、fetch 是只计数并抛错的替身、logging 关闭。没有读取真实配置、密钥或日志库。五项观察列于下文。没有读取或评价测试实现，因此不形成测试 Case 改动；验收矩阵是建议，不是已有覆盖声明。

既有公开报告作为形成时背景，本轮不重新证明价格、限额或账号可用性。[多模态调查](decision-model-multimodal-long-context-integration.md)承接图像、Box、长上下文及门禁；[载体映射调查](jev-carrier-openai-decisions-mapping.md)承接文本编译、raw／normalized 与拒答。共同推荐是保留 state/questions，显式 image_url 节点经 TypeSafe UUID refs/assets 或 OAI input_image 渲染，尚无新能力实测证据。

## 调查结果与边界

### 结论

**接入合同先于 endpoint/model 解析。**推荐最小路径为“选合同 → 校验 JEV carrier → 能力校验与编译 → 单次 HTTP → 原生响应校验 → 独立 normalized”。日志保存实际 wire，原始响应独立保留。首版可用封闭判别值，无需 provider 插件框架、自动重试、降级或账号轮换；逐题多次执行需另行显式扩展。

### 现状及影响链

| 边界与证据 | 已确认行为及影响 |
| --- | --- |
| configuration.ts 7、90–100、124–177 | 默认 OpenRouter System One、JEV 1.13、OPENROUTER_API_KEY；没有合同字段；只读一个配置文件，直接 key 优先。只放宽 model 正则会遗留错误 endpoint/key，应先选合同再解析默认 |
| configuration.ts 140–161；request.ts 158–169 | 配置先验证再应用 endpoint 覆盖；model 为 CLI > request > config，逐源先验证。现有 endpoint 覆盖不会重选凭据范围；URL 合法不等于接收方已获授权 |
| request.ts 16–38、78–99、123–169 | model 为 JEV brand；封闭顶层只接收 state/questions/model，题型只有 choice/score/noul。OpenAI model、assets 和 Box 均被拒；任意结构化 JSON 不自动成为图片协议 |
| options.ts common；input.ts；cli.ts 136–149 | 文件/stdin/ask 组装后将最终 request 直接序列化。新图片节点、资产读取和实验选项需明确输入/协议边界，不让 state 修改连接或 header |
| transport.ts 87–95、119 | 固定 JSON Content-Type、Bearer、manual redirect；直接调用 JEV validateResponse。新增合同需把已准备 wire 与对应校验传入；multipart 不能继续使用固定 JSON header |
| response.ts 144–212 | 要求 JEV model、同 ID answers map；score legend 仅字符串；返回原对象。OpenAI 数组/refusal 会被拒；新标准化层不能覆盖原始对象；结构化 legend 差异需单独按官方样例对齐 |
| call-log.ts 45–53、67–95、108–148 | request_json 是实际发送 JSON，response_body 是完整原始 BLOB；只从有效结果提取 model、input_tokens、output_tokens、cost。carrier/wire 分离后不能悄改列含义 |
| call-schema.ts 5、201–214 | 固定 schema v2、列/索引/SQL 严格验证。增加 nullable 列也不是兼容扩展，需显式版本和迁移，不自动 ALTER |
| statistics-data.ts 126–134；statistics-summary.ts 166–178 | 只 SELECT 摘要，不读正文；当前无合同维度，费用按 endpoint 隔离。不能读取正文补猜协议；已有字节、NULL 与分位数规则可复用 |
| statistics-batches.ts 131–142；output.ts 44–54 | 批次 dimensions 只有 endpoint 与请求/响应 model；result 原样放入 envelope。合同应进入真正需要的分层；normalized 不与 raw 同名混用 |
| scripts/build/lightweight-judgment.ts | 从 cli.ts bundle，迁移 SQL 另复制入 skill。应改源码与构建适配后验证分发，不手改生成 MJS |

全合成探查结果如下，五项均为 fetch=0、attempts=0：

| 动作 | 观察 |
| --- | --- |
| 空配置、noul、dry-run | 退出 0，旧 OpenRouter endpoint、typesafe/jev-1.13 和原生 JEV request |
| 配置 model=gpt-6-luna、dry-run | 退出 2/configuration，config.model 被 JEV 校验拒绝 |
| type=box、dry-run | 退出 2/input，题型被拒绝 |
| 顶层合成 assets、dry-run | 退出 2/input，未知字段被拒绝 |
| 空配置、doctor 覆盖为合成 HTTPS decisions 地址 | 退出 0，仍报告旧 JEV model 与 OPENROUTER_API_KEY。证明覆盖地址不重选凭据，不证明已发送请求 |

### 推荐配置：一个封闭接入判别值

建议私有配置使用单一 api/adapter 判别值，集中绑定 wire 编码、响应校验、能力、实验 header 与凭据命名空间，而非任意组合 protocol/channel。合同类别区分：旧 JEV OpenRouter systemone 文本、JEV OpenRouter alpha decisions、JEV TypeSafe 原生、OpenAI Decisions。类别设计不是已实现参数，也不保证远端兼容。

| 配置边界 | 推荐行为与验收条件 |
| --- | --- |
| 配置文件 | 保持 CLI config > 环境路径 > 默认路径，只读一个文件，不合并；缺判别字段继续旧 systemone 文本行为 |
| 新合同必填 | 显式 endpoint、model、凭据来源；缺项拒绝，不继承旧 JEV／OpenRouter 默认。未来若有默认，须在判别后成组解析 |
| 合同选择 | 首版只从可信配置选择，切换合同即切换私有配置；无需 request.protocol 或临时 --protocol |
| 同合同 model 覆盖 | --model > carrier.model > config.model；逐源验证后覆盖，非法原值仍报错 |
| 凭据 | 保留 apiKey 优先，空值报错；新合同仅取所声明来源，不回退旧 OPENROUTER_API_KEY，不按 key 形状识别账号或自动读 .env |
| endpoint 覆盖 | --endpoint 仅改所选合同目标，不改合同／凭据；自定义 URL 是调用方声明兼容，不由 hostname 猜协议；更换接收方仍需外发授权 |
| 本地诊断 | doctor 展示合同、最终地址／model、credentialSource／env 名，仅证明离线前置；dry-run 无 key／网络／数据库，展示实际 wire 与非秘密 header |
| 实验能力 | images／long-context 来自可信配置或显式参数；不支持组合在发送前拒绝，TypeSafe header 只用于对应合同。OR 自动长上下文须揭示；无法满足禁止要求时拒绝 |
| 失败顺序 | 未知合同／非法组合在读 key、建库、发送前失败；能力与编译错误在写发送意图和网络前失败 |

完整 dry-run 可能含 Base64，按敏感正文私有处理；以占位图替换后只能称脱敏视图，不能称实际 wire。路径／普通 URL 继续是数据。OR alpha 的多模态承诺不能直接证明旧 systemone 兼容，TypeSafe 实验头也不是所有 JEV 通道通用头。

**两项图片执行门禁：**images 关闭时仍按合同扫描 state、每题 instructions、全部 criteria 的服务可解释节点，默认拒绝且 `attempts=0`、`fetch=0`、资产读取=0；只有已证明最终 wire 不被目标端解释为图片的 literal 编码可例外。题目局部图像不能隐式提升为全题 shared input；需要逐题执行时先展示计划、重复 state 成本并取得接受。首版若维持一次发送，就拒绝无法忠实表示的组合。完整识别、作用域及转义条件由[多模态调查](decision-model-multimodal-long-context-integration.md)承接。

### 日志、schema 与恢复：保存 wire 真相

保持发送前 intent、完整收到正文后先保存 BLOB 再校验、最终 finish 和 persistence 独立报告；存储失败不重发。推荐表示分层：

| 表示 | 责任与留存 |
| --- | --- |
| JEV carrier | 保留题目 ID/顺序、state/criteria、显式图片节点。仅 saveRequest 开且 wire 不足以承担原问题恢复时另存 carrier_json；直通 JEV 无需重复同一正文 |
| provider wire | request_json 继续为实际 JSON 正文，request_bytes 为该正文 UTF-8 长度，不混 local tags、key、配置或本地绝对路径 |
| 原始 response | response_body 仍为完整原始 BLOB，只受 saveResponse 控制，包含未知字段、model、原生 usage，不替换成 JEV 化 answers |
| 标准化结果 | 独立字段/对象对外暴露，不能覆盖 raw result；不必为了多协议把完整 normalized JSON 再存一份库 |
| 合同身份 | 新调用始终记录一个 versioned adapter_contract，代表实际 wire 与转换语义，不由 endpoint/model 推导 |

一个 versioned adapter 合同已足以路由校验与转换，无需重复 provider/protocol/channel/transformVersion 四列。只变实现、不变语义无需增加合同版本；旧合同不再能验证时明确报告，不用新转换器猜。有效的非秘密实验选项，只有恢复/统计确实消费时才增加有 owner 的摘要，不存完整配置。carrier_json、wire request_json 以及可能保存的作用域/执行 manifest 都包含请求信息，统一受 saveRequest 授权；不能通过新增 manifest 绕过正文关闭设置。

**schema 扩展依据是持久义务，而不是 provider 数量。** 单纯实时调用不需要改库。但若继续提供多合同日志恢复，尤其 request 默认不留存，v2 没有可靠来源选择校验器，至少需要 nullable adapter_contract；若承诺仅靠日志恢复原题并标准化，再增加受 saveRequest 控制的 carrier_json。它们分别解决“哪个校验器”和“哪份原问题”，不是泛化审计系统。

第一版仍可不做离线响应校验命令，但要继续明确“已取回，尚未验证”。BLOB + carrier 不是完成恢复；后续恢复必须纯离线、显式使用已记录合同，复验原生响应后规范化。缺 carrier 且 wire 不足时，需要外部原请求；不能拿当前配置反推过去，也不能用 json/ask 重发代替校验。

如果采用 multipart，request_json 不再逐字代表 HTTP body，必须先建立新媒体留存和计量契约；或者首版采用双方可用的 JSON 内联资产。不能把 multipart manifest 的 JSON 长度称作实际 wire 字节；multipart BLOB、boundary 和容量不是 v2 已有能力。

### Schema 兼容与显式迁移

采用新列须升级 schema 并提供独立显式迁移；正常推理／stats 仍不升级旧库，不需历史时可改用新库。迁移只在获授权私有副本执行，保留原库及 WAL；核对完整性、ID／行数、旧列逐值、BLOB、NULL 和版本后再切配置，不能仅改 user_version。

- **不按 endpoint 猜合同。** 代理、自托管、兼容 URL 都可能存在。无可信 writer/调用来源证明时，历史 adapter_contract 保持 NULL，在分层中作为 unknown，不并为默认 JEV。
- 证明整库只由已知原生 JEV writer 生成时，才可显式赋 legacy JEV JSON 合同；依据是 writer 来源，不是 URL。混合/改写库需按调用 ID 的外部映射，零/多重命中拒绝。
- 已知直通合同且正文未改写时，旧 request_json 可直接承担 carrier 来源，无需物理复制；没有正文不复造。旧 usage、费用、状态、字节、时间保留原值，不从新价格回填 cost，不把无缓存字段当零命中，不把旧 succeeded 当已证明全部 answered。
- 迁移源码、分发 SQL/说明与构建保持 owner 一致；未知版本、手工 schema 或损坏库继续拒绝。迁移本身不发送请求。

### refusal、usage 与统计口径

**技术成功与题目完成度分离。**依[载体映射调查](jev-carrier-openai-decisions-mapping.md)，通过原生协议校验的混合／全 refusal 可为 `ok=true`、调用 succeeded；题目完成度另为 complete／partial／refused。stats 的 succeeded 只称技术成功，不代表全部题目得到可采用答案。缺项／类型错／越界为 invalid_response；HTTP 非 2xx、网络／超时仍为技术失败。未来执行计划的部分 HTTP 失败还需单独表达，不与合法 refusal 混用。

原生 usage 原样保留 raw；跨协议公共摘要只由对应合同验证后提取。拒答不应丢弃合法 request-level usage；多题只累计一次。

| 指标 | 推荐口径 |
| --- | --- |
| tokens | 服务报告请求级 input/output，缺失/非法为 NULL，不按题数放大；不同 tokenizer 数量不等于相同工作量 |
| cache | 原生细节保留；命中/写入/价格/覆盖不同。只有要离线统计且不开正文时才新增来源明确的 nullable 摘要；否则明确 stats 暂不汇总。首条耗时、重复输入、免费输出不证明命中 |
| reported cost | 延续按 endpoint 隔离和 service-reported-unspecified，未报告为 NULL；免费输出声明不能令整次 cost 填0。公开价格估算需独立价格版本、币种、区域/长上下文条件，不混入 reported cost，本次无需实现 |
| bytes | request 是实际 wire JSON UTF-8，response 为完整原始字节；不是 carrier 长度、图片解码大小、token 数或部分下载量 |
| elapsed | 建议原生校验+标准化完成、最终 finish 前冻结一次，库/输出共用。包括HTTP接收及中间持久化，不含输入/图片读取/转换、最终落盘/stdout；不是TTFT、纯推理或完整进程耗时 |

elapsed 有一个直接现状差异：cli.ts 177–180 在 log.finish 前计算库内值；runCli 238 和 output.ts 27–31 在 infer 返回后再取时生成输出，因此日志开启时输出包含 finish 成本，二者不必相等。本文只确认代码计量点不同，未测数据库耗时，不宣称当前已经统一。

stats 若支持新日志，推荐增加 adapterContract 精确筛选/分组及批次 dimensions；历史 NULL 单列。延续摘要 SELECT、只读事务、NULL 分母、nearest-rank、run index 1 与预算，不读正文补算。题目拒绝数如确有统计需求，再加 nullable answered/refused 摘要和覆盖；无需为多协议无条件建答案子表。质量/校准仍需 gold/人工标签。

### 后续离线验收矩阵

以下是建议而非本轮已执行覆盖；新增/修改测试时按 Test Evidence owner 为最小原生入口维护 Case。

#### 配置、日志与分发

| 风险 | 离线／mock 验收 | 真实环境待证 |
| --- | --- | --- |
| 旧 JEV 与凭据隔离 | 旧配置／三原语／严格 JSON 不变；各合同缺必填项与非法被覆盖来源拒绝；dry-run 无 key；合成 env 仅发送所选 key；未知合同建库／发送前失败；单次 POST／manual redirect | model／alias、账号／代理兼容及外发授权 |
| 日志恢复 | 两正文开关四组合；carrier／wire 不同；intent→完整 BLOB→终态；无效 UTF-8／JSON／非 2xx／中断可只读恢复；存储失败不重发 | 底层存储；进程终止测试不证明断电恢复 |
| 迁移／统计 | 旧／新／未知 schema；合成副本旧列／BLOB 保真；unknown 合同、cache／cost 缺失与 0、wire 字节；stats 按合同／endpoint／model 分层且不读正文／取 key／联网 | 真实库迁移需另授权 |
| 保密 | 短合成 key 与正文键／数字碰撞、恶意动态 ID；诊断仅固定路径／序号，header 不写库；成功 raw 不因全局脱敏替换而损坏；无排障分享 | 用户正文／服务回显秘密仍有原文留存风险 |
| 分发 | bundle 无仓库绝对路径／外置源码依赖；迁移资源入包、skill 版本提升；独立复制后以最低支持 Node 运行 doctor／dry-run／stats／mock，核对源码与生成一致 | 最低 Node 与目标平台，不能仅测 Node 26 |

#### 映射与能力接入

详细 fixture 由[载体映射调查](jev-carrier-openai-decisions-mapping.md)及[多模态调查](decision-model-multimodal-long-context-integration.md)承接，runtime 还须闭合下列执行证据：

| 能力 | 运行时验收 | 真实环境待证 |
| --- | --- | --- |
| 文本／结果 | 全结构化与原序／类型保留；单候选拒绝；响应关联及混合／全 refusal；raw／normalized 分开、合法 usage 一次提取 | 实际响应、structured legend、usage／cache／refusal 形状及业务阈值 |
| 图片 | 合成 PNG/JPEG 与 OAI 128／129 边界；无隐式 URL／path 读取；images 开关覆盖 state／instructions／criteria 可解释深度；关闭时零 fetch／attempts／资产读取拒绝，literal 例外证明最终 wire 不触发图像解释；各合同 wire／Content-Type／header 正确，图像字节不入诊断 | 实际接收、目标端 literal 解释、尺寸差异、外链、作用域质量与账单 |
| Box | 合同能力分流；OAI 发送前拒绝；原生坐标／confidence 严格校验，框不作为存在证明 | 缺目标、小目标／裁切及采用阈值 |
| 长上下文 | 默认／显式选项与 OR 自动行为；长 JSON 精度／嵌套限制；正确合同 header，超限仍为技术错误，无隐式截断／拆分／重试／切服务 | 实际预算、长程内容利用、质量／延迟与费用 |

### 本轮证据与剩余边界

本轮完成 owner／源码只读检查及上列 **5 项全合成 runCli 探查**。没有新实现，未执行完整工具测试、构建同步、日志迁移或 `bun run check`；合成探查只证明现有校验路径，不证明新合同已支持。未读取真实配置／凭据／日志库，未执行真实网络调用、安装或部署。

实施前仍需闭合各通道图片 wire／实验行为、Box 语义、structured legend、Decisions usage／cache／refusal、服务限额与账号可用性。原生协议或映射语义改变时，重新审查合同、恢复来源与计量；只放宽 model 正则不足以完成接入。
