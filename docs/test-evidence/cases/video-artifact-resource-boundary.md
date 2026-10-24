### Case VIDEO-ARTIFACT-RESOURCE-BOUNDARY-001: 实际视频 zip 的物理资源定位

Tests:
- `test:cdaebd8849166d680880ed97b14a6bde87e76bd9790edbab3094176e1de77455`

Tags:
- `video-understanding`

Contract:
- 实际分发入口经目录别名调用时仍从物理安装根定位随包资源；证据不能通过路径别名写入安装目录。

Proves:
- 真实 zip 的中文目录别名与物理目录均拒绝包内输出；受控 spawn 探针观察到物理根的 runtime.env、media.py 与离线环境值，随包 OCR 程序和 profile 存在；探针不证明真实媒体或 OCR 可用。
