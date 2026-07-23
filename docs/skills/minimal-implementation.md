# Minimal Implementation

`minimal-implementation` 处理的是目标、责任和 contract 已经明确之后的实现取舍：多个方案都可能正确，但它们会带来不同数量的依赖、抽象、配置、扩展点、运行状态和长期 ownership。这个 skill 让 agent 识别会改变选择的维护面，要求额外维护面具有当前依据，再选择或报告总体维护面更小且仍正确的方案。

它不是“尽量少写几行代码”的风格规则。少量局部代码可能比新增依赖更容易维护，成熟依赖也可能比自行实现复杂协议更可靠；已有 helper 只有在语义和责任 owner 相同时才值得复用。所有候选都必须先保持 governing contract、项目拥有的安全与运行约束以及匹配验证，之后才比较总维护面。

核心流程只有一条：

1. 固定目标、contract、owner、现实消费者和检查范围。
2. 识别会改变选择的概念、依赖、配置、状态、文件、协调和验证等维护面；简单任务只做紧凑核对。
3. 有界搜索省略或删除、同语义复用、标准库或平台机制、依赖与局部实现；证据足以形成稳定结论时停止。
4. 先通过正确性门槛，再比较候选的总维护面。
5. 根据当前授权应用方案、完成只读 complexity finding，或把证据缺口留作待确认问题。

这项能力既可用于实现前的候选选择，也可用于最终 diff 或指定范围的 complexity pass；二者不是不同模式，只是输入范围和授权出口不同。独立审计只使用 `delete`、`reuse`、`stdlib`、`native` 和 `yagni` 标签；嵌入普通 code review 时服从宿主的 severity 与输出契约。

它与相邻 skills 保持独立：

- `product-architecture-judgment` 判断事情是否该做、做到什么程度以及由谁在哪一层实现。
- `common-denominator-design` 判断多个现实场景是否形成共享契约、变体和分层。
- `test-evidence-review` 判断测试证明价值、人工审查风险与账本维护。
- `minimal-implementation` 只在这些前置已经由项目或当前任务明确后，比较正确候选的实现维护面；相邻 skills 未安装时也不会接管其判断。

## 当前状态

结构、引用、metadata 和 updater 已完成机械验证。行为设计当前为“带显式假设可实现”：尚未在干净独立实例中验证盲态自然发现、显式采用、near miss 与缺少相邻 skills 时的降级。因此当前适合显式调用试用，不把结构验证通过当作行为改善证据。

后续行为探测至少覆盖：未提 `minimal` 时能否从新增抽象或依赖自然发现；标准库、成熟依赖与局部代码之间的候选选择；generic escape hatch、未使用 option 和预防性 shared refactor 的 diff audit；普通机械修改、一般 correctness review、纯可读性重构和共享契约尚未确定时的 near miss；以及缺少相邻 skills 时是否只暴露前置缺口。

上游 Ponytail 的固定逐字快照与 MIT 许可证随 skill 分发，只用于追溯和更新提炼，正常执行不读取。

实际 skill 位于 [`skills/minimal-implementation/`](../../skills/minimal-implementation/)。
