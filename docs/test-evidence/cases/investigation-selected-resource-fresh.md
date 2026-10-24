### Case INVESTIGATION-SELECTED-RESOURCE-FRESH-001: 局部资源必需性与来源fresh

Tests:
- `test:a4d7fcbde932e6af94dfb9a89e9b4fb64b59cee1c72bed5968c157a64e78f7fa`

Tags:
- `investigation-report`

Contract:
- IR selected sync 验证所选直接资源，并独立fresh当前来源，不从发布投影补造资源或吞掉后来的编辑。

Proves:
- 已知直接资源缺失时拒绝且index不变。
- 资源恢复后准备阶段的source后来被编辑，fresh仍拒绝并保留后来正文和原index。
