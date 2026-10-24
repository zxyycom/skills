### Case INVESTIGATION-RENAME-SHARED-FRESH-001: 更名写前重叠保护共用一次观察且写后独立

Tests:
- `test:4dd057ac0b65dfc070e93b59d39f0e5dd107534ad340afd269501479373359a9`

Tags:
- `investigation-report`
- `record-operations`

Contract:
- IR rename 在 beforePublish 后实际取得来源安全事实；同阶段完整 expected 等价的重叠保护共用观察，写后独立取得当前事实。

Proves:
- 在真实 rename 中，hook 先于所有包含未变来源的 phase 验收；写前各重叠队列的实际来源打开增量合计为一，独立 shared postwrite 增量为一，操作成功。不固定准备、领域 postverify 或原生索引 freshness 的全链总次数。
