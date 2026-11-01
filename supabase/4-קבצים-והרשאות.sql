-- יומן אתר על Supabase, חלק 4 (1.11.2026): דלי קבצים, עמודת זמן עמידה, ותבנית לצירוף משתמשים.
-- להריץ אחרי 1-סכמה.sql (אפשר גם על מסד שכבר קיים; כל הפקודות בטוחות להרצה חוזרת).

-- 1. עמודת ts של docs: עד עכשיו המרה ישירה של data->>'ts'; מסמך עם ts שאינו מספר היה מפיל את הכתיבה. עכשיו מספר או NULL.
alter table docs drop column if exists ts;
alter table docs add column ts timestamptz generated always as (
  case when (data->>'ts') ~ '^[0-9]+(\.[0-9]+)?$' then to_timestamp(((data->>'ts')::double precision) / 1000) end) stored;
create index if not exists docs_coll_ts on docs (site_id, coll, ts desc);
create index if not exists docs_updated on docs (site_id, updated_at);

-- 2. קבצים (צילומי תעודות, חתימות, תוכניות, משימות): דלי ציבורי בשם assets. הנתיב <אתר>/<מזהה אקראי>.<סיומת>,
--    כך שרק מי שיש לו את הקישור מתוך האפליקציה רואה את התמונה. העלאה: רק משתמש מחובר, רק לתיקייה של אתר שהוא עורך בו.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('assets', 'assets', true, 15728640, array['image/jpeg','image/png','image/webp','application/pdf'])
  on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists assets_read on storage.objects;
create policy assets_read on storage.objects for select using (bucket_id = 'assets');

drop policy if exists assets_write on storage.objects;
create policy assets_write on storage.objects for insert to authenticated with check (
  bucket_id = 'assets'
  and exists (select 1 from sites s where s.slug = split_part(name, '/', 1)
              and site_role(s.id) in ('owner','editor')));

drop policy if exists assets_owner on storage.objects;
create policy assets_owner on storage.objects for delete to authenticated using (
  bucket_id = 'assets'
  and exists (select 1 from sites s where s.slug = split_part(name, '/', 1) and site_role(s.id) = 'owner'));

-- 3. צירוף משתמש לאתר לפי מייל. קודם יוצרים את המשתמש ב-Authentication → Users → Add user (עם סיסמה, Auto Confirm),
--    ואז שורה אחת לכל אתר ותפקיד. דוגמה (להחליף את המייל; אפשר להריץ שוב כדי לשנות תפקיד):
--
--   select add_member('someone@example.com', 'ein-tamar', 'owner');
--   select add_member('someone@example.com', 'moledet',   'owner');
--   select add_member('someone@example.com', 'beer-tuvia','owner');
--
create or replace function add_member(p_email text, p_slug text, p_role text) returns text
language plpgsql security definer set search_path = public as $$
declare u uuid; s uuid;
begin
  if p_role not in ('owner','editor','viewer') then raise exception 'תפקיד לא מוכר: %', p_role; end if;
  select id into u from auth.users where lower(email) = lower(p_email);
  if u is null then return 'אין משתמש עם המייל ' || p_email || '. קודם Authentication → Users → Add user.'; end if;
  select id into s from sites where slug = p_slug;
  if s is null then return 'אין אתר ' || p_slug; end if;
  insert into members (site_id, user_id, role) values (s, u, p_role)
    on conflict (site_id, user_id) do update set role = excluded.role;
  return p_email || ' → ' || p_slug || ' (' || p_role || ')';
end $$;
revoke all on function add_member(text, text, text) from public, anon, authenticated;   -- רק מה-SQL Editor (service role)

-- 4. בדיקה: מי מצורף לאיזה אתר
-- select s.slug, u.email, m.role from members m join sites s on s.id = m.site_id join auth.users u on u.id = m.user_id order by 1, 2;
