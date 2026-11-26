// הגדרת שני הטפסים, לפי הטפסים של בלקטריק (26.11.2026):
//   «טופס טיפול בטרקטור משא / מיול» ו«טופס בקרה שבועית – נגרר פתוח עד 750 ק״ג».
// כל סעיף: key יציב (נשמר במאגר), תיאור כפי שמופיע בטופס.
export const KINDS = {
  tool: {
    id: "tool",
    label: "כלי",
    plural: "כלים",
    formTitle: "טופס טיפול בטרקטור משא / מיול",
    sub: "טיפול שבועי (איש לוגיסטיקה)",
    hasHours: true,
    groups: [
      { title: "", items: [
        { key: "fluids",  text: "מפלסי נוזלים: שמן מנוע / שמן גיר / מים / דלק" },
        { key: "leaks",   text: "בדיקת נזילות: דלק / שמן מנוע / מים / שמן גיר / הגה ובלמים" },
        { key: "tires",   text: "בדיקה ויזואלית של הצמיגים לגילוי צמיגים שחוקים / לקויים / קרועים / בלויים" },
        { key: "dash",    text: "בדיקת לוח שעונים ווידוא שאין נורות הזהרה דולקות" },
        { key: "mirrors", text: "בדיקת מראות הרכב שבורות / סדוקות" },
        { key: "horn",    text: "בדיקת צופר" },
        { key: "lights",  text: "בדיקת מערכת תאורה: פנסים ראשיים, וינקרים, אורות בלם" },
        { key: "brakes",  text: "בדיקת בלימה ובלם חנייה" },
        { key: "belts",   text: "בדיקת חגורות בטיחות" },
        { key: "clean",   text: "ניקיון המיול מבפנים ומבחוץ" },
        { key: "exhaust", text: "מפלט: רעש חריג / חופשים" },
      ] },
    ],
    notes: [
      "כל 250 שעות עבודה בכלי נדרש טיפול ע״י מוסך (באחריות איש הלוגיסטיקה לעדכן את דנה / מחמוד).",
      "ברגע שנתגלה ליקוי כלשהו במהלך הבדיקה אין להתחיל לעבוד בציוד עד לתיקון הליקוי ויש לדווח למנהל אתר.",
      "יש לעדכן את אלירן (קצין רכב) לפחות שבועיים מראש על תפוגת רישיון הרכב, ביטוח או תסקיר. בטלפון: 054-8963036",
    ],
  },
  trailer: {
    id: "trailer",
    label: "נגרר",
    plural: "נגררים",
    formTitle: "טופס בקרה שבועית – נגרר פתוח עד 750 ק״ג",
    sub: "",
    hasHours: false,
    groups: [
      { title: "בדיקות כלליות", items: [
        { key: "license", text: "רישיון הנגרר בתוקף" },
        { key: "plate",   text: "לוחית רישוי תקינה וקריאה" },
        { key: "vin",     text: "מספר שלדה תואם לרישיון" },
      ] },
      { title: "מערכת חיבור וגרירה", items: [
        { key: "coupler", text: "ראש חיבור הגרירה תקין" },
        { key: "lock",    text: "מנגנון נעילה תקין" },
        { key: "cable",   text: "כבל ביטחון תקין" },
        { key: "jockey",  text: "גלגל תמיכה תקין" },
      ] },
      { title: "תאורה וחשמל", items: [
        { key: "l_park",  text: "אורות חניה" },
        { key: "l_brake", text: "אורות בלם" },
        { key: "l_right", text: "איתות ימני" },
        { key: "l_left",  text: "איתות שמאלי" },
        { key: "l_plate", text: "תאורת לוחית רישוי" },
        { key: "plug",    text: "מחבר חשמל תקין" },
      ] },
      { title: "צמיגים וגלגלים", items: [
        { key: "t_press", text: "לחץ אוויר תקין" },
        { key: "t_tread", text: "עומק חריצים תקין" },
        { key: "t_cuts",  text: "ללא חתכים או סדקים" },
        { key: "t_nuts",  text: "אומי גלגל מהודקים" },
      ] },
      { title: "שלדה ומרכב", items: [
        { key: "frame",   text: "שלדה ללא סדקים או עיוותים" },
        { key: "floor",   text: "רצפת הנגרר תקינה" },
        { key: "sides",   text: "דפנות ומנגנוני סגירה תקינים" },
        { key: "hooks",   text: "ווים ונקודות עיגון תקינים" },
        { key: "axles",   text: "מתלים וסרנים תקינים" },
        { key: "clean",   text: "ניקיון הנגרר" },
      ] },
    ],
    notes: [
      "יש לבצע בדיקה שבועית ולשמור בקלסר האתר. במקרה של ליקוי בטיחותי אין להשתמש בנגרר עד לתיקון ואישור כשירות.",
    ],
  },
};
export const SUMMARY = [
  { key: "ok",     text: "תקין וכשיר לשימוש" },
  { key: "repair", text: "נדרש תיקון" },
  { key: "down",   text: "מושבת עד לתיקון" },
];
export const SUMMARY_LABEL = Object.fromEntries(SUMMARY.map(s => [s.key, s.text]));
export const DEFAULT_INTERVAL = 250;      // שעות מנוע בין טיפולי מוסך (מהטופס)
export const SERVICE_SOON = 20;           // כמה שעות לפני הטיפול מתחילים להזהיר
export const EXPIRY_WARN_DAYS = 14;       // «לפחות שבועיים מראש» לאלירן
export const ELIRAN = { name: "אלירן", role: "קצין רכב", phone: "054-8963036" };
export const EXPIRIES = [
  { key: "licenseExp",   label: "רישיון רכב" },
  { key: "insuranceExp", label: "ביטוח" },
  { key: "testExp",      label: "תסקיר" },
];
export function allItems(kind){ return KINDS[kind].groups.flatMap(g => g.items); }
export function itemText(kind, key){ const it = allItems(kind).find(i => i.key === key); return it ? it.text : key; }
