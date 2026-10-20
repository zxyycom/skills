### Case DECISION-STAGE-UNSELECTED-INVALID-001: Stage 隔离未选择的无效来源

Tests:
- `test:7729f02ba8e119b995257d066d2d92611ebe317f3e0577740c2a74a06563d423`

Tags:
- `decision-records`

Contract:
- 有 revision 时，未选择的非法 filesystem 内容不能阻断合法选择，也不能进入 pending；bootstrap 仍不放宽完整扫描。

Proves:
- 真实来源扫描保留合法选定来源及非法未选路径的局部错误；只验证选定来源时成功，不把未选错误升级为全局失败。
