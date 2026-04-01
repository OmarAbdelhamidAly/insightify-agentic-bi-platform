# 🧪 Insightify — Demo Test Questions

> Use this file as your reference during recording or testing sessions.
> Each question is crafted to stress-test a specific agent and produce a distinct visualization type.

---

## 🗄️ SQL — Chinook Database (`Chinook_Sqlite.sqlite`)

> Upload: `Chinook_Sqlite.sqlite`
> Worker: **SQL Worker** | LangGraph: 12 nodes

### Q1 — Line Chart (Time Series)
```
What is the total monthly revenue trend from 2009 to 2013, and which month of the year consistently generates the highest sales?
```
- **Expected Chart:** 📈 Line Chart
- **Why it's hard:** Requires extracting month + year from `InvoiceDate`, aggregating `Total` across multiple years, and detecting seasonal patterns.
- **Joins:** `Invoice` + `InvoiceLine`

---

### Q2 — Scatter / Bubble Chart (Correlation)
```
What is the relationship between the number of tracks in an album and the total revenue that album generated? Show the top 40 albums by revenue.
```
- **Expected Chart:** 🔵 Scatter / Bubble Chart
- **Why it's hard:** Requires correlating two independent numeric variables (track count vs revenue) across 4 joined tables.
- **Joins:** `Album` → `Track` → `InvoiceLine` → `Invoice`

---

### Q3 — Heatmap (Multi-dimensional Matrix)
```
Show the total revenue broken down by both customer country and music genre — which country-genre combinations are the highest revenue drivers?
```
- **Expected Chart:** 🟧 Heatmap
- **Why it's hard:** 5-table join producing a 2D matrix (country × genre), tested the agent's ability to reason about multi-dimensional aggregation.
- **Joins:** `Customer` → `Invoice` → `InvoiceLine` → `Track` → `Genre`

---

### Q4 — Stacked Bar Chart (Artist × Genre Revenue Breakdown)
```
For the top 10 artists by total revenue, break down their earnings by music genre. Which artist dominates which genre, and is there an artist who generates revenue across multiple genres?
```
- **Expected Chart:** 📊 Stacked Bar Chart
- **Why it's hard:** Requires a 5-table join to connect Artist → Album → Track → Genre → InvoiceLine, then pivot the result by genre per artist.
- **Joins:** `Artist` → `Album` → `Track` → `Genre` + `InvoiceLine`

---

### Q5 — Waterfall Chart (Year-over-Year Growth)
```
Show the year-over-year revenue change for Chinook from 2009 to 2013. Which year had the biggest growth and which had the biggest drop? Display it as incremental gains and losses.
```
- **Expected Chart:** 🏗️ Waterfall Chart
- **Why it's hard:** Requires LAG() window function or self-join to compute delta between years, then format as +/- increments for waterfall visualization.
- **Joins:** `Invoice` (self-aggregation with year-over-year comparison)

---

### Q6 — Radar / Spider Chart (Artist Multi-Metric Comparison)
```
Compare the top 5 artists across 4 dimensions: total albums, total tracks, total revenue generated, and number of playlists they appear in. Show this as a radar/spider chart.
```
- **Expected Chart:** 🕸️ Radar / Spider Chart
- **Why it's hard:** Requires 4 separate aggregations across 6 tables joined together (Artist, Album, Track, InvoiceLine, Invoice, PlaylistTrack), then normalized for radar display.
- **Joins:** `Artist` → `Album` → `Track` → `InvoiceLine` → `Invoice` + `PlaylistTrack`

---

### Q7 — Box Plot (Track Duration Distribution by Genre)
```
What is the distribution of track durations (in minutes) across all music genres? Which genre has the widest variation in track length, and which is the most consistent?
```
- **Expected Chart:** 📦 Box Plot (one box per genre)
- **Why it's hard:** Requires joining Track → Genre, converting `Milliseconds` to minutes, and computing quartiles Q1/Q2/Q3 + outliers per genre group.
- **Joins:** `Track` → `Genre`

---

### Q8 — Area Chart (Genre Revenue Share Over Time)
```
How has the revenue share of the top 5 music genres evolved from 2009 to 2013? Show cumulative stacked area to reveal which genres are growing and which are declining.
```
- **Expected Chart:** 📉 Stacked Area Chart
- **Why it's hard:** Requires 5-table join + time-series grouping by year + percentage normalization per year to produce stacked proportions.
- **Joins:** `Genre` → `Track` → `InvoiceLine` → `Invoice` (grouped by year)

