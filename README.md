# 同频 Together

手机日程记录与指定好友分享网站。

- 网站：[https://993726934.github.io/together-days/](https://993726934.github.io/together-days/)
- 源码：[993726934/together-days](https://github.com/993726934/together-days)
- 注册方式：**账号 + 密码**，昵称选填，注册成功后直接登录，无需邮箱、邮件验证或短信。
- 账号为 4–24 位英文字母、数字或下划线，不区分大小写。手机号也能作为账号，但不验证号码归属。

网站已经上线，目前尚未接入 Supabase，线上仍是明确标注的体验模式。体验数据只保存在本机，不会自动迁移到真实账号。完成以下三步即可启用真实账号和跨设备数据。

## 管理员只需三步

### 1. 创建数据库

打开 [Supabase 控制台](https://supabase.com/dashboard)，新建项目。准备好后进入 **SQL Editor → New query**，运行 `supabase/schema.sql` 全部内容一次。已经运行过该脚本的项目不需要重跑。

日程按数据库行级权限区分「仅自己」「指定好友」「所有登录用户」。密码由 Supabase Auth 管理，不写入日程表。

### 2. 开启直接注册

进入 **Authentication → Sign In / Providers → Email**（也可能显示为 Providers → Email）：

- **Enable Email provider：开启**。
- **Confirm email / Require email confirmation：关闭**。
- **Allow new users to sign up：开启**。
- 密码最短长度设为 **8**。

保存即可。**不用配置 SMTP、发信邮箱、短信服务或邮件返回地址。** Supabase 的设置仍叫 Email，是因为其内部使用邮箱格式的标识。网站把账号映射到保留域名 `accounts.together.invalid` 下的内部标识，用户无需填写或拥有邮箱；不要向内部地址发送邮件，也不要在网站之外手动创建同名标识。关闭邮箱确认后，注册接口直接返回登录会话。[官方密码与确认设置说明](https://supabase.com/docs/guides/auth/passwords)、[signUp 返回行为](https://supabase.com/docs/reference/javascript/auth-signup)。

这不构成邮箱或手机号归属验证。请通过好友本人提供的好友码添加联系人。

### 3. 填入公开项目配置

项目 **Connect** 中复制 Project URL 和 **Publishable key**（`sb_publishable_...`）；也可在 **Settings → API Keys** 查找公钥。编辑 `config.js`：

```javascript
window.APP_CONFIG = {
  supabaseUrl: "https://你的项目编号.supabase.co",
  supabaseKey: "sb_publishable_你的公开密钥"
};
```

提交到现有 GitHub 仓库即可自动部署。这个文件会公开，只能放 Publishable key（兼容旧版 anon），不要放 secret、service_role、数据库密码或 GitHub token。[公钥说明](https://supabase.com/docs/guides/getting-started/api-keys)。

## 用户怎么用

1. 打开网站，注册账号，输入账号和密码，昵称选填，注册成功即进入日程。
2. 好友在「我的账号」或「好友」复制 12 位好友码，发给你。
3. 在「好友」添加对方，新建活动时选择「指定好友」并勾选接收人。
4. 对方登录后在「与我分享」里查看。返回页面会同步，也可以手动点同步。

联系人是单向的。添加好友不自动开放私人日程；移除好友会撤销你对该好友的指定分享。链接不能绕过权限。

| 范围 | 谁可以看 | 谁可以改、删 |
| --- | --- | --- |
| 仅自己 | 发布者 | 发布者 |
| 指定好友 | 发布者与被勾选账号 | 发布者 |
| 所有登录用户 | 全站已登录账号 | 发布者 |

支持网球、跳舞、运动、聚会等活动，增删改日程、周/单日查看、月份跳转、活动和关键词筛选、链接分享。时间按设备时区显示。

## 修改或忘记密码

知道当前密码时，在「我的账号 → 修改密码」输入旧密码和新密码，直接修改，不发送邮件或验证码。

忘记密码时，联系管理员并提供账号。管理员通过可信方式核实身份后，在安全的服务端环境调用 [Auth Admin updateUserById](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid) 设置新密码。用户 ID 可在 Supabase **Authentication → Users** 中通过内部标识查找。管理密钥只能在受信任的服务端使用，不能放进网页、GitHub 源码或聊天。

手机号未验证，不能用来证明账号所有权，不支持短信或邮件找回。请妥善记住账号与密码。

## 本地预览和更新

交付文件 `preview.html` 可双击打开独立体验页。完整网站使用 Node.js 20 或以上，在本目录运行：

```powershell
npm.cmd start
```

打开 `http://127.0.0.1:4173`。不要直接双击完整网站的 index.html，JavaScript 模块需要 HTTP 服务。

仓库和 Pages 已创建。修改并推送 main 后自动部署：

```powershell
git add .
git commit -m "Update Together"
git push
```

工作流只发布网页和资源，不发布数据库脚本和测试。网页资源使用相对路径，兼容 `/together-days/`。需要手动部署时，在 Actions 中运行 Deploy Together to GitHub Pages。[GitHub Pages 工作流说明](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

## 测试与验收

```powershell
npm.cmd test
npm.cmd install
npm.cmd run test:db
```

11 组逻辑测试覆盖账号规范化、手机号不作为默认公开昵称、直接注册会话、重复账号、确认配置错误、登录和修改密码，以及日程校验。数据库的 23 项测试通过 PGlite 执行实际 PostgreSQL 权限脚本，使用合成用户，不会连接正式项目。

接入真实 Supabase 后，用 A、B、C 验证：A 的私有日程只有 A 可见；指定 B 的日程 C 不能读；B 不能修改 A 的活动；撤销分享或移除好友后，B 同步即不可读。另需验证直接注册、重复账号、退出再登录、修改后旧密码失效，以及另一台手机的数据同步。

目前认证测试使用模拟 Auth 客户端，真实后端尚未接入。当前不包含重复活动、聊天、报名名额或推送提醒。