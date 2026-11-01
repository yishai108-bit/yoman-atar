-- יומן אתר · קבלן חשמל: האתרים של קבלני החשמל. להריץ בפרויקט Supabase של קבלני החשמל (לא בזה של בלקטריק),
-- אחרי 1-סכמה.sql ו-4-קבצים-והרשאות.sql. הנתונים של שני הצדדים לא נוגעים.
-- להחליף את השמות לאתרים האמיתיים של S.E.E (עד 10). slug: אותיות לטיניות ומקפים, בלי רווחים. ord = הסדר במסך החברה.
alter table sites add column if not exists company text;
alter table sites add column if not exists ord int;
insert into sites (slug, name, company, ord) values
  ('see-atar-1', 'S.E.E · אתר 1', 'S.E.E', 1),
  ('see-atar-2', 'S.E.E · אתר 2', 'S.E.E', 2),
  ('see-atar-3', 'S.E.E · אתר 3', 'S.E.E', 3)
on conflict (slug) do update set name = excluded.name, company = excluded.company, ord = excluded.ord;

-- עוד קבלנים באותה אפליקציה (ישי 1.11: בודק במקביל עם MSE, S.E.E, LKY): חברה לכל אתר, כל חברה רואה רק את האתרים
-- שחבריה צורפו אליהם (RLS לפי members). שמות זמניים עד שישי נותן אמיתיים.
insert into sites (slug, name, company, ord) values
  ('mse-atar-1', 'MSE · אתר 1', 'MSE', 11),
  ('lky-atar-1', 'LKY · אתר 1', 'LKY', 21)
on conflict (slug) do update set name = excluded.name, company = excluded.company, ord = excluded.ord;

-- משתמשים של S.E.E: Authentication → Users → Add user, ואז לכל אתר:
--   select add_member('manager@see.example', 'see-atar-1', 'owner');
-- מנהלת המשרד: 'viewer' (רואה הכול, לא משנה). מנהל האתרים: 'owner' או 'editor' לכל אתר.
