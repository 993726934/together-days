# 同频 Together

一个适合手机访问的个人日程分享网站。网站放在 GitHub Pages，账号和日程保存在你自己的 Supabase 项目中。

已完成邮箱注册/登录、邮箱确认回调、忘记密码/重设密码、昵称管理、好友码添加联系人、活动增删改、周/单日查看、月份跳转、类别/发布者昵称搜索、分享链接，以及每个活动独立的可见范围。

## 目前的交付状态

- 网页、数据库初始化脚本、自动部署工作流已准备好。
- 未填写账号配置时为明确标注的本机体验模式，不会建立真实账号，不会同步其他设备；体验内容不自动迁移到真实账号。
- 本地已通过 4 组前端逻辑测试、23 项 PostgreSQL 权限检查，并在手机宽度浏览器中验证创建、编辑、指定分享校验与筛选。
- 网站已部署在 [https://993726934.github.io/together-days/](https://993726934.github.io/together-days/)，公开页面已验证可访问。源码仓库为 [993726934/together-days](https://github.com/993726934/together-days)。
- 目前没有 Supabase 项目，正式账号服务尚未启用；线上显示体验模式。尚无真实用户注册/邮件测试结果。

## 1. 先在电脑上预览

交付文件夹中的 `preview.html` 为可双击打开的独立体验页，便于先看效果。它使用示例数据；正式部署请使用本目录的完整网站。

需要 Node.js 20 或更高版本。在此目录打开终端：

```powershell
npm.cmd start
```

打开终端显示的 `http://127.0.0.1:4173`。不要双击 HTML 文件：此网站使用 JavaScript 模块，需要 HTTP 服务。部署后，其他人的手机直接打开正式 HTTPS 链接即可。

## 2. 建立 Supabase 项目

1. 打开 [Supabase 控制台](https://supabase.com/dashboard)，登录并新建项目。
2. 项目准备好后，打开 **SQL Editor → New query**。
3. 把 `supabase/schema.sql` 的全部内容粘贴进去并运行。本脚本用于新项目，运行一次即可，不需要反复运行或删除重建已有表。
4. 打开项目 **Connect**，复制 Project URL 和 **Publishable key**（`sb_publishable_...`）；也可在 **Settings → API Keys** 查找公钥。
5. 编辑 `config.js`：

```javascript
window.APP_CONFIG = {
  supabaseUrl: "https://你的项目编号.supabase.co",
  supabaseKey: "sb_publishable_你的公开密钥"
};
```

此文件会随静态网页公开。只放公开的 Publishable key（兼容旧版 `anon` key）；不要放 `sb_secret_...`、`service_role`、数据库密码、GitHub token。访问范围由数据库行级权限约束。详见 [Supabase 公钥说明](https://supabase.com/docs/guides/getting-started/api-keys)。

### 配置注册邮件（让其他人真正能注册）

在 Supabase **Authentication** 中开启 Email 注册，保留邮箱确认，密码最短长度至少设为 8。

面向好友或公众使用时，需要在 Authentication 的 **Email / SMTP Settings** 配置自己的 SMTP 发信服务，并按服务商要求完成发信地址/域名验证。SMTP 凭据只保存在 Supabase 后台，不写进网页或 GitHub。

Supabase 默认邮件服务只面向项目团队的授权邮箱，不能直接用于任意访客注册；这是公开注册能否工作的必要配置。参考 [官方 SMTP 配置说明](https://supabase.com/docs/guides/auth/auth-smtp)。

### 配置邮件返回地址

假设采用下方推荐的 `together-days` 仓库：在 **Authentication → URL Configuration** 设置：

```text
Site URL:
https://993726934.github.io/together-days/

Redirect URLs:
https://993726934.github.io/together-days/
http://127.0.0.1:4173/
```

不要遗漏路径 `/together-days/` 和结尾 `/`。如果换仓库名，两个正式地址一并修改。参考 [官方 Redirect URLs 说明](https://supabase.com/docs/guides/auth/redirect-urls)。

## 3. GitHub Pages 部署与后续更新

当前仓库已创建，Pages 已启用，首次部署成功。**本项目无需再运行下方建仓命令**；这些命令仅供新建其他副本时参考。你现在只需完成第 2 节的 Supabase 配置，把修改后的 `config.js` 提交到现有仓库，就会自动重新部署。

推荐创建项目仓库 `993726934/together-days`，避免覆盖账号已有的个人主页。

在本目录打开 PowerShell，先重新登录 GitHub；在 GitHub 自己的验证页完成登录，不要把密码或 token 发到聊天中：

```powershell
gh auth login --hostname github.com --git-protocol https --web
gh auth status
git init -b main
git add .
git commit -m "Build Together schedule sharing app"
gh repo create 993726934/together-days --public --source . --remote origin --push
```

如果仓库已存在，先检查原仓库内容，再选其他名字或使用已有仓库；不要强制推送覆盖。若不使用 CLI，也可以新建公开仓库并上传这些文件，但要保留 `.github/workflows/pages.yml` 和 `assets/`。

然后在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。首次推送如果发生在 Pages 配置前，进入 **Actions → Deploy Together to GitHub Pages → Run workflow** 再运行一次。

工作流成功后，预期地址为：

```text
https://993726934.github.io/together-days/
```

当前此地址已经上线，账号服务等待第 2 节配置。工作流只发布网页与资源，不发布数据库脚本和测试文件。页面脚本均使用相对路径，兼容 GitHub Pages 项目目录。参考 [GitHub Pages 工作流文档](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

也可以使用名为 `993726934.github.io` 的仓库部署在根域名，但需要先确认不会覆盖已有网站，并把 Supabase 返回地址改成根目录。

后续修改后：

```powershell
git add .
git commit -m "Update Together"
git push
```

## 4. 两个人开始使用

1. A、B 分别在手机打开部署后的链接，注册自己的邮箱并确认，再登录。
2. B 在「好友」或「我的账号」复制 12 位好友码，发给 A。
3. A 在「好友」输入 B 的好友码添加联系人。联系人是单向的；如 B 也要向 A 分享，则 B 也添加 A。
4. A 新建「周末网球」→ 选择「指定好友」→ 勾选 B → 保存。
5. B 在「与我分享」里点击同步即可看到；返回页面时也会重新同步。
6. A 可以复制活动链接发给 B；未授权的人即使拿到链接也不能读取活动。

| 可见范围 | 谁能读 | 谁能修改/删除 |
| --- | --- | --- |
| 仅自己 | 发布者 | 发布者 |
| 指定好友 | 发布者、逐个选中的账号 | 发布者 |
| 所有登录用户 | 全站所有已登录账号 | 发布者 |

添加好友不会自动开放任何私人日程。移除好友会在数据库事务中撤销你对该好友的所有指定分享；对全站登录用户开放的活动仍可见。已被别人看过、复制或截图的内容无法追回。

所有时间保存为带时区的时间戳，访问时按设备时区显示。同一时区的朋友会看到一致的本地时间。

## 5. 上线后验收

用三个真实账号 A、B、C 验收：

1. A 创建私人、指定 B、全站登录用户三条日程。
2. B 应只能看到指定分享和全站开放的日程；C 只能看到全站开放的日程。
3. 把指定分享链接发给 C，确认 C 仍不能查看；退出登录后也不能查看真实日程。
4. A 将指定分享改成私人，B 同步后应失去访问权限。
5. A 重新分享给 B 后移除 B，B 同步后应再次失去访问权限。
6. 在另一台手机测试注册确认邮件、忘记密码、重新登录和日程保存。

本地 PostgreSQL 测试模拟了 `auth.users` 和用户身份，验证了实际 SQL 权限规则；没有替代 Supabase 邮件和托管 API 的上线验收。

## 开发与测试

网页无需安装依赖即可预览和部署。`assets/supabase.js` 是已打包的官方 `@supabase/supabase-js` 2.49.8 浏览器客户端，不依赖 CDN 加载登录脚本。字体可以回退至系统字体。

```powershell
npm.cmd test
npm.cmd install
npm.cmd run test:db
```

数据库测试通过 PGlite 在本机执行 PostgreSQL，使用合成账号，不会连接或修改正式 Supabase 数据库。脚本为 `tests/rls.test.mjs`。

当前范围是单次活动、个人日程与可见权限分享；没有自动重复活动、聊天、报名/名额、系统推送提醒。数据为主动同步，非实时聊天式推送。
