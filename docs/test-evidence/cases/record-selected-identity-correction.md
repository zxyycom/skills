### Case RECORD-SELECTED-IDENTITY-CORRECTION-001: 已知路径改身份必须同选旧新ID

Tests:
- `test:62e910fb5d0b106bddc3f6e90ab5d69621766d47f5744ec8c60109f612c2438b`
- `test:f1fabc4ac410ea3b4e6ad32775704cf975001c63e2c1a7f132f9d697069d1235`

Tags:
- `decision-records`
- `investigation-report`

Contract:
- 已知sourcePath内身份更正仅在显式同选旧、新ID并在合法发布和本次读取范围内证明唯一时接纳。

Proves:
- 只选旧ID零写失败；同选旧新ID后去掉旧条目并将新ID定位到原已读sourcePath。
- coverage包含旧新身份标签，不把旧ID标签解释成当前仍存在。
