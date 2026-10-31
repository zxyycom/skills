### Case INVESTIGATION-SELECTED-OLD-OWNER-FRESH-001: fresh重新验证旧owner缺失

Tests:
- `test:4d18364ffbd488278a240d0efefe6ac41009efed6ace318971761ae946a9fb90`

Tags:
- `investigation-report`

Contract:
- 旧owner缺失必须在独立fresh再次核对，准备通过不授权清除后来出现的树。

Proves:
- 准备后才创建的旧owner和winner文件使同步失败，内容与index原字节均保持。
