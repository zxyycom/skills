### Case INVESTIGATION-STAGE-DEPENDENCY-DRIFT-001: stage 复核实际消费的共享资源字节

Tests:
- `test:a19c4e215fa2fbefab4d0175fed7718c41d9bb7849dd6fdbd18b3bd9d2cfd398`

Tags:
- `investigation-report`

Contract:
- 直接共享资源字节是当前阶段输入，准备与独立 fresh 不可跨阶段复用可变来源。

Proves:
- 准备后修改直接共享资源，独立复核再次读取并报告 source-drift；pending 身份不变，后来资源字节保留。
