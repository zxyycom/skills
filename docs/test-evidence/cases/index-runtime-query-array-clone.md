### Case INDEX-RUNTIME-QUERY-TRUST-002: 动态克隆产物不获得验证复用

Tests:
- `test:85367aa99750045d1cf32d2674b876829aefa75a821a1a20150ca5f88e430510`

Tags:
- `index-runtime`

Contract:
- 克隆结果无法证明是稳定 data-only 数据时，字段物化保留逐次验证行为。

Proves:
- 数组自定义 map 返回动态 getter 时，第二字段检测到非 JSON 值并失败。
- map 返回其他合法关系时，投影保留其实际结果而非改写数组语义。
