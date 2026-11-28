// Monitor de nível de reservatório - v3 (corrigida)
//
// O sensor fica no topo do reservatório, apontado para a água:
// quanto MAIOR a distância medida, MENOS cheio está o reservatório.
//
// Mudanças em relação à v2:
//  - HISTERESE reduzida (2.0 -> 0.5) e limites mais espaçados
//  - TRANSBORDA agora volta para NORMAL (antes pulava para BAIXO)
//  - Mediana de 3 leituras (descarta picos) em vez de média
//  - SEM_LEITURA só após 3 falhas seguidas (ignora falhas isoladas)
//  - Limite de transbordo fora da zona cega do HC-SR04 (~2 cm)

// ---------- Pinos ----------
const int TRIG = 9;
const int ECHO = 10;

const int LED_TRANSBORDA = 2;  // vermelho (transbordando)
const int LED_VERDE      = 3;  // verde (nível normal)
const int LED_AMARELO    = 4;  // amarelo (nível baixo / vazio)
const int BUZZER         = 6;  // som de alerta

// ---------- Limites em cm (ADAPTE ao tamanho do seu pote) ----------
// Distância do sensor até a água. Mantenha LIM_TRANSBORDA >= 3 cm,
// pois o HC-SR04 lê mal abaixo de ~2 cm.
const float LIM_TRANSBORDA = 3.0f;
const float LIM_BAIXO      = 5.0f;
const float LIM_VAZIO      = 7.0f;

// Margem anti-oscilação. Deve ser MENOR que metade da menor faixa.
const float HISTERESE = 0.5f;

// Falhas seguidas necessárias para declarar SEM_LEITURA.
const int FALHAS_MAX = 3;

// ---------- Tempos em ms ----------
const unsigned long INTERVALO_LEITURA = 1000;
const unsigned long PISCA_RAPIDO      = 300;
const unsigned long PISCA_LENTO       = 600;

enum Estado { SEM_LEITURA, TRANSBORDA, NORMAL, BAIXO, VAZIO };

float distancia = -1;
Estado estado = SEM_LEITURA;
int falhasSeguidas = 0;

unsigned long ultimaLeitura = 0;
unsigned long ultimoPisca   = 0;

bool ledLigado    = false;
bool buzzerLigado = false;

// Uma medição em cm. Retorna -1 se não houver eco.
float medirUmaVez() {
  digitalWrite(TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);

  long duracao = pulseIn(ECHO, HIGH, 30000);
  if (duracao == 0) return -1;

  return duracao * 0.0343f / 2;
}

// Mediana de 3 medições válidas (2 válidas -> média). -1 se menos de 2 válidas.
float medirDistancia() {
  noTone(BUZZER);        // buzzer calado durante a medição
  buzzerLigado = false;  // o loop religa quando preciso

  float v[3];
  int n = 0;

  for (int i = 0; i < 3; i++) {
    float d = medirUmaVez();
    if (d > 0) v[n++] = d;
    delay(30);  // evita eco da medição anterior
  }

  if (n < 2) return -1;
  if (n == 2) return (v[0] + v[1]) / 2;

  // Mediana de 3 valores
  float a = v[0], b = v[1], c = v[2];
  if ((a >= b && a <= c) || (a <= b && a >= c)) return a;
  if ((b >= a && b <= c) || (b <= a && b >= c)) return b;
  return c;
}

