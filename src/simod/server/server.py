# İmport edilen modülleri ekleyin
import os
import time
import threading
import pandas as pd
from typing import Optional, List, Dict
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Body
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from fastapi.responses import JSONResponse
from pydantic import BaseModel

app = FastAPI()

########## API ENDPOINTS - SIMOD CONTROL FLOW ##########

# Variables for top-3 results
top_3_results: Optional[List[Dict]] = None

# API for sending top-3 results
@app.post("/top-3-results/")
def receive_top_3_results(data: List[Dict] = Body(...)):
    """Accept the top-3 results and save them in memory."""
    global top_3_results
    top_3_results = data
    return {"message": "Top-3 results received successfully", "count": len(data)}

# API for retrieving the top-3 results
@app.get("/top-3-results/")
def get_top_3_results():
    """Return the top-3 results if available."""
    if top_3_results is None:
        return {"message": "No results have been received yet."}
    return JSONResponse(content={"results": top_3_results})

# API for resetting the top-3 results
@app.delete("/top-3-results/")
def reset_top_3_results():
    """Reset the top-3 results to None."""
    global top_3_results
    top_3_results = None
    return  {"message": "Top-3 results have been reset."}

# API for getting the best BPMN file
# This endpoint serves BPMN files from a static directory
BASE_BPMN_DIR = "static/best_bpmns"

@app.get("/api/bpmn/{full_path:path}")
def get_bpmn(full_path: str):
    bpmn_path = os.path.join(BASE_BPMN_DIR, full_path)
    if not os.path.isfile(bpmn_path):
        raise HTTPException(status_code=404, detail="BPMN file not found")
    with open(bpmn_path, "r", encoding="utf-8") as f:
        xml = f.read()
    return JSONResponse(content={"bpmn_xml": xml})

# Variables for best model selection
selected_model_path: Optional[Path] = None

class Selection(BaseModel):
    model_path: str

# API for selecting a model
@app.post("/select-model/")
def select_model(selection: Selection):
    global selected_model_path
    selected_model_path = Path(selection.model_path)
    return {"message": "Model selection received", "model_path": str(selected_model_path)}

# API for getting the selected model path
@app.get("/get-selected-model/")
def get_selection():
    if selected_model_path is None:
        return {"message": "No model has been selected yet"}
    return {"selected_model_path": str(selected_model_path)}

# API for best model selection state reset
@app.post("/reset-selected-model/")
def reset_selected_model():
    """Reset the selected model path state."""
    global selected_model_path
    selected_model_path = None
    return {"message": "Selection reset"}

########## API ENDPOINTS - EVENT LOGS ##########

# CORS ayarlarını ekleyin - çok önemli!
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Geliştirme için tüm originlere izin verilir
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global değişkenler
SIMOD_CONTINUE_EVENT = threading.Event()
FILTERED_EVENT_LOG_PATH = None
CURRENT_EVENT_LOG_PATH = None
SIMOD_STATUS = "idle"  # idle, running, waiting_for_filter, completed, error

# Yükleme dizinini tanımla
UPLOAD_DIR = Path("uploaded_logs")
if not UPLOAD_DIR.exists():
    UPLOAD_DIR.mkdir(parents=True)    

# Ana sayfa için basit endpoint
@app.get("/")
async def root():
    return {"status": "ok", "message": "API is running"}