---

### Q9 — Ranked Bar Chart (Employee Sales Performance)
```
Which support representative (employee) generated the most total revenue through their assigned customers? Rank all employees and show total revenue, number of customers managed, and average revenue per customer.
```
- **Expected Chart:** 📊 Horizontal Ranked Bar Chart with annotations
- **Why it's hard:** Requires linking Employee → Customer → Invoice → InvoiceLine through SupportRepId, then computing 3 derived metrics per employee.
- **Joins:** `Employee` → `Customer` → `Invoice` → `InvoiceLine`

---

### Q10 — Bubble Chart (3-Variable Artist Analysis)
```
For each artist, plot: X-axis = number of unique tracks, Y-axis = number of countries their music was purchased in, Bubble size = total revenue. Show top 30 artists. Which artist has the widest global reach vs highest revenue?
```
- **Expected Chart:** 🔵 Bubble Chart (3 variables)
- **Why it's hard:** Requires 6-table join to get per-artist: track count, distinct buyer countries, and total revenue — all in one query. Tests the agent's ability to handle multi-dimensional aggregation.
- **Joins:** `Artist` → `Album` → `Track` → `InvoiceLine` → `Invoice` → `Customer`

---

## 📊 CSV — Walmart Sales (`Walmart_Sales.csv`)

> Upload: `Walmart_Sales.csv`
> Columns: `Store`, `Date`, `Weekly_Sales`, `Holiday_Flag`, `Temperature`, `Fuel_Price`, `CPI`, `Unemployment`
> Worker: **CSV Worker** | LangGraph: 11 nodes (includes reflection loop)

### Q1 — Box Plot / Distribution (Statistical Analysis)
```
How does weekly sales performance differ between holiday weeks and non-holiday weeks across all stores? Show the distribution and statistical significance.
```
- **Expected Chart:** 📦 Box Plot or Violin Chart
- **Why it's hard:** Requires grouping by `Holiday_Flag`, computing distribution statistics (mean, median, std), and comparing two populations — tests the `reflection` and `insight` agents deeply.

---

### Q2 — Multi-Line / Dual Axis Chart (Correlation over Time)
```
Is there a correlation between fuel price increases and weekly sales drops? Show the trend of both variables over time for Store 1.
```
- **Expected Chart:** 📈 Dual-Axis Line Chart
- **Why it's hard:** Requires aligning two different-scale time series (`Fuel_Price` and `Weekly_Sales`) on a shared time axis and inferring a causal relationship — tests the `compute_forecast` and `visualization` agents.

---

### Q3 — Time Series Forecasting (Predictive Analysis)
```
Can you forecast the weekly sales for Store 1 for the next 12 weeks based on its historical data? Plot the historical trend and the future prediction.
```
- **Expected Chart:** 📉 Time Series + Forecast Line Chart
- **Why it's hard:** Requires converting the `Date` column to a datetime index, splitting historical data, predicting future values using a statistical model or rolling averages, and displaying the projected path smoothly alongside historical actuals.

---

## 🔷 JSON — Sales Data (`sales.json`)

> Upload: `sales.json`
> Structure: Array of objects with `region`, `product`, `sales`, `units`, `order_date`
> Worker: **JSON Worker** | LangGraph: 10 nodes

### Q1 — Bar / Grouped Chart (Comparative Analysis)
```
Which product generates the highest total revenue and which generates the most units sold? Are they the same product or different?
```
- **Expected Chart:** 📊 Grouped Bar Chart (revenue vs units side-by-side)
- **Why it's hard:** Requires two separate aggregations on the same data and a cross-comparison of rankings — tests the agent's ability to handle multi-metric analysis on JSON arrays.

---

### Q2 — Pie / Funnel Chart (Regional Breakdown)
```
What percentage of total sales revenue comes from each region (EU, US, MEA)? Which region has the highest revenue per unit sold?
```
- **Expected Chart:** 🥧 Pie Chart + calculated ratio metric
- **Why it's hard:** Requires computing both raw totals AND a derived metric (`sales / units` per region), then synthesizing a recommendation — tests `insight_agent` reasoning on nested JSON aggregations.

