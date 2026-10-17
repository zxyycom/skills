# Design

先选择可信接入合同，再验证／编译统一载体并进行一次发送；以原生校验和独立统一结果维持协议与业务责任边界。

## Context

实施起点为 HEAD `c00f14282c31036acd814152401dd75554ed9a0e`，当时工作树干净。行为入口为 `skills/lightweight-judgment/SKILL.md`，源码与生成边界由 `docs/tooling.md` 承接。三份形成于 2026-10-17 的调查分别提供载体映射、多模态和跨协议运行时依据：`docs/investigations/jev-carrier-openai-decisions-mapping.md`、`decision-model-multimodal-long-context-integration.md`、`lightweight-judgment-multi-protocol-runtime-boundaries.md`；其中推荐尚须通过实现与验证兑现，不能当作当前能力。

## Goals / Non-Goals

目标是支持 OAI+JEV、图片、Box 和长上下文，保留用户点名启用及旧配置文本行为。非目标为多次逐题执行、远程图片下载、原生 assets 导入、自动重试／降级、账号轮换、插件系统、缓存计费估算及真实历史库自动迁移。必要 OpenRouter 真调用已获授权；TypeSafe/OAI 在线可用性与广泛质量评测不因接口实现而被证明。

## Decisions

### Intended Change

- 用封闭 adapter 绑定 wire、响应校验、能力、凭据来源和非秘密实验选项；model 优先级不替代逐源合法性验证。adapter 为 openrouter-systemone（缺省兼容）、typesafe、openrouter-decisions、openai-decisions，合同为对应值加 /v1；images 与 longContext 仅为可信配置布尔值，默认 false。
- TypeSafe 与两种 OpenRouter adapter 保持 state/questions 形状；仅直接 `openai-decisions` 以确定性模板编码结构化数据，生成不透明题名并本地映回原 ID／顺序。字符串、JSON、候选 null、Noul 单侧定义及 Score rubric 不混同。
- 显式图片节点按 adapter 编译，不将 path/URL 当内容；同形节点在图片关闭时拒绝，不提供未经证明的 literal 例外。直接 OAI 与 OR 的指定 OpenAI 型号仅支持共享 state 图，局部图或任一 Box 整次拒绝。JEV Box 须满足模型、图片及坐标约束。
- 原生有效结果保留 raw，normalized 单列题目状态、类型和完成度；直接 `openai-decisions` 的合法 refusal 不伪造数值答案。OpenRouter 指定 OpenAI 路由仍只按相应题型的完整 answers map 校验，不继承原生数组的拒答合同。

### Resulting Impacts

- 每次仍至多一个 HTTP POST，manual redirect，无自动重试；失败顺序须使非法合同、能力与编译错误在意图写入／发送前发生。dry-run 显示真实 wire 与非秘密 header，不取环境 key、不建库。
- JSON 图片使 wire 字节仍有确定定义；请求留存开关同时控制 wire 和 carrier。schema 新增合同及 carrier 等必要摘要，严格版本检查；显式迁移只保留可证明来源，未知历史独立分层。
- elapsed 冻结点供日志与输出共用；usage 按服务请求级提取一次。统计不读正文补算合同、缓存或拒答；succeeded 仅指技术成功。
- 工具实现与 Case 由实现 owner 写入，行为／人类文档、迁移 Markdown 与决策由文档 owner 写入。生成产物由构建更新，skill 版本从 8 提升至 9 一次。阶段点正确性审查不承担风格重写，末期再分开做 AI-ready 与编码规范优化。

## Risks / Trade-offs

结构化内容转换保持信息不证明模型行为等价；图像 codec、处理后预算、长程质量与实际账单仍需真服务证据。旧未知合同不能由 endpoint 猜测。含 Base64 的预览和日志是敏感正文。无需自动拆题的代价是拒绝无法保真请求，但避免隐式增加费用和可见范围。用户已授权本轮必要 Git 提交及正常 hook 自动推送，并同意提交保存后结项删除当前 Change；先使完整 Plan 可从 HEAD 精确恢复，再通过公开 finalize 门禁删除。授权不表示已经提交、推送或结项。

## Open Questions

暂无需用户决定的设计问题；公共合同已冻结，精确规格由[包内接入合同](../../skills/lightweight-judgment/references/protocol-adapters.md)承接。剩余的是验证边界而非待选方案：OR 指定 OpenAI 路由只具文档与 mock 合同，真实 403 未证明成功或拒答形状；原生 TypeSafe／OpenAI 尚无在线成功证据。若新证据与合同不符，应重新审查受影响的实现和边界，不绕过校验。
