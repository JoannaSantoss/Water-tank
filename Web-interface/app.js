const connectButton = document.querySelector("#connectButton");
const connectionStatus = document.querySelector("#connectionStatus");
const connectionIndicator = document.querySelector("#connectionIndicator");
const tankHeightInput = document.querySelector("#tankHeight");
const tankHeightValue = document.querySelector("#tankHeightValue");
const levelValue = document.querySelector("#levelValue");
const percentageValue = document.querySelector("#percentageValue");
const distanceValue = document.querySelector("#distanceValue");
const levelStatus = document.querySelector("#levelStatus");
const levelBadge = document.querySelector("#levelBadge");
const lastUpdate = document.querySelector("#lastUpdate");
const waterFill = document.querySelector("#waterFill");
const liveChip = document.querySelector(".live-chip i");
const pumpMode = document.querySelector("#pumpMode");
const pumpStatus = document.querySelector("#pumpStatus");
const pumpStatusBadge = document.querySelector("#pumpStatusBadge");

// Recomendação da bomba
const pumpAdvice = document.querySelector("#pumpAdvice");
const adviceTag = document.querySelector("#adviceTag");
const adviceTitle = document.querySelector("#adviceTitle");
const adviceDetail = document.querySelector("#adviceDetail");
const pumpButtons = {
  auto: document.querySelector("#pumpAutoButton"),
  fill: document.querySelector("#pumpFillButton"),
  drain: document.querySelector("#pumpDrainButton"),
  stop: document.querySelector("#pumpStopButton")
};

// Limites de nível (em %) usados para recomendar a ação da bomba
const LOW_LEVEL = 30;   // abaixo disso: precisa puxar água
const HIGH_LEVEL = 75;  // acima disso: reservatório cheio (faixa normal: 30% a 75%)

let lastDistance = null;
let lastPercentage = null;
let isAutoMode = null;
let redLedOn = false; // LED vermelho do Arduino (alerta de transbordamento)
let activePort = null;
let activeReader = null;
let activeWriter = null;
let pumpFillActive = false;
let pumpDrainActive = false;

connectButton.addEventListener("click", () => {
  if (activePort) disconnectArduino();
  else connectToArduino();
});

for (const [selector, command] of [
  ["#pumpAutoButton", "AUTO"],
  ["#pumpFillButton", "ABASTECER 1"],
  ["#pumpDrainButton", "ESVAZIAR 1"],
  ["#pumpStopButton", "PARAR"]
]) {
  document.querySelector(selector).addEventListener("click", () => sendCommand(command));
}

tankHeightInput.addEventListener("input", () => {
  const height = Number.parseFloat(tankHeightInput.value);
  tankHeightValue.textContent = Number.isFinite(height) && height > 0 ? height.toFixed(0) : "--";
  if (lastDistance !== null) updateDashboard(lastDistance);
});

