# 原生复杂度调查：补充条件与静态候选

本说明补充[报告正文](../../261107-record-cli-native-complexity.md)未展开的测量条件和源码定位。以下位置均指形成时的 `tools/record-cli/src/`。

## 长行预览和观察边界

私有单记录正文追加 ASCII 行，查询使用 any 模式。连续 L 个 `x` 的命中范围应合并为 `[0,L)`；单个 `x` 后接 `z` 只有 `[0,1)`；交替 `xz` 的前三个分离范围分别为 `[0,1)`、`[2,3)`、`[4,5)`，第四个触发预览截断。每次核对身份、matched、coverage、范围、截断标志及 warning。

预览上限为 24,000 个 UTF-16 单元：64 KiB 连续行的 JSON 直接观察到 `[0,24000)`，完整终点由输入与合并机制推导。正文修改后沿用原索引 revision，查询使用 `published-index+current-text / currentness: unchecked`，不把它当作索引当前性验证。长行、大 Q 和名称预检的首尾守卫分别覆盖被测资产与输入，但不证明系统库或采样期间每一瞬间不变。

两轮预探分别有 30、50 个早期成功记录；预探最初未把预览截断 warning 纳入预期而停止，CLI 退出均为 0，修正预期后才另跑主批。独立小输入模型核对公式，另重跑 Q=8 核对身份、coverage、截断及 warning；该次是正确性复核，不作为表中性能样本。

## 其他源码候选

- **全集统计与排序**：`investigation/list.rs:122–160` 构建 facets，保存匹配项并排序后分页；`investigation/metadata.rs:72–94` 按来源排序后过滤。精确 total/facets 需观察全集，全排序和保留量可与有界窗口比较，须保持稳定顺序及大 offset 语义。局部排序未独立计时。
- **图准备与事件**：`domains/graph.rs:7–39,81–90` 建邻接并排序；`trace/selection.rs:123–195,275–311` 处理 BFS、事件和 frontier。现行事件使用 seen、指针表和 HashMap 聚合，历史原型的普通 unit 两两查重已收敛；复杂事件、长共同前缀和 DR 重划仍需独立计数。
- **选择性同步、身份更正和保留量**：`mutations/sync/selected_sync.rs:47–76` 在新 ID 且有当前值时扫描 updates 找旧 ID 删除，存在 K² 候选，但公开 CLI 能否产生该批量组合未证实。同文件的投影副本及 `preview.rs:43–59,153–194` 的整行规范化和映射会产生临时保留；实际 RSS、同时活跃字节及收益未测。
