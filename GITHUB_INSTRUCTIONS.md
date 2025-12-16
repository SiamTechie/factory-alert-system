# วิธีนำโปรเจคนี้ขึ้น GitHub

เนื่องจากนี่เป็นการใช้งาน Git ครั้งแรกในเครื่องนี้ หรือยังไม่ได้ตั้งค่าผู้ใช้ เราต้องทำการตั้งค่าก่อนครับ

### 1. สร้าง Repository บน GitHub
1. ไปที่ [GitHub.com](https://github.com) และ Login
2. กดปุ่ม **New (+)** เพื่อสร้าง Repository ใหม่
3. ตั้งชื่อว่า `factory-alert-system` (หรือตามต้องการ)
4. **ไม่ต้อง** ติ๊ก "Add a README file" (เพราะเรามีไฟล์ในเครื่องแล้ว)
5. กด **Create repository**

### 2. ตั้งค่าและอัพโหลด (ทำใน Terminal)
เปิด Terminal ใน VS Code (Ctrl+J) แล้วพิมพ์คำสั่งตามลำดับนี้:

**ขั้นตอนที่ 1: ตั้งตัวตน (ถ้ายังไม่เคยทำ)**
เปลี่ยน `your@email.com` และ `Your Name` เป็นของคุณ
```bash
git config --global user.email "your@email.com"
git config --global user.name "Your Name"
```

**ขั้นตอนที่ 2: บันทึกไฟล์ลง Git**
```bash
git init
git add .
git commit -m "First commit"
```

**ขั้นตอนที่ 3: เชื่อมต่อกับ GitHub และอัพโหลด**
(ก๊อปปี้ URL จากหน้า GitHub ที่คุณเพิ่งสร้างมาแทนที่ `URL_FROM_GITHUB`)
```bash
git branch -M main
git remote add origin https://github.com/USERNAME/factory-alert-system.git
git push -u origin main
```

---

---
*หมายเหตุ: `USERNAME` คือชื่อผู้ใช้ GitHub ของคุณ*

### ❌ ถ้าเจอปัญหา (Troubleshooting)

**กรณีเจอ Error 403 "Permission denied"**
แปลว่ารหัสผ่านหรือ Token ที่เครื่องจำไว้ **ไม่มีสิทธิ์เขียน (Write Access)** หรือ **หมดอายุ**

**วิธีแก้ (Windows):**
1. กดปุ่ม Start พิมพ์ค้นหา **"Credential Manager"** (ตัวจัดการข้อมูลประจำตัว)
2. เลือกแถบ **Windows Credentials**
3. หาหัวข้อ `git:https://github.com` แล้วกด **Remove** (ลบออก)
4. กลับมาที่ VS Code ลองพิมพ์คำสั่ง `git push -u origin main` ใหม่
5. จะมีหน้าต่างเด้งมาให้ Login:
   - เลือก **"Sign in with your browser"** (ง่ายที่สุด)
   - หรือใส่ Token ใหม่ถ้าใช้แบบ Token

