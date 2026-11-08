### Case INVESTIGATION-STAGE-SOURCE-PATH-DELETE-001: 依据 HEAD 索引位置暂存已删除报告

Tests:
- `test:a8e662b1b943b525eefa370760c6f635b5344e5a5d50a13b556e6d88fb27b430`

Tags:
- `investigation-report`

Contract:
- domain scope 暂存 baseline-only 报告及 owner 资源删除时按 HEAD 索引 sourcePath 定位。

Proves:
- 真实 Git 中 HEAD 的语义报告路径与资源均从 pending 删除，索引 pending 和未选报告 pending 保持。
