# Test Design

`test-design` 选择关键、必要、低成本的测试。建立与保留都须证明有效性、保护价值、形态与开销必要性；已有测试、Case 或覆盖率不授予保留资格。AI 执行从[行为入口](../../skills/test-design/SKILL.md)开始。

## 共同原则，两套 SOP

按任务意图选择流程：

- **[测试设计](../../skills/test-design/references/design-workflow.md)**：为功能、Bug 回归或具体测试改进形成最小候选，举证选择并按授权实现；不承担全量盘点。
- **[存量测试审查](../../skills/test-design/references/existing-tests-review.md)**：全部候选从待审开始，逐项或按明确成员成组举证，对账后交付保留集合；发现少数问题不代表其余必要。

修改旧测试不自动转成存量审查，混合任务划分范围。两套流程共用[测试范式](../../skills/test-design/references/test-patterns.md)和以反例校准判断的[易错集](../../skills/test-design/references/judgment-pitfalls.md)。

## 关键边界

单条测试只证明自身责任；有效且重要也须证明当前形态和成本的必要性。准入失败可无替代退出，关键契约可因成本不自动化，改进方案独立准入。完整处置与误删边界由[主入口](../../skills/test-design/SKILL.md#准入结果与处置)承接。

[设计反馈](../../skills/test-design/SKILL.md#设计反馈与重新裁决)比较实现与测试的整体得失；实际变化后重新准入受影响候选。

## 分工与验证

本 skill 负责设计与取舍；[Test Evidence Review](test-evidence-review.md)负责实际证据、Case 与引用，账本及 Gate 政策仍由项目管理。

格式检查只证明结构；效果验证需另行核对设计是否轻量、审查是否覆盖全部保留项、未通过者能否退出及有效保护是否误删。静态判断与执行结果分别报告。
