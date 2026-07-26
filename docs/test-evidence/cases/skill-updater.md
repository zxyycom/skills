# Skill Updater

### Case SKILL-UPDATER-PUBLIC-CONTRACT-001: Updater 配置、帮助与声明公开稳定契约
Entry:
- `tools/skill-updater/tests/run.ts > updater configuration, help, and declarations expose the public contract`
- `bun test --test-name-pattern="^updater configuration, help, and declarations expose the public contract$" ./tools/skill-updater/tests/run.ts`
Contract:
- Updater 配置、帮助文本和类型声明必须公开一致的 skill 更新契约。
Proves:
- Skill 名称、manifest 资产、CLI 用法和公共导出均可发现。

### Case SKILL-UPDATER-REPLACE-PRESERVE-001: Updater 替换包文件并保留本地自定义
Entry:
- `tools/skill-updater/tests/run.ts > updater replaces packaged files and preserves local custom files`
- `bun test --test-name-pattern="^updater replaces packaged files and preserves local custom files$" ./tools/skill-updater/tests/run.ts`
Contract:
- 更新必须替换远端包拥有的文件，同时保留不属于包的本地文件。
Proves:
- 包文件更新为远端内容，本地自定义文件内容不变。

### Case SKILL-UPDATER-CURRENT-CHECK-001: 当前安装版本被识别为无需更新
Entry:
- `tools/skill-updater/tests/run.ts > updater check treats a matching installed version as current`
- `bun test --test-name-pattern="^updater check treats a matching installed version as current$" ./tools/skill-updater/tests/run.ts`
Contract:
- Check 模式按版本判断当前安装，不因本地正文定制误报过期。
Proves:
- 本地版本与 manifest 一致时报告 current 且不写入文件。

### Case SKILL-UPDATER-LOCAL-OWNER-001: Updater 拒绝其他 skill 拥有的目录
Entry:
- `tools/skill-updater/tests/run.ts > updater rejects a local directory owned by another skill`
- `bun test --test-name-pattern="^updater rejects a local directory owned by another skill$" ./tools/skill-updater/tests/run.ts`
Contract:
- 目标目录中的 `SKILL.md` owner 必须与 updater 目标 skill 一致。
Proves:
- 其他 skill 的目录在远端获取和写入前被拒绝。

### Case SKILL-UPDATER-NON-SKILL-DIRECTORY-001: Updater 拒绝非空非 skill 目录
Entry:
- `tools/skill-updater/tests/run.ts > updater rejects a non-skill directory before fetching release data`
- `bun test --test-name-pattern="^updater rejects a non-skill directory before fetching release data$" ./tools/skill-updater/tests/run.ts`
Contract:
- 非空且不含 `SKILL.md` 的目录不得被 updater 接管。
Proves:
- 目标在获取 release 数据前失败，现有文件保持不变。

### Case SKILL-UPDATER-EMPTY-TARGET-001: Updater 可安装到缺失或空目录
Entry:
- `tools/skill-updater/tests/run.ts > updater installs into missing and empty target directories`
- `bun test --test-name-pattern="^updater installs into missing and empty target directories$" ./tools/skill-updater/tests/run.ts`
Contract:
- 缺失目录和显式空目录都应被视为合法首次安装目标。
Proves:
- 两种目标状态均安装完整远端 skill 包。

### Case SKILL-UPDATER-UNVERSIONED-001: Check 报告未版本化安装
Entry:
- `tools/skill-updater/tests/run.ts > updater check reports an unversioned installed skill`
- `bun test --test-name-pattern="^updater check reports an unversioned installed skill$" ./tools/skill-updater/tests/run.ts`
Contract:
- 缺少有效版本 metadata 的已安装 skill 必须被明确标记为 unversioned。
Proves:
- Check 输出本地未版本化状态并与远端版本比较。

### Case SKILL-UPDATER-MANIFEST-VERSION-001: Updater 拒绝 manifest 与包版本不一致
Entry:
- `tools/skill-updater/tests/run.ts > updater rejects a manifest version that differs from the package`
- `bun test --test-name-pattern="^updater rejects a manifest version that differs from the package$" ./tools/skill-updater/tests/run.ts`
Contract:
- Release manifest 声明版本必须与远端 `SKILL.md` 版本一致。
Proves:
- 版本不一致在安装前被拒绝且目标未被替换。

### Case SKILL-UPDATER-REMOTE-OWNER-001: Updater 拒绝其他 owner 的远端包
Entry:
- `tools/skill-updater/tests/run.ts > updater rejects a remote package owned by another skill`
- `bun test --test-name-pattern="^updater rejects a remote package owned by another skill$" ./tools/skill-updater/tests/run.ts`
Contract:
- 远端包的 `SKILL.md` owner 必须与 updater 目标一致。
Proves:
- 错误 owner 的 release 包不会写入本地目标。

### Case SKILL-UPDATER-CANONICAL-PATH-001: Updater 拒绝非规范包路径别名
Entry:
- `tools/skill-updater/tests/run.ts > updater rejects aliased non-canonical package paths`
- `bun test --test-name-pattern="^updater rejects aliased non-canonical package paths$" ./tools/skill-updater/tests/run.ts`
Contract:
- Release zip 中的 skill 文件必须位于规范且无别名的包路径。
Proves:
- 路径别名和非规范路径在解包写入前被拒绝。

### Case SKILL-UPDATER-REMOTE-PAYLOADS-001: Updater 报告无效 release 与 manifest
Entry:
- `tools/skill-updater/tests/run.ts > updater reports invalid release and manifest payloads`
- `bun test --test-name-pattern="^updater reports invalid release and manifest payloads$" ./tools/skill-updater/tests/run.ts`
Contract:
- GitHub release 和 manifest 响应必须在使用前通过结构验证。
Proves:
- 无效 JSON 结构产生明确远端 payload 诊断。
