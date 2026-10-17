---
title: "JEV 载体到 OpenAI Decisions：语义保真映射与结果边界"
id: "261017-jev-carrier-openai-decisions-mapping"
formedAt: "2026-10-17T02:38:12Z"
question: "以 JEV 为统一请求载体时，哪些字段可无损或显式转换到 Decisions，哪些必须拒绝，如何保留原始与统一结果？"
tags:
  - "decision-models"
  - "lightweight-judgment"
  - "model-api"
  - "protocol-adaptation"
relations: []
---

## 形成时背景

本轮为 `skills/lightweight-judgment/` 同时接入 JEV 与 OpenAI Decisions 建立实现依据。用户已选择 **JEV 请求形状作为统一载体，自动转换到目标 provider**，并将图片、Box、长上下文纳入后续实现范围；本轮仅调查，未获 CLI 修改、凭据读取或付费试调授权。

[Decisions 接口调查](openai-decisions-api-contract.md)、[历史效果比较](openai-decisions-jev-comparison.md)和 [Jev 1.14 调查](jev-1-14-capabilities-and-comparison.md)保存协议及能力背景。本文独立回答此前未覆盖的逐字段编译、拒绝边界与统一输出问题。

## 调查目的

提出保留 JEV 结构的确定性编译方案：完整表达输入、显式暴露目标能力限制，并分开 provider 原答与统一结果。**本文的 renderer、manifest、normalized 与能力校验均为调查建议，尚未成为 skill 或 CLI 契约。**信息保真不等于模型行为、概率校准或业务阈值等价。

## 调查范围与依据

公开资料于 **2026-10-17 UTC** 实际核对：

