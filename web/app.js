const connectButton = document.querySelector("#connectButton");
const connectionStatus = document.querySelector("#connectionStatus");
const connectionIndicator = document.querySelector("#connectionIndicator");
const tankHeightInput = document.querySelector("#tankHeight");
const levelValue = document.querySelector("#levelValue");
const percentageValue = document.querySelector("#percentageValue");
const distanceValue = document.querySelector("#distanceValue");
const levelStatus = document.querySelector("#levelStatus");
const lastUpdate = document.querySelector("#lastUpdate");

let lastDistance = null;

connectButton.addEventListener("click", connectToArduino);
tankHeightInput.addEventListener("input", () => {
  if (lastDistance !== null) updateDashboard(lastDistance);
});

async function connectToArduino() {
  if (!("serial" in navigator)) {
    setConnectionState("Use Chrome ou Edge para acessar a porta serial.", false);
    return;
  }

  try {
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });
    setConnectionState("Arduino conectado", true);
    connectButton.textContent = "Conectado";

    const decoder = new TextDecoderStream();
    port.readable.pipeTo(decoder.writable);
    const reader = decoder.readable.getReader();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += value;
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        const match = line.match(/Distancia:\s*(-?\d+(?:\.\d+)?)\s*cm/i);
        if (match) updateDashboard(Number.parseFloat(match[1]));
      }
    }
  } catch (error) {
    if (error.name !== "NotFoundError") {
      setConnectionState(`Erro: ${error.message}`, false);
    }
  }
}

function updateDashboard(distance) {
  const tankHeight = Number.parseFloat(tankHeightInput.value);
  if (!Number.isFinite(distance) || distance < 0 || !Number.isFinite(tankHeight) || tankHeight <= 0) {
    levelStatus.textContent = "Leitura inválida";
    return;
  }

  lastDistance = distance;
  const level = Math.min(tankHeight, Math.max(0, tankHeight - distance));
  const percentage = (level / tankHeight) * 100;

  levelValue.textContent = level.toFixed(1);
  percentageValue.textContent = percentage.toFixed(0);
  distanceValue.textContent = distance.toFixed(1);
  levelStatus.textContent = percentage < 30 ? "Nível baixo" : "Leitura normal";
  lastUpdate.textContent = `Atualizado às ${new Date().toLocaleTimeString("pt-BR")}`;
}

function setConnectionState(message, connected) {
  connectionStatus.textContent = message;
  connectionIndicator.classList.toggle("indicator-on", connected);
}
