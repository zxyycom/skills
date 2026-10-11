### Case DECISION-FILTER-EVIDENCE-LINEAR-001: 私有追加消除命中数组平方复制

Tests:
- `test:853856d60bf84f2f95fe681a2328b6db1b0c558081c281fe43399991222bad96`

Tags:
- `decision-records`

Contract:
- type-only 关系筛选保持完整 tuple 去重、code-unit 排序、summary 与独立调用结果，不在追加时复制累计命中数组。

Proves:
- d=10/100/1000 的反序边与重复 tuple 返回完整且有序证据；证据数组 iterator 访问受线性上限约束，重复调用不共享输出数组。
