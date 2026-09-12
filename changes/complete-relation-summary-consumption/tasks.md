# Tasks

按领域实施 P1–P4，再同步 P5/P6 的读取契约与交付证据。源码、测试及分发维护遵循 proposal 的 owner，测试改动随实现同步 Case 与索引；每项勾选以对应产物或执行结果为依据。

## Readiness

- [x] 0.1 完成两域逐入口审计及覆盖率重算，标明契约、源码、实跑与未验证分支；见[审计 E1–E7](relation-summary-audit.md)。
- [x] 0.2 确定 P1–P6 的范围、有意省略、数据边界和 owner；proposal 与 design 一致。
- [x] 0.3 定稿 filterRelations、relationReview、set-relations preflight、输出预算及兼容边界。
- [x] 0.4 取得 E8 复杂图选集和改前输出，明确 P4 逐边目标布局，并将成功标准映射为实施与验证任务。
- [x] 0.5 审计文档重心、负向规则、历史残留、篇幅与 Markdown 层级；保留必要契约及证据，清除会话过程描述。
- [x] 0.6 按代表性实施问题复核字段、来源、事务阶段、复杂边归属和验证入口，确认可直接实施；Plan、链接与仓库检查通过后放行提交。

## Implementation

- [x] 1.1 实现 Decision 内部 list/metadata search/content search 的同快照 filterRelations 及有界展示，含内容读取降级；见 P1/P2，验证 2.1/2.2。
- [x] 1.2 实现 Investigation list/search entry 的 filterRelations 与展示，同步公开声明；见 P1/P2，验证 2.1/2.2。
- [x] 1.3 实现 Decision 新候选 activate/evolve 的 relationReview，保留领域准备/提交结果的完整 before/after，覆盖多后继与组合删除；见 P3，验证 2.3。
- [x] 1.4 实现 Investigation publish/set-relations 的 relationReview 和 set-relations preflight，同步 options/result、CLI 参数及 help；见 P3，验证 2.3。
- [x] 1.5 实现两域无摘要标记、转义与切片提示，调整 Decision 事件摘要承接位置；见 P4，验证 2.4。
- [x] 1.6 同步两个 skill 的读取指引、固定契约及必要的人类说明；按 Decision Records 流程记录长期消费取舍；见 P1–P6，验证 2.5/2.6。
- [x] 1.7 运行 bun run sync:decision-records-cli 与 bun run sync:investigation-report-check 生成脚本/声明，按工具链规则递增实际受影响的 skill 版本；验证 2.6。
- [x] 1.8 最终验收前由独立代码优化子代理按编码规范优化本次实现，清除无必要抽象，并重跑受影响验证。
- [x] 1.9 最终验收前由独立文档优化子代理使用 AI-Ready Docs 优化实际变更的长期文档，保持行为契约与实现一致。

## Verification

- [x] 2.1 验证两域 predecessors/successors/both/type-only/组合条件的完整筛选边、source 归属和无条件省略；覆盖有/无摘要、超过三边、CLI 余量/detail 展开，核对记录集合、排序、total 和分页不变。
- [x] 2.2 验证 metadata 文本命中、仅关系筛选命中、同边双重证据、无条件查询与 content 降级；matchedRelations 仅含实际文本命中，筛选依据来自同次来源快照。
- [x] 2.3 验证建立、替换、清空、summary-only 增改删、unchanged 与多来源事务；比较预检前后文件及暂存状态证明零写入，核对正式集合；覆盖非法输入、提交失败和恢复分支，失败结果不附成功 review。
- [x] 2.4 验证 P4 五组复杂图的改后文本、source/type/target 和摘要；覆盖缺省、相同摘要、引号转义及 depth/max-records 截断，比较改前/改后 JSON、成员、coverage、frontier、blockedEvent 一致性。
- [x] 2.5 回归 raw show/show-candidate、候选与状态回执、rename 摘要保留、parser/index 透传、合法缺省及 40 码点；运行受影响的最小原生测试并核对 Case 与 test-evidence-index.json。
- [x] 2.6 运行 bun run check:decision-records-cli、bun run check:investigation-report-check、bun run check 和受影响的版本/打包检查，核对声明、help 与读取指引；交付真实验证证据和剩余边界。
- [x] 2.7 在实现稳定及最终优化后的阶段点完成独立正确性审查，修复实质缺陷并取得定向复核证据。
