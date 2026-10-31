### Case DECISION-STAGE-UNSELECTED-INVALID-001: Stage 隔离未选择的无效来源

Tests:
- `test:fdafea3b600ddd3e6ec041fdd5c0423adbe90c91b8de6a80a9e2e3fcfd13b71b`

Tags:
- `decision-records`

Contract:
- 未选择的非法工作区来源不阻断按已验证发布投影定位的合法 stage，也不自动进入 pending。

Proves:
- 真实 stage 在出现未同步 invalid.md 后仍成功，Git pending tree identity 保持不变。
