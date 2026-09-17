# Lumina Mobile

Expo SDK 57 application backed by the existing Lumina Go API.

## Run

Use Node 22.13+ or Node 24.3+; Node 23 is not supported by React Native 0.86.

```bash
cp .env.example .env
npm install
npm start
```

The Android emulator can use `http://10.0.2.2:8080/api`. For Expo Go on a physical phone, set `EXPO_PUBLIC_API_URL` to the computer's LAN address, such as `http://192.168.1.20:8080/api`. Both devices must be on the same network.

The MVP includes secure persistent authentication, cached public feed, search, story reader, bookmarks, profile, and Quick Capture.
