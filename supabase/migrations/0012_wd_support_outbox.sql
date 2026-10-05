-- Prepared, UNAPPLIED. Private support progress only; no transport, schedule, retention or engine change.
begin;
create table public.wd_support_work (
 id text primary key check(id ~ '^[a-f0-9]{64}$'), kind text not null check(kind in ('inbound','digest')),
 input jsonb not null, input_hash text not null, approved jsonb, payload jsonb,
 state text not null default 'triage' check(state in ('triage','ready','sending','accepted','escalated','done','held')),
 thread_id uuid references public.support_threads(id), digest_id text references public.wd_support_work(id),
 send_id text, fingerprint text, send_owner uuid not null default gen_random_uuid(), message_id text,
 owner uuid, attempt integer not null default 0, lease_until timestamptz,
 created_at timestamptz not null default now(),
 check(octet_length(input::text)<=24576 and octet_length(coalesce(approved,'{}')::text)<=16384 and octet_length(coalesce(payload,'{}')::text)<=32768)
);
create index wd_support_work_pending on public.wd_support_work(state,created_at);
alter table public.wd_support_work enable row level security;
revoke all on public.wd_support_work from public,anon,authenticated,service_role;
grant select on public.wd_support_work to service_role;
create function public.wd_support_progress(p_action text,p_body jsonb)returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.wd_support_work%rowtype; s public.wd_support_sends%rowtype; m public.support_messages_v2%rowtype;
 i jsonb; a jsonb; v_payload jsonb; candidate jsonb; h text; ident text; t uuid; n bigint; outcome jsonb; members text[]; summary text;
