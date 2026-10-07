"""Reset the ESP32 and save its serial output to a file.

    ~/.platformio/penv/bin/python tools/capture_serial.py [--port /dev/ttyUSB0] [--seconds 30] [--until DONE] [--out serial.log]
"""
import argparse
import glob
import sys
import time

import serial  # bundled with PlatformIO's python


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", default=None)
    ap.add_argument("--seconds", type=float, default=30)
    ap.add_argument("--until", default=None, help="stop early when a line contains this text")
    ap.add_argument("--out", default="serial.log")
    args = ap.parse_args()

    port = args.port or next(iter(sorted(glob.glob("/dev/ttyUSB*") + glob.glob("/dev/ttyACM*"))), None)
    if not port:
        print("No serial port yet, waiting for the ESP32 to be plugged in...")
        deadline = time.time() + args.seconds
        while not port and time.time() < deadline:
            time.sleep(1)
            port = next(iter(sorted(glob.glob("/dev/ttyUSB*") + glob.glob("/dev/ttyACM*"))), None)
        if not port:
            sys.exit("No ESP32 serial port found")

    end = time.time() + args.seconds
    reset_done = False
    with open(args.out, "w") as f:
        while time.time() < end:
            try:
                with serial.Serial(port, 115200, timeout=0.5) as s:
                    if not reset_done:
                        # Pulse EN via RTS to reboot into the app (DTR high = GPIO0 not held low).
                        s.dtr = False
                        s.rts = True
                        time.sleep(0.2)
                        s.rts = False
                        reset_done = True
                    while time.time() < end:
                        line = s.readline().decode(errors="replace")
                        if not line:
                            continue
                        sys.stdout.write(line)
                        f.write(line)
                        f.flush()
                        if args.until and args.until in line:
                            end = 0
            except (serial.SerialException, OSError) as e:
                # USB blip (loose cable, brown-out): note it and keep trying until the deadline.
                note = f"[capture] {time.strftime('%H:%M:%S')} serial lost ({e.__class__.__name__}), waiting for port...\n"
                sys.stdout.write(note)
                f.write(note)
                f.flush()
                while time.time() < end:
                    time.sleep(1)
                    found = sorted(glob.glob("/dev/ttyUSB*") + glob.glob("/dev/ttyACM*"))
                    if found:
                        port = found[0]
                        f.write(f"[capture] {time.strftime('%H:%M:%S')} reconnected on {port}\n")
                        break
    print(f"\nSaved to {args.out} (port {port})")


if __name__ == "__main__":
    main()
