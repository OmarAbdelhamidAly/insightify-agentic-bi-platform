"""Function Execution Layer.

Routes Planner outputs to Python implementations for ML, Stats, and Data Analysis.
Ensures standardized `{result: ..., metadata: ...}` dictionary output contracts.
Handles missing dependencies gracefully.
"""

import pandas as pd
import numpy as np

def _sanitize_for_json(obj):
    """Recursively cast Numpy datatypes to native Python types for JSON serialization."""
    if isinstance(obj, dict):
        return {k: _sanitize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_sanitize_for_json(v) for v in obj]
    elif isinstance(obj, (pd.Series, pd.Index)):
        return _sanitize_for_json(obj.tolist())
    elif isinstance(obj, pd.DataFrame):
        return _sanitize_for_json(obj.to_dict(orient="records"))
    elif pd.isna(obj): # Catches np.nan, pd.NA, None
        return None
    elif isinstance(obj, (np.integer, np.int64, np.int32)):
        return int(obj)
    elif isinstance(obj, (np.floating, np.float64, np.float32)):
        if np.isnan(obj) or np.isinf(obj):
            return None
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return _sanitize_for_json(obj.tolist())
    elif hasattr(obj, "isoformat"): # Catches dates, datetimes, pd.Timestamp
        return obj.isoformat()
    return obj

