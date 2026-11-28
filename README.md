# Reservoir Level Monitor (Arduino)

A non-blocking Arduino firmware for monitoring water or liquid levels in a reservoir using an ultrasonic distance sensor (such as an HC-SR04), three status LEDs, a buzzer alarm, and Serial output.

## How It Works

The ultrasonic sensor is mounted at the top of the reservoir pointing downward:
- **Smaller distance (`cm`)** = fuller reservoir
- **Larger distance (`cm`)** = emptier reservoir

Every **1000 ms**, the firmware takes up to 3 distance samples, averages valid readings, and prints the result to the Serial Monitor (`9600` baud). Based on configured thresholds, it updates the indicator LEDs and triggers an audible alarm if the reservoir is near overflow.

### Level Thresholds

| Distance Range (`cm`) | State | Indicator Behavior |
| :--- | :--- | :--- |
| `<= 100.0 cm` (`LIM_MUITO_CHEIO`) | **Very High Level** | Red LED blinks + `1000 Hz` buzzer |
| `> 100.0` and `< 210.0 cm` | **Normal Level** | Green LED active |
| `>= 210.0 cm` (`LIM_MUITO_VAZIO`) | **Very Low Level** | Yellow LED active |
| Invalid reading (`-1`) | **Sensor Failure** | Both pumps stop for safety |

## Hardware Requirements

- **Microcontroller:** Arduino Uno (or compatible 5V board)
- **Sensor:** Ultrasonic sensor (e.g., HC-SR04)
- **LEDs:** 1× Red, 1× Green, 1× Yellow (with appropriate current-limiting resistors, e.g., 220 Ω)
- **Alarm:** 1× Piezo buzzer
- **Power & Wiring:** Jumper wires, breadboard/PCB

## Pinout

| Component | Pin | Arduino Pin | Notes |
| :--- | :--- | :--- | :--- |
| Ultrasonic Sensor | `TRIG` | `D9` | Output (`10 µs` trigger pulse) |
| Ultrasonic Sensor | `ECHO` | `D10` | Input (`30,000 µs` timeout) |
| Red LED (Overflow) | Anode (+) | `D2` | Blinks during overflow alert |
| Green LED (Normal) | Anode (+) | `D3` | Normal water level |
| Yellow LED (Low) | Anode (+) | `D4` | Low water level |
| Buzzer | Positive (+) | `D6` | `1000 Hz` tone on overflow |
| Relay — pump to fill/pull water | IN1 | `D7` | Active LOW by default |
| Relay — pump to send water | IN2 | `D8` | Active LOW by default |
| Serial Monitor | USB | `9600 baud` | Prints `Distancia: <value> cm` |

## Getting Started

1. Wire the ultrasonic sensor, LEDs, and buzzer according to the **Pinout** table above.
2. Open the `.ino` sketch in the Arduino IDE.
3. Select your board and COM port, then click **Upload**.
4. Open **Tools > Serial Monitor**, set the baud rate to **9600**, and verify distance readings.

## Calibration

Measure the physical distance from the face of the ultrasonic sensor to the water surface at key levels, then update the constants at the top of the sketch:

```cpp
const float LIM_MUITO_CHEIO = 100.0;
const float LIM_NORMAL_CHEIO = 115.0;
const float LIM_MUITO_VAZIO = 210.0;
const float LIM_NORMAL_VAZIO = 195.0;
```

## Pump Control

The firmware can control two independent pumps or one bidirectional transfer system:

- At `<= 100 cm`, the tank is very full and the drain pump is activated.
- At `>= 210 cm`, the tank is very empty and the fill pump is activated.
- The drain pump stops at `>= 115 cm` and the fill pump stops at `<= 195 cm`.
- Invalid sensor readings stop both pumps for safety.
- The two pump outputs are interlocked, so they can never be enabled together.

If the relay module uses a positive trigger instead of an active-low trigger, set:

```cpp
const bool RELAY_ACTIVE_LOW = false;
```

Never power a pump directly from Arduino pins. Use an appropriately rated relay module, external pump power supply, common-ground wiring, and flyback protection. Disconnect mains power during assembly.

## Web Control

Open `web/index.html` in Chrome or Edge, click **Conectar dispositivo**, and select the Arduino serial port. The page can:

- switch to automatic operation with `AUTO`;
- manually activate the fill pump with `ABASTECER 1`;
- manually activate the drain pump with `ESVAZIAR 1`;
- stop both pumps with `PARAR`.

The Arduino also returns `Distancia`, `Modo`, `Abastecer`, and `Esvaziar` lines at `9600` baud for the web dashboard.