async function connectToArduino() {
  if (!("serial" in navigator)) {
    setConnectionState("Navegador incompatível", false, true);
    connectionStatus.title = "Use Chrome ou Edge para conectar ao Arduino";
    return;
  }

  try {
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });
    activePort = port;
    activeWriter = port.writable.getWriter();
    setConnectionState("Arduino conectado", true);

    const decoder = new TextDecoderStream();
    port.readable.pipeTo(decoder.writable);
    activeReader = decoder.readable.getReader();
    let buffer = "";

    while (true) {
      const { value, done } = await activeReader.read();
      if (done) break;

      buffer += value;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop();

      for (const line of lines) {
        const distanceMatch = line.match(/Distancia:\s*(-?\d+(?:\.\d+)?)\s*cm/i);
        if (distanceMatch) updateDashboard(Number.parseFloat(distanceMatch[1]));

        const modeMatch = line.match(/^Modo:(AUTO|MANUAL)/i);
        if (modeMatch) {
          isAutoMode = modeMatch[1].toUpperCase() === "AUTO";
          pumpMode.textContent = isAutoMode ? "Modo automático" : "Modo manual";
          updatePumpAdvice();
        }

        // LED vermelho (alerta de transbordamento). O Arduino deve enviar, por exemplo: LedVermelho:1 (aceso) / LedVermelho:0 (apagado)
        const ledMatch = line.match(/(?:led\s*vermelho|led\s*red|vermelho|transbord\w*|alerta)\s*[:=]\s*(1|0|on|off|true|false|ligad[oa]|desligad[oa]|acesa|aceso|apagad[oa])/i);
        if (ledMatch) {
          redLedOn = /^(1|on|true|ligad[oa]|acesa|aceso)$/i.test(ledMatch[1]);
          if (redLedOn) {
            levelStatus.textContent = "Transbordando";
            levelBadge.className = "level-badge high";
          } else if (lastDistance !== null) {
            updateDashboard(lastDistance);
          }
          updatePumpAdvice();
        }

        if (/^Abastecer:/i.test(line)) {
          pumpFillActive = /^Abastecer:1/i.test(line);
          updatePumpStatus(pumpFillActive, pumpDrainActive);
        }
        if (/^Esvaziar:/i.test(line)) {
          pumpDrainActive = /^Esvaziar:1/i.test(line);
          updatePumpStatus(pumpFillActive, pumpDrainActive);
        }
      }
    }
  } catch (error) {
    if (error.name === "NotFoundError") {
      setConnectionState("Nenhum dispositivo selecionado", false);
    } else {
      setConnectionState("Falha na conexão", false, true);
      connectionStatus.title = error.message;
    }
  } finally {
    if (!activePort) setConnectionState("Desconectado", false);
  }
}

async function disconnectArduino() {
  try {
    if (activeReader) {
      await activeReader.cancel();
      activeReader.releaseLock();
      activeReader = null;
    }
    if (activeWriter) {
      activeWriter.releaseLock();
      activeWriter = null;
    }
    if (activePort) {
      await activePort.close();
      activePort = null;
    }
  } catch (error) {
    activeReader = null;
    activeWriter = null;
    activePort = null;
  }
  setConnectionState("Conectar dispositivo", false);
  liveChip.classList.remove("active");
  lastPercentage = null;
  redLedOn = false;
  pumpFillActive = false;
  pumpDrainActive = false;
  updatePumpStatus(false, false);
}

async function sendCommand(command) {
  if (!activeWriter) {
    setConnectionState("Conecte o dispositivo", false, true);
    return;
  }
  await activeWriter.write(new TextEncoder().encode(`${command}\n`));
}

function updatePumpStatus(abastecer, esvaziar) {
  if (abastecer) {
    pumpStatus.textContent = "Puxando água";
  } else if (esvaziar) {
    pumpStatus.textContent = "Enviando água";
  } else {
    pumpStatus.textContent = "Parada";
  }
  pumpStatusBadge.className = abastecer || esvaziar ? "level-badge high" : "level-badge neutral";
  updatePumpAdvice();
}

/* Define o painel de recomendação.
   state: idle | ok | action-on | action-off
   highlight: chave do botão a destacar (fill, drain, stop, auto) ou null */
function setAdvice(state, tag, title, detail, highlight = null) {
  pumpAdvice.className = `pump-advice ${state}`;
  adviceTag.textContent = tag;
  adviceTitle.textContent = title;
  adviceDetail.textContent = detail;
  for (const [key, button] of Object.entries(pumpButtons)) {
    button.classList.toggle("recommended", key === highlight);
  }
}

