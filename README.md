# Crypto Signal

Cryptocurrency trading signals platform with backend API and mobile application.

## Project Structure

- **backend**: Node.js backend API for cryptocurrency signals
- **mobile**: React Native mobile application

## Setup

### Backend
```bash
cd backend
npm install
# copy backend/.env.example to backend/.env and fill GEMINI_API_KEY
npm start
```

### Mobile
```bash
cd mobile
npm install
npm start
```

## Technologies

- Backend: Node.js, Express
- Mobile: React Native, Expo

## Gemini AI Setup

The mobile AI tab calls the backend, and the backend calls Gemini.

Required backend env vars:

- `GEMINI_API_KEY`
- `GEMINI_MODEL` (optional, default `gemini-2.5-flash`)
- `GEMINI_TIMEOUT_MS` (optional)

Do not place the Gemini API key in the mobile app.
