from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

load_dotenv()
from .core.errors import AppError  # noqa: E402
from .routes import router  # noqa: E402

app = FastAPI(title="nghetienghan")
# Cho phép frontend trên localhost và GitHub Pages gọi backend chạy trên máy người dùng.
app.add_middleware(CORSMiddleware, allow_origin_regex=r"https://.*\.github\.io|http://(localhost|127\.0\.0\.1)(:\d+)?",
                   allow_methods=["*"], allow_headers=["*"])


@app.middleware("http")
async def private_network(request, call_next):
    resp = await call_next(request)
    resp.headers["Access-Control-Allow-Private-Network"] = "true"  # trang https → localhost
    return resp


@app.exception_handler(AppError)
async def app_error(_, e: AppError):
    return JSONResponse({"code": e.code, "message": e.message}, status_code=e.status)


app.include_router(router)
app.mount("/", StaticFiles(directory=Path(__file__).resolve().parents[2] / "frontend", html=True), name="web")
