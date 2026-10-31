### Case GATE-SELECTED-ACTIVATION-001: 原生调度只执行必要集及所选能力依赖闭包

Tests:
- `test:6c0a0d661d04681a410d5e4e4b1eddeecb63a6e0dd743e5d2e18357e1f5d0351`

Tags:
- `repository-tooling`

Contract:
- selected 保留完整 69 项 catalog，执行固定 quick 必要集、显式能力订阅根与 dependsOn 闭包，不从工作区变化扩大范围。
- 必要集不因能力 flag 未选而关闭；含维护代码的领域追加 file/function metrics 及 typecheck、lint、format:check，duplicate-detection 仍只订阅 repository-code；validate 只由 repository-validation 或 skill-validator 选中。

Proves:
- 真实 Vibe 调度在替换执行器的 catalog 上逐项核对通过或 not-applicable：gate-tests 追加自身入口及代码质量五项，decision-stage-tests 追加 pending-stage 及代码质量五项，mcpshell 追加三个叶子、代码质量五项及生成 provider；重复和联合选组不重复执行。
- 六项必要 Check 始终执行；无代码的 decision-collection 只追加决策集合检查、不激活代码检查；repository-code 另加 duplicate-detection；repository-validation 和 skill-validator 均追加 validate，后者的生成检查保持前置。
- selected Definition 中 typecheck、lint 与 format:check 继续使用不带路径裁剪的原 package script argv；选组只影响三项命令的激活，不冒称它们的全仓输入已裁剪。
- CLI 不调用全工作区准备或 receipt 发布，controls 只携带去重所选 flags；性能摘要基于原生终态如实给出请求组、适用与执行 ID、计数及真实生成前置，不把直接选中的代码质量项误列依赖，无 gate-incremental.json。
