### Case INVESTIGATION-SELECTED-REQUIRED-DEPENDENCIES-001: 必要依赖当前性与完整删除闭合

Tests:
- `test:0eacd99d3bd286e55bcd67ace00229d96a567509c1cafbbcb6d751202ac834d8`

Tags:
- `investigation-report`

Contract:
- IR局部更新必须验证相关未选依赖仍匹配发布事实，最终完整组合图不能产生dangling关系。

Proves:
- 关系目标存在未同步修改时拒绝选择来源的同步，index字节不变。
- 删除仍被引用的所选报告时失败，完整index保持。
