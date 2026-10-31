### Case DECISION-EVOLVE-ESTABLISHED-REPLACE-001: Evolve 只替换已建立记录的完整关系

Tests:
- `test:160f8cfee240b903dc547e7dde472c889f96c8a6e127946341b90c53a3f08c8a`

Tags:
- `decision-records`

Contract:
- Evolve 修订已建立记录时只能完整替换 relations，必须保留正文、status、alignment、createdAt 和摘要字段；relationReview 对替换展示完整 before/after 差异，重复相同集合明确标记 unchanged。

Proves:
- review 显示被移除的旧边和新增边；关系替换前后的 status、alignment、createdAt、title、purpose、background、decision 与三段正文逐项一致。
- 最终关系只包含新的替代目标；该新增目标从 active 归档，已移除的旧目标继续保持 archived，重复执行显示 unchanged。
