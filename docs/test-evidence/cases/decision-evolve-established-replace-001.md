### Case DECISION-EVOLVE-ESTABLISHED-REPLACE-001: Evolve 只替换已建立记录的完整关系

Tests:
- `test:fb2c826e55bc197116868609cd2d04ade1ddcfe7cf9acc28ead79b4920d93ebb`

Tags:
- `decision-records`

Contract:
- Evolve 修订已建立记录时只能完整替换 relations，必须保留正文、status、alignment、createdAt 和摘要字段；移除的旧目标不自动改变生命周期。

Proves:
- 关系替换前后的 status、alignment、createdAt、title、purpose、background、decision 与三段正文逐项一致。
- 最终关系只包含新的替代目标；该新增目标从 active 归档，已移除的旧目标继续保持 archived。
