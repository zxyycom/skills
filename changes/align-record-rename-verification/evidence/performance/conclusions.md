# 本轮测量结算

## 结果

- 24 个正式 CLI 样本（四场景 × 两版本 × normal 2 / instrumented 1）与 16 个 1k 自证样本全部通过独立后验；没有正式失败、补跑或择优。最初准备失败独立留存，不混入这些样本。
- normal wall：IR rename 从 `63.132 / 53.126s` 到 `10.010 / 9.961s`；IR discard 从 `16.936 / 17.747s` 到 `9.862 / 10.497s`。这是本机本输入的观察，不是统计置信区间或跨场景加速保证。
- DR rename `10.380 / 8.071s → 7.836 / 7.722s`，discard `9.520 / 8.616s → 8.836 / 8.666s`。低实际写集下没有足够证据把小幅差异解释为稳健提速。

## 由代码机制支持的阶段解释

以下全部是各版本**单次 instrumented**，与 normal 分开：

1. IR rename：fresh + shared preverify `39.121 → 1.813s`，shared postverify `18.345 → 0.671s`。这与 unchanged 从计划写集收口为保护、同阶段 fresh/guard 共享安全观察、验收阶段按既有批读执行的机制相符。before 的 10,003 planned writes / 10,001 unchanged 不表示 10,003 次物理写：journal 原已跳过 unchanged；主要浪费在其串行验收路径。after planned writes 为 2。
2. IR discard：fresh + shared preverify `7.941 → 2.152s` 与同阶段来源接线有机制支持。其他未改阶段明显波动：domain postverify `4.982 → 1.807s`、外部及未归因残差 `9.144 → 5.213s`。before instrumented wall `24.242s` 明显高于两个 normal；**不把这些未改阶段下降归因于本轮代码**，也不把总 wall 下降全部按阶段差值拆成因果。
3. fresh 与 preverify 的边界在 after 有观察共享，必须组合比较；不能只拿 shared preverify 单项下降说少做了验证。shared post 与 domain post 独立列出，不掩盖领域验证义务。

## 共同动作对齐后留下的成本

- after IR rename 的 domain postverify 约 `2.926s`，其中 `verifyCommittedRename` 包容 interval 约 `2.090s`；domain prepare 包容 interval约 `2.795s`。DR domain prepare 约 `4.698s`（已含 initial validation，不能再加一次）。
- after IR discard 仍有 early freshness 包容 interval约 `1.316s`、domain postverify约 `1.807s`，以及外部及未归因残差约 `5.213s`。其容器 interval 已单独标识，不能与 shared 子阶段叠加。
- 这些是当前实现中未合并成本、领域证明、成员/索引/资源检查及未细分工作组成的实际剩余，不证明它们都是不可消除的固有领域 I/O，也不证明继续合并一定正确。未细分残差还含 CLI launch/import/输出；本轮不继续扩大矩阵或猜测最优方案。

## 计数与未覆盖

- 两域每次 rename 最终仅一个身份的旧/新两路径，加一个索引；discard 最终一个正文删除，加一个索引。IR discard 的 2 个 planned writes 含临时 tombstone。没有测大 fan-in 或大实际 changed 集合；该正确性由其他验证承担。
- after IR rename 的 `guards: 20003` 是 guard **条目**，不是 unique 文件数：normalizer 追加 unchanged guards 与原有 guards 重叠。不能把此数字当 I/O/syscall 次数；同阶段复用机制另由产品安全证据验证。
- 完整 10k fixture 保留一个未选 IR owner 的资源文件，其 bytes/mode 未变；所选目标零资源。不覆盖资源移动/恢复性能。
- 每个 instrumented 与匹配 normal 的完整输出文件 manifest、stdout、stderr 精确一致。所有来源/依赖测后未漂移，Node executable/versions 测后相同。CPU/RSS 逐值保留，未声称内存峰值改善。
- 非 cold-cache、非随机交错；共享工作区外部负载不可完全控制；每场景 normal 仅两次。normal/instrumented 差值不能当纯仪器开销。

## 可恢复性

原 10k fixture 已由压缩模板与完整 hash/mode 映射精确重建原 tree/HEAD；frozen after 已从精确 baseline + `product-after.patch` + manifest mode 恢复，1,281 文件完整 manifest 相等。after 有 35 个既有文件内容变化、7 个新增文件；其余 1,239 个仅 source 复制表示差异，不算产品行为变化。源码/依赖本体未提交。

`audit-archive.py` 在 Git 恢复证据后无需 `/tmp`、依赖或产品执行即可复核归档。根代理审计与 Git 保存前保留本轮私有根；清理不触碰旧只读 fixture。
