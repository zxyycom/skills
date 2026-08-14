# Proposal

本 draft Change 探索把 Test Evidence 从受控 topic 目录分类改造为平铺 case 文件与记录级 tags，同时保留 Case ID 作为测试证据的语义身份。

## Why

当前 Test Evidence 以 topic catalog 和 `docs/test-evidence/<topic-id>/<semantic-slug>.md` 组织 493 个 case。topic 既决定物理目录和查询分类，又通过聚合 metadata 影响选择性暂存；新增、重命名或重组 topic 会产生与单个 case 无关的集中修改，并让一个 case 难以同时表达多个分类维度。

Test Evidence 已经拥有独立、稳定的 Case ID，目录路径并不是它的语义身份。继续用 topic 约束放置位置，带来的主要是分类重组成本而非身份收益。该集合也没有活动/归档生命周期，因此可以只替换分类和存储布局，而不复制 Decision Records 的归档设计。

## Outcome

每个测试证据 case 以全局唯一文件名平铺保存，并在权威源中携带多个 tags；Case ID 继续作为索引、关联和选择性暂存的语义身份。派生索引直接投影每个 case 的 tags，不再依赖 topic catalog 或 topic 目录。测试入口、Case ID、`proves` 关系、证据审阅规则和账本完整性保持不变，且不增加 Test Evidence 不需要的归档能力。
