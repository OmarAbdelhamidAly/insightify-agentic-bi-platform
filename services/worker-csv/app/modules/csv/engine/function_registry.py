"""Analytical Function Registry.

A structured definition of all available analytical tools/functions in the system.
This registry is injected into the PlannerAgent's prompt to enable intelligent,
function-driven analysis rather than raw ad-hoc pandas codes.

Every function listed here has a matching implementation in function_executor.py.
"""

FUNCTION_REGISTRY = {
    "eda": {
        "description": "Exploratory data analysis",
        "functions": [
            "summary_stats",
            "distribution_analysis",
            "correlation_matrix",
            "missing_values",
            "outlier_detection"
        ]
    },
    "aggregation": {
        "description": "Basic aggregations",
        "functions": [
            "sum",
            "avg",
            "count",
            "min",
            "max",
            "groupby"
        ]
    },
    "statistical": {
        "description": "Statistical analysis",
        "functions": [
            "variance",
            "std_dev",
            "correlation",
            "covariance",
            "t_test",
            "chi_square_test",
            "anova"
        ]
    },
    "time_series": {
        "description": "Time-based analysis",
        "functions": [
            "trend_analysis",
            "moving_average",
            "seasonality_detection",
            "forecasting",
            "growth_rate",
            "volatility"
        ]
    },
    "diagnostic": {
        "description": "Root cause analysis",
        "functions": [
            "segmentation",
            "drill_down",
            "cohort_analysis",
            "contribution_analysis"
        ]
    },
    "predictive": {
        "description": "Predictive modeling",
        "functions": [
            "linear_regression",
            "random_forest",
            "classification",
            "clustering"
        ]
    },
    "prescriptive": {
        "description": "Decision support",
        "functions": [
            "scenario_analysis",
            "what_if_analysis"
        ]
    },
    "data_cleaning": {
        "description": "Data preprocessing",
        "functions": [
            "fill_missing",
            "drop_nulls",
            "type_cast",
            "remove_duplicates",
            "normalize"
        ]
    }
}
