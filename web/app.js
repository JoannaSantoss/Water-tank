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

let lastDistance = null;
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
        if (modeMatch) pumpMode.textContent = modeMatch[1].toUpperCase() === "AUTO" ? "Modo automático" : "Modo manual";

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
}

function updateDashboard(distance) {
  const tankHeight = Number.parseFloat(tankHeightInput.value);
  if (!Number.isFinite(distance) || distance < 0 || !Number.isFinite(tankHeight) || tankHeight <= 0) {
    levelStatus.textContent = "Leitura inválida";
    levelBadge.className = "level-badge high";
    waterFill.style.height = "0%";
    lastUpdate.textContent = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    return;
  }

  lastDistance = distance;
  const level = Math.min(tankHeight, Math.max(0, tankHeight - distance));
  const percentage = Math.round((level / tankHeight) * 100);

  levelValue.textContent = level.toFixed(1);
  percentageValue.textContent = percentage;
  distanceValue.textContent = distance.toFixed(1);
  tankHeightValue.textContent = tankHeight.toFixed(0);
  waterFill.style.height = `${percentage}%`;
  liveChip.classList.toggle("active", Boolean(activePort));

  if (percentage >= 85) {
    levelStatus.textContent = "Nível alto";
    levelBadge.className = "level-badge high";
  } else if (percentage < 30) {
    levelStatus.textContent = "Nível baixo";
    levelBadge.className = "level-badge low";
  } else {
    levelStatus.textContent = "Nível normal";
    levelBadge.className = "level-badge normal";
  }

  lastUpdate.textContent = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function setConnectionState(message, connected, error = false) {
  connectionStatus.textContent = message;
  connectionStatus.title = "";
  connectionIndicator.className = "status-dot";
  if (connected) connectionIndicator.classList.add("connected");
  else if (error) connectionIndicator.classList.add("error");
  liveChip.classList.toggle("active", connected);
}
