# Design

从具体写作结果反推能力边界，再参考现有方法形成可执行契约；候选范围与实现方案待收敛。

## Context

本 Change 提炼可独立使用的写作辅助能力，与[卡片写作工作流](../establish-card-driven-novel-writing/design.md)各有交付结果。两者按实际需要协作，辅助能力的提炼与验证可独立推进。

以下是初始参考；采用前需核对具体版本、许可及行为证据。

| 参考材料 | 相关能力 |
| --- | --- |
| [clinlx/write-novel-skill](https://github.com/clinlx/write-novel-skill/blob/master/SKILL.md) | 分层规划、读者乐趣、人物张力、镜头与审稿 |
| [Chinese-WebNovel-Skill](https://github.com/Tomsawyerhu/Chinese-WebNovel-Skill/blob/v2/SKILL.md) | 转场、对白、章末、因果与人物一致性 |
| [fiction-writing-prose](https://github.com/alt-code-ai/agent/blob/main/skills/fiction-writing-prose/SKILL.md) | 声音、视角距离、细节与修订，含英语文学写作偏好 |
| [deslop](https://github.com/tance-mang/chinese-webnovel-skills/blob/main/skills/deslop/SKILL.md) | 中文网文语言修订，含特定节奏与标点偏好 |

## Goals / Non-Goals

- 目标：形成能改善具体写作任务的判断与动作，支持独立使用和按需协作。
- 交付边界：经审阅与验证的写作能力及必要资源；原文作为方法参考，具体留存按用途和许可决定。

## Decisions

### Intended Change

用户目标是以原文为参考提炼适合的 skills；暂定按以下路径收敛：

1. **确定写作结果。** 从代表性请求选择候选，优先考察结构与读者期待、场景呈现、对白与人物声音、保留作者风格的正文修订。
2. **选择能力归属。** 独立意图、责任和验收同时成立时创建 skill；局部方法进入相应 owner 的按需资源。数量由实际边界决定。
3. **恢复行为契约。** 提取判断、动作、输入输出、适用条件和例外，区分作者规则、题材偏好与运行前置，再用可维护的表达组织正文。
4. **声明协作。** 辅助能力提供诊断、方法或当前授权的局部产出；作者工作流继续负责卡片流转与修改权限。真实调用明确前置条件和缺失路径。

### Resulting Impacts

1. **来源与资源。** 核对参考版本、许可和归属；保留原始示例时单独审查可分发范围。`SKILL.md` 保存共用行为，专项知识与模板按需归位。
2. **职责边界。** 审查候选与卡片工作流的重叠，明确独立使用和协作权限；正式契约建立后交给对应 skill 维护。
3. **验证与交付。** 用代表性请求及正反例验证判断差异，包括正文可保持原样、结构问题需要回到规划等情形；分别报告模型辅助判断与机械证据。候选收敛后同步入口、版本和分发检查，独立生命周期的实现按需拆分 Change。

## Risks / Trade-offs

- 参考材料的题材偏好可能冲突，采用范围需与当前目标一致。
- 技巧与工作流职责可能重叠，独立边界以实际请求和验收为依据。
- 效果依赖题材、作者和模型，行为证据须说明覆盖范围；原文留存另受许可与维护成本约束。

## Open Questions

转为 Plan 前核定：

1. 首批写作痛点、代表性请求，以及要保留的题材、文风与镜头习惯。
2. 实际采用材料的版本、许可与引用范围。
3. 候选归属、最终名称、数量和必要协作契约。
4. 最小行为验证样例、改善证据和机械检查边界。