---

## 📄 PDF — Vision Transformer Paper (`vit2010.11929v2.pdf`)

> Upload: `vit2010.11929v2.pdf`
> Paper: **"An Image is Worth 16×16 Words: Transformers for Image Recognition at Scale"** (Dosovitskiy et al., 2020)
> Mode: **Deep Vision** (OpenRouter Gemini Vision) — ColPali multi-vector retrieval
> Worker: **PDF Worker** | Route: `deep_vision`

---

### Q1 — Architecture Understanding (Core Concept)
```
Explain the Vision Transformer (ViT) architecture. How does it convert an image into a sequence of patches, and what happens to each patch before it is fed into the Transformer encoder?
```
- **Why it's hard:** Requires the system to understand figure-based content (Figure 1 in the paper) and combine it with the text describing patch embeddings, linear projection, and the [CLS] token insertion.
- **What to show:** Visual grounding panel showing the architecture diagram page.

---

### Q2 — Table Extraction (Quantitative Comparison)
```
According to the results tables in the paper, how does ViT-H/14 compare to ViT-L/16 and BiT-L (ResNet152x4) on ImageNet Top-1 accuracy when pre-trained on JFT-300M? Which model achieves the best result?
```
- **Why it's hard:** Requires extracting numbers from a result table (Table 2), comparing three different model rows across columns — tests structured data extraction from a PDF table via vision.
- **What to show:** The page containing Table 2 in the visual grounding panel.

---

### Q3 — Conceptual Question (Transfer Learning)
```
The paper claims that ViT requires large-scale pre-training to outperform CNNs. At what dataset size does ViT begin to match or exceed ResNet performance, and why does the paper say ViT lacks some "inductive biases" that CNNs have?
```
- **Why it's hard:** Requires synthesizing two separate concepts from different sections (Section 3.2 and Section 4) — the dataset size threshold for ViT superiority and the discussion of inductive biases (translation equivariance, locality).

---

### Q4 — Figure Interpretation (Attention Maps)
```
What do the attention maps shown in the paper reveal about how ViT processes images? Does the model attend to semantically meaningful regions even in the lower layers?
```
- **Why it's hard:** Requires interpreting Figure 6 (attention maps visualization) which shows attention heads focusing on different semantic parts of an image — purely visual content that cannot be answered from text alone.
- **What to show:** The attention map visualization page in the grounding panel.

---

### Q5 — Model Variants Comparison
```
What are the three main ViT model configurations (ViT-Base, ViT-Large, ViT-Huge)? How do they differ in terms of number of layers, number of attention heads, hidden dimension size, and MLP size?
```
- **Why it's hard:** Requires finding and extracting Table 1 (Model Variants) and accurately reading all four numeric dimensions for each model variant — tests precise tabular extraction.
- **What to show:** The page with Table 1 in the visual grounding panel.

---

### Q6 — Hybrid Architecture
```
The paper describes a "hybrid" architecture that combines CNNs and Transformers. How does this hybrid model work, and how does it compare in performance to the pure ViT model on ImageNet when using the same amount of compute?
```
- **Why it's hard:** Requires locating the hybrid model description (Section 3.1) and connecting it to the performance comparison in Section 4 — tests cross-section reasoning across the document.

---

### Q7 — Positional Embeddings Analysis
```
What did the paper find when comparing different types of positional encodings — 1D learned, 2D-aware, and relative positional embeddings? Which approach performed best and what does Figure 10 show about how the model learned spatial structure?
```
- **Why it's hard:** Requires interpreting the ablation study in Appendix D.4 and visually reading Figure 10 which shows cosine similarity heatmaps of learned position embeddings — deep domain knowledge extraction from appendix tables and figures.

---

### Q8 — Training Data Scale vs. Performance
```
According to Figure 3 in the paper (Transfer to ImageNet), how does ViT-L/16 performance change as the pre-training dataset grows from ImageNet-1k to ImageNet-21k to JFT-300M? At which scale does it surpass the BiT-L baseline?
```
- **Why it's hard:** Requires reading a multi-line graph (Figure 3) and extracting scaling behavior — tests the vision model's ability to interpret a quantitative performance chart within an academic paper.

---

