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

let lastDistance = null;
let activePort = null;
let activeReader = null;

connectButton.addEventListener("click", () => {
  if (activePort) disconnectArduino();
  else connectToArduino();
});

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
        const match = line.match(/Distancia:\s*(-?\d+(?:\.\d+)?)\s*cm/i);
        if (match) updateDashboard(Number.parseFloat(match[1]));
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
    if (!activePort) {
      setConnectionState("Desconectado", false);
    }
  }
}

async function disconnectArduino() {
  try {
    if (activeReader) {
      await activeReader.cancel();
      activeReader.releaseLock();
      activeReader = null;
    }
    if (activePort) {
      await activePort.close();
      activePort = null;
    }
  } catch (error) {
    activeReader = null;
    activePort = null;
  }
  setConnectionState("Conectar dispositivo", false);
  liveChip.classList.remove("active");
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
  if (connected) {
    connectionIndicator.classList.add("connected");
  } else if (error) {
    connectionIndicator.classList.add("error");
  }
  liveChip.classList.toggle("active", connected);
}
