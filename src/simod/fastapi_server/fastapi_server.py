from fastapi import FastAPI
from simod.fastapi_server.best_model_selection_api import router as best_model_selection_router
from simod.fastapi_server.best_three_results_api import router as best_3_results_router
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles # 导入 StaticFiles
import os
from fastapi.responses import FileResponse
from simod.bpmn.auto_bpmn_layout import generate_layout


app = FastAPI()

# --- CORS 配置 (非常重要，否则前端会因为跨域而被浏览器阻止) ---
origins = [
    "http://localhost",
    "http://localhost:8000", # 你的 React 开发服务器端口，请根据实际情况修改
    "http://127.0.0.1:8000",
    "http://localhost:3000",
    # 生产环境部署时，添加你的前端域名
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# --- CORS 配置结束 ---

app.include_router(best_model_selection_router)
app.include_router(best_3_results_router)


# 假设 BPMN 文件存在于这个路径
BPMN_DIR = os.path.join(os.getcwd(), "generated_bpmn")

@app.on_event("startup")
def generate_bpmn_on_startup():
    input_bpmn = os.path.join(os.getcwd(), "generated_bpmn/LoanApp_simplified_train.bpmn")
    output_bpmn = os.path.join(BPMN_DIR, "output.bpmn")
    os.makedirs(BPMN_DIR, exist_ok=True)
    generate_layout(input_bpmn, output_bpmn)

@app.get("/bestbpmns/")
async def list_bpmn_files():
    files = []
    for fname in os.listdir(BPMN_DIR):
        if fname.endswith(".bpmn") or fname.endswith(".xml"):
            files.append({"id": fname, "filename": fname})
    return {"results": files}

@app.get("/bestbpmns/{filename}")
async def get_bpmn_file(filename: str):
    file_path = os.path.join(BPMN_DIR, filename)
    if not os.path.exists(file_path):
        return {"error": "file not found"}
    return FileResponse(file_path, media_type="application/xml")