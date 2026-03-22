# WEPsCLI 发布说明

本文档用于记录 `wepscli` 的发布步骤、发布注意事项，以及每次发版的更新日志。

## 当前包信息

- npm 包名: `wepscli`
- 当前已发布版本: `0.1.0`
- 全局启动命令: `wepscli`
- 包目录: `D:\WEPsCodingCLI\agents-core\packages\wepscli`

## 标准发布步骤

每次发版都按这个顺序执行，不要跳步。

1. 进入包目录

```powershell
cd D:\WEPsCodingCLI\agents-core\packages\wepscli
```

2. 确认版本号已经更新

- 位置: `package.json`
- 如果上一个版本已经发过，必须先改版本号，再发布

3. 运行发布前检查

```powershell
npx tsc -p tsconfig.build.json --noEmit
npm run build
npm pack --dry-run
```

4. 用本地 tarball 做一次真实安装验证

```powershell
npm pack
npm uninstall -g wepscli
npm install -g .\wepscli-x.y.z.tgz
wepscli --help
wepscli
```

说明:

- 这里的 `x.y.z` 替换成当前版本号
- 这一步比 `npm pack --dry-run` 更重要，因为它更接近真实用户安装环境

5. 确认 npm 登录状态和源

```powershell
npm whoami
npm config get registry
```

官方源应为:

```text
https://registry.npmjs.org/
```

如果不是官方源，切回去:

```powershell
npm config set registry https://registry.npmjs.org/
```

6. 正式发布

```powershell
npm publish
```

如果账号启用了发布 2FA，则使用:

```powershell
npm publish --otp=6位验证码
```

7. 发布后做公网安装验证

```powershell
npm uninstall -g wepscli
npm install -g wepscli
wepscli --help
wepscli
```

## 发布提醒

- 不要重复发布同一个版本号。
- 发版前必须先确认本地 `npm install -g .\wepscli-x.y.z.tgz` 能跑起来。
- 如果改动涉及 runtime、构建链、Bun 重启、依赖版本，必须做真实安装验证，不能只看 `build` 是否通过。
- 如果 npm 登录失败，优先检查 registry 是否为官方源。
- 如果 `npm publish` 提示需要 2FA，就用 `--otp=` 重新发布。
- 发布后建议执行:

```powershell
npm view wepscli version
npm view wepscli
```

## 常见问题

### 1. `npm login` 失败

大概率是因为当前 npm 源不是官方源。

```powershell
npm config set registry https://registry.npmjs.org/
npm login
```

### 2. `npm publish` 报 403，需要 2FA

使用:

```powershell
npm publish --otp=6位验证码
```

### 3. 本地能跑，安装后不能跑

优先检查:

- 是否引用了 monorepo 内部相对路径
- 是否依赖了未发布的本地包
- 是否只在 workspace 环境里才存在某些文件

### 4. 全局命令不生效

确认:

- `package.json` 里 `bin.wepscli` 是否指向 `dist/cli.js`
- `dist/cli.js` 顶部是否保留 `#!/usr/bin/env node`
- 是否用的是 `npm install -g wepscli`

## 更新日志记录规则

以后每次发版都在本文档底部追加一条，建议格式如下:

```md
## YYYY-MM-DD - vX.Y.Z

- 发布状态: 已发布 / 未发布
- 重点改动:
  - xxx
  - xxx
- 发布前验证:
  - `npx tsc -p tsconfig.build.json --noEmit`
  - `npm run build`
  - `npm pack`
  - 本地全局安装验证
- 备注:
  - xxx
```

## 更新日志

## 2026-03-22 - v0.1.0

- 发布状态: 已发布到 npm
- 重点改动:
  - 完成真实 runtime 接入、provider/model/session 持久化链路
  - 完成 tool 执行呈现、文件改动摘要、diff 预览与 approval 联动
  - 完成 `/compact`、模式层、以及一批高频 slash commands
  - 修复发布相关问题，确保包在真实全局安装环境中可启动
- 发布前验证:
  - `npx tsc -p tsconfig.build.json --noEmit`
  - `npm run build`
  - `npm pack`
  - `npm install -g .\wepscli-0.1.0.tgz`
  - `wepscli --help`
  - `wepscli`

