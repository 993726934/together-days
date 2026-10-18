import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHTML, visibleEvents, validateEvent, localDate, weekStart, addDays } from '../domain.js';
test('private and designated events stay out of the demo reader view',()=>{
  const events=[{owner_id:'a',visibility:'private'},{owner_id:'b',visibility:'private'},{owner_id:'b',visibility:'selected',viewers:['a']},{owner_id:'b',visibility:'selected',viewers:['c']},{owner_id:'b',visibility:'public'}];
  assert.equal(visibleEvents(events,'a').length,3);
});
test('text entered by users is escaped before HTML rendering',()=>{
  assert.equal(escapeHTML('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
});
test('end time, visibility and recipients are validated',()=>{
  const e={title:'网球',category:'tennis',starts_at:'2026-10-20T10:00',ends_at:'2026-10-20T11:00',visibility:'private'};
  assert.doesNotThrow(()=>validateEvent(e));
  assert.throws(()=>validateEvent({...e,ends_at:e.starts_at}));
  assert.throws(()=>validateEvent({...e,visibility:'selected'}));
  assert.doesNotThrow(()=>validateEvent({...e,visibility:'selected'},['friend']));
  assert.throws(()=>validateEvent({...e,title:' '}));
  assert.throws(()=>validateEvent({...e,ends_at:'2026-11-20T11:00'}));
});
test('week navigation handles month and year boundaries in local time',()=>{
  assert.equal(weekStart('2026-10-18'),'2026-10-12');
  assert.equal(addDays('2026-12-31',1),'2027-01-01');
  assert.equal(localDate(new Date(2026,0,1,0,1)),'2026-01-01');
});
