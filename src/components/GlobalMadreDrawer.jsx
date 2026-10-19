import React, { useState, useEffect, useRef } from "react";

export const MADRE_API_ENDPOINT = "https://neon-seachartercorepro-4ce09d.netlify.app/.netlify/functions/madre-chat";

export function MadrePanel({
  referenciaMadre,
  origen = "Core PRO",
  initialOpen = false,
  showTrigger = true,
  COMANDOS_RAPIDOS = [
    { id: "escenarios", texto: "Genera los 3 escenarios", icono: "📊" },
    { id: "escudo", texto: "Redacta el escudo preventivo", icono: "🛡️" },
    { id: "oferta_50", texto: "El cliente dice que tiene una oferta 50% más barata", icono: "⚔️" },
  ],
}) {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [inputTexto, setInputTexto] = useState("");
  const [mensajes, setMensajes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Escape key listener to close drawer (Blueprint 4.1)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Focus input automatically upon opening (Blueprint 4.1)
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Auto-scroll whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  // Window API and custom events synchronization
  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    const handleClose = () => setIsOpen(false);
    const handleToggle = () => setIsOpen((prev) => !prev);

    window.addEventListener("madre:open", handleOpen);
    window.addEventListener("madre:close", handleClose);
    window.addEventListener("madre:toggle", handleToggle);

    if (typeof window !== "undefined") {
      window.MadrePanelUI = {
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
        toggle: () => setIsOpen((prev) => !prev),
        isOpen: () => isOpen,
      };

      // Synchronize topbar buttons in the DOM if present
      const topbarGlowElements = document.querySelectorAll(".madre-topbar-glow, #madre-topbar-glow");
      const topbarBtnElements = document.querySelectorAll(".madre-topbar-btn, #madre-topbar-button");
      const topbarImgElements = document.querySelectorAll(".madre-topbar-img, #madre-topbar-img");

      topbarBtnElements.forEach((btn) => {
        btn.setAttribute("aria-expanded", String(isOpen));
      });
      topbarGlowElements.forEach((glow) => {
        glow.style.display = (isOpen || isListening) ? "block" : "none";
      });
      topbarImgElements.forEach((img) => {
        if (isOpen || isListening) {
          img.classList.add("grayscale-0", "opacity-100", "scale-110");
          img.classList.remove("grayscale", "opacity-70", "scale-100");
        } else {
          img.classList.remove("grayscale-0", "opacity-100", "scale-110");
          img.classList.add("grayscale", "opacity-70", "scale-100");
        }
      });
    }

    return () => {
      window.removeEventListener("madre:open", handleOpen);
      window.removeEventListener("madre:close", handleClose);
      window.removeEventListener("madre:toggle", handleToggle);
    };
  }, [isOpen, isListening]);

  const handleSubmit = async (e, quickCommandText = null) => {
    if (e?.preventDefault) {
      e.preventDefault();
    }
    const texto = (typeof quickCommandText === "string" ? quickCommandText : inputTexto).trim();
    if (!texto) return;

    const userMsg = {
      id: Date.now(),
      rol: "user",
      autor: "Operador",
      texto,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMensajes((prev) => [...prev, userMsg]);
    setInputTexto("");
    setLoading(true);

    try {
      const response = await fetch(MADRE_API_ENDPOINT, {
        method: "POST",
        mode: "cors",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          mensajeUsuario: texto,
          context: {
            origin: "Reefer Charter Core PRO",
            projectRef: referenciaMadre || "RDM/2026-TBN",
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const replyText =
        data?.reply || data?.response || data?.message || "Directiva procesada.";

      const assistantMsg = {
        id: Date.now() + 1,
        rol: "assistant",
        autor: "MADRE Core",
        texto: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMensajes((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error("MADRE Connection Error:", err);
      const errorMsg = {
        id: Date.now() + 1,
        rol: "assistant",
        autor: "MADRE Core",
        texto: "Error de conexión con el Cerebro Central en Data Bridge. Verifica los permisos CORS o reintenta.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMensajes((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = handleSubmit;

  const handleQuickCommandClick = (cmd) => {
    const cmdText = cmd?.texto || cmd;
    handleSubmit(null, cmdText);
  };

  return (
    <>
      {/* 1. Botón Isotipo MADRE en TopBar */}
      {showTrigger && (
        <button
          id="madre-topbar-button"
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Abrir panel MADRE"
          title={isOpen || isListening ? "MADRE activa" : "MADRE"}
          className="madre-topbar-btn relative flex items-center justify-center w-10 h-10 rounded-full p-0 bg-transparent border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-slate-900 group"
        >
          {(isOpen || isListening) && (
            <div
              id="madre-topbar-glow"
              className="madre-topbar-glow absolute inset-0 rounded-full animate-pulse bg-cyan-500 blur-md pointer-events-none opacity-80"
              aria-hidden="true"
            />
          )}
          <img
            id="madre-topbar-img"
            src="/MADRE.png"
            alt="MADRE"
            className={`madre-topbar-img w-10 h-10 rounded-full relative z-10 object-contain transition-all duration-300 ${
              isOpen || isListening
                ? "grayscale-0 opacity-100 scale-110 drop-shadow-[0_0_12px_rgba(34,211,238,0.8)]"
                : "grayscale opacity-70 scale-100 hover:opacity-90"
            }`}
          />
        </button>
      )}

      {/* 2. Drawer Lateral y Backdrop */}
      {isOpen && (
        <>
          <div
            id="madre-backdrop"
            className="madre-backdrop fixed inset-0 bg-black/60 backdrop-blur-sm z-[2147483646] transition-opacity"
            style={{ zIndex: 2147483646 }}
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          <aside
            id="madre-drawer-panel"
            className="madre-drawer fixed top-0 left-0 bottom-0 w-full max-w-lg bg-slate-900 text-slate-100 shadow-2xl z-[2147483647] flex flex-col border-r border-slate-800 animate-in slide-in-from-left duration-300"
            style={{ backgroundColor: '#0f172a', color: '#f1f5f9', zIndex: 2147483647 }}
            role="dialog"
            aria-modal="true"
            aria-label="Panel Inteligente MADRE"
          >
            {/* Header */}
            <header
              className="madre-drawer-header flex items-center justify-between p-4 bg-slate-950 border-b border-slate-800"
              style={{ backgroundColor: '#020617', color: '#f8fafc' }}
            >
              <div className="madre-drawer-title-wrap flex items-center gap-3">
                <div className="madre-avatar-icon flex items-center justify-center w-8 h-8 rounded-full overflow-hidden bg-cyan-950/60 border border-cyan-500/40 shrink-0 flex-shrink-0">
                  <img
                    src="/MADRE.png"
                    alt="MADRE"
                    className="w-8 h-8 rounded-full object-contain grayscale-0 opacity-100"
                  />
                </div>
                <div>
                  <h2 className="madre-title-text text-sm font-bold text-white flex items-center gap-2">
                    <span className="text-white font-bold tracking-tight">MADRE</span>
                    <span className="madre-badge-ref text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      Cerebro Central
                    </span>
                  </h2>
                  <p className="madre-subtitle-text text-[11px] text-slate-400">
                    Cerebro Operacional Marítimo & Multimodal
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 ml-auto text-white shrink-0 flex-shrink-0">
                <button
                  id="madre-mute-button"
                  type="button"
                  className={`madre-mute-btn shrink-0 flex-shrink-0 text-white flex items-center justify-center w-8 h-8 rounded-md transition ${
                    isMuted
                      ? "text-rose-400 hover:text-rose-300 hover:bg-slate-800"
                      : "text-white hover:text-cyan-300 hover:bg-slate-800"
                  }`}
                  onClick={() => setIsMuted(!isMuted)}
                  title={isMuted ? "Activar voz de MADRE" : "Silenciar voz de MADRE"}
                  aria-label={isMuted ? "Activar voz de MADRE" : "Silenciar voz de MADRE"}
                >
                  {isMuted ? "🔇" : "🔊"}
                </button>
                <button
                  id="madre-reset-button"
                  type="button"
                  className="madre-reset-btn shrink-0 flex-shrink-0 text-white flex items-center justify-center w-8 h-8 p-1.5 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition text-xs"
                  onClick={() => setMensajes([])}
                  title="Reiniciar conversación"
                  aria-label="Reiniciar conversación"
                >
                  🔄
                </button>
                <button
                  id="madre-close-button"
                  type="button"
                  className="madre-close-btn shrink-0 flex-shrink-0 text-white flex items-center justify-center w-8 h-8 rounded-md hover:text-slate-200 hover:bg-slate-800 transition"
                  onClick={() => setIsOpen(false)}
                  aria-label="Cerrar panel MADRE"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </header>

            {/* Mensajes */}
            <div
              id="madre-messages-container"
              className="madre-drawer-body flex-1 overflow-y-auto p-4 space-y-3 bg-slate-900 text-slate-100"
              style={{ backgroundColor: '#0f172a', color: '#f1f5f9' }}
            >
              {mensajes.length === 0 ? (
                <div className="madre-empty-state text-center py-10 px-4 text-slate-400">
                  <div className="madre-empty-icon flex items-center justify-center mb-3">
                    <img src="/MADRE.png" alt="MADRE" className="w-12 h-12 rounded-full object-contain opacity-80" />
                  </div>
                  <h3 className="madre-empty-title text-sm font-bold text-slate-200 mb-1">
                    Cerebro Central Activo
                  </h3>
                  <p className="madre-empty-desc text-xs text-slate-400 max-w-xs mx-auto leading-relaxed mb-4">
                    Contexto sincronizado con el expediente. Puedes dictar órdenes, consultar
                    fletes, rastrear barcos por AIS o usar los comandos rápidos de abajo.
                  </p>
                </div>
              ) : (
                mensajes.map((msg) => (
                  <div
                    key={msg.id}
                    className={`madre-message flex flex-col ${
                      msg.rol === "user" ? "madre-message--user items-end" : "madre-message--assistant items-start"
                    }`}
                  >
                    <div
                      className={`madre-bubble p-3 text-xs leading-relaxed max-w-[95%] text-white rounded-2xl whitespace-pre-wrap ${
                        msg.rol === "user"
                          ? "bg-cyan-600 text-white rounded-br-sm shadow-md min-w-[150px] w-max max-w-[95%] text-left"
                          : "bg-slate-800 border border-slate-700 text-slate-100 rounded-bl-sm shadow-md"
                      }`}
                      style={msg.rol === "user" ? { minWidth: '150px', width: 'max-content', maxWidth: '95%', textAlign: 'left' } : {}}
                    >
                      <div className="madre-bubble-meta flex items-center justify-between text-[10px] opacity-70 mb-1">
                        <span className="font-semibold">{msg.autor}</span>
                        <span>{msg.timestamp}</span>
                      </div>
                      <div className="whitespace-pre-wrap break-words">{msg.texto}</div>
                    </div>
                  </div>
                ))
              )}
              {loading && (
                <div
                  id="madre-loading-indicator"
                  className="flex items-center gap-3 p-3 mx-4 mb-2 rounded-xl bg-slate-800/60 border border-dashed border-cyan-500/40 text-xs text-cyan-300"
                >
                  <div className="madre-radar-spinner w-4 h-4 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin"></div>
                  <span>MADRE está procesando directivas y telemetría...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Comandos Rápidos */}
            <div
              className="madre-quick-commands-bar p-3 bg-slate-950/90 border-t border-slate-800"
              style={{ backgroundColor: '#020617', color: '#f8fafc' }}
            >
              <span className="madre-quick-title text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                ⚡ Comandos Rápidos (1-Clic)
              </span>
              <div className="madre-quick-buttons-row flex flex-col gap-1.5">
                {COMANDOS_RAPIDOS.map((cmd) => (
                  <button
                    key={cmd.id}
                    type="button"
                    disabled={loading}
                    onClick={() => handleQuickCommandClick(cmd)}
                    className="madre-quick-btn flex items-center justify-between text-left px-3 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-xs transition hover:border-cyan-500/50 hover:text-cyan-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="flex items-center gap-2">
                      <span>{cmd.icono}</span>
                      <span className="font-medium">{cmd.texto}</span>
                    </span>
                    <span className="text-[10px] text-slate-400">↵</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Input y Footer */}
            <footer
              className="madre-drawer-footer relative p-3 bg-slate-950 border-t border-slate-800 flex-shrink-0"
              style={{ backgroundColor: '#020617', color: '#f8fafc' }}
            >
              {isListening && (
                <div
                  id="madre-voice-status"
                  className="madre-voice-status absolute bottom-full left-3 right-3 mb-2 px-2.5 py-1.5 rounded-md text-[11px] flex items-center justify-between border bg-slate-900/95 border-cyan-500/50 text-cyan-200 backdrop-blur-md shadow-lg z-20 pointer-events-auto"
                >
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                    <span id="madre-voice-status-text">🎙️ Escuchando Wake Word... (Escuchando...)</span>
                  </span>
                  <span id="madre-voice-transcript" className="italic truncate max-w-[180px] text-[10px] opacity-80"></span>
                </div>
              )}
              <form onSubmit={handleSubmit} className="madre-input-form flex items-center gap-2 w-full">
                <button
                  id="madre-mic-button"
                  type="button"
                  onClick={() => setIsListening(!isListening)}
                  className={`madre-mic-btn flex-shrink-0 shrink-0 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 transition flex items-center justify-center gap-1.5 ${isListening ? 'ring-2 ring-cyan-400 text-cyan-300' : ''}`}
                  title="Activar escucha de voz (Wake Word: 'Hola MADRE')"
                  aria-label="Activar escucha de voz"
                >
                  <span className="text-sm select-none">🎙️</span>
                </button>
                <input
                  ref={inputRef}
                  id="madre-chat-input"
                  type="text"
                  value={inputTexto}
                  onChange={(e) => setInputTexto(e.target.value)}
                  placeholder="Pregunta a MADRE o escribe un comando..."
                  className="madre-chat-input flex-1 min-w-0 px-3 py-2 text-xs bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                />
                <button
                  id="madre-send-button"
                  type="submit"
                  disabled={loading || !inputTexto.trim()}
                  className="madre-send-btn flex-shrink-0 shrink-0 px-4 py-2 text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed shadow"
                >
                  Enviar
                </button>
              </form>
            </footer>
          </aside>
        </>
      )}
    </>
  );
}

export const GlobalMadreDrawer = MadrePanel;
export default MadrePanel;