# Event log yükleme endpoint'i
@app.post("/api/event-log/upload")
async def upload_event_log(file: UploadFile = File(...)):
    """Event log dosyasını yükler ve API tarafından erişilebilir hale getirir"""
    global CURRENT_EVENT_LOG_PATH
    
    try:
        # Yükleme klasörünü kontrol et ve oluştur
        if not UPLOAD_DIR.exists():
            UPLOAD_DIR.mkdir(parents=True)
            
        # Dosya yolu oluştur
        file_path = UPLOAD_DIR / file.filename
        
        # Dosyayı kaydet
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        CURRENT_EVENT_LOG_PATH = str(file_path)
        
        print(f"Event log dosyası başarıyla yüklendi: {file.filename} ({os.path.getsize(file_path)} bytes)")
        
        # İlk birkaç satırı okuyarak içeriği kontrol et
        try:
            df = pd.read_csv(file_path, nrows=5)
            print(f"Event log örnek içerik - ilk 5 satır, kolonlar: {', '.join(df.columns.tolist())}")
        except Exception as e:
            print(f"Event log içeriği kontrol edilirken hata: {str(e)}")
        
        return {
            "status": "success", 
            "message": f"Event log dosyası başarıyla yüklendi: {file.filename}",
            "file_path": CURRENT_EVENT_LOG_PATH
        }
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Event log yükleme hatası: {str(e)}")
        print(error_details)
        raise HTTPException(status_code=500, detail=f"Event log yüklenirken hata oluştu: {str(e)}")

# Event log endpoint'i - sayfalama ile
@app.get("/api/event-log")
async def get_event_log(limit: int = 100, offset: int = 0):
    """Event log verilerini sayfalama ile döndürür"""
    global CURRENT_EVENT_LOG_PATH
    
    try:
        # Event log dosyası kontrolü
        if not CURRENT_EVENT_LOG_PATH or not os.path.exists(CURRENT_EVENT_LOG_PATH):
            # Klasördeki en son event log dosyasını bulmaya çalış
            if UPLOAD_DIR.exists():
                log_files = list(UPLOAD_DIR.glob("*.csv"))
                if log_files:
                    CURRENT_EVENT_LOG_PATH = str(max(log_files, key=os.path.getmtime))
                else:
                    raise HTTPException(status_code=404, detail="Event log dosyası bulunamadı")
            else:
                raise HTTPException(status_code=404, detail="Event log dosyası bulunamadı")
        
        # Dosya uzantısına göre okuma yap
        log_df = None
        if CURRENT_EVENT_LOG_PATH.endswith('.csv'):
            log_df = pd.read_csv(CURRENT_EVENT_LOG_PATH)
        elif CURRENT_EVENT_LOG_PATH.endswith('.csv.gz'):
            log_df = pd.read_csv(CURRENT_EVENT_LOG_PATH, compression='gzip')
        else:
            raise HTTPException(status_code=400, detail="Desteklenmeyen dosya formatı")
        
        # Toplam satır sayısı
        total_rows = len(log_df)
        
        # Sayfalama
        paginated_df = log_df.iloc[offset:offset+limit]
        
        # JSON'a dönüştür (NaN değerleri boş stringe dönüştür)
        log_data = paginated_df.fillna('').to_dict(orient="records")
        
        return {
            "status": "success",
            "data": log_data,
            "total_rows": total_rows,
            "columns": log_df.columns.tolist(),
            "file_path": CURRENT_EVENT_LOG_PATH
        }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Hata: {str(e)}")
        print(error_details)
        raise HTTPException(status_code=500, detail=f"Event log verisi yüklenirken hata: {str(e)}")

