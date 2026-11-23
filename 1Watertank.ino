// Monitor de nível do reservatório com controle de bombas por relés

const int TRIG = 9;
const int ECHO = 10;

const int LED_TRANSBORDA = 2;
const int LED_VERDE = 3;
const int LED_AMARELO = 4;
const int BUZZER = 6;

// Para uma bomba única bidirecional, use também válvulas externas.
// Neste projeto, são previstas duas saídas independentes:
// - Rele do abastecimento: liga a bomba para puxar água para o reservatório.
// - Rele da descarga: liga a bomba para enviar água para outro reservatório.
const int RELE_ABASTECER = 7;
const int RELE_ESVAZIAR = 8;

// Defina como false se o módulo de relé ligar na saída em LOW.
// A maioria dos módulos baratos usa RELAY_ACTIVE_LOW = true.
const bool RELAY_ACTIVE_LOW = true;

// Quanto menor a distância, mais cheio está o reservatório.
const float LIM_MUITO_CHEIO = 100.0;
const float LIM_NORMAL_CHEIO = 115.0; // Histerese para parar o esvaziamento
const float LIM_MUITO_VAZIO = 210.0;
const float LIM_NORMAL_VAZIO = 195.0; // Histerese para parar o abastecimento

float distancia = -1;
unsigned long ultimaLeitura = 0;
//Marca em ms a última inverão dos leds.
unsigned long ultimoPisca = 0;
//Estado do led, boleano. 
bool ledLigado = false;
bool modoAutomatico = true;
bool bombaAbastecer = false;
bool bombaEsvaziar = false;
String comandoSerial = "";

void configurarRele(int pino, bool ligado) {
  // Relé ligado em HIGH ou LOW conforme a configuração do módulo.
  digitalWrite(pino, RELAY_ACTIVE_LOW ? (ligado ? LOW : HIGH)
                                      : (ligado ? HIGH : LOW));
}

void atualizarBombas(bool abastecer, bool esvaziar) {
  // Nunca permitir que as duas bombas funcionem ao mesmo tempo.
  if (abastecer && esvaziar) {
    abastecer = false;
    esvaziar = false;
  }

  bombaAbastecer = abastecer;
  bombaEsvaziar = esvaziar;
  configurarRele(RELE_ABASTECER, bombaAbastecer);
  configurarRele(RELE_ESVAZIAR, bombaEsvaziar);
}

float medirUmaVez() {
//Garante que o trig está em nível baixo antes de começar.
  digitalWrite(TRIG, LOW);
//Pausa para estabilização do final. 
  delayMicroseconds(2);
//Envia pulso padrão ao sensor.
  digitalWrite(TRIG, HIGH);
//Encerra o pulso desparado.
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);

  
//Mede quanto tempo o pino echo fica HIGH.
//O timeout evita que o arduino trave, fazendo o echo voltar.
  long duracao = pulseIn(ECHO, HIGH, 30000);
//Se pulseIn retornar 0, não houve eco dentro do tempo limite.
// Converte tempo de ida e volta em distância (cm), dividido por 2 (ida e volta)
  if (duracao == 0) return -1;
  return duracao * 0.0343 / 2.0;
}

// Média de 3 medições válidas.
float medirDistancia() {
  noTone(BUZZER);
  float soma = 0;
  int validas = 0;

  for (int i = 0; i < 3; i++) {
    float d = medirUmaVez();
    if (d > 0 && d < 400) {
      soma += d;
      validas++;
    }
    delay(10);
  }

  if (validas == 0) return -1;
  return soma / validas;
}

