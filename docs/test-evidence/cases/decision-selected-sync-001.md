### Case DECISION-SELECTED-SYNC-001: 所选 Decision 同步验证必要依赖并发布局部变化

Tests:
- `test:1485e8f104936cefa55fddb1d0195c5dbcf2ed9c459492faae1e00eb3625f767`
- `test:3d7ed27a8dbc8f22a7661346022083a7e8daf0af93519861725cbe452f4fd98c`
- `test:6d193a90976e6fe87d936d5458d1ea927782e5623ab6d5aeb23fc142ad944541`

Tags:
- `decision-records`

Contract:
- Decision `sync-index --select` 在合法发布基线上验证所选已知路径与必要依赖，只接纳所选变化并验完整组合图；`--preflight` 同范围只读预演。

Proves:
- 原生 selected preflight 对必要依赖漂移返回 dependency-stale；依赖恢复后 coverage 包含所选与依赖。另一个实际文件 fixture 验证预演状态、所选提交与未选 revision 保留。
- 构建组合投影时，独立图校验拒绝指向不存在目标的所选条目。上述节点调用原生事务和领域接口，不证明 CLI 文本渲染或与 full sync 的字节等价。
