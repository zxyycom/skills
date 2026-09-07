### Case SKILL-UPDATER-REPLACE-PRESERVE-001: Updater 替换包文件并保留本地自定义

Tests:
- `test:af03c760cd9fbc1655d13c501697e9281d0bb2b32e0b0cf2e0c1fe370a0d8c70`

Tags:
- `skill-updater`

Contract:
- 更新必须替换远端包拥有的文件，同时保留不属于包的本地文件。

Proves:
- 包文件更新为远端内容，本地自定义文件内容不变。