void processarComandosSerial() {
  while (Serial.available() > 0) {
    char c = Serial.read();

    if (c == '\n' || c == '\r') {
      comandoSerial.trim();
      comandoSerial.toUpperCase();

      if (comandoSerial == "AUTO") {
        modoAutomatico = true;
      } else if (comandoSerial == "PARAR") {
        modoAutomatico = false;
        atualizarBombas(false, false);
      } else if (comandoSerial == "ABASTECER 1") {
        modoAutomatico = false;
        atualizarBombas(true, false);
      } else if (comandoSerial == "ABASTECER 0") {
        atualizarBombas(false, bombaEsvaziar);
      } else if (comandoSerial == "ESVAZIAR 1") {
        modoAutomatico = false;
        atualizarBombas(false, true);
      } else if (comandoSerial == "ESVAZIAR 0") {
        atualizarBombas(bombaAbastecer, false);
      }

      comandoSerial = "";
    } else {
      comandoSerial += c;
    }
  }
}

void publicarEstado() {
  Serial.print("Distancia:");
  Serial.print(distancia);
  Serial.println(" cm");
  Serial.print("Modo:");
  Serial.println(modoAutomatico ? "AUTO" : "MANUAL");
  Serial.print("Abastecer:");
  Serial.println(bombaAbastecer ? 1 : 0);
  Serial.print("Esvaziar:");
  Serial.println(bombaEsvaziar ? 1 : 0);
  Serial.println("EstadoFim");
}

void setup() {
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
  pinMode(LED_TRANSBORDA, OUTPUT);
  pinMode(LED_VERDE, OUTPUT);
  pinMode(LED_AMARELO, OUTPUT);
  pinMode(BUZZER, OUTPUT);
  pinMode(RELE_ABASTECER, OUTPUT);
  pinMode(RELE_ESVAZIAR, OUTPUT);

  digitalWrite(TRIG, LOW);
  digitalWrite(LED_TRANSBORDA, LOW);
  digitalWrite(LED_VERDE, LOW);
  digitalWrite(LED_AMARELO, LOW);
  noTone(BUZZER);
  atualizarBombas(false, false);

  Serial.begin(9600);
}

void loop() {
  
//Captura o arduino ligando.
  unsigned long agora = millis();
  processarComandosSerial();

// Mede a cada 1000 ms, não queremos um sistema confuso.
  if (agora - ultimaLeitura >= 1000) {
// Atualiza o carimbo de tempo da última leitura.
    ultimaLeitura = agora;
// Atualiza a distância média atual.
    distancia = medirDistancia();

    if (modoAutomatico) {
      if (distancia < 0) {
        // Falha ou leitura inválida: corte de segurança.
        atualizarBombas(false, false);
      } else if (distancia <= LIM_MUITO_CHEIO) {
        atualizarBombas(false, true); // Muito cheio: enviar para outro reservatório.
      } else if (bombaEsvaziar && distancia >= LIM_NORMAL_CHEIO) {
        atualizarBombas(false, false);
      } else if (distancia >= LIM_MUITO_VAZIO) {
        atualizarBombas(true, false); // Muito vazio: puxar água.
      } else if (bombaAbastecer && distancia <= LIM_NORMAL_VAZIO) {
        atualizarBombas(false, false);
      }
    }

    publicarEstado();
  }

  bool transborda = distancia > 0 && distancia <= LIM_MUITO_CHEIO;
  bool verde = distancia > 0 && distancia > LIM_MUITO_CHEIO && distancia < LIM_MUITO_VAZIO;
  bool amarelo = distancia >= LIM_MUITO_VAZIO;

  unsigned long periodo = transborda ? 300 : 600;
// Verifica se já passou o tempo do período.
  if (agora - ultimoPisca >= periodo) {
  if (agora - ultimoPisca >= periodo) {
// Registra o momento em que o pisca mudou de estado.
    ultimoPisca = agora;
    ledLigado = !ledLigado;
  }

 // Aplica nos LEDs
  digitalWrite(LED_TRANSBORDA, transborda && ledLigado);
  digitalWrite(LED_VERDE, verde);
  digitalWrite(LED_AMARELO, amarelo);

  if (transborda && ledLigado) tone(BUZZER, 1000);
  else noTone(BUZZER);
}