### Q9 — Self-Supervised Learning Mention
```
Does the paper mention any experiments with self-supervised pre-training for ViT? What method did they use and what accuracy did it achieve on ImageNet? How does it compare to supervised pre-training?
```
- **Why it's hard:** This information is in a brief, easy-to-miss paragraph in Section 4 — tests whether the retrieval system can locate a small but important piece of text about masked patch self-supervised learning.

---

### Q10 — Critical Analysis (Limitations)
```
What limitations does the paper acknowledge about ViT? What future work do the authors propose, and are there specific tasks or image sizes where ViT still struggles compared to CNNs?
```
- **Why it's hard:** Requires synthesizing the Conclusion section + Section 4 discussion points + understanding what is NOT shown in the paper — tests the model's ability to reason about what the authors admit is still unsolved.

---

## 📋 Quick Reference Cheat Sheet

| Source | Question # | Expected Output | Key Agent Tested |
|--------|-----------|-----------------|-----------------|
| SQL (Chinook) | Q1 | 📈 Line Chart | `analysis_generator` + time parsing |
| SQL (Chinook) | Q2 | 🔵 Scatter/Bubble | `verifier` + 4-join reasoning |
| SQL (Chinook) | Q3 | 🟧 Heatmap | `insight_agent` + 5-join matrix |
| SQL (Chinook) | Q4 | 📊 Stacked Bar | 5-join + pivot by genre |
| SQL (Chinook) | Q5 | 🏗️ Waterfall | YoY delta + window functions |
| SQL (Chinook) | Q6 | 🕸️ Radar Chart | 6-table join + normalization |
| SQL (Chinook) | Q7 | 📦 Box Plot | quartile computation per genre |
| SQL (Chinook) | Q8 | 📉 Stacked Area | 5-join + time + % share |
| SQL (Chinook) | Q9 | 📊 Ranked Bar | Employee → Customer → Revenue |
| SQL (Chinook) | Q10 | 🔵 Bubble Chart | 6-table + 3-variable analysis |
| CSV (Walmart) | Q1 | 📦 Box Plot | `reflection` loop + stats agent |
| CSV (Walmart) | Q2 | 📈 Dual-Axis Line | `compute_forecast` + correlation |
| CSV (Walmart) | Q3 | 📉 Forecast Chart | time-series prediction |
| JSON (Sales) | Q1 | 📊 Grouped Bar | multi-metric aggregation |
| JSON (Sales) | Q2 | 🥧 Pie + ratio | `insight_agent` derived metric |
| PDF (ViT Paper) | Q1 | 🖼️ Architecture diagram | ColPali + figure retrieval |
| PDF (ViT Paper) | Q2 | 📋 Table extraction | structured table reading |
| PDF (ViT Paper) | Q3 | 📝 Cross-section reasoning | multi-section synthesis |
| PDF (ViT Paper) | Q4 | 🖼️ Attention maps | visual figure interpretation |
| PDF (ViT Paper) | Q5 | 📋 Model variants table | Table 1 extraction |
| PDF (ViT Paper) | Q6 | 📝 Hybrid architecture | section cross-referencing |
| PDF (ViT Paper) | Q7 | 🖼️ Position embed heatmap | appendix + Figure 10 |
| PDF (ViT Paper) | Q8 | 📈 Scaling graph reading | Figure 3 interpretation |
| PDF (ViT Paper) | Q9 | 📝 Self-supervised section | precise text location |
| PDF (ViT Paper) | Q10 | 📝 Limitations synthesis | conclusion + discussion |

---

> [!TIP]
> Run each question **once before recording** to warm up the backend and verify the chart renders correctly.

> [!IMPORTANT]
> For all PDF questions — make sure `vit2010.11929v2.pdf` is **fully indexed** (100% progress) before asking. The deep_vision indexing processes all 22 pages via OpenRouter Vision.

> [!WARNING]
> SQL Q6 (Radar) and Q10 (Bubble) are the most computationally heavy — they require 6-table joins. Give the LangGraph extra time to animate. These are the **most impressive** questions for the demo.

> [!NOTE]
> For PDF Q4 and Q7 (attention maps, position embeddings) — the answer quality depends on the vision model correctly retrieving the **figure pages**. Check the Visual Grounding panel to confirm the right pages were retrieved.
