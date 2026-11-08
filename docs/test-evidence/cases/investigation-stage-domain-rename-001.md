### Case INVESTIGATION-STAGE-DOMAIN-RENAME-001: 领域选择把显式重命名组成删除与新增

Tests:
- `test:254b741c592ab9047df47c96fd959aa77a863b700412e6daa10a4207f380befd`
- `test:a8e662b1b943b525eefa370760c6f635b5344e5a5d50a13b556e6d88fb27b430`
- `test:af7b7418426110fcb814dc47f8d41a77b6410d29ea7afa86f56994e97362bfac`

Tags:
- `investigation-report`

Contract:
- domain scope 的身份更正可同时选择旧 ID 与新 ID；旧路径删除、新路径新增按来源位置分别处理，domain 不暂存索引。

Proves:
- IR 真实 Git 分别验证选中新增的报告及 owner、选中 baseline-only 报告及 owner 删除，并保持 pending 索引。
- IR 真实 Git 另验证同路径旧 zulu 与新 alpha 双 ID 选择时保留新正文。源码将选中位置逐路径并入同一更新集合；本组合不声称单次运行了跨 ID 不同路径组合。
