### Case INVESTIGATION-UNIFIED-DISCARD-SINGLE-LOCK-001: 统一删除在单锁内分类与执行

Tests:
- `test:d37b9ebf280f676e982e364288caa9aa13bc662c72ba336af77a237f1b9f4ff7`

Tags:
- `investigation-report`

Contract:
- 统一discard在一把集合锁内分类并交接同准备阶段layout，候选与正式仍采用自身提交点。

Proves:
- 候选与正式目标均只取得一次锁，所有正文open都在锁内，成功实际移除对象。
- 候选删除不改正式index；最后正式报告删除后保留合法空index。
