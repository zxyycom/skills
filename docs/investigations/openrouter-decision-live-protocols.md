---
title: "OpenRouter Decisions 真实协议取证：Jev 图片、Box、结构化等级与有限长上下文"
id: "261017-openrouter-decision-live-protocols"
formedAt: "2026-10-17T03:37:06Z"
question: "当前 OpenRouter 的 legacy 与 alpha 实际接受哪些 Jev 输入、返回哪些结构，OpenAI Decisions 上游能否在当前账号验证？"
tags:
  - "decision-models"
  - "lightweight-judgment"
  - "live-protocol"
  - "model-api"
  - "multimodal"
relations:
  - type: "补充"
    target: "261017-decision-model-multimodal-long-context-integration"
    summary: "以受权真实合成调用补充文档级接入边界"
---

## 形成时背景

[前序调查](decision-model-multimodal-long-context-integration.md)依据公开文档区分原生 TypeSafe、OpenRouter legacy／alpha 与 OpenAI Decisions，但没有真实图片、Box、结构化 Score legend 和长输入接收证据。本轮用户明确授权使用现有 OpenRouter 凭据进行必要的真实调用；这是一组新证据条件，需要与文档级设计分别复核，因此独立保存并声明补充关系，不覆盖前序的形成时认识。

本报告的取证动作不修改运行时实现、真实配置／日志库、skill 行为、测试或部署。下述直接 HTTP 探查只取真实协议证据，不能证明正在实施的 adapter、renderer 或 CLI 已联调；同轮后续公开 CLI 验收另节记录。

## 调查目的

以少量、可复核的合成输入回答：两种 OpenRouter endpoint 的模型名与实际 envelope；Jev 图片节点在共享 state、题目 instructions 和 Score criteria 的实际接收及 legend；Box 的返回形状与实验头；有限长上下文的接收；OpenAI Decisions 上游的公开合同与当前账号可达性。不是历史效果比较、模型 benchmark 或容量上限压测。

## 调查范围与依据

2026-10-17 03:36 UTC 在仓库 HEAD `c00f1428` 对应工作区开始调查。先读相关 owner、三份协议设计报告，运行一次离线 `bun run lightweight-judgment -- doctor` 确认已有 OpenRouter 连接／凭据前置。之后使用独占一次性 HTTP 客户端读取已配置凭据，仅向 `https://openrouter.ai` 发出 **8 次 POST**；不读取其他供应商凭据，不用旧 CLI 的持久化路径，不创建或打开调用日志库。

各请求使用 `application/json`、Bearer 鉴权、manual redirect、90 秒等待上限，**均没有 TypeSafe 实验头**；没有自动重试。只发合成英文文本和自制静态 RGB PNG：320×320 白底，中心 160×160 的红色／蓝色正方形，满足本轮所读两种通道的文档尺寸交集。每个请求先落合成正文、再发一次并保存实际状态、接收正文与耗时。正式附件保留安全合成 JSON；403 中账号标识删除，长输入用精确生成式及 wire SHA-256 代替大段重复文本。认证、配置、私有路径和带凭据读取逻辑的客户端不入仓库。

