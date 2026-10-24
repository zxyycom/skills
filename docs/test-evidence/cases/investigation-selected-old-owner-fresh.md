### Case INVESTIGATION-SELECTED-OLD-OWNER-FRESH-001: fresh重新验证旧owner缺失

Tests:
- `test:f70194b9b519a44ff3482d1b6a43498cf373139dca7dc2e4e8c4b1ad5d0ca6e1`

Tags:
- `investigation-report`

Contract:
- 旧owner缺失必须在独立fresh再次核对，准备通过不授权清除后来出现的树。

Proves:
- 准备后才创建的旧owner和winner文件使同步失败，内容与index原字节均保持。