# Tüm event log verilerini döndüren endpoint
@app.get("/api/event-log/full")
async def get_full_event_log():
    """Tüm event log verilerini tek seferde döndürür"""
    global CURRENT_EVENT_LOG_PATH
    
    try:
        # Event log dosyası kontrolü
        if not CURRENT_EVENT_LOG_PATH or not os.path.exists(CURRENT_EVENT_LOG_PATH):
            # Klasördeki en son event log dosyasını bulmaya çalış
            if UPLOAD_DIR.exists():
                log_files = list(UPLOAD_DIR.glob("*.csv"))
                if log_files:
                    CURRENT_EVENT_LOG_PATH = str(max(log_files, key=os.path.getmtime))
                else:
                    raise HTTPException(status_code=404, detail="Event log dosyası bulunamadı")
            else:
                raise HTTPException(status_code=404, detail="Event log dosyası bulunamadı")
        
        # Dosya okuma
        log_df = None
        if CURRENT_EVENT_LOG_PATH.endswith('.csv'):
            log_df = pd.read_csv(CURRENT_EVENT_LOG_PATH)
        elif CURRENT_EVENT_LOG_PATH.endswith('.csv.gz'):
            log_df = pd.read_csv(CURRENT_EVENT_LOG_PATH, compression='gzip')
        else:
            raise HTTPException(status_code=400, detail="Desteklenmeyen dosya formatı")
        
        # JSON'a dönüştür (NaN değerleri boş stringe dönüştür)
        log_data = log_df.fillna('').to_dict(orient="records")
        
        return {
            "status": "success",
            "data": log_data,
            "total_rows": len(log_data),
            "columns": log_df.columns.tolist(),
            "file_path": CURRENT_EVENT_LOG_PATH
        }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Hata: {str(e)}")
        print(error_details)
        raise HTTPException(status_code=500, detail=f"Event log verisi yüklenirken hata: {str(e)}")

