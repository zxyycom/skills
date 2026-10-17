---
title: Lightweight Judgment 以 JEV 载体和封闭合同保持多协议边界
id: 261017-lightweight-judgment-faithful-protocol-adapters
status: active
alignment: aligned
createdAt: 2026-10-17T03:36:31Z
purpose: 复用统一判断输入，同时保留不同协议的能力、原答和恢复身份。
background: JEV 与 Decisions 的字段、模态、拒答和凭据不同，仅改 endpoint 或 model 无法保真接入。
decision: 保留 JEV 载体，以封闭版本化 adapter 编译和校验，分离原答与统一结果，无法保真时发送前拒绝。
tags:
  - lightweight-judgment
  - protocol-adaptation
relations: []
---

## 目的

- 让 `lightweight-judgment`（`skills/lightweight-judgment/`）在保留同一判断输入的同时，明确不同接收方的能力、凭据、返回和恢复边界，不把统一接口误当作模型行为等价。

## 背景

- 既有 state/questions 能表达文本、结构化条件与原语，但 OpenAI Decisions 使用共享 input、题目数组和不同返回字段；JEV 各通道也不共享全部图片、Box 与长上下文行为。仅覆盖 endpoint/model 会把默认凭据或错误 wire 送到另一接收方。
- 图片不只是字符串格式转换：提升局部图片为共享证据、替换为文字描述或隐式多次调用，会改变题意、可见范围或费用。统一输出若覆盖原答，会丢失原生标签、usage、拒答和后续复核依据。
- 可选日志和当前 schema／显式迁移继续遵循既有持久化与统计决策；多协议进一步要求即使不留正文，也能知道过去采用哪个校验与转换合同。endpoint、model 或当前配置不能证明历史协议身份。

## 决策

- 采用: 保留 JEV state/questions 为统一输入，以封闭、版本化 adapter 绑定 wire 编码、原生响应校验、能力、凭据来源与实验设置。先选择可信合同再解析其默认与覆盖；无 adapter 的旧配置保留原有文本合同。每个新合同显式声明连接与凭据，不自动继承另一合同的密钥。
- 编译完整保留原类型、成员顺序、题目与候选身份；协议没有对应能力或无法保持作用域时整次发送前拒绝。图片采用显式节点和获授权的内联像素，不自动读路径、抓外链或改图；图片关闭仍防止服务可解释节点穿透。不暗中拆题、降级、切服务或重试。
- provider 原生有效响应与 normalized 分层保留。统一答案映回原题 ID，合同支持的拒答显式表达而不造概率或候选；技术成功与题目完成度分开，不把同名 confidence 或 score 当作跨模型可互换的业务阈值。精确 shape 与能力由包内 [CLI](../../skills/lightweight-judgment/references/cli.md)及[接入合同](../../skills/lightweight-judgment/references/protocol-adapters.md)承接。
- 新日志明确记录实际版本化 adapter 合同；实际 wire 仍是请求字节与 request_json 的依据，必要原 carrier 与 wire 共用请求留存授权。历史无可靠 writer 证明时合同保持未知，不由 endpoint 或现行配置补猜。保留旧列与正文的显式迁移独立于正常调用，stats 不读正文补算身份，未知历史独立分层。
- 接口／模态接收、目标任务质量、上下文容量与费用分别取得证据；本地编译或 mock 通过不替代远端实测，真调用成功不扩大外发或业务操作授权。
