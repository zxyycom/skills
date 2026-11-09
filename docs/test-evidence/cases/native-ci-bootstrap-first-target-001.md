### Case NATIVE-CI-BOOTSTRAP-FIRST-TARGET-001: 首次引导目标前置状态

Tests:
- `test:5588479c4dbfb0648771fd9d010f43890ac5427ca748f82ca4a5c3bc768aff19`
- `test:fdec41368c94371893da7a75dcf69a7fe07677e7b060e7c757fa89b37557f880`

Tags:
- `repository-tooling`

Contract:
- 私有与真实 release bootstrap 平台验收的新装目标在检查和激活前必须为空；已有匹配身份的目标则在激活前保留自有 sentinel 以验证包外文件保留。

Proves:
- 真实目标状态验证器和隔离 bootstrap 替身分别检查新装和已有目标的检查、激活与 sentinel 时序；在线验收节点另通过隔离子进程验证参数及相同的前置状态。不证明真实平台安装、远端下载或真实平台行为。
