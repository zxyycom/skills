### Case DECISION-SOURCE-REVISION-FRESH-001: 独立来源发现重新观察字节身份与候选状态

Tests:
- `test:737018312a8c42220cda1444fa0258bc40d7a7c719ceb8fd89a781508030ecda`

Tags:
- `decision-records`

Contract:
- 各次来源 revision 获取独立读取当前文件，不跨阶段复用身份或候选状态。

Proves:
- 连续调用分别观察字节变化产生的新 revision、来源退回 candidate 后的排除，以及重新建立后声明的新身份。
