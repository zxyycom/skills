# 网站获取工具准备与验收

本参考供需要准备或维护网站下载器时使用；获取范围与认证由[网站材料获取](online-sources.md)承接，本地媒体执行环境见[运行环境](runtime.md)。

## 网站获取工具

网站获取与本地证据处理独立。需要文件且获准安装时，可准备官方 `yt-dlp` CLI；获取范围、调用参数和材料交接由[网站材料获取](online-sources.md)拥有。

Windows x64 可采用以下布局，`$downloadRoot` 是获授权的独立应用目录，与本地媒体的 `appRoot` 分开：

1. 从[官方发布](https://github.com/yt-dlp/yt-dlp#release-files)取得 `yt-dlp.exe`，按同一发布的 `SHA2-256SUMS` 核对后保存到 `$downloadRoot`。独立 exe 包含 Python 与 EJS 脚本，无需另建 Python 环境。
2. 需要合并、转音轨或字幕格式时，准备 FFmpeg 与 ffprobe。可使用 [yt-dlp 的构建](https://github.com/yt-dlp/FFmpeg-Builds/releases)，核对对应校验和，将完整发行目录（含许可证）解压为 `$downloadRoot/ffmpeg/`，使程序位于 `bin/`。
3. YouTube 需要受支持的 JS 运行时。按[当前 EJS 要求](https://github.com/yt-dlp/yt-dlp/wiki/EJS)优先复用合格运行时：Node 22+ 需显式 `--js-runtimes "node:$jsRuntime"`，其中 `$jsRuntime` 为其绝对路径；Deno 是上游推荐的另一选择。离线 CLI 的 Bun 支持不能替代该核对。
4. 按[官方配置规则](https://github.com/yt-dlp/yt-dlp#configuration)复用已核对的配置，或在包外建立受控自动发现位置／显式文件，交接路径与加载方式。配置可持有 FFmpeg 绝对路径、UTF-8、插件策略及认证来源引用；认证及读写边界由[认证来源](online-sources.md#认证来源与登录受限材料)拥有，配置不保存凭据值。FFmpeg 配置与本地媒体 `appRoot` 的 ffmpeg-static 发现链分别维护。

`--ignore-config` 的位置影响加载：写在已发现的 portable 配置内部时，可阻止后续 home／user／system 搜索；从命令行传入会跳过默认发现，因此显式模式配合 `--config-locations` 指定已确认文件。核对所用版本的加载顺序后，日常调用沿用选定方式。

### 核对与交接

1. 用 `--version`、`--help` 和 FFmpeg/ffprobe 的 `-version` 核对程序可启动。
2. 用无凭据本地 fixture 核对选定加载方式、后续搜索隔离及 FFmpeg/ffprobe 发现。`--verbose --simulate` 仅在无凭据 fixture 或输出已可靠脱敏时使用；真实来源验证遵循[认证核对边界](online-sources.md#认证来源与登录受限材料)。`--load-info-json` 可避免站点请求，但仍可能读写 cookie jar。
3. 用获授权的最小本地素材实际执行合并或后处理，验证 FFmpeg 被真实消费。站点与材料可用性另以获授权 URL 探查和小样本获取验证。
4. 交接程序位置、配置路径与原生加载方式、所选版本与校验值、可选 JS 运行时及实际通过的边界；有认证引用时同时交接既有授权与读写范围，不交接凭据值。配置存在、入口启动、依赖发现、实际后处理与网站获取分别报告。

程序使用绝对路径，不需修改全局 `PATH`。下载目录由 `--paths` 显式指定，与证据目录分开；凭据按获取参考处理。

固定所选发布版本并保留来源与校验值。[上游建议普通用户使用 nightly](https://github.com/yt-dlp/yt-dlp#update)以跟进站点变化；更新仍是显式动作，而非每次获取的前置。更新前保留当前可用版本，在新目录验证后切换；`--update-to [CHANNEL@]TAG` 可选择具体版本，回退不处理既有素材。
