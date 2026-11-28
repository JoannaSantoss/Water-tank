// Monitor de nível de reservatório - versão estável

//Definição dos pinos conectados ao sensor ultrassônico.
//Usar const evita problemas de alteração do pino por engano.
const int TRIG = 9;
const int ECHO = 10;

// Definição dos pinos dos leds, e sua função
const int LED_TRANSBORDA = 2;  // vermelho (Transbordando.)
const int LED_VERDE      = 3;  // verde (Nível Normal.)
const int LED_AMARELO    = 4;  // amarelo(baixo nível.)
const int BUZZER         = 6;  // Utilizado para emitir som.

//Limites definidos do sensor(podem ser adaptados)
//Quanto Maior a distância, menos cheio está o reservatório.
//Quanto menor a distância, mais cheio está o reservatório.
const float LIM_TRANSBORDA = 100.0;
const float LIM_BAIXO      = 210.0;
const float LIM_VAZIO      = 320.0;


//Float vai guardar a última distância medida.
//-1 Significa que não ouve leitura válida ainda.
float distancia = -1;    
//Marca em ms a última medição para controle.
unsigned long ultimaLeitura = 0;
//Marca em ms a última inverão dos leds.
unsigned long ultimoPisca = 0;
//Estado do led, boleano. 
bool ledLigado = false;

void setup() {
//Definição de entrada e saída.
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
  pinMode(LED_TRANSBORDA, OUTPUT);
  pinMode(LED_VERDE, OUTPUT);
  pinMode(LED_AMARELO, OUTPUT);
  pinMode(BUZZER, OUTPUT);
  Serial.begin(9600);
}

//Inicia medição em centímetros.
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
  return duracao * 0.0343 / 2;
}

// Média de 3 medições válidas.
float medirDistancia() {
  noTone(BUZZER);  // buzzer desligado durante a medição.
  float soma = 0; //Acumula as leituras válidas.
  int validas = 0; //Conta quantas leituras voltaram positivas.
  for (int i = 0; i < 3; i++) {
    float d = medirUmaVez();
//Ignora leituras inválidas.
    if (d > 0) {
      soma += d;
      validas++;
    }
    delay(10);
  }
  
//Se não há leitura válida, retorna -1.
  if (validas == 0) return -1;
  return soma / validas;
}

void loop() {
  
//Captura o arduino ligando.
  unsigned long agora = millis();

// Mede a cada 1000 ms, não queremos um sistema confuso.
  if (agora - ultimaLeitura >= 1000) {
// Atualiza o carimbo de tempo da última leitura.
    ultimaLeitura = agora;
// Atualiza a distância média atual.
    distancia = medirDistancia();

//Envia leitura para o monitor serial.
    Serial.print("Distancia: ");
    Serial.print(distancia);
    Serial.println(" cm");
  }

// Decide o estado do reservatório.
  bool transborda = false, verde = false, amarelo = false;

// Só classifica o nível se houver uma distância válida (> 0).
  if (distancia > 0) {
    //Nível da água alto.
    if (distancia <= LIM_TRANSBORDA)      transborda = true;
    //Nível normal da água.
    else if (distancia < LIM_BAIXO)       verde = true;
    //Nível baixo da água.
    else if (distancia < LIM_VAZIO)       amarelo = true;
      }

// Piscar sem travar o programa
//300 ms se transborda, e 600 em nível normal.
  unsigned long periodo = transborda ? 300 : 600;
  // Verifica se já passou o tempo do período.
  if (agora - ultimoPisca >= periodo) {
    // Registra o momento em que o pisca mudou de estado.
    ultimoPisca = agora;
    ledLigado = !ledLigado;
  }

  // Aplica nos LEDs
  digitalWrite(LED_TRANSBORDA, transborda && ledLigado);
  digitalWrite(LED_VERDE, verde);
  digitalWrite(LED_AMARELO, amarelo);

  // Emite som de 1000 Hz se estiver transbordando.
  if (transborda && ledLigado) tone(BUZZER, 1000);
  else noTone(BUZZER);
}
