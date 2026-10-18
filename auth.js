// Supabase uses an email-shaped identifier internally. This reserved domain has
// no mailbox; email confirmation must be disabled in the project's Auth settings.
const accountDomain = 'accounts.together.invalid';
export function normalizeAccount(value) {
  const account = String(value || '').trim().toLowerCase();
  if (!/^[a-z0-9_]{4,24}$/.test(account)) throw new Error('账号需为 4–24 位字母、数字或下划线，也可以使用手机号');
  return account;
}
export function accountEmail(value) { return `${normalizeAccount(value)}@${accountDomain}`; }
export function accountName(user) {
  const email = user?.email || '';
  return email.endsWith('@' + accountDomain) ? email.slice(0, -(accountDomain.length + 1)) : email;
}
function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) throw new Error('密码需要 8–128 位');
}
export async function registerAccount(client, { account, password, name }) {
  const email = accountEmail(account);
  validatePassword(password);
  const displayName = String(name || '').trim() || '同频新朋友';
  if (displayName.length > 30) throw new Error('昵称最多 30 字');
  const { data, error } = await client.auth.signUp({ email, password, options: { data: { display_name: displayName } } });
  if (error) throw error;
  if (!data?.session) throw new Error('账号服务尚未开启直接注册，请联系管理员关闭邮箱确认后再试；本网站不发送验证邮件');
  return data;
}
export async function loginAccount(client, { account, password }) {
  const email = accountEmail(account);
  validatePassword(password);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}
export async function changePassword(client, user, { currentPassword, password, confirm }) {
  validatePassword(password);
  if (password !== confirm) throw new Error('两次输入的新密码不一致');
  if (!user?.email) throw new Error('请先登录');
  const checked = await client.auth.signInWithPassword({ email: user.email, password: currentPassword });
  if (checked.error) throw checked.error;
  const result = await client.auth.updateUser({ password });
  if (result.error) throw result.error;
}
