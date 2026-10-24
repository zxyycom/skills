### Case VIDEO-ARTIFACT-UPDATER-PRESERVATION-001: 实际视频 zip 的离线更新与保留

Tests:
- `test:02088779340b25bb2fc7f53b73bb1d06da3e385e56cc7efa2b678161b1c2005c`

Tags:
- `video-understanding`

Contract:
- updater 检查不写安装包；更新只覆盖正式 zip 中的路径，保留额外文件、已装依赖和包外配置／证据；依赖需要时显式 frozen 恢复。

Proves:
- 安装包内真实 updater 在仅响应固定 URL 的离线 release fixture 下检查旧版本，不下载 zip 且不写包；确认更新后所有正式文件与原 zip 逐字节一致，同路径定制被覆盖，额外文件、依赖、配置与证据不变；移除测试依赖后入口明确失败，按更新后的随包锁文件重装恢复且包外文件不变。
