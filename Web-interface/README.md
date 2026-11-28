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
| `<= 100.0 cm` (`LIM_TRANSBORDA`) | **Overflow / High Level** | Red LED blinks rapidly (`300 ms` half-period) + `1000 Hz` buzzer pulse |
| `> 100.0` and `< 210.0 cm` (`LIM_BAIXO`) | **Normal Level** | Green LED active (Note: currently tied to the blink toggle in `loop`) |
| `>= 210.0` and `< 320.0 cm` (`LIM_VAZIO`) | **Low Level** | Yellow LED active (Note: currently tied to the blink toggle in `loop`) |
| `>= 320.0 cm` or invalid (`-1`) | **Empty / No Valid Reading** | All LEDs off, buzzer silent |

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
| Serial Monitor | USB | `9600 baud` | Prints `Distancia: <value> cm` |

## Getting Started

1. Wire the ultrasonic sensor, LEDs, and buzzer according to the **Pinout** table above.
2. Open the `.ino` sketch in the Arduino IDE.
3. Select your board and COM port, then click **Upload**.
4. Open **Tools > Serial Monitor**, set the baud rate to **9600**, and verify distance readings.

## Calibration

Measure the physical distance from the face of the ultrasonic sensor to the water surface at key levels, then update the constants at the top of the sketch:

```cpp
const float LIM_TRANSBORDA = 100.0; // Max safe height before overflow warning (cm)
const float LIM_BAIXO      = 210.0; // Threshold for low-level warning (cm)
const float LIM_VAZIO      = 320.0; // Distance at or near empty tank (cm)
