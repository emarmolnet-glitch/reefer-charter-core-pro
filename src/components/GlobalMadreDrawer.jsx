import React, { useState, useEffect, useRef } from 'react';

export const MADRE_API_ENDPOINT = "https://calm-shortbread-55bcfc.netlify.app/.netlify/functions/madre-chat";

export function getCoreProUIContext() {
  const params = {};
  let vistaActivaActual = "Core PRO - Panel y Mapa Operativo";
  let referenciaActiva = null;

  if (typeof document !== 'undefined') {
    // 1. MGO y Portfolio (lo que ya tenías)
    const mgoEl = document.querySelector('[data-fuel="mgo"], #mgo-price, #bunker-mgo, .price-mgo, [data-metric="mgo"]');
    const portfolioEl = document.querySelector('#portfolio-count, [data-portfolio-count], #fleet-summary-count');

    if (mgoEl) {
      const val = parseFloat((mgoEl.value || mgoEl.textContent || "").replace(/[^0-9.]/g, ""));
      if (Number.isFinite(val) && val > 0) params.mgo_price = val;
    }
    if (portfolioEl) {
      const pVal = parseInt((portfolioEl.textContent || "").replace(/[^0-9]/g, ""), 10);
      if (Number.isFinite(pVal) && pVal > 0) params.totalPortfolio = pVal;
    }

    // --- NUEVO: 2. Rescatar la Referencia del Expediente (RDM/...) ---
    // Escaneamos la pantalla buscando el formato RDM/XXXX-XXXX
    const allTextEls = Array.from(document.querySelectorAll('span, div, p, h1, h2, h3, h4, h5, h6, input'));
    const refEl = allTextEls.find(el => {
      const text = el.value || el.textContent || "";
      return text.includes('RDM/');
    });
    if (refEl) {
      const match = (refEl.value || refEl.textContent).match(/RDM\/\d{4}-\d{4,}/);
      if (match) referenciaActiva = match[0];
    }

    // --- NUEVO: 3. Rescatar las PDA POL y PDA POD ---
    // Escaneamos los inputs de la calculadora buscando las PDA
    // (Asegúrate de que tus inputs en React tengan name="pda_pol" o id="pda_pol", etc.)
    const pdaPolInput = document.querySelector('input[name*="pda_pol"], input[name*="pdaPol"], [id*="pda-pol"], [id*="pdapol"]');
    const pdaPodInput = document.querySelector('input[name*="pda_pod"], input[name*="pdaPod"], [id*="pda-pod"], [id*="pdapod"]');

    if (pdaPolInput) {
      const valPol = parseFloat((pdaPolInput.value || "").replace(/[^0-9.]/g, ""));
      if (Number.isFinite(valPol)) params.pda_pol = valPol;
    }
    if (pdaPodInput) {
      const valPod = parseFloat((pdaPodInput.value || "").replace(/[^0-9.]/g, ""));
      if (Number.isFinite(valPod)) params.pda_pod = valPod;
    }

    // --- NUEVO: 4. Cambiar de vista dinámicamente ---
    // Si la pantalla tiene las PDA cargadas, le decimos a MADRE que estamos en la Calculadora
    if (params.pda_pol || params.pda_pod) {
      vistaActivaActual = "Core PRO - Calculadora de Bunkers y PDAs";
    }
  }

  // Se lo enviamos TODO a MADRE
  return {
    current_module: "core_pro",
    vista_activa: vistaActivaActual,
    referenciaMadre: referenciaActiva, // <- VITAL PARA QUE NO FALLE NEON
    parametros_activos: params         // <- AQUÍ VAN LOS GASTOS DE PUERTO
  };
}

if (typeof window !== 'undefined') {
  window.getReeferUIContext = getReeferUIContext;
}

