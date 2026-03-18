# دليل النشر على Render

## المتطلبات
- حساب على [Render.com](https://render.com) (مجاني)
- حساب على GitHub (لرفع الكود)

## خطوات النشر

### 1. ارفع الكود على GitHub
```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/USERNAME/minervini-journal.git
git push -u origin main
```

### 2. نشر الـ Backend (FastAPI)
1. اذهب إلى [Render Dashboard](https://dashboard.render.com)
2. اضغط "New" → "Web Service"
3. اربط بمستودع GitHub
4. الإعدادات:
   - **Name:** `minervini-api`
   - **Root Directory:** `minervini-api`
   - **Runtime:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. في قسم "Disks":
   - **Name:** `userdata`
   - **Mount Path:** `/data`
   - **Size:** 1 GB
6. اضغط "Create Web Service"
7. انتظر حتى يتم النشر، ثم انسخ الـ URL (مثل: `https://minervini-api.onrender.com`)

### 3. نشر الـ Frontend (React)
1. اضغط "New" → "Static Site"
2. اربط بنفس المستودع
3. الإعدادات:
   - **Name:** `minervini-journal`
   - **Root Directory:** `minervini-journal`
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`
4. في "Environment Variables" أضف:
   - **Key:** `VITE_API_URL`
   - **Value:** URL الـ backend من الخطوة السابقة (مثل: `https://minervini-api.onrender.com`)
5. اضغط "Create Static Site"

### 4. تحديث CORS في الـ Backend (مهم)
بعد معرفة URL الـ frontend، أضف متغير بيئة في Backend:
- **Key:** `ALLOWED_ORIGIN`
- **Value:** URL الـ frontend (مثل: `https://minervini-journal.onrender.com`)

## ملاحظات
- الخطة المجانية على Render قد تجعل الـ backend "ينام" بعد 15 دقيقة من عدم الاستخدام
- عند أول طلب بعد النوم، قد يأخذ 30-60 ثانية للاستيقاظ
- بيانات المستخدمين (حسابات التسجيل) تُحفظ في قاعدة بيانات SQLite على الـ disk
- بيانات المحفظة (أسهم، صفقات) تبقى في localStorage على متصفح المستخدم