同时复核官方 [Jev 文档](https://openrouter.ai/docs/guides/community/jev)、[alpha Reference](https://openrouter.ai/docs/api/api-reference/alphadecisions/submit-a-decisions-request)、[多模态指南](https://openrouter.ai/docs/guides/community/multimodal-decisions)、[TypeSafe SDK 接入](https://openrouter.ai/docs/guides/community/typesafe-sdk)及 [OpenAI 上游模型页](https://openrouter.ai/openai/gpt-6-luna-decisions)。它们是本轮读取的 live 文档，未固定 revision；文档声明与下列实际调用分开解释。

## 调查结果与边界

本轮分为直接 HTTP 探查与新版公开 CLI 验收：共 11 次真实请求、10 个 200 与 1 个 403。取得 OpenRouter JEV 文本、图片、Box 和有限长输入的接收证据，并在公开 CLI 贯通 normalized、临时日志与 stats；OpenAI 路由未取得成功响应。下列按阶段保留条件、计量与可复核边界。

### 直接 HTTP 探查

#### 实际请求与计量

除第 3 项外，实际响应 model 全部为 `typesafe/jev-1.14-20261014`，provider 为 `TypeSafe`。下表 cost 为逐响应 `usage.cost` 原值，非价格推算；ms 包含本次 HTTP 接收，不是 TTFT／p95，也未测缓存命中。

| 次序／条件 | endpoint 后缀／请求 model | HTTP | 请求正文 UTF-8 字节 | input／output tokens | cost | ms |
| --- | --- | --- | --- | --- | --- | --- |
| 1 文本三原语、结构化等级 | `/api/v1/systemone`／`jev-1.14` | 200 | 606 | 444／70 | 0.000018648 | 882 |
| 2 文本三原语、结构化等级 | `/api/alpha/decisions`／`typesafe/jev-1.14` | 200 | 615 | 444／70 | 0.000018648 | 362 |
| 3 文本三原语、结构化等级 | `/api/alpha/decisions`／`openai/gpt-6-luna-decisions` | 403 | 625 | 未报告 | 未报告 | 204 |
| 4 嵌套 state 图、Choice／Box／Noul | alpha／`typesafe/jev-1.14` | 200 | 2801 | 679／71 | 0.000028518 | 2464 |
| 5 instructions 图、Score 等级图 | alpha／`typesafe/jev-1.14` | 200 | 10283 | 1697／55 | 0.000071274 | 448 |
| 6 嵌套 state 图、Choice／Box／Noul | systemone／`jev-1.14` | 200 | 2792 | 680／71 | 0.00002856 | 443 |
| 7 重复填充＋首尾标记 | alpha／`typesafe/jev-1.14` | 200 | 40901 | 6158／38 | 0.000258636 | 630 |
| 8 更长重复填充＋首尾标记 | alpha／`typesafe/jev-1.14` | 200 | 280301 | 40358／38 | 0.001695036 | 1221 |

七个 200 的总计为 **50,460 input、413 output tokens、reported cost 0.00211932**。403 无 usage／cost，不按零费用填补；因此这是已报告费用合计，不是完整结算账单。官方 [Jev 文档](https://openrouter.ai/docs/guides/community/jev)将该字段解释为 USD，但字段本身没有币种标记。本轮没有 timeout／network 失败，也未重试 403。

#### Envelope、legend 与图像作用域

七个成功响应都含 `model/answers/usage/id/provider`；answers 按原题 ID 返回，`choice`、概率映射、`confidence`、`noul` 和 `score` 保持 JEV 形状。legacy 裸 `jev-1.14` 被实际解析为 namespaced snapshot；**只证明这两个请求名可用**，没有测全部 alias、裸 alpha 名或其他版本。

第 1、2 项 Score criteria 使用 `{label,details:[...]}` 对象，legend 的 `"0"/"1"/"2"` 值返回原对象，不是字符串。第 5 项 criteria 的 `{name,picture:<image_url node>}` 也以原对象返回；离线逐值比较确认其两个 legend 值与请求等级的 JSON 值相同，包括图像节点中的 Base64。不能 stringify 以后声称服务返回 string；日志／诊断也不能假设 legend 不含图像正文。

第 4 项 `state.photo` 的 inline `image_url` 节点被正确用于颜色判断，返回 red=1；第 5 项把蓝图放进一题 instructions，返回 blue=1，同时另一题用红图及红蓝等级图，返回 score=0.03、概率 0.97／0.03。它们提供局部槽和结构化等级图的实际正例，与官方 [多模态指南](https://openrouter.ai/docs/guides/community/multimodal-decisions)的 Jev 嵌套节点合同一致；**一次正例不证明所有嵌套、跨题隔离、注入安全或业务质量**。

第 6 项证明 legacy `/api/v1/systemone` 在本次 `jev-1.14` 上也接受该共享嵌套图＋Box，无 TypeSafe Images 头。它补足前序“legacy 新版图片待验证”的一个正例，**没有验证 legacy assets／multipart、其他模型或全部图片位置**；是否扩大产品承诺仍由实现／行为 owner 判断。

#### Box 与实验头

第 4、6 项均无任何 TypeSafe Danger-Zone header，实际返回 `type:"box"`、`box:{top,bottom,left,right}` 和 confidence。alpha 返回 `{top:0.14,bottom:0.7,left:0.23,right:0.7}`、confidence=0.61；legacy 返回 `{top:0.13,bottom:0.66,left:0.23,right:0.7}`、confidence=0.67。它们满足 [0,1] 及正宽高，但相对合成图的归一化真值边缘约 0.25／0.75 有明显偏差。**只证明接收和形状，不证明定位精度或可用阈值。**同题组 Noul=0.98 也不是通用存在性校准。

因此本轮 OpenRouter 成功路径不需调用方传 TypeSafe 实验头；不能外推为 TypeSafe 原生不需要该头，也未直接观察 OR 转发上游时的内部 header。

#### 长输入：只证已测容量

第 7、8 项 state 均为首标记＋分别重复 5,800／40,000 次的 `filler `＋尾标记，询问尾标记，返回 correct=1。实际最大请求 **280,301 UTF-8 body bytes、40,358 input tokens**，且无调用方长上下文头；证明这一有限输入可接收并利用该尾部证据，不是 262k 上限验证，也不是复杂长程推理或多位置检索评估。

官方 [Jev 文档](https://openrouter.ai/docs/guides/community/jev)声明较长文本或含图请求自动走长上下文；本轮结果与之相容，但响应不报告模式，不能仅由无头成功证明具体内部开关或精确切换阈值。未测拒绝长上下文的服务端开关，不把未发头当作“禁用长上下文”。

#### OpenAI 上游：有公开通道，当前调用受限

官方 [模型页](https://openrouter.ai/openai/gpt-6-luna-decisions)明确将 `openai/gpt-6-luna-decisions` 描述为经 OpenAI Decisions 提供的模型，外部接收 JEV `state/questions`，支持 Noul／Choice／Score 与最多 200 题。这是 OpenRouter 转换合同，**不是其 endpoint 接收 OAI 原生 `input/questions` 的证明**。

本次第 3 项发送同一安全合成文本三题，返回 HTTP403，`error.code=403`、message 为 `The request is prohibited due to a violation of provider Terms Of Service.`。没有成功 model、answers、usage；不能把此错误解释为 structured criteria 不兼容，也不能推断具体地区、账号或组织限制原因，更不绕过限制。因而**尚未验证 OR OpenAI 成功 envelope、refusal、usage／cache、图片或长上下文**。未读取 OpenAI key，未调用原生 `/v1/decisions`，未验证本仓库 OAI renderer。

#### 直接 HTTP 阶段的覆盖边界

8 次探查采用一次性客户端，资源只供阅读复核，不保留自动联网执行器。该阶段未验证 JPEG、外链、图片尺寸边界、TypeSafe 原生 assets／headers、1.13 Box 拒绝、缺目标 Box 行为、全部模型别名、refusal／缓存或上下文硬上限；也未验证正在实施的 adapter 与 CLI。后者由下一阶段单独验收。

### 同轮补证：新版公开 CLI 的隔离端到端验收

**2026-10-17 03:47–03:48 UTC**，待实现作者冻结代码后，另经公开入口 `bun run lightweight-judgment -- ...` 验收 skill version `9` 的生成 bundle；附件记录该 bundle SHA-256。此处与前面 8 次直接 HTTP 探查明确分开：新增 **3 次真实请求**，不重试 OpenAI 403，不访问 TypeSafe／OAI 原生端点。临时配置仅声明环境变量名，授权 OpenRouter key 在父进程内读取后仅注入子进程环境，不复制进临时配置或正式资源；正文、配置与 SQLite 都放独占临时目录，未访问真实日志库。

先以新 alpha 配置运行 `doctor` 和媒体请求 `--dry-run`，均退出 0、attempts=0；预览保留实际图像节点，非秘密实验 headers 为 `{}`。同一媒体输入配 `images:false` 正式调用时在本地返回退出 2、`input`、attempts=0，并确认当时临时数据库尚未创建。随后执行下列真实调用，全部退出 0、`ok:true`、attempts=1、`normalized.completion:"complete"`、`meta.persistence.status:"recorded"`；响应模型均为 `typesafe/jev-1.14-20261014`。

| CLI 输入／合同 | 实际覆盖 | wire bytes | input／output tokens | reported cost | elapsedMs |
| --- | --- | --- | --- | --- | --- |
| media／`openrouter-decisions/v1` | 7 题：共享嵌套图 Choice／Box／Noul、instructions 局部蓝图、Score 图片等级、文本 Noul、结构化文本 Score 等级 | 13361 | 2224／156 | 0.000093408 | 935 |
| long／`openrouter-decisions/v1` | 40,000 次 filler＋首尾标记，返回尾标 correct | 280301 | 40358／38 | 0.001695036 | 1658 |
| legacy／`openrouter-systemone/v1` | 文本 Noul／Choice／结构化等级 Score | 615 | 444／70 | 0.000018648 | 733 |

逐题比较通过：normalized 中每个答案的 `status:"answered"` 及所有原生答案字段与 result 对应值相同；两个 Score 的 `requestRubric` 等于原请求等级数组，不替换原生 legend。共享红图选 red，局部蓝图选 blue。Box 仍只验有效坐标／协议，不作精度采用。

在子进程结束后仅只读查询临时 DB，三行均为 `succeeded`，`adapter_contract` 与各输出合同一致；`request_json` 等于补齐 model 后的完整实际载体，`carrier_json` 为 NULL（JEV 直通无需重复正文），`response_body` 解析值与 result 相同；request／response 字节摘要与正文长度一致。**每行 elapsed_ms 与对应 stdout meta.elapsedMs 精确相等**（935、1658、733），本地 run 元数据没有进入 wire。这里验证的是 JEV 直通留存，不覆盖 OAI 转换后的非 NULL carrier。

公开 `stats --database ... --group-by adapterContract` 退出 0、attempts=0，返回 3 条调用、两组合同；再以 `--adapter-contract openrouter-decisions/v1` 筛选，得到 2 条、单合同组。只操作该临时 DB，未读取历史真实库。doctor、预览、本地拒绝、两个 stats 共 5 次离线 CLI 操作，不计入服务请求次数。

新增 3 次 reported cost 合计 **0.001807092**、43,026 input／264 output tokens；加前面直接 HTTP，本轮累计 **11 次真实请求、10 个 200、1 个 403**，已报告 cost **0.003926412**、93,486 input／677 output tokens，403 仍为费用未报告而非零费用。全部实际费用仍沿用前述 reported 字段边界。

### 结论与未验证范围

公开 CLI 阶段补足 **OpenRouter JEV 两种合同的真实 CLI、normalized、临时日志和 stats 贯通证据**。两个阶段均只证明所列接收与贯通：Box 精度、目标任务质量、262k 容量、native TypeSafe、native OAI、OR OpenAI 成功响应、OAI 非直通 carrier／refusal 与真实旧库迁移仍未证。

本报告不承担实现测试或全仓 Gate 验收；后续产品能力以行为 owner 及其验证为准。取证阶段未修改代码／测试或真实库；临时配置、输入、原输出、客户端和临时 DB 在安全资源提取后清理，仅保留下列合成资源，不保留联网执行器。

## 随附资源

- [合成蓝色方形 PNG](./_resources/261017-openrouter-decision-live-protocols/blue-square.png)
- [新版公开 CLI 端到端合成证据](./_resources/261017-openrouter-decision-live-protocols/cli-e2e-evidence.json)
- [安全合成请求与实际响应汇总](./_resources/261017-openrouter-decision-live-protocols/evidence.json)
- [合成红色方形 PNG](./_resources/261017-openrouter-decision-live-protocols/red-square.png)
