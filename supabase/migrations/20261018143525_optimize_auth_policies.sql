alter policy profile_update on public.profiles using(id=(select auth.uid())) with check(id=(select auth.uid()));
alter policy contacts_read on public.contacts using(owner_id=(select auth.uid()));
alter policy event_insert on public.events with check(owner_id=(select auth.uid()));
alter policy event_update on public.events using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
alter policy event_delete on public.events using(owner_id=(select auth.uid()));
alter policy shares_read on public.event_shares using(viewer_id=(select auth.uid()) or private.owns_event(event_id));
