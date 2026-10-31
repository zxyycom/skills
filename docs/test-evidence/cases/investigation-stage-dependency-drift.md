### Case INVESTIGATION-STAGE-DEPENDENCY-DRIFT-001: stage 复核实际消费的共享资源字节

Tests:
- `test:a74f699c98e4d8e1521d553836333fd6e7ba2cfe9899c1bb7e81bd48ef665cc4`

Tags:
- `investigation-report`

Contract:
- 直接共享资源字节是当前阶段输入，准备与独立 fresh 不可跨阶段复用可变来源。

Proves:
- 准备后修改直接共享资源，独立复核再次读取并报告 source-drift；pending 身份不变，后来资源字节保留。
