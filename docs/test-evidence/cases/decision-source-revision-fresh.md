### Case DECISION-SOURCE-REVISION-FRESH-001: 独立来源发现重新观察字节身份与候选状态

Tests:
- `test:79f3c1e671c99b1464683cc576f4bda21e9ae59b4c7215974ebbbe828ede26bc`

Tags:
- `decision-records`

Contract:
- 各次来源 revision 获取独立读取当前文件，不跨阶段复用身份或候选状态。

Proves:
- 连续调用分别观察字节变化产生的新 revision、来源退回 candidate 后的排除，以及重新建立后声明的新身份。
