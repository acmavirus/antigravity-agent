from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from app.core.process_manager import ProcessManager
from app.core.account_manager import AccountManager
from app.core.config import API_HOST, API_PORT
import uvicorn
import threading

app = FastAPI(title="Antigravity Agent API (Python)")

@app.get("/api/is_antigravity_running")
async def is_running():
    return {"status": "running" if ProcessManager.is_running() else "stopped"}

@app.get("/api/get_antigravity_accounts")
async def get_accounts():
    return AccountManager.list_accounts()

@app.post("/api/switch_to_antigravity_account")
async def switch_account(account_name: str):
    """
    Endpoint này nhận account_name (thường là email).
    Thực hiện: Tắt app -> Ghi DB -> Trả về kết quả.
    """
    # 1. Tắt ứng dụng Antigravity
    ProcessManager.kill_all()
    
    # 2. Thực hiện chuyển đổi trong DB
    success, message = AccountManager.switch_to_account(account_name)
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    # 3. Khởi động lại ứng dụng sau khi đổi account thành công
    ProcessManager.start_app()
        
    return {"success": True, "message": message}

@app.post("/api/delete_backup")
async def delete_backup(name: str):
    success, message = AccountManager.delete_account(name)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"success": True, "message": message}

@app.post("/api/clear_all_backups")
async def clear_all_backups():
    count, message = AccountManager.clear_all_accounts()
    return {"success": True, "deleted_count": count, "message": message}

@app.get("/api/get_current_antigravity_account_info")
async def get_current_info():
    from app.core.db_handler import DBHandler, AGENT_STATE_KEY
    from app.core.auth_handler import AuthHandler
    
    db = DBHandler()
    state = db.read_key(AGENT_STATE_KEY)
    if not state:
        return {"error": "No account active"}
    
    return AuthHandler.get_account_summary(state)

def run_api():
    uvicorn.run(app, host=API_HOST, port=API_PORT, log_level="info")

def start_api_thread():
    thread = threading.Thread(target=run_api, daemon=True)
    thread.start()
