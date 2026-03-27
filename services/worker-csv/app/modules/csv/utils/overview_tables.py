import pandas as pd
from sqlalchemy import create_engine, text
import structlog
from app.infrastructure.config import settings

logger = structlog.get_logger(__name__)

def generate_overview_tables(df: pd.DataFrame, dataset_name: str, tenant_id: str):
    """Generates structural EDA tables and upserts them to PostgreSQL for Superset."""
    try:
        conn_string = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
        engine = create_engine(conn_string)
        
        # 1. dataset_summary
        ds_summary = pd.DataFrame([{
            "dataset_name": dataset_name,
            "tenant_id": tenant_id,
            "row_count": len(df),
            "column_count": len(df.columns),
            "memory_usage_mb": float(df.memory_usage(deep=True).sum() / (1024 * 1024))
        }])
        
        # 2. column_stats
        col_stats = []
        for col in df.columns:
            series = df[col]
            stats = {
                "dataset_name": dataset_name,
                "tenant_id": tenant_id,
                "column_name": col,
                "dtype": str(series.dtype),
                "missing_count": int(series.isnull().sum()),
                "missing_pct": float(series.isnull().mean() * 100)
            }
            if pd.api.types.is_numeric_dtype(series):
                stats.update({
                    "mean": float(series.mean()) if pd.notnull(series.mean()) else None,
                    "median": float(series.median()) if pd.notnull(series.median()) else None,
                    "std": float(series.std()) if pd.notnull(series.std()) else None,
                    "min": float(series.min()) if pd.notnull(series.min()) else None,
                    "max": float(series.max()) if pd.notnull(series.max()) else None,
                    "skewness": float(series.skew()) if pd.notnull(series.skew()) else None
                })
            col_stats.append(stats)
        df_col_stats = pd.DataFrame(col_stats)
        
        # 3. correlations
        num_cols = df.select_dtypes(include=['number']).columns
        corr_data = []
        if len(num_cols) > 1:
            corr_matrix = df[num_cols].corr()
            for i in range(len(num_cols)):
                for j in range(i+1, len(num_cols)):
                    col_a = num_cols[i]
                    col_b = num_cols[j]
                    val = corr_matrix.loc[col_a, col_b]
                    if pd.notnull(val):
                        corr_data.append({
                            "dataset_name": dataset_name,
                            "tenant_id": tenant_id,
                            "column_a": col_a,
                            "column_b": col_b,
                            "correlation_value": float(val)
                        })
        df_corr = pd.DataFrame(corr_data) if corr_data else pd.DataFrame(columns=["dataset_name", "tenant_id", "column_a", "column_b", "correlation_value"])
        
        # 4. categorical_stats
        cat_cols = df.select_dtypes(exclude=['number', 'datetime']).columns
        cat_data = []
        for col in cat_cols:
            counts = df[col].value_counts().head(20) # Top 20 categories max
            for val, cnt in counts.items():
                cat_data.append({
                    "dataset_name": dataset_name,
                    "tenant_id": tenant_id,
                    "column_name": col,
                    "category_value": str(val),
                    "count": int(cnt)
                })
        df_cat = pd.DataFrame(cat_data) if cat_data else pd.DataFrame(columns=["dataset_name", "tenant_id", "column_name", "category_value", "count"])
        
        # 5. outliers
        outlier_data = []
        for col in num_cols:
            series = df[col].dropna()
            if len(series) > 0:
                q1 = series.quantile(0.25)
                q3 = series.quantile(0.75)
                iqr = q3 - q1
                lower = q1 - 1.5 * iqr
                upper = q3 + 1.5 * iqr
                outliers = series[(series < lower) | (series > upper)]
                if len(outliers) > 0:
                    outlier_data.append({
                        "dataset_name": dataset_name,
                        "tenant_id": tenant_id,
                        "column_name": col,
                        "outlier_count": int(len(outliers)),
                        "method": "IQR"
                    })
        df_outliers = pd.DataFrame(outlier_data) if outlier_data else pd.DataFrame(columns=["dataset_name", "tenant_id", "column_name", "outlier_count", "method"])
        
        # Upsert emulation
        with engine.begin() as conn:
            for table_name in ["dataset_summary", "column_stats", "correlations", "categorical_stats", "outliers"]:
                try:
                    conn.execute(text(f"DELETE FROM {table_name} WHERE dataset_name = :dname"), {"dname": dataset_name})
                except Exception:
                    pass # Table doesn't exist yet, it's fine
                    
        # Write tables
        ds_summary.to_sql("dataset_summary", engine, if_exists="append", index=False)
        df_col_stats.to_sql("column_stats", engine, if_exists="append", index=False)
        if not df_corr.empty:
            df_corr.to_sql("correlations", engine, if_exists="append", index=False)
        if not df_cat.empty:
            df_cat.to_sql("categorical_stats", engine, if_exists="append", index=False)
        if not df_outliers.empty:
            df_outliers.to_sql("outliers", engine, if_exists="append", index=False)
            
        logger.info("overview_tables_generated", dataset=dataset_name)
    except Exception as e:
        logger.error("failed_generating_overview_tables", error=str(e))
