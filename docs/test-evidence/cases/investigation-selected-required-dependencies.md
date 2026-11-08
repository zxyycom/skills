### Case INVESTIGATION-SELECTED-REQUIRED-DEPENDENCIES-001: 必要依赖当前性与完整删除闭合

Tests:
- `test:b57fb8c86345ac03e9f0f5bd132527c69b17a5974afa552b5ed24e5d8866437f`

Tags:
- `investigation-report`

Contract:
- IR局部更新必须验证相关未选依赖仍匹配发布事实，最终完整组合图不能产生dangling关系。

Proves:
- 所选来源依赖未选目标且目标正文已漂移时，preflight 返回 dependency-stale，index 字节不变。
- 删除仍被引用的所选报告时 preflight 返回 projection-invalid 且标识关系双方，完整 index 字节保持。
