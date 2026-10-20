### Case SKILL-UPDATER-REPLACE-PRESERVE-001: Updater 替换包文件并保留本地自定义

Tests:
- `test:09122aeebf21da75cac4ad8de3794f32401152e68461c1e7bec1c9daebcab664`

Tags:
- `skill-updater`

Contract:
- 更新必须替换远端包拥有的文件，同时保留不属于包的本地文件。

Proves:
- 包文件更新为远端内容，本地自定义文件内容不变。
