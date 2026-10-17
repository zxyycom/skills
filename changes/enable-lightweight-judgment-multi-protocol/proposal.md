# Proposal

以同一 JEV 载体接入 JEV 与 OpenAI Decisions，并将模态、日志和结果差异纳入一次发送的明确契约；本文保存本轮临时实施计划。

## Why

现有 lightweight-judgment 仅支持旧 OpenRouter System One 文本合同。用户已经选择以 JEV state/questions 自动转换，同时要求图片、JEV Box 和长上下文实际接入；只扩展 model 字符串无法兑现协议、凭据、模态或恢复边界。

## Outcome

用户点名 skill 后，可通过可信配置选择 JEV 或 OpenAI Decisions，用同一 state/questions 组织受支持的判断；CLI 忠实编译、单次发送、保留原答并给出独立统一结果，对无法保真的组合在发送前拒绝，且可用新日志与只读统计核对调用。

## Scope

### Intended Change

- 封闭接入旧 OpenRouter System One、TypeSafe native、OpenRouter alpha（JEV 与指定 OpenAI 模型）、OpenAI Decisions；旧配置行为不变，不建立插件平台。
- 保留 JEV 载体、原序与严格 JSON；图片采用显式内联 PNG/JPEG 节点；接入 JEV Box 与可信长上下文选项。
- 分离 provider raw 与 normalized；直接 `openai-decisions` 支持逐题合法拒答，与技术失败分开；不向 OpenRouter answers map 合同外推该能力。

### Resulting Impacts

- 配置必须按接入合同隔离 endpoint/model/凭据与实验 header；图片关闭仍须阻止服务可解释节点，OAI 局部图与 Box 不能静默改义或拆分。
- 日志保存实际 wire、可选 carrier 与版本化合同；schema 显式升级，旧历史不猜合同，不自动迁移真实库；统计增加合同维度并保留未知与 NULL 语义。
- 同步 skill 包内知识、CLI／日志／统计／迁移说明、独立版本与生成产物、测试证据；长期取舍进入 Decision，历史调查保持形成时认识。

## Success Criteria

- 四种 adapter 的离线／mock 合同覆盖各自的文本编译、模态门禁、raw/normalized、配置凭据隔离、日志与迁移／统计，直接 OpenAI 的逐题拒答单独验收，且旧配置回归通过。
- 在授权与账号可用范围内执行必要 OpenRouter 真调用；真服务证据与未覆盖 TypeSafe/OAI、质量／容量边界分别报告，不用 mock 充当在线证明。
- 阶段正确性审查、末期 AI-ready 文档优化与编码规范优化完成；生成产物一致，相关 Case/index 与全仓检查通过。
- 仅使用已授权 OpenRouter 凭据，不输出或提交秘密，不读取或迁移真实用户库。按用户最新授权整理必要 Git 提交并保留正常 hook 自动推送；计划完整保存到 Git 后，经 `finalize --preflight` 核对可精确恢复，再结项删除当前 Change 并提交该删除。

## Affected Owners

- `tools/lightweight-judgment/`：适配、输入输出、传输、日志 schema、迁移 SQL、统计及测试。
- `scripts/build/lightweight-judgment.ts` 与 `skills/lightweight-judgment/scripts/`：构建与分发；测试 Case/index 由测试证据 owner 维护。
- `skills/lightweight-judgment/SKILL.md`、`references/`、`migrations/`：行为与分发知识；`docs/skills/lightweight-judgment.md` 为人类入口。
- `docs/decisions/`：多协议长期选择与兼容／恢复取舍；当前目录只拥有本次实施进度。
