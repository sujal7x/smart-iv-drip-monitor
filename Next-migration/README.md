# Smart IV Drip Monitor — Next.js Migration

This is the Next.js ward dashboard. It uses seeded ward data until Firebase configuration is provided, then persists bed records in Firestore.

## Run it

```bash
cd Next-migration
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The dashboard includes an interactive ward map, saline-level chart, patient panel, care queue, and an Add Patient form that records the patient name, working diagnosis, estimated discharge date, and the nurse entering the record.

## Firebase

The Firebase CLI project is `iv-drip-monitor-20261006`. Copy `.env.local.example` to `.env.local`, add the Firebase web-app values from the Firebase console, then restart the development server.

Firestore uses authenticated access in `firestore.rules`. Add Firebase Authentication before deploying the rules, then deploy them with:

```bash
firebase deploy --only firestore:rules
```

The Firestore adapter lives in `lib/bed-repository.ts`. ESP32 saline readings can later be written to a `readings` collection while the ward map continues to read the latest bed state from `beds`.
