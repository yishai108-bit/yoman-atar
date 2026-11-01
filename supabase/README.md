# Supabase: המאגר של גרסת הענן (מגרסה 61)

מה יש כאן: סכמה, הרשאות (RLS), דלי קבצים וצירוף משתמשים. נבדקים אוטומטית (`tests/supabase.test.js` על PGlite, `tests/cloud.test.js` מול Supabase מדומה).
מה אין: נתוני אתרים. קובץ הנתונים של עין תמר נשמר מחוץ לריפו.

## המבנה
- `sites`: אתר אחד לכל מופע (עין תמר, מולדת, באר טוביה; ל-S.E.E: עד 10).
- `members`: מי שייך לאיזה אתר ובאיזה תפקיד: `owner`, `editor`, `viewer`.
- `docs`: טבלה אחת שמחקה את מאגר המסמכים של הארטיפקט (`site_id`, `coll`, `id`, `data jsonb`). האפליקציה עוברת בלי שינוי בחישובים: `src/js/cloud/supabase-db.js` מתרגם `collection().onSnapshot()` ו-`doc().set()` לשורות.
- Storage, דלי `assets` (ציבורי, נתיבים אקראיים): צילומי תעודות, חתימות, תוכניות, משימות.

## הרשאות (כמו ב-capabilities של הארטיפקט)
- viewer: קורא הכול חוץ מ-`settings/cba` ו-`settings/prices`.
- editor: כותב הכול חוץ מ-`settings`; מעלה קבצים לאתר שלו.
- owner: הכול. **מחירים נקראים רק ע״י owner** (סוגר את הדליפה שקיימת בארטיפקט).
- `updated_by`, `updated_at` ו-`ts` נכתבים אוטומטית.

## הקמה (פעם אחת, ~15 דקות)
1. פרויקט חדש ב-Supabase, אזור Frankfurt.
2. SQL Editor, בסדר: `schema.sql` → `4-קבצים-והרשאות.sql` → קובץ האתרים הריקים → קובץ הנתונים של עין תמר (מחוץ לריפו).
3. Authentication → Users → Add user: מייל + סיסמה, Auto Confirm. לכל משתמש.
4. SQL Editor: `select add_member('מייל', 'ein-tamar', 'owner');` לכל משתמש ואתר (`moledet`, `beer-tuvia`).
5. Project Settings → API: **Project URL** ו-**anon public** → משתני הסביבה `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` ב-Vercel (Settings → Environment Variables), ופריסה מחדש.
6. Authentication → URL Configuration → Site URL: כתובת האפליקציה ב-Vercel (בשביל «שכחתי סיסמה»).

## יומן אתר · קבלן חשמל (S.E.E)
«יומן אתר» שייך לבלקטריק; «יומן אתר · קבלן חשמל» משרת קבלני חשמל. אותו קוד, **פריסות נפרדות לגמרי**: פרויקט Vercel נפרד
(`yoman-hashmal-see`, כתובת `https://yoman-kablan-hashmal.vercel.app`), פרויקט Supabase נפרד, בלי נתונים או משתמשים משותפים.
הצד נקבע ב-`VITE_ORG` (`belectric` / `see`) בפרויקט ה-Vercel; בלי `VITE_ORG` (בדיקות, מקומי) לפי הדומיין או `?org=see`.
משתני הסביבה בפרויקט של קבלן החשמל: `VITE_SEE_SUPABASE_URL`, `VITE_SEE_SUPABASE_ANON_KEY`. ההקמה זהה; האתרים מ-`5-אתרי-SEE.sql` (עד 10, עם `company` ו-`ord`).

## הרצה מקומית מול Supabase
`VITE_SUPABASE_URL=… VITE_SUPABASE_ANON_KEY=… npm run build:cloud` ואז לפתוח את `dist/cloud/index.html` משרת סטטי (לא כקובץ: הכניסה צריכה origin).
