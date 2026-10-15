# EduFlow — O‘quv markaz CRM

HTML, CSS, Vanilla JavaScript, Node.js, Express va SQLite asosidagi o‘quv markaz boshqaruv tizimi.

## Talablar
- Node.js 18 yoki undan yangi versiya
- Internet (npm paketlarini birinchi marta o‘rnatish uchun)

## Windows’da ishga tushirish

1. Ushbu papkani kompyuteringizga oching.
2. Terminal/CMD’ni shu papkada oching.
3. `.env.example` faylidan nusxa olib `.env` nomi bilan saqlang.
4. `.env` ichida `SESSION_SECRET` va `ADMIN_PASSWORD` qiymatlarini o‘zgartiring.
5. Buyruqlarni bajaring:

```bash
npm install
npm run init-admin
npm start
```

6. Brauzerda `http://localhost:3000` manzilini oching.
7. `.env` faylida yozilgan admin login va paroldan foydalaning.

## O‘qituvchi yaratish
Admin bo‘lib kiring → **O‘qituvchilar** → **O‘qituvchi qo‘shish**. Login va kamida 8 belgili parol kiriting, so‘ng guruh(lar)ni biriktiring. O‘qituvchi shu login bilan kirib faqat o‘z guruhlari va davomatini ko‘radi.

## Asosiy funksiyalar
- Alohida guruhlar va guruh ichidagi o‘quvchilar
- O‘quvchi qo‘shish/tahrirlash
- Oylik to‘lov hisoblarini yaratish
- Qarz va qisman to‘lovni kuzatish
- Davomat: keldi, kelmadi, kechikdi, sababli
- Kirim va chiqimni hisoblash
- O‘qituvchi kabineti va guruhga asoslangan ruxsatlar

## Ma’lumotlar
SQLite ma’lumotlar bazasi `database/education-center.sqlite` faylida saqlanadi. Server qayta ishga tushganda ma’lumotlar saqlanib qoladi. Zaxira olish uchun serverni to‘xtatib, shu faylni xavfsiz joyga nusxalang.

## Muhim eslatmalar
- Bu boshlang‘ich, lokal foydalanish uchun CRM loyihasi.
- Internetga chiqarishdan oldin kuchli `SESSION_SECRET`, kuchli admin paroli, HTTPS, CSRF himoyasi, zaxira nusxalari va server xavfsizligini sozlang.
- Hozircha o‘quvchi to‘lovlari oylik hisobga bog‘langanda qarzdorlikda to‘g‘ri aks etadi. Oylik hisob yaratish uchun Guruh → To‘lovlar bo‘limida **Oylik hisoblash** tugmasidan foydalaning.
- To‘lovni qarzga bog‘lamasdan kiritish umumiy tushumda aks etadi, lekin oylik qarzdorlikni kamaytirmaydi.
