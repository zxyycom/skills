# Test Evidence Review

AI 很容易把 TDD、防回归和覆盖率理解成“尽量多写测试”。结果通常不是更可靠的证据，而是重复等价类、实现细节断言、mock 自证和需要持续维护的测试库存。另一些真实风险受当前架构或环境限制，强行机械测试的成本又可能高于价值。

`test-evidence-review` 把测试和相关风险统一视为候选验证义务。它先判断候选是否值得长期维护，再选择自动化证明、人工审查或发现豁免；无法形成稳定义务的测试不新增，已有低价值测试则合并或删除。

调用这个 skill 时，会同时启用两个边界清楚的工作面：

1. 语义准入判断测试是否值得存在、是否重复、是否绑定实现，以及风险应自动验证还是人工审查。
2. 可追溯登记默认启用：Markdown 账本保存 automated、review 和 exempt 三种验证义务，不枚举每个测试函数。
3. `@test-evidence main` 标记自动化主入口，`derived` 把测试源码归入已有主 case，`exempt` 把发现误报映射到有原因的豁免 case。
4. 随 skill 分发的 Node CLI 检查账本状态、验证方式、源码角色、主入口路径和未登记测试文件。
5. 跨语言发现以文件为最小归属单元，支持 Rust、TypeScript、JavaScript、Python、Go、Java 和 C#，并提供 ignore、warn 和 error 三种接入强度。

CLI 不执行测试，也不能机械判断自动化证据是否有价值、人工审查是否完成。测试框架继续负责运行行为，项目测试策略继续拥有测试层级和覆盖要求；这个 skill 负责完成验证义务准入，并让后续审计能够定位测试为何存在、哪些风险仍依赖人工检查，以及哪些发现结果被豁免。实现变更命中账本中的 review `Scope:` 时，skill 会执行并报告对应人工检查动作。

实际 skill 位于 [`skills/test-evidence-review/`](../../skills/test-evidence-review/)。
