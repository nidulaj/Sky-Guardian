import os
import sys
import uuid
from datetime import datetime, timezone

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.config import settings
from app.api.auth import hash_password, UserRole
from supabase import create_client

def seed_admin(
    email: str = "admin@skyguardian.ai",
    password: str = "Admin@SkyGuardian2026!",
    first_name: str = "System",
    last_name: str = "Administrator",
    phone_number: str = "+94112345678"
):
    print("=" * 60)
    print("SKYGUARDIAN AI - ADMIN SEED SCRIPT")
    print("=" * 60)

    url = settings.clean_supabase_url
    key = settings.SUPABASE_SERVICE_ROLE_KEY

    if not url or not key:
        print("[ERROR] Supabase URL or Service Role Key missing in .env")
        return False

    sb = create_client(url, key)
    clean_email = email.lower().strip()
    hashed_pwd = hash_password(password)
    now_iso = datetime.now(timezone.utc).isoformat()

    try:
        # Check if user already exists
        existing = sb.table("users").select("id, role").eq("email", clean_email).execute()
        if existing.data:
            user_id = existing.data[0]["id"]
            print(f"[INFO] User {clean_email} already exists. Promoting/updating to ADMIN...")
            sb.table("users").update({
                "role": UserRole.ADMIN.value,
                "hashed_password": hashed_pwd,
                "first_name": first_name,
                "last_name": last_name,
                "phone_number": phone_number,
                "is_active": True,
                "updated_at": now_iso
            }).eq("id", user_id).execute()
            print(f"[SUCCESS] Admin user '{clean_email}' updated successfully!")
        else:
            user_id = f"usr_admin_{uuid.uuid4().hex[:8]}"
            admin_record = {
                "id": user_id,
                "email": clean_email,
                "hashed_password": hashed_pwd,
                "first_name": first_name,
                "last_name": last_name,
                "phone_number": phone_number,
                "role": UserRole.ADMIN.value,
                "preferred_language": "en",
                "is_active": True,
                "created_at": now_iso,
                "updated_at": now_iso
            }
            sb.table("users").insert(admin_record).execute()
            print(f"[SUCCESS] Admin user '{clean_email}' created successfully with role 'ADMIN'!")

        print("\n--- ADMIN LOGIN CREDENTIALS ---")
        print(f"Email:    {clean_email}")
        print(f"Password: {password}")
        print("Role:     ADMIN")
        print("=" * 60)
        return True
    except Exception as e:
        print(f"[ERROR] Failed to seed admin in Supabase: {e}")
        return False

if __name__ == "__main__":
    seed_admin()
