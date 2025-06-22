from fastapi import FastAPI
from simod.fastapi_server.best_model_selection_api import router as best_model_selection_router
from simod.fastapi_server.best_three_results_api import router as best_3_results_router

app = FastAPI()

app.include_router(best_model_selection_router)
app.include_router(best_3_results_router)
