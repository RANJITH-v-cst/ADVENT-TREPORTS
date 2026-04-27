from fastapi import APIRouter, HTTPException, BackgroundTasks
import sqlite3
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from datetime import datetime

from database import DB_PATH

router = APIRouter(prefix="/api/license", tags=["license"])

ADMIN_EMAIL = "ranjithsvhpc1234@gmail.com"

# --- SMTP Configuration (User needs to set these) ---
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
SMTP_USER = os.getenv("SMTP_USER", "your-email@gmail.com")
SMTP_PASS = os.getenv("SMTP_PASS", "your-app-password")

def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS access_requests (
                email TEXT PRIMARY KEY,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

init_db()

def send_approval_email(user_email: str):
    try:
        msg = MIMEMultipart()
        msg['From'] = SMTP_USER
        msg['To'] = ADMIN_EMAIL
        msg['Subject'] = "New Access Request - ADVENT TREPORTS"

        approve_url = f"http://localhost:8000/api/license/approve/{user_email}"
        
        body = f"""
        <h2>New Access Request</h2>
        <p>A user is requesting access to ADVENT TREPORTS.</p>
        <p><strong>User Email:</strong> {user_email}</p>
        <p><strong>Time:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
        <br/>
        <a href="{approve_url}" style="padding: 10px 20px; background: #6366f1; color: white; text-decoration: none; border-radius: 5px;">APPROVE ACCESS</a>
        """
        
        msg.attach(MIMEText(body, 'html'))

        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USER, SMTP_PASS)
        server.send_message(msg)
        server.quit()
    except Exception as e:
        print(f"Failed to send email: {e}")

@router.post("/request")
async def request_access(data: dict, background_tasks: BackgroundTasks):
    email = data.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    
    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute("INSERT OR IGNORE INTO access_requests (email) VALUES (?)", (email,))
            background_tasks.add_task(send_approval_email, email)
        return {"message": "Request sent to admin"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/approve/{email}")
async def approve_access(email: str):
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cur = conn.execute("UPDATE access_requests SET status = 'approved' WHERE email = ?", (email,))
            if cur.rowcount == 0:
                return "User not found or already approved."
        return f"Access granted for {email}. They can now unlock the app!"
    except Exception as e:
        return f"Error: {str(e)}"

@router.get("/status/{email}")
async def check_status(email: str):
    with sqlite3.connect(DB_PATH) as conn:
        row = conn.execute("SELECT status FROM access_requests WHERE email = ?", (email,)).fetchone()
        if not row:
            return {"status": "not_found"}
        return {"status": row[0]}