function updatePumpAdvice() {
  // LED vermelho aceso = transbordando: prioridade máxima, é preciso parar a bomba
  if (redLedOn) {
    const detail = pumpFillActive
      ? "O LED vermelho do Arduino está aceso e a bomba continua puxando água. Pare a bomba imediatamente."
      : "O LED vermelho do Arduino está aceso (risco de transbordamento). Mantenha a bomba parada e não puxe água.";
    setAdvice("alert", "Transbordando", "PARE A BOMBA AGORA", detail, "stop");
    return;
  }

  if (lastPercentage === null) {
    setAdvice("idle", "Aguardando", "Aguardando leitura do sensor",
      "Conecte o dispositivo para receber recomendações da bomba.");
    return;
  }

  const pct = lastPercentage;
  const pumping = pumpFillActive || pumpDrainActive;
  const autoNote = isAutoMode ? " No modo automático o Arduino deve acionar sozinho; se não ocorrer, use o modo manual." : "";

  if (pct < LOW_LEVEL) {
    if (pumpDrainActive) {
      setAdvice("action-off", "Desativar bomba", "Desative o envio de água agora",
        `Nível em ${pct}% (abaixo de ${LOW_LEVEL}%). A bomba está enviando água para fora do reservatório.`, "stop");
    } else if (pumpFillActive) {
      setAdvice("ok", "Manter ligada", "Bomba puxando água: mantenha ligada",
        `Nível em ${pct}%. Aguarde o reservatório subir; desligue ao chegar perto de ${HIGH_LEVEL}%.`);
    } else {
      setAdvice("action-on", "Ativar bomba", "Ative a bomba para puxar água",
        `Nível baixo: ${pct}% (limite ${LOW_LEVEL}%).${autoNote}`, "fill");
    }
  } else if (pct > HIGH_LEVEL) {
    if (pumpFillActive) {
      setAdvice("action-off", "Desativar bomba", "Desative a bomba agora",
        `Nível alto: ${pct}% (limite ${HIGH_LEVEL}%). Continuar puxando água pode causar transbordamento.`, "stop");
    } else if (pumpDrainActive) {
      setAdvice("ok", "Manter ligada", "Bomba enviando água: pode manter",
        `Nível em ${pct}%. Desligue quando o nível ficar na faixa normal.`);
    } else {
      setAdvice("ok", "Bomba desligada", "Reservatório cheio: não puxe água",
        `Nível em ${pct}%. Se precisar baixar o nível, use "Enviar água".`);
    }
  } else if (pumping) {
    const acao = pumpFillActive ? "puxando" : "enviando";
    setAdvice("action-off", "Pode desativar", "Nível normal: a bomba pode ser desligada",
      `Nível em ${pct}% (faixa ${LOW_LEVEL}%–${HIGH_LEVEL}%). A bomba está ${acao} água.`, "stop");
  } else {
    setAdvice("ok", "Sem ação", "Nenhuma ação necessária",
      `Nível em ${pct}%, dentro da faixa normal (${LOW_LEVEL}%–${HIGH_LEVEL}%). Bomba desligada.`);
  }
}

function updateDashboard(distance) {
  const tankHeight = Number.parseFloat(tankHeightInput.value);
  if (!Number.isFinite(distance) || distance < 0 || !Number.isFinite(tankHeight) || tankHeight <= 0) {
    levelStatus.textContent = "Leitura inválida";
    levelBadge.className = "level-badge high";
    waterFill.style.height = "0%";
    lastUpdate.textContent = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    lastPercentage = null;
    updatePumpAdvice();
    return;
  }

  lastDistance = distance;
  const level = Math.min(tankHeight, Math.max(0, tankHeight - distance));
  const percentage = Math.round((level / tankHeight) * 100);
  lastPercentage = percentage;

  levelValue.textContent = level.toFixed(1);
  percentageValue.textContent = percentage;
  distanceValue.textContent = distance.toFixed(1);
  tankHeightValue.textContent = tankHeight.toFixed(0);
  waterFill.style.height = `${percentage}%`;
  liveChip.classList.toggle("active", Boolean(activePort));

  if (percentage > HIGH_LEVEL) {
    levelStatus.textContent = "Nível alto";
    levelBadge.className = "level-badge high";
  } else if (percentage < LOW_LEVEL) {
    levelStatus.textContent = "Nível baixo";
    levelBadge.className = "level-badge low";
  } else {
    levelStatus.textContent = "Nível normal";
    levelBadge.className = "level-badge normal";
  }

  if (redLedOn) {
    levelStatus.textContent = "Transbordando";
    levelBadge.className = "level-badge high";
  }

  lastUpdate.textContent = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  updatePumpAdvice();
}

function setConnectionState(message, connected, error = false) {
  connectionStatus.textContent = message;
  connectionStatus.title = "";
  connectionIndicator.className = "status-dot";
  if (connected) connectionIndicator.classList.add("connected");
  else if (error) connectionIndicator.classList.add("error");
  liveChip.classList.toggle("active", connected);
}