def execute_function(function_name: str, data_path: str = None, df: pd.DataFrame = None, columns: list = None, parameters: dict = None) -> tuple[dict, pd.DataFrame]:
    """Dynamically route and execute an analytical function against a dataset.
    Returns (result_dict, mutated_df)."""
    if df is None:
        if not data_path:
            raise ValueError("Either data_path or df must be provided")
        df = pd.read_csv(data_path) if data_path.endswith('.csv') else pd.read_excel(data_path)
        
    parameters = parameters or {}
    columns = columns or []
    
    # Store a copy for mutation if needed
    df_out = df
    
    try:
        # ---- EDA (Exploratory Data Analysis) ----
        if function_name == "summary_stats":
            target = df[columns] if columns else df.select_dtypes(include='number')
            desc = target.describe().to_dict()
            res = desc
            
        elif function_name == "distribution_analysis":
            col = columns[0] if columns else df.select_dtypes(include='number').columns[0]
            series = df[col].dropna()
            if np.issubdtype(series.dtype, np.number):
                counts, bins = np.histogram(series, bins=min(20, len(series.unique())))
                bin_labels = [f"{np.round(bins[i], 2)}-{np.round(bins[i+1], 2)}" for i in range(len(counts))]
                res = [{"bin": label, "count": int(c)} for label, c in zip(bin_labels, counts)]
            else:
                vc = series.value_counts().head(20)
                res = [{"category": str(k), "count": int(v)} for k, v in vc.items()]

        elif function_name == "missing_values":
            nulls = df.isnull().sum()
            pct = (nulls / len(df) * 100).round(2)
            res = [{"column": col, "missing_count": int(nulls[col]), "missing_pct": float(pct[col])} for col in df.columns if nulls[col] > 0]
            if not res:
                res = [{"message": "No missing values found"}]
                
        elif function_name == "outlier_detection":
            col = columns[0] if columns else df.select_dtypes(include='number').columns[0]
            series = df[col].dropna()
            q1, q3 = series.quantile(0.25), series.quantile(0.75)
            iqr = q3 - q1
            lower, upper = q1 - 1.5 * iqr, q3 + 1.5 * iqr
            outliers = series[(series < lower) | (series > upper)]
            res = {
                "column": col,
                "total_outliers": int(len(outliers)),
                "lower_bound": float(lower),
                "upper_bound": float(upper),
                "outlier_pct": round(float(len(outliers) / len(series) * 100), 2),
                "sample_outliers": outliers.head(10).tolist()
            }

        # ---- AGGREGATION ----
        elif function_name == "sum":
            res = df[columns].sum(numeric_only=True).to_dict()
        elif function_name == "avg":
            res = df[columns].mean(numeric_only=True).to_dict()
        elif function_name in ("max", "min", "count"):
            res = getattr(df[columns], function_name)(numeric_only=True if function_name != "count" else False).to_dict()
        elif function_name == "groupby":
            grp = parameters.get("group_by", columns[0] if columns else None)
            agg_col = parameters.get("agg_column")
            func = parameters.get("agg_function", "sum")
            if isinstance(grp, str): grp = [grp]
            if grp and agg_col:
                res = df.groupby(grp)[agg_col].agg(func).reset_index().to_dict(orient="records")
            else:
                # Fallback purely counts
                res = df.groupby(grp or columns).size().reset_index(name='count').to_dict(orient="records")
                
        # ---- STATISTICAL ----
        elif function_name == "correlation_matrix":
            res = df.select_dtypes(include='number').corr().fillna(0).to_dict()
        elif function_name == "correlation":
            if len(columns) >= 2:
                corr_val = float(df[columns[0]].corr(df[columns[1]]))
                # Return scatter-plottable data so the visualization agent can plot it
                sample = df[columns].dropna().head(200)
                res = sample.to_dict(orient="records")
                # Attach the correlation coefficient as metadata
            else:
                res = df.select_dtypes(include='number').corr().fillna(0).to_dict()
        elif function_name == "covariance":
            if len(columns) >= 2:
                res = {"covariance": float(df[columns[0]].cov(df[columns[1]]))}
            else:
                res = df.select_dtypes(include='number').cov().fillna(0).to_dict()
        elif function_name == "variance":
            res = df[columns].var(numeric_only=True).to_dict()
        elif function_name == "std_dev":
            res = df[columns].std(numeric_only=True).to_dict()
        elif function_name == "chi_square_test":
            try:
                from scipy.stats import chi2_contingency
                if len(columns) >= 2:
                    ct = pd.crosstab(df[columns[0]], df[columns[1]])
                    chi2, p_val, dof, expected = chi2_contingency(ct)
                    res = {
                        "chi2_statistic": float(chi2),
                        "p_value": float(p_val),
                        "degrees_of_freedom": int(dof),
                        "significant": bool(p_val < 0.05)
                    }
                else:
                    raise ValueError("chi_square_test requires 2 categorical columns")
            except ImportError:
                raise ImportError("scipy is required for chi_square_test")
        elif function_name == "anova":
            try:
                from scipy.stats import f_oneway
                group_col = columns[0] if columns else list(df.select_dtypes(exclude='number').columns)[0]
                val_col = columns[1] if len(columns) > 1 else list(df.select_dtypes(include='number').columns)[0]
                groups = [g[val_col].dropna().values for _, g in df.groupby(group_col)]
                groups = [g for g in groups if len(g) > 0]
                f_stat, p_val = f_oneway(*groups)
                res = {
                    "f_statistic": float(f_stat),
                    "p_value": float(p_val),
                    "significant": bool(p_val < 0.05),
                    "num_groups": len(groups)
                }
            except ImportError:
                raise ImportError("scipy is required for anova")
        elif function_name == "t_test": 
            try:
                from scipy import stats
                g_col = parameters.get("group_col", columns[0] if len(columns)>0 else list(df.select_dtypes(exclude="number").columns)[0])
                v_col = parameters.get("value_col", columns[1] if len(columns)>1 else list(df.select_dtypes("number").columns)[0])
                
                groups = df[g_col].dropna().unique()
                if len(groups) >= 2:
                    g1 = df[df[g_col] == groups[0]][v_col].dropna()
                    g2 = df[df[g_col] == groups[1]][v_col].dropna()
                    t_stat, p_val = stats.ttest_ind(g1, g2)
                    res = {
                        "t_statistic": float(t_stat), 
                        "p_value": float(p_val), 
                        "groups": [str(groups[0]), str(groups[1])],
                        "significant_difference": bool(p_val < 0.05)
                    }
                else:
                    raise ValueError(f"t_test requires at least 2 distinct groups in {g_col}. Found: {groups}")
            except ImportError:
                raise ImportError("scipy is required for t_test. Please install it.")
                
        # ---- TIME SERIES ----
        elif function_name == "trend_analysis":
            date_col = parameters.get("date_column") or (columns[0] if columns else None)
            val_col = parameters.get("value_column") or (columns[1] if len(columns) > 1 else None)
            df_temp = df.copy()
            df_temp[date_col] = pd.to_datetime(df_temp[date_col])
            freq = parameters.get("freq", "M")
            res = df_temp.groupby(df_temp[date_col].dt.to_period(freq))[val_col].sum().reset_index()
            res[date_col] = res[date_col].astype(str)
            res = res.to_dict(orient="records")
        elif function_name == "moving_average":
            date_col = parameters.get("date_column", columns[0] if columns else None)
            val_col = parameters.get("value_column", columns[1] if len(columns)>1 else None)
            window = parameters.get("window", 7)
            df_ts = df[[date_col, val_col]].dropna().sort_values(date_col).copy()
            df_ts[f"{val_col}_ma"] = df_ts[val_col].rolling(window=window).mean()
            df_ts[date_col] = df_ts[date_col].astype(str)
            res = df_ts.tail(50).to_dict(orient="records")
            
        elif function_name == "growth_rate":
            date_col = parameters.get("date_column", columns[0] if columns else None)
            val_col = parameters.get("value_column", columns[1] if len(columns)>1 else None)
            df_ts = df.groupby(date_col)[val_col].sum().reset_index().sort_values(date_col)
            df_ts['growth_pct'] = df_ts[val_col].pct_change() * 100
            df_ts[date_col] = df_ts[date_col].astype(str)
            res = df_ts.fillna(0).tail(50).to_dict(orient="records")
            
        elif function_name == "volatility":
            date_col = parameters.get("date_column", columns[0] if columns else None)
            val_col = parameters.get("value_column", columns[1] if len(columns)>1 else None)
            df_ts = df.groupby(date_col)[val_col].sum().reset_index().sort_values(date_col)
            pct_change = df_ts[val_col].pct_change().dropna()
            res = {
                "volatility_std": float(pct_change.std()),
                "volatility_annualized": float(pct_change.std() * np.sqrt(252)) # Rough financial approx
            }

        elif function_name == "forecasting": 
            # Fallback naive forecast or Prophet if available
            date_col = parameters.get("date_column", columns[0] if columns else None)
            val_col = parameters.get("value_column", columns[1] if len(columns)>1 else None)
            periods = parameters.get("periods", 30)
            
            try:
                from prophet import Prophet
                df_prophet = df[[date_col, val_col]].rename(columns={date_col: "ds", val_col: "y"}).dropna()
                df_prophet['ds'] = pd.to_datetime(df_prophet['ds'])
                m = Prophet()
                m.fit(df_prophet)
                future = m.make_future_dataframe(periods=periods)
                forecast = m.predict(future)
                res = forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].tail(periods).copy()
                res['ds'] = res['ds'].astype(str)
                res = res.to_dict(orient="records")
            except ImportError:
                # Naive Fallback
                df_ts = df[[date_col, val_col]].dropna().sort_values(date_col)
                last_val = df_ts[val_col].iloc[-1]
                last_date = pd.to_datetime(df_ts[date_col].iloc[-1])
                res = [{"date": str(last_date + pd.Timedelta(days=i)), "forecast": float(last_val)} for i in range(1, periods + 1)]

        elif function_name == "seasonality_detection":
            try:
                from statsmodels.tsa.seasonal import seasonal_decompose
                date_col = parameters.get("date_column", columns[0] if columns else None)
                val_col = parameters.get("value_column", columns[1] if len(columns)>1 else None)
                period = parameters.get("period", 12) # e.g., 12 for monthly data
                df_ts = df[[date_col, val_col]].dropna().sort_values(date_col).copy()
                df_ts.set_index(date_col, inplace=True)
                decomposition = seasonal_decompose(df_ts[val_col], period=period, extrapolate_trend='freq')
                
                # Extract the seasonal component
                seasonal = decomposition.seasonal
                res = {
                    "seasonal_amplitude_estimate": float(seasonal.max() - seasonal.min()),
                    "seasonal_values": seasonal.tail(period).to_dict()
                }
            except ImportError:
                 raise ImportError("statsmodels is required for seasonality_detection. Please install it.")

        # ---- PREDICTIVE / ML ----
        elif function_name == "clustering":
            try:
                from sklearn.cluster import KMeans
                n_clusters = parameters.get("n_clusters", 3)
                df_num = df[columns].select_dtypes(include='number').dropna() if columns else df.select_dtypes('number').dropna()
                kmeans = KMeans(n_clusters=n_clusters, random_state=42)
                df_num['cluster'] = kmeans.fit_predict(df_num)
                res = {
                    "cluster_centers": kmeans.cluster_centers_.tolist(),
                    "features_used": list(df_num.columns[:-1]),
                    "cluster_distribution": df_num['cluster'].value_counts().to_dict()
                }
            except ImportError:
                raise ImportError("scikit-learn is required for clustering. Please install it.")
        elif function_name == "linear_regression":
            try:
                from sklearn.linear_model import LinearRegression
                x_col = parameters.get("x_col", columns[0] if len(columns)>0 else None)
                y_col = parameters.get("y_col", columns[1] if len(columns)>1 else None)
                if not x_col or not y_col:
                    raise ValueError("linear_regression requires x_col and y_col")
                df_clean = df[[x_col, y_col]].dropna()
                X = df_clean[[x_col]].values
                y = df_clean[y_col].values
                model = LinearRegression().fit(X, y)
                res = {
                    "coefficient": float(model.coef_[0]),
                    "intercept": float(model.intercept_),
                    "r2_score": float(model.score(X, y)),
                    "equation": f"y = {model.coef_[0]:.4f}x + {model.intercept_:.4f}"
                }
            except ImportError:
                raise ImportError("scikit-learn is required for regression. Please install it.")
        elif function_name == "random_forest":
            try:
                from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
                from sklearn.model_selection import train_test_split
                target_col = parameters.get("target_col", columns[-1] if columns else None)
                feature_cols = parameters.get("feature_cols", [c for c in columns if c != target_col]) if columns else None
                if not target_col:
                    raise ValueError("random_forest requires a target_col")
                if not feature_cols:
                    feature_cols = [c for c in df.select_dtypes(include='number').columns if c != target_col]
                df_clean = df[feature_cols + [target_col]].dropna()
                X = df_clean[feature_cols].values
                y = df_clean[target_col].values
                is_classification = len(np.unique(y)) <= 20 or not np.issubdtype(df_clean[target_col].dtype, np.number)
                if is_classification:
                    y = pd.Categorical(y).codes
                    model = RandomForestClassifier(n_estimators=100, random_state=42, max_depth=10)
                else:
                    model = RandomForestRegressor(n_estimators=100, random_state=42, max_depth=10)
                X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
                model.fit(X_train, y_train)
                importance = dict(zip(feature_cols, [round(float(v), 4) for v in model.feature_importances_]))
                res = {
                    "model_type": "classification" if is_classification else "regression",
                    "train_score": round(float(model.score(X_train, y_train)), 4),
                    "test_score": round(float(model.score(X_test, y_test)), 4),
                    "feature_importance": importance,
                    "n_features": len(feature_cols),
                    "n_samples_train": len(X_train),
                    "n_samples_test": len(X_test)
                }
            except ImportError:
                raise ImportError("scikit-learn is required for random_forest.")
        elif function_name == "classification":
            try:
                from sklearn.linear_model import LogisticRegression
                from sklearn.model_selection import train_test_split
                from sklearn.preprocessing import LabelEncoder
                target_col = parameters.get("target_col", columns[-1] if columns else None)
                feature_cols = parameters.get("feature_cols", [c for c in columns if c != target_col]) if columns else None
                if not target_col:
                    raise ValueError("classification requires a target_col")
                if not feature_cols:
                    feature_cols = [c for c in df.select_dtypes(include='number').columns if c != target_col]
                df_clean = df[feature_cols + [target_col]].dropna()
                X = df_clean[feature_cols].values
                le = LabelEncoder()
                y = le.fit_transform(df_clean[target_col])
                X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
                model = LogisticRegression(max_iter=1000, random_state=42)
                model.fit(X_train, y_train)
                res = {
                    "accuracy_train": round(float(model.score(X_train, y_train)), 4),
                    "accuracy_test": round(float(model.score(X_test, y_test)), 4),
                    "classes": le.classes_.tolist(),
                    "n_classes": len(le.classes_),
                    "n_features": len(feature_cols)
                }
            except ImportError:
                raise ImportError("scikit-learn is required for classification.")
                
        # ---- DIAGNOSTIC ----
        elif function_name == "segmentation":
            col = columns[0]
            bins = parameters.get("bins", 4)
            df['segment'] = pd.qcut(df[col], q=bins, duplicates='drop').astype(str)
            res = df.groupby('segment').size().to_dict()
        elif function_name == "contribution_analysis":
            # Shows what percentage each category contributes to a total value
            cat_col = parameters.get("category_column", columns[0])
            val_col = parameters.get("value_column", columns[1] if len(columns)>1 else None)
            if not val_col: raise ValueError("contribution_analysis requires a value_column")
            totals = df.groupby(cat_col)[val_col].sum()
            contrib = (totals / totals.sum() * 100).round(2)
            res = contrib.reset_index().to_dict(orient="records")
        elif function_name == "drill_down":
            # Hierarchical breakdown: group by first column, then sub-group by second
            primary = columns[0] if columns else list(df.select_dtypes(exclude='number').columns)[0]
            secondary = columns[1] if len(columns) > 1 else None
            val_col = parameters.get("value_column", columns[2] if len(columns) > 2 else None)
            if secondary and val_col:
                res = df.groupby([primary, secondary])[val_col].agg(['sum', 'mean', 'count']).reset_index().to_dict(orient="records")
            elif secondary:
                res = df.groupby([primary, secondary]).size().reset_index(name='count').to_dict(orient="records")
            else:
                res = df.groupby(primary).agg(['sum', 'mean', 'count']).reset_index().head(20).to_dict(orient="records")
        elif function_name == "cohort_analysis":
            date_col = parameters.get("date_column", columns[0] if columns else None)
            group_col = parameters.get("group_column", columns[1] if len(columns) > 1 else None)
            val_col = parameters.get("value_column", columns[2] if len(columns) > 2 else None)
            if not date_col:
                raise ValueError("cohort_analysis requires a date_column")
            df_temp = df.copy()
            df_temp[date_col] = pd.to_datetime(df_temp[date_col], errors='coerce')
            df_temp = df_temp.dropna(subset=[date_col])
            df_temp['cohort'] = df_temp[date_col].dt.to_period('M').astype(str)
            if group_col and val_col:
                res = df_temp.groupby(['cohort', group_col])[val_col].agg(['sum', 'mean', 'count']).reset_index().to_dict(orient="records")
            elif val_col:
                res = df_temp.groupby('cohort')[val_col].agg(['sum', 'mean', 'count']).reset_index().to_dict(orient="records")
            else:
                res = df_temp.groupby('cohort').size().reset_index(name='count').to_dict(orient="records")

        # ---- PRESCRIPTIVE ----
        elif function_name == "scenario_analysis":
            # Simulate impact of changing a column value by a percentage
            col = columns[0] if columns else df.select_dtypes(include='number').columns[0]
            change_pct = parameters.get("change_pct", 10) / 100
            target_col = parameters.get("target_col", columns[1] if len(columns) > 1 else None)
            original_mean = float(df[col].mean())
            simulated = df.copy()
            simulated[col] = simulated[col] * (1 + change_pct)
            new_mean = float(simulated[col].mean())
            res = {
                "column": col,
                "change_applied": f"{change_pct*100:.1f}%",
                "original_mean": round(original_mean, 4),
                "simulated_mean": round(new_mean, 4),
                "absolute_change": round(new_mean - original_mean, 4),
            }
            if target_col:
                corr = float(df[col].corr(df[target_col]))
                estimated_impact = round(corr * (new_mean - original_mean), 4)
                res["target_column"] = target_col
                res["correlation_with_target"] = round(corr, 4)
                res["estimated_target_impact"] = estimated_impact

        elif function_name == "what_if_analysis":
            # Filter based on a condition and compare metrics before/after
            filter_col = parameters.get("filter_column", columns[0] if columns else None)
            filter_val = parameters.get("filter_value")
            metric_col = parameters.get("metric_column", columns[1] if len(columns) > 1 else None)
            if not filter_col or filter_val is None:
                raise ValueError("what_if_analysis requires filter_column and filter_value")
            if not metric_col:
                metric_col = df.select_dtypes(include='number').columns[0]
            baseline = df[metric_col].describe().to_dict()
            filtered = df[df[filter_col] == filter_val]
            scenario = filtered[metric_col].describe().to_dict() if len(filtered) > 0 else {}
            res = {
                "filter": f"{filter_col} == {filter_val}",
                "baseline_records": len(df),
                "filtered_records": len(filtered),
                "baseline_stats": baseline,
                "scenario_stats": scenario
            }

        # ---- DATA CLEANING / MUTATIONS ----
        elif function_name == "drop_nulls":
            df_out = df.dropna(subset=columns if columns else None)
            res = {"dropped_rows": len(df) - len(df_out), "remaining_rows": len(df_out)}
        elif function_name == "fill_missing":
            val = parameters.get("fill_value", 0)
            df_out = df.copy()
            if columns:
                df_out[columns] = df_out[columns].fillna(val)
            else:
                df_out = df_out.fillna(val)
            res = {"filled_value": val}
        elif function_name == "remove_duplicates":
            original_len = len(df)
            df_out = df.drop_duplicates(subset=columns if columns else None)
            res = {"removed_duplicates": original_len - len(df_out), "remaining_rows": len(df_out)}
        elif function_name == "normalize":
            df_out = df.copy()
            target_cols = columns if columns else df.select_dtypes(include='number').columns.tolist()
            method = parameters.get("method", "min_max")
            for col in target_cols:
                if method == "z_score":
                    df_out[col] = (df_out[col] - df_out[col].mean()) / df_out[col].std()
                else:  # min_max
                    min_val, max_val = df_out[col].min(), df_out[col].max()
                    if max_val != min_val:
                        df_out[col] = (df_out[col] - min_val) / (max_val - min_val)
            res = {"normalized_columns": target_cols, "method": method}
        elif function_name == "type_cast":
            df_out = df.copy()
            cast_to = parameters.get("cast_to", "numeric")
            for col in columns:
                if cast_to == "numeric":
                    df_out[col] = pd.to_numeric(df_out[col], errors='coerce')
                elif cast_to == "datetime":
                    df_out[col] = pd.to_datetime(df_out[col], errors='coerce')
                elif cast_to == "string":
                    df_out[col] = df_out[col].astype(str)
            res = {"cast_columns": columns, "cast_to": cast_to}

        else:
            raise NotImplementedError(f"Function {function_name} is not implemented yet in the Function Executor.")
            
        return {
            "result": _sanitize_for_json(res),
            "metadata": {
                "function": function_name,
                "columns_used": columns,
                "confidence": 0.95
            }
        }, df_out
    except Exception as e:
        raise RuntimeError(f"Execution failed for {function_name}: {str(e)}")