// Classifica a distância com histerese.
// Para SAIR de um estado, o nível precisa passar do limite por HISTERESE.
Estado classificar(float d, Estado atual) {
  // Limites efetivos conforme o estado atual
  float limT = LIM_TRANSBORDA;  // d <= limT      -> TRANSBORDA
  float limB = LIM_BAIXO;       // d <  limB      -> NORMAL
  float limV = LIM_VAZIO;       // d <  limV      -> BAIXO, senão VAZIO

  // Já transbordando: só sai quando a água descer HISTERESE além do limite
  if (atual == TRANSBORDA) limT += HISTERESE;

  // Já em NORMAL ou TRANSBORDA: só vira BAIXO se passar do limite + HISTERESE
  if (atual == NORMAL || atual == TRANSBORDA) limB += HISTERESE;

  // Já em BAIXO ou VAZIO: só volta a NORMAL se ficar HISTERESE abaixo do limite
  if (atual == BAIXO || atual == VAZIO) limB -= HISTERESE;

  // Já em VAZIO: só vira BAIXO se ficar HISTERESE abaixo do limite
  if (atual == VAZIO) limV -= HISTERESE;
  // Já em BAIXO: só vira VAZIO se passar do limite + HISTERESE
  if (atual == BAIXO) limV += HISTERESE;

  if (d <= limT) return TRANSBORDA;
  if (d <  limB) return NORMAL;
  if (d <  limV) return BAIXO;
  return VAZIO;
}

const char* nomeEstado(Estado e) {
  switch (e) {
    case SEM_LEITURA: return "SEM_LEITURA";
    case TRANSBORDA:  return "TRANSBORDA";
    case NORMAL:      return "NORMAL";
    case BAIXO:       return "BAIXO";
    case VAZIO:       return "VAZIO";
  }
  return "?";
}

void atualizarLeitura() {
  float d = medirDistancia();

  if (d > 0) {
    falhasSeguidas = 0;
    distancia = d;
    estado = classificar(d, estado);
  } else {
    falhasSeguidas++;
    // Só declara falha do sensor depois de várias falhas seguidas;
    // até lá, mantém o último estado.
    if (falhasSeguidas >= FALHAS_MAX) {
      distancia = -1;
      estado = SEM_LEITURA;
    }
  }

  if (d > 0) {
    Serial.print(F("Distancia: "));
    Serial.print(d, 1);
    Serial.print(F(" cm"));
  } else {
    Serial.print(F("Sem eco ("));
    Serial.print(falhasSeguidas);
    Serial.print(F(")"));
  }
  Serial.print(F(" | Estado: "));
  Serial.println(nomeEstado(estado));
}

void setup() {
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
  pinMode(LED_TRANSBORDA, OUTPUT);
  pinMode(LED_VERDE, OUTPUT);
  pinMode(LED_AMARELO, OUTPUT);
  pinMode(BUZZER, OUTPUT);
  Serial.begin(9600);

  atualizarLeitura();
  // Na partida, uma falha isolada não deve mostrar erro de sensor:
  // se ainda não há estado válido, tenta de novo no próximo ciclo.
  ultimaLeitura = millis();
  ultimoPisca   = millis();
}

void loop() {
  unsigned long agora = millis();

  if (agora - ultimaLeitura >= INTERVALO_LEITURA) {
    ultimaLeitura = agora;
    atualizarLeitura();
  }

  unsigned long periodo = (estado == TRANSBORDA) ? PISCA_RAPIDO : PISCA_LENTO;
  if (agora - ultimoPisca >= periodo) {
    ultimoPisca = agora;
    ledLigado = !ledLigado;
  }

  //   TRANSBORDA  -> vermelho piscando rápido + buzzer
  //   NORMAL      -> verde fixo
  //   BAIXO       -> amarelo fixo
  //   VAZIO       -> amarelo piscando
  //   SEM_LEITURA -> vermelho e amarelo alternando (falha do sensor)
  bool vermelho = false, verde = false, amarelo = false;

  switch (estado) {
    case TRANSBORDA:  vermelho = ledLigado; break;
    case NORMAL:      verde = true; break;
    case BAIXO:       amarelo = true; break;
    case VAZIO:       amarelo = ledLigado; break;
    case SEM_LEITURA: vermelho = ledLigado; amarelo = !ledLigado; break;
  }

  digitalWrite(LED_TRANSBORDA, vermelho);
  digitalWrite(LED_VERDE, verde);
  digitalWrite(LED_AMARELO, amarelo);

  bool querSom = (estado == TRANSBORDA) && ledLigado;
  if (querSom != buzzerLigado) {
    buzzerLigado = querSom;
    if (querSom) tone(BUZZER, 1000);
    else         noTone(BUZZER);
  }
}