- [OpenAI Decisions HTTP Reference](https://developers.openai.com/api/reference/resources/decisions/methods/create) 与 [Guide](https://developers.openai.com/api/docs/guides/decisions)：字段、类型、长度、顺序、原语意义、概率、refusal 与返回数组。
- TypeSafe [API](https://docs.typesafe.ai/api)、[State](https://docs.typesafe.ai/concepts/state)、[Choice](https://docs.typesafe.ai/primitives/choice)、[Score](https://docs.typesafe.ai/primitives/score)、[Noul](https://docs.typesafe.ai/primitives/noul)、[Confidence](https://docs.typesafe.ai/confidence)、[Box](https://docs.typesafe.ai/primitives/box)、[Models](https://docs.typesafe.ai/models)。
- [OpenRouter Multimodal Decisions](https://openrouter.ai/docs/guides/community/multimodal-decisions)：嵌套 image part、JEV 特例与 `alpha/decisions` 通道，用于区分 TypeSafe 原生 assets。

本地读取 `skills/lightweight-judgment/SKILL.md`、`references/cli.md`，先用 CodeGraph 定位，再读取 `tools/lightweight-judgment/src/{request,response,json,json-order,json-number}.ts`。当前自包含 CLI 仅支持 System One；源码证明当前实现，公开文档支持远端协议判断，两者均不证明新 adapter 已可用。

本文承接文本字段、顺序与精度、renderer、原始响应及 normalized。[多模态接入调查](decision-model-multimodal-long-context-integration.md)承接图像节点、传输、题目可见性、Box 和长上下文；[运行时调查](lightweight-judgment-multi-protocol-runtime-boundaries.md)承接配置凭据、日志恢复、统计和接入验收。本轮未发送 API 请求、下载模型、安装依赖、改动环境、读取凭据或私有资料；没有真实服务响应、账单或质量证据。

## 调查结果与边界

### 1. 推荐路径与原生差异

**由 adapter 编译请求并本地关联答案，不让模型重建问题 ID 或候选。**字符串原样使用，对象／数组完整编码为带类型说明的 JSON 文本；manifest 保存来源路径、类型、顺序和对应关系。

JEV 使用 `state` 与问题映射，instructions／criteria 可结构化；Decisions 使用共享 `input` 与题目数组，支持 predicate／choice／score。以下均为推荐编译规则；目标支持范围依据 [OpenAI Reference](https://developers.openai.com/api/reference/resources/decisions/methods/create)。“直接”只表示字段内容不变。

### 2. 请求映射

#### 共享输入与题目身份

| JEV 载体字段 | OAI 目标与保留规则 | 前置条件与边界 |
| --- | --- | --- |
| `state: string` | 原字符串作为 `input`；固定说明将 state 定义为输入证据 | 保留空白与字面内容，包括看似 JSON 的字符串 |
| `state: object/array` | `input = "JEV state JSON:\n" + J(state)`；说明 `state` 指 JSON 根，`state.a` 等引用仍指原字段 | 保留根形状与全部成员；数组仍是数据，不猜作 OAI messages |
| 非空 `questions` 映射 | 按 parser 记录的原成员序生成数组；manifest 保存 `ordinal -> originalId` | OAI 1–200 题；超限发送前拒绝，拆分须另有显式执行契约 |
| 问题 ID | 生成不透明 `name: "q0"/"q1"/...`；响应同时核对位置和 name | 原 ID 只存 manifest。JEV 明确 ID 不送底层模型；OAI name 是否参与推理未说明，故不向题意注入用户 ID |
| `model` | 先选接入合同，再解析该合同原生模型 | 模型不做跨厂商字符串翻译；来源校验与覆盖见[运行时配置](lightweight-judgment-multi-protocol-runtime-boundaries.md#推荐配置一个封闭接入判别值) |
| `instructions: string` | 内容原样进入目标 instructions，前后仅加版本化 adapter 说明 | 完整题意均保留 |
| `instructions: object/array` | 整体 `J(instructions)` 放入带类型区段，说明引用相对该局部根解析 | 所有键地位相同，无 `question`／`focus`／`examples` 等特权字段 |

#### Choice、Score 与 Noul

| JEV 字段 | OAI 映射 | 保留条件 |
| --- | --- | --- |
| `type: choice` | `type: "choice"` | 保留单个多候选题的语义 |
| Choice criteria 键 | `choices[i].value = originalKey`，始终是 string，按原序输出 | 键内容、空白与类型不变，包括 `"true"` 和数字形字符串 |
| Choice criteria 的 string／object／array 值 | string 原样作为 description；object／array 用 `typedJSON(value)` | 空串及结构化全部成员保留 |
| Choice criteria 值为 null | 省略 description；manifest 记录 null | 表示没有额外说明，候选键保留 |
| Choice 候选数 | 原序逐项映射 | OAI 2–255，当前 JEV 载体 1–255；单候选发 OAI 前拒绝，不能补候选或本地造答案 |
| `type: score` | `type: "score"` | 有序量表，不改作 Choice |
| Score string 等级 | `levels[i] = {label: originalString}` | 位置是身份；重复和空标签均保留 |
| Score object／array 等级 | `levels[i] = {label: String(i), description: typedJSON(value)}`；manifest 保存原结构 | label 是 adapter 标识，完整 rubric 在 description。沿用 JEV 2–10 级；本次 OAI 文档未明列该题型级数硬限，容量仍待证 |
| `type: noul` | `type: "predicate"` | 概率对应肯定方向，保留极性 |
| Noul criteria 缺省／`{}` | 缺省保持缺省；显式空对象在载荷和 manifest 中保留 | 原请求副本仍可区分两者 |
| Noul `criteria.true`／`.false` | 全部进入 predicate.instructions 的 criteria 区段，分别说明肯定／否定定义 | 缺失项不补写；两侧条件及原极性完整保留 |

`J` 复用现有严格 JSON 能力：UTF-8 校验、重复键拒绝、受控嵌套、精确十进制往返及原对象成员序。复用 `orderedKeys`／`preserveKeyOrder`／`stringifyJson`，避免通用对象枚举重排 `"10"` 与 `"2"`；`__proto__`／`constructor` 等作为 own data key，用无原型对象或安全 defineProperty 还原。

`typedJSON(value)` 为固定前缀 `JEV structured JSON:\n` 加 `J(value)`，manifest 记录原类型和编码选择；字面字符串无须被反向猜成 JSON。数值 `9007199254740993`、`1e-400`、负零及无法按十进制值往返的额外精度在发送前拒绝，提示改用字符串。`"9007199254740993"`、`"001"` 原样保留。`1e2 -> 100` 属等值词法归一化，原载体字节另按留存授权处理。

### 3. Renderer 与发送前校验

建议版本名 `jev-to-decisions/v1`，分为三个纯本地步骤：

1. 严格解析载体，记录原序；独立解析接入合同、model 和实验能力。manifest 保存 renderer 版本、原题 ID／ordinal／题型／wire name、候选键序、等级原结构，以及 string／JSON／null 编码选择。
2. 每题建立完整局部载荷 `{instructions: <原值>}`，Noul 原本存在 criteria 时加入完整 criteria。结构化载荷整体用 `J` 编码进固定模板：共享 state 是证据，instructions 给出任务，criteria 给出 yes/no 定义；内部引用相对原 instructions 局部根，`state.*` 相对共享 state。纯字符串且无 criteria 时可走原样内容快路径。
3. 独立映射 Choice descriptions／Score levels；对最终 wire 再校验字段长度、UTF-8／body、题数、候选数、图像数／角色与能力。预算包括 JSON 转义、模板、重复图像和 Base64。dry-run 展示实际 wire 与转换摘要，无凭据读取或联网。

例如，原 instructions 的 `candidate` 即使包含 `{"id":"001","amount":"9007199254740993"}`，引用仍指该局部对象，而不是 `state.candidate`；false-only criteria 仍完整呈现。条件自身矛盾由题目设计解决，adapter 不另调模型猜测修复。

模板中的 JSON 是定界数据，输出仍采用 Decisions 原生题型。模板不执行数据中的 shell、URL 或路径；不可信 state 指令无权修改问题、授权或连接。模板只能降低歧义，不承诺消除提示注入。

能力按**通道＋协议＋模型＋opt-in**声明。统一载体保留 Box 和显式 `image_url` 节点；推荐 TypeSafe 渲染为 UUID refs/assets、OAI 渲染为 `input_image`。OAI 无 Box 时整次发送前拒绝；题目局部图像只能进入显式获接受的逐题执行计划，或拒绝，不能隐式全题共享／多次发送。images 关闭时仍扫描服务可解释节点，默认零 fetch、`attempts=0` 拒绝，只有已证明目标端不再解释为图像的 literal 编码可例外。节点、作用域、长上下文和预算细则由[多模态调查](decision-model-multimodal-long-context-integration.md)承接。

发送前拒绝至少覆盖：不支持的题型／模态／开关，OAI 题数／候选数／已知字段与 body 限额，JSON／数值／UTF-8 失真，图像引用缺失或能力未声明，模型与合同冲突，以及当前执行模式无法保持局部图片可见性。凭据校验顺序由 runtime 决定；能力与编译校验须在网络发送、写发送意图或付费动作前完成。结构化文本本身是合法输入。

### 4. 原始响应、normalized 与拒答

建议 `result` 保存完整 provider 原生响应，另设版本化 `normalized`（字段名待实现契约确认）。原生 model、usage、额外字段、概率数组与标签保留原值；解析后对象不等于 exact bytes。实际 wire、carrier、manifest 与响应字节的留存授权及恢复由[运行时日志设计](lightweight-judgment-multi-protocol-runtime-boundaries.md#日志schema-与恢复保存-wire-真相)承接。

| OAI answer | normalized 建议 | 关键校验 |
| --- | --- | --- |
| predicate `{probability}` | 原题 ID 下 `{status:"answered",type:"noul",noul:probability}` | 保留概率；无额外 confidence 或阈值化 |
| choice `{choice,probabilities:[{value,probability}],confidence}` | 按 string value 建原键概率映射，choice／confidence 原值保留 | 精确核对候选集合与键类型，不按返回序 zip、不归一化或用 argmax 覆盖选择 |
| score `{score,probabilities:[{value,label,probability}],confidence}` | 按原等级索引建概率映射；保留 providerLabel、原 score／confidence，原 criteria 单列 rubric | value 对应索引；重复 label 不承担身份，不重算 score |
| refusal `{type:"refusal",name}` | 原题 ID 下 `{status:"refused",requestedType:<原题型>}`，无数值答案 | 原生合法拒答，不填 false、0、0.5、其他候选或低 confidence |

先完整验证原生响应，再导出可采用 normalized：model、答案数、顺序及 name／类型、唯一候选／等级、有限值与概率范围。重复 value、缺候选、未知身份、name 错配或缺题均为协议错误；可按授权留 raw 诊断，但不把残余字段无标记地当有效部分结果。

Reference 允许逐题 refusal，与正常答案混合。建议题目完成度为 `complete`／`partial`／`refused`（全答／混合／全拒）；它与 HTTP／network／invalid_response 分离。若 `ok` 表示协议成功，全拒也可 `ok:true`，但不代表全部题目取得判断；CLI 退出和日志口径需配套更新。[OpenAI Reference](https://developers.openai.com/api/reference/resources/decisions/methods/create)

**JEV legend 尚有文档差异：**API Reference 为 `map<string,string>`，Score 结构化示例却直接返回 object legend，当前本地 response.ts 仅接受 string。线上形状未验证；后续应保留原始内容并明确结构化等级验证策略，而非 stringify 后冒充服务端字符串。OAI 无 JEV 顶层 legend；normalized 应区分服务返回的 `providerLabels` 与请求中的 `requestRubric`。[TypeSafe API](https://docs.typesafe.ai/api)、[Score 示例](https://docs.typesafe.ai/primitives/score#structured-level-descriptions)

### 5. 同名概率与 confidence 的采用边界

双方 Score 均以 0 开始的有序等级位置表达，可经概率加权落在等级间；不是选中某一级或任意 0–100 分。等级内容与顺序不变是比较必要条件，不能保证同值。[TypeSafe Score](https://docs.typesafe.ai/primitives/score)、[OpenAI Guide](https://developers.openai.com/api/docs/guides/decisions)

TypeSafe 公开的 Choice confidence 是相对均匀分布的 top probability 线性缩放；Score 还考虑距最高概率等级的距离并截到非负；Noul 无独立 confidence。这些不等于正确率。本次 OAI Guide／Reference 未给同一公式，字段同名不足以证明校准或阈值可互换。[TypeSafe Confidence](https://docs.typesafe.ai/confidence)

建议 normalized 标明 provider、实际 model、原题型与 confidence 来源。统一派生统计量应另名并标公式／版本，与原 confidence 并存；概率、confidence 与业务采纳可靠性分别验证。

### 6. 已取得证据与后续验证

本轮以 `bun -e` 调用现有严格 parser／serializer，加内联示意转换，**15 项断言通过**：数字形键／原型同名键保序、精确数字字符串、非法数值／重复键拒绝、候选 null 说明省略、问题名映射和 false-only 条件留存。这只是局部离线证据，未实施或测试完整 adapter。

后续 golden fixture 应同时核对 carrier、wire、manifest、raw、normalized；覆盖全结构化字段、数组／null／空串／Unicode、顺序与数值、1／2／255 候选、200／201 题、Noul 缺省／空／单侧条件、重复 Score 标签、混合／全拒答、响应缺项／重排／重复 value／name 错配、结构化 legend 及编译后超长。图片／Box／长上下文验收见[多模态调查](decision-model-multimodal-long-context-integration.md#8-权限与验证交接)，运行时验收见[运行时调查](lightweight-judgment-multi-protocol-runtime-boundaries.md#后续离线验收矩阵)；round-trip 自身循环不足以证明映射正确。

待获得真实调用授权后，核对实际模型、refusal、structured legend、OAI 长度／Score 级数边界、图像作用域及质量。公开协议／模型、renderer 或日志 schema 改变时，重新复核对应边界。
