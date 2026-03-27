import { useState, useEffect, useRef } from 'react';
import { AlertCircle, Maximize2, ExternalLink, Loader2 } from 'lucide-react';
import { AnalysisAPI } from '../../services/api';
import { embedDashboard } from '@superset-ui/embedded-sdk';
import Plot from 'react-plotly.js';

interface DynamicChartProps {
  config: any; // Contains { embedded_id, internal_uuid, native_id } if superset, or { data, layout } if plotly
}

export default function DynamicChart({ config }: DynamicChartProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [supersetData, setSupersetData] = useState<{ token: string, url: string } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isPlotly = config?.data && config?.layout;
  const isSuperset = !isPlotly && (config?.embedded_id || config?.internal_uuid);

  useEffect(() => {
    if (isPlotly) {
      setLoading(false);
      return;
    }

    if (!isSuperset) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    const mountDashboard = async () => {
      try {
        const { guest_token, superset_url } = await AnalysisAPI.getSupersetToken(config.internal_uuid);
        if (!isMounted) return;
        setSupersetData({ token: guest_token, url: superset_url });
        
        if (containerRef.current) {
          containerRef.current.innerHTML = "";
          await embedDashboard({
            id: config.embedded_id,
            supersetDomain: superset_url,
            mountPoint: containerRef.current,
            fetchGuestToken: () => Promise.resolve(guest_token),
            dashboardUiConfig: { hideTitle: true, hideChartControls: false, hideTab: true }
          });
        }
        if (isMounted) setLoading(false);
      } catch (err) {
        console.error("[CHART] Superset embed error:", err);
        if (isMounted) {
          setError("Secured access to Superset failed.");
          setLoading(false);
        }
      }
    };

    mountDashboard();
    return () => { isMounted = false; };
  }, [config, isSuperset, isPlotly]);

  if (loading) {
    return (
      <div className="w-full h-[450px] flex flex-col items-center justify-center bg-slate-900/30 border border-slate-800/60 rounded-3xl backdrop-blur-sm">
        <Loader2 className="w-8 h-8 text-sky-500 animate-spin mb-4" />
        <p className="text-slate-400 text-sm font-medium animate-pulse">Mounting Analytics Dashboard...</p>
      </div>
    );
  }

  if (error || (!isSuperset && !isPlotly && (!config || Object.keys(config).length === 0))) {
    return (
      <div className="p-10 border border-slate-800/60 rounded-2xl bg-slate-900/30 text-center backdrop-blur-sm">
        <AlertCircle className="w-8 h-8 text-rose-500/50 mx-auto mb-3" />
        <p className="text-slate-400 text-sm font-medium">Visualization Port Offline</p>
        <p className="text-slate-500 text-xs mt-1 italic">{error || "The analytical engine generated results, but the visualization format was incompatible."}</p>
      </div>
    );
  }

  // ── Plotly Rendering ──────────────────────────────────────────────────────────
  if (isPlotly) {
    return (
      <div className="w-full h-[500px] my-8 rounded-3xl bg-[#0f172a] border border-slate-700/50 shadow-2xl relative overflow-hidden group p-4 flex flex-col items-center justify-center">
        <div className="absolute top-4 left-6 flex items-center gap-3 z-10 pointer-events-none">
           <div className="w-1.5 h-1.5 rounded-full bg-sky-500 shadow-[0_0_8px_#0ea5e9]" />
           <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold bg-slate-900/80 px-2 py-1 rounded backdrop-blur-md">Live Plotly Intelligence</span>
        </div>
        
        <div className="w-full h-full mt-6">
          <Plot
            data={config.data}
            layout={{
              ...config.layout,
              autosize: true,
              paper_bgcolor: 'transparent',
              plot_bgcolor: 'transparent',
              font: { color: '#94a3b8', size: 12 },
              title: config.layout?.title ? {
                text: config.layout.title?.text || config.layout.title,
                font: { color: '#e2e8f0', size: 15 },
                x: 0.5,
                xanchor: 'center'
              } : undefined,
              xaxis: {
                ...config.layout?.xaxis,
                color: '#64748b',
                gridcolor: 'rgba(30, 41, 59, 0.5)',
                title: config.layout?.xaxis?.title ? {
                  text: config.layout.xaxis.title?.text || config.layout.xaxis.title,
                  font: { color: '#94a3b8', size: 13 }
                } : undefined
              },
              yaxis: {
                ...config.layout?.yaxis,
                color: '#64748b',
                gridcolor: 'rgba(30, 41, 59, 0.5)',
                title: config.layout?.yaxis?.title ? {
                  text: config.layout.yaxis.title?.text || config.layout.yaxis.title,
                  font: { color: '#94a3b8', size: 13 }
                } : undefined
              },
              margin: { t: 45, r: 20, l: 60, b: 55 }
            }}
            useResizeHandler={true}
            style={{ width: '100%', height: '100%' }}
            config={{ responsive: true, displayModeBar: false }}
          />
        </div>
      </div>
    );
  }

  // ── Superset Rendering ────────────────────────────────────────────────────────
  if (isSuperset && supersetData) {
    return (
      <div className="w-full h-[500px] my-8 rounded-3xl bg-[#0f172a] border border-slate-700/50 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-4 left-6 flex items-center gap-3 z-10 pointer-events-none">
           <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
           <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold bg-slate-900/80 px-2 py-1 rounded backdrop-blur-md">Live Superset Intelligence</span>
        </div>

        <div className="absolute top-4 right-6 flex items-center gap-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          <a 
            href={`${supersetData.url}/superset/dashboard/${config.native_id}/`} 
            target="_blank" 
            rel="noreferrer"
            className="p-1.5 bg-slate-800/80 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-all backdrop-blur-md border border-slate-700/50"
            title="Open in Superset"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button className="p-1.5 bg-slate-800/80 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-all backdrop-blur-md border border-slate-700/50">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Embedded SDK mounts here */}
        <div 
          ref={containerRef} 
          className="w-full h-full [&_iframe]:w-full [&_iframe]:h-full [&_iframe]:border-none [&_iframe]:rounded-2xl" 
        />
      </div>
    );
  }

  // ── Fallback/Legacy ECharts Rendering (for old messages) ──────────────────────
  return (
    <div className="w-full h-[450px] my-4 p-4 rounded-xl bg-slate-900/30 text-center flex flex-col items-center justify-center">
      <AlertCircle className="w-6 h-6 text-slate-600 mb-2" />
      <p className="text-slate-500 text-xs italic">Legacy chart format detected. Please rerun the analysis to use Plotly/Superset.</p>
    </div>
  );
}
