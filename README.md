# Ledger — บัญชีรับจ่าย

แอปพลิเคชันบัญชีรับจ่ายส่วนตัว พร้อมระบบจัดการเงินยืมและดอกเบี้ย  
ออกแบบเป็น **Progressive Web App (PWA)** — ใช้งานบน iPhone/Android ได้เหมือนแอปจริง รองรับ Offline

![HTML](https://img.shields.io/badge/HTML-5-orange)
![CSS](https://img.shields.io/badge/CSS-3-blue)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow)
![PWA](https://img.shields.io/badge/PWA-Ready-green)

---

## Features

### Dashboard
- สรุปรายรับ/รายจ่ายรวม พร้อมยอดคงเหลือ
- กราฟ Doughnut รายรับ vs รายจ่าย
- กราฟแท่งรายเดือน
- กราฟหมวดหมู่รายจ่ายสูงสุด
- ผลประกอบการเงินยืม (Loan Performance)

### บัญชีรับจ่าย (Ledger)
- บันทึกรายรับ/รายจ่าย พร้อมหมวดหมู่
- ยอดยกมา (Opening Balance)
- ยอดคงเหลือสะสม (Running Balance)
- กรองตามประเภท/หมวดหมู่
- แก้ไข/ลบรายการ

### เงินยืม (Loans)
- บันทึกเงินยืมรายบุคคล
- ประเภทดอกเบี้ย 4 แบบ:
  - **% ต่อวัน** — คำนวณดอกเบี้ยรายวัน
  - **% ต่อสัปดาห์** — คำนวณดอกเบี้ยรายสัปดาห์
  - **บาท/วัน (คงที่)** — เก็บดอกเบี้ยคงที่รายวัน พร้อม checkbox ติดตามการรับเงิน
  - **บาท/สัปดาห์ (คงที่)** — เก็บดอกเบี้ยคงที่รายสัปดาห์ พร้อม checkbox ติดตาม
- บันทึกการชำระเงินต้น
- สรุปตามผู้ยืม (Group by Borrower)
- แก้ไข/ลบรายการเงินยืม
- คาดการณ์ผลตอบแทน 7 วัน / 30 วัน

---

## Tech Stack

| เทคโนโลยี | รายละเอียด |
|-----------|-----------|
| HTML5 | โครงสร้างหน้าเว็บ |
| CSS3 | Dark theme, Responsive, Safe-area (iPhone) |
| JavaScript (Vanilla) | Logic ทั้งหมด ไม่ใช้ Framework |
| Chart.js | กราฟ Dashboard |
| localStorage | เก็บข้อมูลในเครื่อง |
| Service Worker | PWA, Offline support |

---

## Getting Started

### เปิดใช้งานในเครื่อง
```bash
# เปิดไฟล์ index.html ด้วย Browser โดยตรง
start accounting/index.html

# หรือใช้ Live Server
npx serve accounting
```

### Deploy ขึ้น Hosting (เปิดบน iPhone ได้)

**Netlify Drop (ง่ายสุด)**
1. เข้า [app.netlify.com/drop](https://app.netlify.com/drop)
2. ลากโฟลเดอร์ `accounting` ไปวาง
3. ได้ลิงก์ `https://xxxxx.netlify.app`

**GitHub Pages**
1. Push repo ขึ้น GitHub
2. Settings → Pages → Deploy from branch
3. ได้ลิงก์ `https://username.github.io/repo-name/accounting/`

### Add to Home Screen (iPhone/Android)
1. เปิดลิงก์ใน **Safari** (iPhone) หรือ **Chrome** (Android)
2. กดปุ่ม **แชร์** → **เพิ่มไปยังหน้าจอโฮม**
3. แอปจะอยู่บน Home Screen เหมือนแอปปกติ

---

## Project Structure

```
accounting/
├── index.html        # หน้าเว็บหลัก
├── styles.css        # สไตล์ทั้งหมด (Dark theme)
├── app.js            # Logic ทั้งหมด
├── sw.js             # Service Worker (Offline/PWA)
├── manifest.json     # PWA Manifest
├── icon.svg          # App icon (SVG)
├── run.bat           # เปิดแอปบน Windows
├── README.md
└── LICENSE
```

---

## Data Storage

ข้อมูลทั้งหมดเก็บใน **localStorage** ของ Browser:

| Key | ข้อมูล |
|-----|-------|
| `ledger_transactions` | รายการรับจ่ายทั้งหมด |
| `ledger_loans` | รายการเงินยืมทั้งหมด |
| `ledger_opening_balance` | ยอดยกมา |

> **หมายเหตุ:** ข้อมูลเก็บในเครื่องเท่านั้น ไม่มีการส่งขึ้น Server  
> หากล้าง Browser Data ข้อมูลจะหายไป

---

## License

MIT License — ดูรายละเอียดใน [LICENSE](LICENSE)