export function GlobalMadreDrawer({
  isOpen = false,
  onClose,
  isMuted: controlledIsMuted,
  onMuteToggle,
  onReset,
}) {
  const [internalIsOpen, setInternalIsOpen] = useState(isOpen);
  const [internalIsMuted, setInternalIsMuted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'assistant',
      role: 'assistant',
      text: 'Auditoría Estratégica MADRE activa. Sistema listo para optimización y fixture recap.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    setInternalIsOpen(isOpen);
  }, [isOpen]);

  const isMuted = controlledIsMuted !== undefined ? controlledIsMuted : internalIsMuted;

  useEffect(() => {
    if (internalIsOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, internalIsOpen]);

  useEffect(() => {
    const handleToggle = () => setInternalIsOpen((prev) => !prev);
    const handleOpen = () => setInternalIsOpen(true);
    const handleCloseEvent = () => setInternalIsOpen(false);

    window.addEventListener('madre:toggle', handleToggle);
    window.addEventListener('madre:open', handleOpen);
    window.addEventListener('madre:close', handleCloseEvent);

    return () => {
      window.removeEventListener('madre:toggle', handleToggle);
      window.removeEventListener('madre:open', handleOpen);
      window.removeEventListener('madre:close', handleCloseEvent);
    };
  }, []);

  const speakText = (text) => {
    if (isMuted || typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const clean = text.replace(/[*#_`~[\]]/g, '').trim();
      const utterance = new SpeechSynthesisUtterance(clean);
      const isEnglish = document.documentElement.lang?.startsWith('en') || window.location.href.includes('lang=en');
      utterance.lang = isEnglish ? 'en-US' : 'es-ES';
      utterance.rate = 1.05;
      window.speechSynthesis.speak(utterance);
    } catch (_) {}
  };

  const handleMuteToggle = () => {
    const nextMuted = !isMuted;
    if (typeof onMuteToggle === 'function') {
      onMuteToggle(nextMuted);
    } else {
      setInternalIsMuted(nextMuted);
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  const handleReset = () => {
    if (typeof onReset === 'function') {
      onReset();
    }
    setMessages([
      {
        id: Date.now(),
        sender: 'assistant',
        role: 'assistant',
        text: 'Auditoría Estratégica MADRE reiniciada.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  const handleClose = () => {
    if (typeof onClose === 'function') {
      onClose();
    }
    setInternalIsOpen(false);
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  const handleMicClick = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('El reconocimiento de voz no está soportado en este navegador. Utiliza Google Chrome.');
      return;
    }
    const recognition = new SpeechRecognition();
    const isEnglish = document.documentElement.lang?.startsWith('en');
    recognition.lang = isEnglish ? 'en-US' : 'es-ES';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (err) => {
      console.error('Error de micrófono:', err);
      setIsListening(false);
    };
    recognition.onresult = (event) => {
      const speechText = event.results[0][0].transcript;
      setInputValue(speechText);
    };

    recognition.start();
  };
  const handleSubmit = async (e) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    const trimmed = inputValue.trim();
    if (!trimmed || isLoading) return;

    const userMessage = {
      id: Date.now(),
      sender: 'user',
      role: 'user',
      text: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const urlParams = new URLSearchParams(window.location.search);
      let activeRef = urlParams.get('ref');
      if (!activeRef && window.location.hash.includes('?')) {
        const hashQuery = window.location.hash.split('?')[1];
        activeRef = new URLSearchParams(hashQuery).get('ref');
      }
      const finalProjectRef = activeRef || "RDM/2026-TBN";

      const response = await fetch(MADRE_API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          mensajeUsuario: trimmed,
          message: trimmed,
          prompt: trimmed,
          contexto_ui: getReeferUIContext(),
          history: messages
            .filter((m) => m.text && !m.isError)
            .map((m) => ({
              role: m.role || (m.sender === 'user' ? 'user' : 'assistant'),
              content: m.text,
            }))
            .filter((msg, index, arr) => index > 0 || msg.role === 'user'),
          context: {
            origin: "Reefer Charter Core PRO",
            projectRef: finalProjectRef,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const replyText = data?.reply || data?.message || data?.text || data?.response || 'Auditoría MADRE procesada.';

      const assistantMessage = {
        id: Date.now() + 1,
        sender: 'assistant',
        role: 'assistant',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      speakText(replyText);
    } catch (err) {
      const fallbackText = 'Error de conexión con el Cerebro Central en Data Bridge.';
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'assistant',
          role: 'assistant',
          text: fallbackText,
          isError: true,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!internalIsOpen) return null;

  return (
    <aside
      id="global-madre-drawer"
      className="fixed top-0 left-0 bottom-0 z-[9999] w-full max-w-md bg-slate-900 text-slate-100 shadow-2xl border-r border-slate-800 flex flex-col font-sans"
      style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
    >
      <header className="flex items-center justify-between px-4 py-3 shrink-0 border-b border-slate-800" style={{ backgroundColor: '#0f172a', color: '#ffffff', borderBottom: '1px solid #1e293b' }}>
        <div className="flex items-center gap-2">
          <img src="/MADRE.png" alt="MADRE" className="w-5 h-5 rounded-full object-cover" />
          <span translate="no" className="notranslate font-bold text-base tracking-wide text-white" style={{ color: '#ffffff' }}>MADRE</span>
          <span className="text-[9px] font-mono bg-teal-500/20 text-teal-300 px-1.5 py-0.5 rounded border border-teal-500/30">Cerebro Central</span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <button type="button" id="btn-madre-mute" onClick={handleMuteToggle} className="text-xs px-2 py-1 rounded hover:bg-slate-800 text-white bg-transparent" style={{ color: '#ffffff', backgroundColor: 'transparent' }}>
            {isMuted ? '🔇' : '🔊'}
          </button>
          <button type="button" id="btn-madre-reset" onClick={handleReset} className="text-xs px-2 py-1 rounded hover:bg-slate-800 text-white bg-transparent" style={{ color: '#ffffff', backgroundColor: 'transparent' }}>
            🔄
          </button>
          <button type="button" id="btn-madre-close" onClick={handleClose} className="text-xs px-2 py-1 rounded hover:bg-slate-800 text-white bg-transparent" style={{ color: '#ffffff', backgroundColor: 'transparent' }}>
            ✕
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
        {messages.map((m) => {
          const isUser = m.sender === 'user';
          return (
            <div key={m.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
              <span translate="no" className="notranslate text-[10px] text-slate-400 mb-1 px-1">
                {isUser ? 'Operador' : 'MADRE Core'}
              </span>
              <div className={`p-3 rounded-xl text-xs max-w-[85%] leading-relaxed ${isUser ? 'bg-teal-600 text-white' : m.isError ? 'bg-red-950 text-red-200 border border-red-800' : 'bg-slate-800 text-slate-100 border border-slate-700'}`}>
                {m.text}
              </div>
            </div>
          );
        })}
        {isLoading && (
          <div className="text-xs text-teal-300 animate-pulse px-1">MADRE está procesando la solicitud...</div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 border-t border-slate-800 bg-slate-900 flex gap-2 items-center" style={{ backgroundColor: '#0f172a' }}>
        <button
          type="button"
          id="madre-mic-button"
          onClick={handleMicClick}
          className={`p-2 rounded-lg text-xs border ${isListening ? 'bg-red-600 border-red-500 animate-pulse text-white' : 'bg-slate-800 border-slate-700 text-teal-300 hover:bg-slate-700'}`}
          title="Hablar con MADRE"
        >
          🎙️
        </button>
        <form onSubmit={handleSubmit} className="flex gap-2 flex-1">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Pregunta a MADRE o escribe un comando..."
            className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-teal-400"
            style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
          />
          <button type="submit" className="px-3 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-bold" style={{ backgroundColor: '#0d9488', color: '#ffffff' }}>
            Enviar
          </button>
        </form>
      </div>
    </aside>
  );
}

export const MadrePanel = GlobalMadreDrawer;
export default GlobalMadreDrawer;
