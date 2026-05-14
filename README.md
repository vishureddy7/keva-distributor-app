# Keva Distributor — Stock Management App

A React Native (Expo) mobile app for managing product inventory, recording sales, tracking billing status, and exporting data to Excel. Powered by Firebase Firestore for real-time cloud sync across all devices.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Screens & Navigation](#screens--navigation)
- [Firebase & Data Model](#firebase--data-model)
- [Billing System](#billing-system)
- [Billed (But Unsold) Tracker](#billed-but-unsold-tracker)
- [Excel Export](#excel-export)
- [Constants & Configuration](#constants--configuration)
- [Building & Updating the APK](#building--updating-the-apk)

---

## Features

| Feature | Description |
|---|---|
| **Real-time stock sync** | Products update live across all devices via Firestore `onSnapshot` |
| **Record Sale** | Multi-product sales with per-product quantity validation against live stock |
| **Billed / Unbilled toggle** | Every sale is tagged as Billed or Unbilled at the time of recording |
| **Mark as Billed** | Convert an unbilled sale to billed with one tap in Customer Sales Records |
| **Edit Sale** | Change customer name, timestamp, billing status, quantities, or swap products |
| **Delete Sale** | Entire sale group deleted with automatic stock reversal |
| **Add Stock (Restock)** | Record incoming inventory for any product |
| **Add Product** | Create a new product with an opening stock quantity |
| **Edit / Delete Product** | Rename or permanently remove a product from inventory |
| **View Stock** | Live inventory table with low-stock and out-of-stock highlighting |
| **Product Detail** | Per-product transaction history (sales + restocks) with tap-to-edit |
| **Billed (But Unsold)** | Separate tracker for billed-but-undelivered stock — never touches live stock |
| **Customer Sales Records** | Tabbed view (Unbilled / Billed) with search by customer or product |
| **Excel Export** | Generate and save/share a `.xlsx` file with a Total Stock sheet + per-product sheets |
| **Low stock alerts** | Home screen banner and colour-coded table rows when stock ≤ 5 units |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native via **Expo SDK 54** |
| Navigation | `@react-navigation/stack` v6 |
| Database | **Firebase Firestore** (web SDK v10) |
| UI components | `react-native-paper`, `react-native-dropdown-picker` |
| Excel | **SheetJS (xlsx)** v0.18 |
| File system | `expo-file-system` (legacy API) |
| Sharing | `expo-sharing` |
| Build system | **EAS Build** (Expo Application Services) |

---

## Project Structure

```
keva-distributor-app/
├── App.js                          # Root: providers, navigator, loading gate
├── app.json                        # Expo config (name, package, permissions)
├── eas.json                        # EAS build profiles
├── babel.config.js
├── package.json
│
└── src/
    ├── context/
    │   └── AppContext.js            # Global state; Firestore real-time subscription
    │
    ├── screens/
    │   ├── HomeScreen.js            # Dashboard with quick-action cards + stat chips
    │   ├── RecordSaleScreen.js      # Multi-product sale form with billing toggle
    │   ├── CustomerSalesScreen.js   # Tabbed sales history (Unbilled / Billed)
    │   ├── EditSaleScreen.js        # Edit/delete an entire sale group
    │   ├── RestockScreen.js         # Add incoming stock for a product
    │   ├── AddProductScreen.js      # Create a new product with opening stock
    │   ├── EditProductScreen.js     # Rename or delete a product
    │   ├── ViewStockScreen.js       # Live inventory table (tap row → ProductDetail)
    │   ├── ProductDetailScreen.js   # Per-product history + edit shortcut
    │   ├── BilledUnsoldScreen.js    # Billed-but-unsold tracker (no stock changes)
    │   └── ExcelViewScreen.js       # Generate and save/share the Excel file
    │
    ├── components/
    │   ├── ConfirmModal.js          # Reusable confirmation dialog (scrollable body)
    │   ├── ProductDropdown.js       # Single/multi product picker (react-native-dropdown-picker)
    │   ├── QuantityInput.js         # Stepper input with live stock badge
    │   └── StockTable.js            # Inventory table with skeleton loading + legend
    │
    ├── services/
    │   ├── firebase.js              # Firebase app init + Firestore export
    │   ├── firebaseService.js       # All Firestore read/write operations
    │   ├── stockService.js          # Sale and restock validation wrappers
    │   ├── productService.js        # Product CRUD wrappers with validation
    │   └── excelService.js          # SheetJS helpers (local file, legacy)
    │
    └── utils/
        ├── constants.js             # COLORS, ROUTES, BILLING_STATUS, column indices
        ├── dateHelpers.js           # Timestamp formatting (DD-MMM-YYYY H:MM AM/PM)
        └── validators.js            # Pure validation functions, no side effects
```

---

## Screens & Navigation

### Route Constants (`src/utils/constants.js`)

```js
ROUTES.HOME            // Dashboard
ROUTES.RECORD_SALE     // Record a new sale
ROUTES.RESTOCK         // Add incoming stock
ROUTES.ADD_PRODUCT     // Create a new product
ROUTES.VIEW_STOCK      // Live inventory table
ROUTES.EXCEL_VIEW      // Export to Excel
ROUTES.EDIT_PRODUCT    // Rename / delete product
ROUTES.CUSTOMER_SALES  // Sales history (Unbilled / Billed tabs)
ROUTES.EDIT_SALE       // Edit a sale group
ROUTES.PRODUCT_DETAIL  // Per-product transaction history
ROUTES.BILLED_UNSOLD   // Billed-but-unsold tracker
```

### Screen Flow

```
HomeScreen
├── RecordSaleScreen      → success → back to Home
├── RestockScreen         → success → back to Home
├── AddProductScreen      → success → back to Home
├── CustomerSalesScreen
│   └── EditSaleScreen    → save/delete → back to CustomerSales
├── BilledUnsoldScreen    (self-contained — add + list on same screen)
├── ViewStockScreen
│   └── ProductDetailScreen
│       └── EditProductScreen → save/delete → back to ViewStock
└── ExcelViewScreen       (save to Downloads or share)
```

---

## Firebase & Data Model

### Collections

#### `products` (document ID = product name)

```
{
  productName:   string,   // e.g. "Keva Protein 1kg"
  totalStockIn:  number,   // cumulative units received
  totalSold:     number,   // cumulative units sold
  currentStock:  number,   // live available quantity
  lastUpdated:   string    // "DD-MMM-YYYY H:MM AM/PM"
}
```

#### `transactions` (auto-ID)

```
{
  productName:      string,   // product this entry belongs to
  type:             string,   // "SALE" | "STOCK IN" | "OPENING STOCK"
  customerOrSource: string,   // customer name for sales, supplier for restocks
  quantity:         number,
  timestamp:        string,   // human-readable "DD-MMM-YYYY H:MM AM/PM"
  createdAt:        number,   // epoch ms — used for ordering
  billingStatus:    string    // "billed" | "unbilled" (sales only)
}
```

#### `billedUnsold` (auto-ID)

```
{
  productName:  string,
  quantity:     number,
  notes:        string,   // optional free text
  timestamp:    string,
  createdAt:    number
}
```

> **Important:** `billedUnsold` is completely separate from `products` and `transactions`. Writing to it never changes stock levels.

### Key Service Functions (`firebaseService.js`)

| Function | What it does |
|---|---|
| `subscribeToProducts(cb)` | Real-time listener on `products` collection |
| `recordSale(customer, items, billingStatus)` | Atomic batch: deducts stock + creates transaction docs |
| `recordRestock(product, qty, remarks)` | Atomic batch: adds stock + creates transaction doc |
| `updateSaleGroup(...)` | Reverses old stock, applies new stock, replaces transaction docs |
| `deleteSaleGroup(items)` | Restores stock for all items, deletes transaction docs |
| `markSaleGroupAsBilled(items)` | Batch-updates `billingStatus` to `"billed"` on all docs in group |
| `addNewProduct(name, openingQty)` | Creates product doc + opening stock transaction |
| `renameProduct(oldName, newName)` | Copies doc to new ID, deletes old doc |
| `deleteProduct(name)` | Deletes product doc (transactions preserved for audit) |
| `addBilledUnsold(product, qty, notes)` | Writes to `billedUnsold` only — no stock change |
| `getBilledUnsoldList()` | Returns all billed-unsold entries, newest first |
| `deleteBilledUnsoldEntry(id)` | Deletes one billed-unsold entry |
| `generateAndSaveExcel()` | Builds `.xlsx` from live Firestore data, saves to device cache |

---

## Billing System

### Recording a Sale

In `RecordSaleScreen`, Section 4 presents two pill buttons:

- **📋 Unbilled** — sale recorded, stock deducted, but invoice not yet issued
- **🧾 Billed** — sale recorded with invoice issued

The chosen status is saved as `billingStatus` on every transaction document created for that sale.

### Customer Sales Records (Tabbed View)

`CustomerSalesScreen` groups transactions by `customerOrSource + timestamp` into sale cards and separates them into two tabs:

| Tab | Contents |
|---|---|
| 📋 Unbilled | Sales pending invoice. Shows a count badge and "Mark as Billed" button on each card |
| 🧾 Billed | Completed / invoiced sales |

### Mark as Billed

Tapping **"✅ Mark as Billed"** on an unbilled card calls `markSaleGroupAsBilled`, which batch-updates every transaction doc in that group to `billingStatus: "billed"`. The screen then auto-refreshes and switches to the Billed tab.

### Edit Sale Billing Status

`EditSaleScreen` also exposes the billing toggle, so you can change status at any time alongside editing customer name, date, or quantities.

### Backward Compatibility

Transactions written before the billing field was added have no `billingStatus` field. These default to **Billed** in the grouping logic so they appear in the Billed tab and don't pollute the Unbilled count.

---

## Billed (But Unsold) Tracker

`BilledUnsoldScreen` is a **purely informational reminder tool**. It is completely independent of stock management.

### What it does

- Lets you record that a certain product quantity has been billed to a customer but not yet physically delivered or sold
- Stores entries in the `billedUnsold` Firestore collection
- **Does not read, write, or modify the `products` or `transactions` collections in any way**
- Shows a running summary table (product → total units billed unsold + grand total)
- Shows a full list of all entries with timestamps, optional notes, and a delete button per entry

### What it does NOT do

- It does not deduct or reserve stock
- It does not create sale records
- It does not appear in CustomerSalesScreen or affect billing counts

### When to use it

Use this screen as a mental note when you've raised an invoice for goods that haven't left the warehouse yet, so you can keep track of what's committed without affecting live inventory numbers.

---

## Excel Export

`ExcelViewScreen` generates a fresh `.xlsx` file on demand, pulling live data from Firestore.

### Sheets generated

| Sheet | Contents |
|---|---|
| `Total Stock` | One row per product: Name, Total Stock In, Total Sold, Current Stock, Last Updated |
| One sheet per product | Full transaction history: Date/Time, Entry Type, Customer/Source, Quantity |

### Export options

- **💾 Save to Downloads (Android)** — uses StorageAccessFramework (SAF); user picks a folder
- **💾 Save to Files (iOS)** — opens the system share sheet to save to Files app
- **📤 Share / Send** — opens the native share sheet (WhatsApp, Email, Google Drive, etc.)

---

## Constants & Configuration

### Low Stock Threshold

In `src/utils/constants.js`:

```js
export const LOW_STOCK_THRESHOLD = 5;
```

Products at or below this value are highlighted in amber in the stock table and counted in the Home screen stat chips.

### Colors

```js
COLORS.primary      // #1565C0 — main blue
COLORS.success      // #2E7D32 — green
COLORS.error        // #C62828 — red
COLORS.warning      // #F9A825 — amber
COLORS.accent       // #FF6F00 — orange (used in BilledUnsold)
```

### Billing Status Values

```js
BILLING_STATUS.BILLED   // "billed"
BILLING_STATUS.UNBILLED // "unbilled"
```

### Timestamp Format

All timestamps are stored and displayed as: `DD-MMM-YYYY H:MM AM/PM`
Example: `06-May-2026 3:45 PM`

---

## Building & Updating the APK

The app uses **EAS Build** (Expo Application Services). Make sure you have the EAS CLI installed and are logged in before running any build commands.

### One-time setup

```bash
# Install EAS CLI globally
npm install -g eas-cli

# Log in to your Expo account
eas login

# Verify you're logged in
eas whoami
```

### Build profiles (from `eas.json`)

| Profile | Use case | Distribution |
|---|---|---|
| `development` | Local testing with Expo Dev Client | Internal (sideload) |
| `preview` | Shareable test APK — no Play Store needed | Internal (sideload) |
| `production` | Play Store / final release APK | Store / Internal |

---

### Build a preview APK (most common — share with anyone)

```bash
# Build for Android (generates a downloadable .apk)
eas build --platform android --profile preview
```

Once the build finishes, EAS prints a download URL. Open it in a browser or run:

```bash
# Download the APK directly to your machine
eas build:download --platform android
```

Then transfer the `.apk` to your Android device and install it (enable "Install from unknown sources" if prompted).

---

### Build a production APK / AAB (Play Store)

```bash
# Builds an .aab (Android App Bundle) for Play Store submission
eas build --platform android --profile production

# If you need a standalone .apk instead of .aab for production:
# Add "buildType": "apk" under the production profile in eas.json first, then:
eas build --platform android --profile production
```

---

### Update the app (Over-the-Air — JS changes only)

If you only changed JavaScript / assets (no native code, no new packages), you can push an OTA update without rebuilding the APK:

```bash
# Install expo-updates if not already present
npx expo install expo-updates

# Push OTA update to the production channel
eas update --branch production --message "describe what changed"

# Push OTA update to the preview channel
eas update --branch preview --message "describe what changed"
```

Users will receive the update automatically on next app launch (or within the configured update interval).

> **When you DO need a full rebuild:** any time you add or update a native package (e.g. a new entry in `dependencies` that has native code), change `app.json`, change Firebase config, or bump the Expo SDK version.

---

### Increment version number before a release

In `app.json`, update the `version` field and (for Android) the `versionCode`:

```json
{
  "expo": {
    "version": "1.1.0",
    "android": {
      "versionCode": 2
    }
  }
}
```

`eas.json` already has `"autoIncrement": true` under the production profile, which automatically bumps `versionCode` on every production build so you don't have to do it manually.

---

### Run locally (development)

```bash
# Install dependencies
npm install

# Start the Expo dev server
npm start          # or: npx expo start

# Open on a connected Android device / emulator
npm run android

# Open on iOS simulator (macOS only)
npm run ios
```

---

### Full rebuild + update workflow (typical release)

```bash
# 1. Make your code changes

# 2. Test locally
npm start

# 3. Bump version in app.json if it's a significant release

# 4. Commit your changes
git add .
git commit -m "v1.1.0 — describe changes"

# 5. Build a preview APK to test before production
eas build --platform android --profile preview

# 6. Test the preview APK on a real device

# 7. Build production
eas build --platform android --profile production

# 8. Download and distribute / submit to Play Store
eas build:download --platform android
```