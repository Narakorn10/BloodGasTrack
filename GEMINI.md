# Blood Gas Tracker Project

ระบบบันทึกข้อมูลน้ำยา Blood Gas สำหรับห้องปฏิบัติการ (Refactored v4.1)

## โครงสร้างโปรเจค
- **Code.js:** ส่วน Backend (Google Apps Script) จัดการ Auth, Data Persistence และ Sheet Initialization
- **index.html:** ส่วน Frontend (UI/UX) ใช้ระบบ Login, Dashboard แบบ Gauge และฟอร์มบันทึกข้อมูล
- **appsscript.json:** การตั้งค่า Web App (Asia/Bangkok)
- `.clasp.json`: การเชื่อมต่อกับ Google Script ID

## รายละเอียดทางเทคนิค
- **Database:** Google Sheets (Sheets: `Records`, `Logs`, `Users`)
- **UI:** CSS Vanilla + Kanit Font + IBM Plex Mono สำหรับตัวเลข
- **Security:** ป้องกัน Clickjacking ด้วย `XFrameOptionsMode.DEFAULT`

## แผนการพัฒนา
- [x] โครงสร้างพื้นฐานและ UI/UX
- [ ] ทดสอบระบบ Login และการบันทึกข้อมูล
- [ ] ตรวจสอบการจัดการ Waste และ PM Badges
