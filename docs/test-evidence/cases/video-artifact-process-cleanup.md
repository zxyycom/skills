### Case VIDEO-ARTIFACT-PROCESS-CLEANUP-001: 实际视频 zip 的进程树清理

Tests:
- `test:a50ab19a9a24911af60214b0beb79b7f5e16f596891118491867ac5912046348`

Tags:
- `video-understanding`

Contract:
- 视频分发运行时超时或取消时必须终止其启动的进程树，并保留可区分的 inspection 失败和诊断。

Proves:
- 从实际 zip 导入的进程 owner 启动真实 Node 父子进程；超时和取消分别失败，等待结束后两个 PID 均不存活且诊断含对应原因；该 fixture 不涉及真实媒体程序。
