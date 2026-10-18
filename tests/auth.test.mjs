import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAccount,accountEmail,accountName,registerAccount,loginAccount,changePassword} from '../auth.js';
test('case-insensitive accounts accept phone digits and reject ambiguous identifiers',()=>{
  assert.equal(normalizeAccount('  Tennis_01 '),'tennis_01');
  assert.equal(accountEmail('TENNIS_01'),accountEmail('tennis_01'));
  assert.equal(accountName({email:accountEmail('13800138000')}),'13800138000');
  for(const value of ['a','space name','name@example.com','../test','中文账号','+8613800138000'])assert.throws(()=>normalizeAccount(value));
});
test('registration returns a session and never publishes a phone account as a nickname',async()=>{
  let sent;const session={user:{id:'new-user'}};
  const client={auth:{async signUp(values){sent=values;return{data:{session},error:null};}}};
  const data=await registerAccount(client,{account:'13800138000',password:'TestPass123'});
  assert.equal(data.session,session);
  assert.equal(sent.options.data.display_name,'同频新朋友');
  assert.equal(sent.email,accountEmail('13800138000'));
  assert.equal('emailRedirectTo' in sent.options,false);
});
test('missing immediate session reports configuration error instead of claiming success',async()=>{
  const client={auth:{async signUp(){return{data:{session:null,user:{id:'pending'}},error:null};}}};
  await assert.rejects(registerAccount(client,{account:'tennis01',password:'TestPass123'}),/关闭邮箱确认/);
});
test('duplicate accounts and weak passwords cannot become successful registrations',async()=>{
  let calls=0;const client={auth:{async signUp(){calls++;return{data:null,error:new Error('User already registered')};}}};
  await assert.rejects(registerAccount(client,{account:'tennis01',password:'TestPass123'}),/already registered/);
  await assert.rejects(registerAccount(client,{account:'tennis01',password:'short'}),/8–128/);
  assert.equal(calls,1);
});
test('login resolves the same account identifier as registration',async()=>{
  let received;const client={auth:{async signInWithPassword(values){received=values;return{data:{session:{user:{id:'a'}}},error:null};}}};
  const data=await loginAccount(client,{account:' TENNIS_01 ',password:'TestPass123'});
  assert.equal(received.email,accountEmail('tennis_01'));assert.equal(data.session.user.id,'a');
});
test('incorrect current password prevents writing a new password',async()=>{
  let updated=false;const client={auth:{async signInWithPassword(){return{error:new Error('Invalid login credentials')};},async updateUser(){updated=true;}}};
  await assert.rejects(changePassword(client,{email:accountEmail('tennis01')},{currentPassword:'WrongPass123',password:'NewPass123',confirm:'NewPass123'}),/Invalid login/);
  assert.equal(updated,false);
});
test('password change validates confirmation and verifies credentials before updating',async()=>{
  const calls=[];const client={auth:{async signInWithPassword(){calls.push('verify');return{error:null};},async updateUser(){calls.push('update');return{error:null};}}};
  const user={email:accountEmail('tennis01')};
  await assert.rejects(changePassword(client,user,{currentPassword:'TestPass123',password:'NewPass123',confirm:'Mismatch123'}),/不一致/);
  assert.equal(calls.length,0);
  await changePassword(client,user,{currentPassword:'TestPass123',password:'NewPass123',confirm:'NewPass123'});
  assert.deepEqual(calls,['verify','update']);
});
