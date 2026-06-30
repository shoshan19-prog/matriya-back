# MATRIYA — Agentic-OS Skills

שני "skills" בסגנון Agentic-OS שמוסיפים שכבת תפעול **מעל** מטריה, בלי לגעת בלוגיקת הליבה.
שניהם קוראים רק ל-endpoints וסקריפטים שכבר קיימים, ומפיקים דוח קריא בלחיצה אחת.

## 1. ☀️ Morning Brief — דוח בוקר על בריאות המערכת

מאחד `GET /health`, `GET /admin/recovery/violations` ו-`GET /admin/reports/value-summary`
לסיכום עברי יומי: סטטוס, מספר מסמכים, latency p50/p99, שיעור שגיאות, שערים נעולים, וריצות מחקר.

```bash
npm run brief:morning                  # הדפסה
node scripts/morning-brief.mjs --out brief.md   # שמירה כ-Markdown
node scripts/morning-brief.mjs --json  # JSON (לאוטומציה / מייל)
```

- סביבה: `BASE_URL` (ברירת מחדל `http://localhost:8000`), `ADMIN_USERNAME`/`ADMIN_PASSWORD` (admin/admin123).
- ספי התראה: `BRIEF_P99_WARN_MS` (3000), `BRIEF_ERROR_RATE_WARN` (0.05).
- יציאה: `0` תקין · `2` יש התראות · `1` שגיאת ריצה.
- דרך ה-skill (`.claude/skills/morning-brief`) אפשר גם לשלוח את הדוח במייל (Gmail) לפי בקשה.

## 2. ✅ Eval Harness — בדיקת רגרסיה לאיכות תשובות

מריץ סט שאלות מ-`scripts/eval-cases.json` מול `GET /search`, מסווג כל תשובה
(`grounded` / `insufficient` / `locked` / `error`), משווה לציפייה ול-baseline קודם,
ומתריע על רגרסיות עיגון (תשובה מעוגנת שהפכה לחסרת-עדות או להפך).

```bash
npm run eval:harness                             # ריצה + השוואה ל-baseline
node scripts/eval-harness.mjs --update-baseline  # שמירת baseline חדש
node scripts/eval-harness.mjs --cases my.json    # קובץ cases מותאם
```

- סביבה: `BASE_URL` (ברירת מחדל `http://localhost:8000`).
- יציאה: `0` הכל עבר · `2` כשלים/רגרסיות · `1` שגיאת ריצה.
- ערכו את `scripts/eval-cases.json` לפי המסמכים האמיתיים שלכם. `scripts/eval-baseline.json` הוא מקומי ומוחרג מ-git.

## הערה
שני הסקריפטים דורשים שרת מטריה פעיל (`npm run dev`). הם read-only ולא משנים נתונים
(למעט כתיבת baseline/קובץ דוח מקומיים).
