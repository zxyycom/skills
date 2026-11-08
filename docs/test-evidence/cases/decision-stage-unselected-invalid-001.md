### Case DECISION-STAGE-UNSELECTED-INVALID-001: Stage 隔离未选择的无效来源

Tests:
- `test:f46f104e5ce84c3294a22b131385495083983e819190134032dfc126c6a01adb`

Tags:
- `decision-records`

Contract:
- 未选择的非法工作区来源不阻断按发布投影定位的 stage。

Proves:
- 真实 all stage 在未选 record.md 含非法正文时成功，未选文件不进入 pending 且原字节不变。
