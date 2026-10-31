### Case RECORD-SELECTED-IDENTITY-CORRECTION-001: 已知路径改身份必须同选旧新ID

Tests:
- `test:62c41357553572feadfc943dd48da04462e7994ecb31e8c23db6ae1e6d21c58b`
- `test:90342c6681bf0a19bd04d17ce1ee271a5f840587102654431fde07042aa4c4b9`

Tags:
- `decision-records`
- `investigation-report`

Contract:
- 已知sourcePath内身份更正仅在显式同选旧、新ID并在合法发布和本次读取范围内证明唯一时接纳。

Proves:
- 只选旧ID零写失败；同选旧新ID后去掉旧条目并将新ID定位到原已读sourcePath。
- coverage包含旧新身份标签，不把旧ID标签解释成当前仍存在。
