# 🧠 RAG Master Plan: The 7-Pillar Strategy

This document serves as the technical blueprint for transforming the data analyst agent into a context-aware business brain.

---

## 1. 📖 The Company Dictionary (Metrics Definitions)
**Goal:** Align AI logic with specific business definitions (e.g., "Active User").

*   **Technical Approach:**
    *   Store metric names, descriptions, and formulas in a `BusinessMetric` table.
    *   During the **Intake Phase**, use the `MetricAgent` to search the dictionary for any entity mentioned in the user's question.
    *   Inject definitions directly into the [SQL](file:///C:/Users/Lenovo/Downloads/finalproject/app/modules/sql/tools/run_sql_query.py#18-26) or `CSV` analysts as "System Context".
*   **Data Flow:** `Question` → `Vector Search (Metrics)` → `Context Injection` → `Query Generation`.

## 2. 🗺️ Smart Schema Mapper (Data Dictionary)
**Goal:** Prevent hallucinations in complex databases with thousands of columns.

*   **Technical Approach:**
    *   Ingest the technical data dictionary (DDLS + comments) into Qdrant.
    *   Implement **Schema RAG**: Instead of sending the full schema, the agent retrieves only the top 10 most relevant tables based on the question.
    *   Use `sql_schema_discovery` tool results as the embedding source.
*   **Data Flow:** `Question` → `Schema RAG` → `Relevant Schema Only` → `SQL Generation`.

## 3. 🧠 Historical Insights Memory (Long-Term Memory)
**Goal:** Remember past findings and anomalies across sessions.

*   **Technical Approach:**
    *   Upon completing an analysis, embed the `exec_summary` and `insight_report`.
    *   Store in a tenant-isolated vector collection.
    *   Before starting a new job, retrieve the top 3 similar past results to provide "Trend Awareness".
*   **Data Flow:** `Job Done` → `Embed Result` → `Store in Qdrant`. `New Question` → `Retrieve Past Results`.

## 4. 📄 Hybrid Analysis (Structured + Unstructured)
**Goal:** Combine SQL/CSV data with qualitative PDF content.

*   **Technical Approach:**
    *   Introduce `DOCUMENT` as a new [DataSource](file:///C:/Users/Lenovo/Downloads/finalproject/app/models/data_source.py#16-57) type.
    *   Use a `HybridCoordinatorAgent` to split the query:
        1.  "Quant Agent" (SQL/CSV) gets the numbers.
        2.  "Qual Agent" (RAG) gets the context.
    *   The `OutputAssembler` merges both into one report.
*   **Data Flow:** `Question` → `Split (Quant/Qual)` → `Parallel Execution` → `Merged Report`.

## 5. 🛠️ Automated Data Cleaning Rules Base
**Goal:** Ensure data cleaning follows company-specific governance.

*   **Technical Approach:**
    *   Store cleaning policies (e.g., "Always convert dates to UTC") in a `SystemPolicy` table.
    *   The `data_cleaning_agent` retrieves these rules *before* writing the Pandas script.
*   **Data Flow:** `Profile Data` → `Retrieve Cleaning Rules` → `Generate Cleaning Code`.

## 6. 🏆 Competitive Intelligence Benchmarking
**Goal:** Compare internal performance against market research.

*   **Technical Approach:**
    *   Dedicated `MarketKnowledge` collection in Qdrant.
    *   Import industry whitepapers and competitor reports.
    *   The `BenchmarkingAgent` extracts industry averages and aligns them with SQL results.
*   **Data Flow:** `Internal Numbers` + `Market Retrieval` → `Comparison Chart`.

## 7. 🚨 Regulatory & Compliance Guardrails
**Goal:** Prevent sensitive data exposure (PII/GDPR).

*   **Technical Approach:**
    *   Maintain a vector base of compliance rules (e.g., "Never show SSN").
    *   A `GuardrailAgent` intercepts the [SQL](file:///C:/Users/Lenovo/Downloads/finalproject/app/modules/sql/tools/run_sql_query.py#18-26) or `Chart JSON`.
    *   If a violation is found, it automatically masks the data or blocks the response.
*   **Data Flow:** `Result Ready` → `Compliance Check` → `Masked/Approved Output`.
