### Case LIGHTWEIGHT-JUDGMENT-LOG-JOURNAL-BUDGET-001: WAL 切换等待预算

Tests:
- `test:f5185371d50ef26b5d8f581dd751dce77631ee70b51b7aea8f986b6c547a1cfc`

Tags:
- `lightweight-judgment`

Contract:
- 初始化 WAL 切换 BUSY 等待使用单个五秒预算，耗尽后报 storage 且不发送。

Proves:
- 真实 competing BEGIN IMMEDIATE 锁一直保持时，切换反复尝试但约五秒退出4、attempts=0、fetch=0，库中没有调用记录。
