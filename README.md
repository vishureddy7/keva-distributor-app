# Keva Distributor App

A mobile application for managing Keva product distribution — recording sales,
restocking inventory, and keeping everything synced to an Excel workbook on the device.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native (Expo SDK 54) |
| Navigation | React Navigation v6 (Stack) |
| Excel I/O | SheetJS (xlsx 0.18.x) |
| File System | expo-file-system |
| File Sharing | expo-sharing |
| UI | React Native Paper v5 |
| Dropdowns | react-native-dropdown-picker |

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 18.x or 20.x LTS |
| npm | 9+ (comes with Node) |
| Expo CLI | Latest (`npm install -g expo-cli`) |
| Expo Go app | Latest (install on your Android phone from Play Store) |

---

## Project Structure

```
keva-distributor-app/
├── App.js                          ← Root + Navigation
├── app.json                        ← Expo config
├── babel.config.js                 ← Babel preset
├── package.json                    ← Dependencies
│
├── src/
│   ├── context/
│   │   └── AppContext.js           ← Global state (products, stock)
│   │
│   ├── utils/
│   │   ├── constants.js            ← Sheet names, column indices, colours, routes
│   │   ├── dateHelpers.js          ← Timestamp formatting
│   │   └── validators.js           ← Input validation functions
│   │
│   ├── services/
│   │   ├── excelService.js         ← All SheetJS read/write logic
│   │   ├── productService.js       ← Product CRUD
│   │   └── stockService.js         ← Sale & restock logic
│   │
│   ├── components/
│   │   ├── ProductDropdown.js      ← Multi/single select dropdown
│   │   ├── QuantityInput.js        ← Number input with stock awareness
│   │   ├── StockTable.js           ← Reusable inventory table
│   │   └── ConfirmModal.js         ← Confirmation dialog before writes
│   │
│   └── screens/
│       ├── HomeScreen.js           ← Dashboard with live stats
│       ├── RecordSaleScreen.js     ← Customer sale form
│       ├── RestockScreen.js        ← Stock arrival form
│       ├── AddProductScreen.js     ← New product form
│       ├── ViewStockScreen.js      ← Read-only stock table
│       └── ExcelViewScreen.js      ← File path + share/open
│
└── assets/
    └── icon.png                    ← App icon (replace with Keva logo)
```

---

## Setup & Run

### Step 1 — Clone / set up the project

```bash
git clone https://github.com/vishureddy7/keva-distributor-app.git
cd keva-distributor-app
```

### Step 2 — Install dependencies

```bash
npm install
```

> If you get peer dependency warnings, run: `npm install --legacy-peer-deps`

### Step 3 — Add a placeholder app icon

The app requires `assets/icon.png` to exist (even a blank 1024×1024 PNG works).
Replace it with the Keva logo when ready.

```bash
# Quick way — copy any PNG and rename it
cp path/to/any-image.png assets/icon.png
```

### Step 4 — Start the development server

```bash
npx expo start
```

This opens the Expo dev tools in your browser and shows a QR code.

### Step 5 — Run on your phone

1. Install **Expo Go** from the Play Store on your Android phone
2. Make sure your phone and laptop are on the **same Wi-Fi network**
3. Open Expo Go → scan the QR code from step 4
4. The app loads on your phone

---

## How the Excel File Works

- The file `keva_stock.xlsx` is created automatically on first launch
- It lives in the app's private document directory on the phone
- **Sheet: `Total Stock`** — one row per product, always shows current inventory
- **Sheet per product** — e.g. `Keva Block Set A` — full transaction history
- Use the **"Share / Export Excel"** screen to send it via WhatsApp, email, or Google Drive

---

## Key Business Rules

| Rule | Detail |
|------|--------|
| Stock never goes negative | Sale is blocked if qty > current stock |
| Unique product names | Case-insensitive check on create |
| Atomic sales | Multi-product sale: all succeed or none |
| All transactions are logged | Nothing is ever deleted from Excel |
| Sheet name limit | Product names > 31 chars are truncated (Excel limit) |

---

## Building for Production (APK)

```bash
# Install EAS CLI
npm install -g eas-cli

# Log in to Expo account
eas login

# Build Android APK
eas build --platform android --profile preview
```

The APK link will be emailed to you and can be installed directly on any Android phone.

---

## Common Issues

| Problem | Fix |
|---------|-----|
| `Unable to resolve module` error | Run `npm install` again |
| QR code not working | Make sure phone + laptop are on same Wi-Fi |
| App shows blank screen | Check Expo Go terminal for red error message |
| Excel file not found | Uninstall and reinstall Expo Go to clear cache |
| `peer dep` warnings | Run `npm install --legacy-peer-deps` |

---

## License

Internal use only — Keva Distributor.