# Filtrelenmiş event log verilerini kaydetme endpoint'i
@app.post("/api/event-log/filtered")
async def save_filtered_event_log(data: dict):
    """
    Filtrelenmiş event log verilerini CSV olarak kaydeder
    """
    global FILTERED_EVENT_LOG_PATH, SIMOD_CONTINUE_EVENT
    
    try:
        # Gelen verileri kontrol et
        if not data or "data" not in data or not isinstance(data["data"], list):
            raise HTTPException(status_code=400, detail="Geçersiz veri formatı: 'data' alanı bekleniyor")
            
        if len(data["data"]) == 0:
            raise HTTPException(status_code=400, detail="Boş veri listesi gönderildi")
        
        # Gelen verileri Pandas DataFrame'e dönüştür
        import pandas as pd
        df = pd.DataFrame(data["data"])
        
        # Dosya adı ve yolu belirle
        from datetime import datetime
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_name = f"filtered_event_log_{timestamp}.csv"
        
        # Upload dizini kontrolü
        if not UPLOAD_DIR.exists():
            UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        
        # Dosyayı kaydet
        file_path = UPLOAD_DIR / file_name
        df.to_csv(file_path, index=False)
        
        # Dosya kontrolü
        if not os.path.exists(file_path):
            raise HTTPException(status_code=500, detail="Dosya kaydedildi ancak kontrol edilemedi")
            
        # Global değişkene ata
        FILTERED_EVENT_LOG_PATH = str(file_path)
        SIMOD_CONTINUE_EVENT.set()  # Devam sinyalini ayarla
        
        print(f"Filtrelenmiş event log dosyası kaydedildi: {file_path} ({len(df)} kayıt)")
        
        return {
            "status": "success", 
            "message": f"Filtrelenmiş event log dosyası başarıyla kaydedildi",
            "file_path": FILTERED_EVENT_LOG_PATH,
            "row_count": len(df),
            "file_exists": os.path.exists(FILTERED_EVENT_LOG_PATH),
            "file_size_bytes": os.path.getsize(FILTERED_EVENT_LOG_PATH)
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Filtrelenmiş event log kaydetme hatası: {str(e)}")
        print(error_details)
        raise HTTPException(status_code=500, detail=f"Filtrelenmiş event log kaydedilirken hata oluştu: {str(e)}")

# Simod'a devam sinyali gönderen endpoint
@app.post("/api/simod/continue")
async def continue_simod():
    """Simod'a devam sinyali gönderir"""
    global SIMOD_CONTINUE_EVENT, FILTERED_EVENT_LOG_PATH
    
    try:
        if not FILTERED_EVENT_LOG_PATH:
            raise HTTPException(status_code=400, detail="Filtrelenmiş event log dosyası bulunamadı")
        
        # Simod'a devam sinyali gönder
        SIMOD_CONTINUE_EVENT.set()
        
        return {
            "status": "success",
            "message": "Simod'a devam sinyali gönderildi",
            "filtered_event_log": FILTERED_EVENT_LOG_PATH
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Simod continue hatası: {str(e)}")
        print(error_details)
        raise HTTPException(status_code=500, detail=f"Simod'a devam sinyali gönderilirken hata oluştu: {str(e)}")

# Filtrelenmiş event log yolunu döndüren endpoint
@app.get("/api/event-log/filtered-path")
async def get_filtered_event_log_path():
    """Filtrelenmiş event log yolunu döndürür"""
    global FILTERED_EVENT_LOG_PATH
    
    if FILTERED_EVENT_LOG_PATH and os.path.exists(FILTERED_EVENT_LOG_PATH):
        # Dosya boyutu kontrolü
        file_size = os.path.getsize(FILTERED_EVENT_LOG_PATH)
        
        return {
            "path": FILTERED_EVENT_LOG_PATH,
            "exists": True,
            "size_bytes": file_size,
            "size_mb": round(file_size / (1024 * 1024), 2)
        }
    else:
        return {
            "path": FILTERED_EVENT_LOG_PATH,
            "exists": False if FILTERED_EVENT_LOG_PATH else None,
            "message": "Filtrelenmiş dosya bulunamadı veya henüz oluşturulmadı"
        }

# Simod durumunu döndüren endpoint
@app.get("/api/simod/status")
async def get_simod_status():
    """Simod'un durumunu döndürür"""
    global SIMOD_STATUS
    
    return {
        "status": SIMOD_STATUS,
        "timestamp": time.time()
    }

# Simod durumunu güncelleyen endpoint
@app.post("/api/simod/set-status")
async def set_simod_status(data: dict):
    """Simod durumunu günceller"""
    global SIMOD_STATUS
    
    try:
        if "status" not in data:
            raise HTTPException(status_code=400, detail="Status değeri gerekli")
        
        new_status = data["status"]
        allowed_statuses = ["idle", "running", "waiting_for_filter", "completed_filtering", "completed", "error"]
        
        if new_status not in allowed_statuses:
            raise HTTPException(status_code=400, detail=f"Geçersiz durum. İzin verilen değerler: {', '.join(allowed_statuses)}")
        
        SIMOD_STATUS = new_status
        print(f"Simod durumu güncellendi: {SIMOD_STATUS}")
        
        return {"status": "success", "message": f"Durum güncellendi: {SIMOD_STATUS}"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Durum güncellenirken hata: {str(e)}")

# Temizleme endpoint'i
@app.post("/api/event-log/clear")
async def clear_event_logs():
    """Yüklü event log'ları ve filtreleme durumunu temizler"""
    global CURRENT_EVENT_LOG_PATH, FILTERED_EVENT_LOG_PATH, SIMOD_CONTINUE_EVENT
    
    try:
        # Global değişkenleri sıfırla
        old_path = CURRENT_EVENT_LOG_PATH
        CURRENT_EVENT_LOG_PATH = None
        FILTERED_EVENT_LOG_PATH = None
        SIMOD_CONTINUE_EVENT.clear()
        
        # Klasördeki dosyaları temizle
        if UPLOAD_DIR.exists():
            import shutil
            try:
                # Klasördeki dosyaları temizle ama klasörü silme
                for file_path in UPLOAD_DIR.glob("*"):
                    if file_path.is_file():
                        file_path.unlink()  # Dosyayı sil
                print(f"Klasördeki tüm dosyalar temizlendi: {UPLOAD_DIR}")
            except Exception as e:
                print(f"Dosyalar silinirken hata: {str(e)}")
            
        return {
            "status": "success",
            "message": f"Event log verileri temizlendi. Klasör: {UPLOAD_DIR}, Eski dosya: {old_path}"
        }
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Event log temizleme hatası: {str(e)}")
        print(error_details)
        raise HTTPException(status_code=500, detail=f"Event log temizlenirken hata oluştu: {str(e)}")    

if __name__ == "__main__":
    import uvicorn
    
    print("FastAPI sunucusu başlatılıyor...")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")