begin
 if auth.role() is distinct from 'service_role' then raise insufficient_privilege;end if;
 if p_body is null or jsonb_typeof(p_body)<>'object' or octet_length(p_body::text)>65536 then return '{"error":"invalid_command"}';end if;
 if p_action='record' then
  if p_body-'input'<>'{}' or jsonb_typeof(p_body->'input') is distinct from 'object' then return '{"error":"invalid_command"}';end if;i:=p_body->'input';
  if i-array['messageId','from','subject','text','inReplyTo','threadSubject']<>'{}' or not(i?&array['messageId','from','subject','text','inReplyTo','threadSubject'])
   or jsonb_typeof(i->'messageId') is distinct from 'string' or length(i->>'messageId') not between 1 and 1024
   or jsonb_typeof(i->'from') is distinct from 'string' or length(i->>'from') not between 1 and 320
   or jsonb_typeof(i->'text') is distinct from 'string' or octet_length(i->>'text')>16384
   or jsonb_typeof(i->'subject') is distinct from 'string' or length(i->>'subject')>512
   or jsonb_typeof(i->'threadSubject') is distinct from 'string' or length(i->>'threadSubject')>512
   or (i->'inReplyTo'<>'null'::jsonb and (jsonb_typeof(i->'inReplyTo')<>'string' or length(i->>'inReplyTo')>1024)) then return '{"error":"invalid_command"}';end if;
  ident:=encode(sha256(convert_to(i->>'messageId','UTF8')),'hex');h:=encode(sha256(convert_to(i::text,'UTF8')),'hex');
  insert into public.wd_support_work(id,kind,input,input_hash,state) values(ident,'inbound',i,h,case when exists(select 1 from public.support_messages_v2 where message_id=i->>'messageId') then 'held' else 'triage' end) on conflict do nothing;
  select * into r from public.wd_support_work where id=ident for update;
  if r.input_hash<>h then update public.wd_support_work set state='held' where id=ident and state<>'done';return '{"error":"identity_conflict"}';end if;
  return jsonb_build_object('state',r.state);
 elsif p_action='claim' then
  if p_body-array['owner','exclude']<>'{}' or jsonb_typeof(p_body->'exclude') is distinct from 'array' or jsonb_array_length(p_body->'exclude')>4 or p_body->>'owner' is null then return '{"error":"invalid_command"}';end if;
  -- A crashed sender crossed the transport boundary. Expiry can hold it, never release/resend it.
  select array_agg(x.id)into members from(select id from public.wd_support_work where state='sending' and lease_until<now() order by created_at,id limit 10 for update skip locked)x;
  update public.wd_support_sends ledger set state='held' from public.wd_support_work w where w.id=any(members) and w.send_id=ledger.id and ledger.state='sending';
  update public.wd_support_work set state='held',owner=null,lease_until=null where id=any(members);
  select * into r from public.wd_support_work where state in ('triage','ready','accepted') and (lease_until is null or lease_until<now())
   and not exists(select 1 from jsonb_array_elements_text(p_body->'exclude') x where x=id) order by created_at,id limit 1 for update skip locked;
  if not found then return '{"work":null}';end if;
  update public.wd_support_work set owner=(p_body->>'owner')::uuid,attempt=attempt+1,lease_until=now()+interval '5 minutes' where id=r.id returning * into r;
  return jsonb_build_object('work',to_jsonb(r));
 elsif p_action='digest' then
  if p_body-'to'<>'{}' or jsonb_typeof(p_body->'to') is distinct from 'string' or length(p_body->>'to') not between 1 and 320 then return '{"error":"invalid_command"}';end if;
  perform pg_advisory_xact_lock(741008,12);
  members:='{}';summary:='';
  for r in select * from public.wd_support_work where state='escalated' and digest_id is null order by created_at,id limit 10 for update skip locked loop
   n:=coalesce(array_length(members,1),0)+1;
   candidate:=jsonb_build_object('to',p_body->>'to','subject','Support: '||n||' to answer','text',n||' support email'||case when n=1 then '' else 's' end||E' need a person. They are still unread in the support inbox.\n\n'||summary||case when n=1 then '' else E'\n\n' end||(r.approved->>'summary')||E'\n\nWiseDinner support');
   exit when octet_length(candidate::text)>32768;
   v_payload:=candidate;members:=array_append(members,r.id);summary:=summary||case when n=1 then '' else E'\n\n' end||(r.approved->>'summary');
  end loop;
  n:=coalesce(array_length(members,1),0);if n=0 then return '{"created":false}';end if;
  ident:=encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex');
  select thread_id into t from public.wd_support_work where id=members[1];
  insert into public.wd_support_work(id,kind,input,input_hash,payload,state,thread_id,send_id,fingerprint)
   values(ident,'digest',jsonb_build_object('members',members),ident,v_payload,'ready',t,ident,encode(sha256(convert_to(v_payload::text,'UTF8')),'hex'));
  update public.wd_support_work set digest_id=ident where id=any(members);
  return '{"created":true}';
 end if;
 if p_body->>'id' is null or p_body->>'owner' is null or p_body->>'attempt' is null then return '{"error":"invalid_command"}';end if;
 select * into r from public.wd_support_work where id=p_body->>'id' for update;
 if not found or r.owner is distinct from (p_body->>'owner')::uuid or r.attempt is distinct from (p_body->>'attempt')::integer or r.lease_until is null or r.lease_until<=now() then return '{"error":"stale_claim"}';end if;
 if p_action='approve' then
  if p_body-array['id','owner','attempt','approved','payload']<>'{}' then return '{"error":"invalid_command"}';end if;
  a:=p_body->'approved';v_payload:=p_body->'payload';
  if r.state<>'triage' then
   if r.approved is distinct from a or r.payload is distinct from v_payload then return '{"error":"identity_conflict"}';end if;
   return jsonb_build_object('work',to_jsonb(r));
  end if;
  if r.kind<>'inbound' or jsonb_typeof(a) is distinct from 'object' or a-array['intent','summary']<>'{}' or not(a?&array['intent','summary']) or jsonb_typeof(a->'intent') is distinct from 'string' or a->>'intent' not in ('reply','escalate') or jsonb_typeof(a->'summary') is distinct from 'string' or octet_length(a->>'summary')>4096 then return '{"error":"invalid_command"}';end if;
  if a->>'intent'='reply' then
   if jsonb_typeof(v_payload) is distinct from 'object' or v_payload-array['to','subject','text','inReplyTo','references']<>'{}' or not(v_payload?&array['to','subject','text','inReplyTo','references'])
    or v_payload->>'to' is distinct from r.input->>'from' or v_payload->>'inReplyTo' is distinct from r.input->>'messageId'
    or jsonb_typeof(v_payload->'subject') is distinct from 'string' or length(v_payload->>'subject')>1024
    or jsonb_typeof(v_payload->'text') is distinct from 'string' or octet_length(v_payload->>'text') not between 1 and 8192
    or v_payload->'references' is distinct from jsonb_build_array(r.input->>'messageId') then return '{"error":"invalid_command"}';end if;
  elsif v_payload is distinct from 'null'::jsonb then return '{"error":"invalid_command"}';end if;
  select v.thread_id into t from public.support_messages_v2 v where v.message_id=r.input->>'inReplyTo';
  if t is null then select id into t from public.support_threads where from_email=r.input->>'from' and subject=r.input->>'threadSubject' order by created_at desc,id limit 1;end if;
  if t is null then
   insert into public.support_threads(channel,from_email,subject,message_id)values('email',r.input->>'from',r.input->>'threadSubject',r.input->>'messageId') returning id into t;
  end if;
  update public.wd_support_work set approved=a,payload=v_payload,state='ready',thread_id=t,
   send_id=case when a->>'intent'='reply' then encode(sha256(convert_to('reply','UTF8')||decode('00','hex')||convert_to(r.input->>'messageId','UTF8')),'hex') end,
   fingerprint=case when a->>'intent'='reply' then encode(sha256(convert_to(v_payload::text,'UTF8')),'hex') end where id=r.id returning * into r;
 elsif p_action='release' then
  if p_body-array['id','owner','attempt']<>'{}' then return '{"error":"invalid_command"}';end if;
  if r.state='sending' then perform public.wd_support_send('hold',jsonb_build_object('id',r.send_id,'owner',r.send_owner));end if;
  update public.wd_support_work set state=case when state='sending' then 'held' else state end,owner=null,lease_until=null where id=r.id returning * into r;
 elsif p_action='inbound' then
  if p_body-array['id','owner','attempt']<>'{}' or r.kind<>'inbound' or r.state not in ('ready','accepted') then return '{"error":"invalid_command"}';end if;
  insert into public.support_messages_v2(thread_id,direction,body,ai,message_id)values(r.thread_id,'in',coalesce(nullif(r.input->>'text',''),'(empty)'),false,r.input->>'messageId') on conflict do nothing;
  select * into m from public.support_messages_v2 where message_id=r.input->>'messageId';
  if m.thread_id is distinct from r.thread_id or m.direction<>'in' or m.ai or m.body is distinct from coalesce(nullif(r.input->>'text',''),'(empty)') then return '{"error":"identity_conflict"}';end if;
 elsif p_action='reserve' then
  if p_body-array['id','owner','attempt']<>'{}' or r.state not in ('ready','accepted') or r.send_id is null then return '{"error":"invalid_command"}';end if;
  perform pg_advisory_xact_lock(741008,11);
  select * into s from public.wd_support_sends where id=r.send_id for update;
  if found then
   if s.fingerprint<>r.fingerprint or s.owner<>r.send_owner then update public.wd_support_work set state='held' where id=r.id;return '{"error":"send_held"}';end if;
   if s.state='accepted' then update public.wd_support_work set state='accepted',message_id=s.message_id where id=r.id returning * into r;
   elsif s.state='reserved' then
    -- A recorded reservation has not crossed the SMTP boundary. Refresh only with cap admission.
    if s.created_at<=now()-interval '24 hours' then
     select (select count(*)from public.wd_support_sends where coalesce(accepted_at,created_at)>now()-interval '24 hours')+
      (select count(*)from public.support_messages_v2 v where v.direction='out' and v.created_at>now()-interval '24 hours' and not exists(select 1 from public.wd_support_sends x where x.message_id=v.message_id)) into n;
     if n>=450 then return '{"error":"send_cap"}';end if;
    end if;
    update public.wd_support_sends set created_at=now() where id=s.id;
   else update public.wd_support_work set state='held' where id=r.id;return '{"error":"send_held"}';end if;
  else
   outcome:=public.wd_support_send('reserve',jsonb_build_object('id',r.send_id,'fingerprint',r.fingerprint,'owner',r.send_owner));
   if outcome?'error' then return outcome;end if;
  end if;
 elsif p_action='begin' then
  if p_body-array['id','owner','attempt']<>'{}' or r.state<>'ready' or r.send_id is null then return '{"error":"invalid_command"}';end if;
  outcome:=public.wd_support_send('begin',jsonb_build_object('id',r.send_id,'owner',r.send_owner));if outcome?'error' then return outcome;end if;
  update public.wd_support_work set state='sending' where id=r.id returning * into r;
 elsif p_action='accept' then
  if p_body-array['id','owner','attempt','messageId']<>'{}' or r.state<>'sending' or jsonb_typeof(p_body->'messageId') is distinct from 'string' or length(p_body->>'messageId') not between 1 and 1024 then return '{"error":"invalid_command"}';end if;
  outcome:=public.wd_support_send('accept',jsonb_build_object('id',r.send_id,'owner',r.send_owner,'messageId',p_body->>'messageId'));if outcome?'error' then return outcome;end if;
  update public.wd_support_work set state='accepted',message_id=p_body->>'messageId' where id=r.id returning * into r;
 elsif p_action='outbound' then
  if p_body-array['id','owner','attempt']<>'{}' or r.state<>'accepted' then return '{"error":"invalid_command"}';end if;
  summary:=case when r.kind='digest' then 'Escalation digest sent (private content retained in mailbox)' else r.payload->>'text' end;
  insert into public.support_messages_v2(thread_id,direction,body,ai,message_id)values(r.thread_id,'out',summary,r.kind='inbound',r.message_id)on conflict do nothing;
  select * into m from public.support_messages_v2 where message_id=r.message_id;
  if m.thread_id is distinct from r.thread_id or m.direction<>'out' or m.body is distinct from summary or m.ai is distinct from (r.kind='inbound') then return '{"error":"identity_conflict"}';end if;
 elsif p_action='status' then
  if p_body-array['id','owner','attempt']<>'{}' or r.kind<>'inbound' or (r.state<>'accepted' and not(r.state='ready' and r.approved->>'intent'='escalate')) then return '{"error":"invalid_command"}';end if;
  update public.support_threads set status=case when r.approved->>'intent'='escalate' then 'escalated' else 'auto_replied' end,updated_at=now() where id=r.thread_id;
  if r.approved->>'intent'='escalate' then update public.wd_support_work set state='escalated',owner=null,lease_until=null where id=r.id returning * into r;end if;
 elsif p_action='finish' then
  if p_body-array['id','owner','attempt']<>'{}' or r.state<>'accepted' or not exists(select 1 from public.support_messages_v2 where message_id=r.message_id and direction='out') then return '{"error":"invalid_command"}';end if;
  if r.kind='digest' then update public.wd_support_work set state='done' where digest_id=r.id and state='escalated';end if;
  update public.wd_support_work set state='done',owner=null,lease_until=null where id=r.id returning * into r;
 else return '{"error":"invalid_command"}';end if;
 return jsonb_build_object('work',to_jsonb(r));
exception when invalid_text_representation or check_violation or not_null_violation or numeric_value_out_of_range then return '{"error":"invalid_command"}';
end $$;
revoke all on function public.wd_support_progress(text,jsonb) from public,anon,authenticated;
grant execute on function public.wd_support_progress(text,jsonb) to service_role;
commit;
