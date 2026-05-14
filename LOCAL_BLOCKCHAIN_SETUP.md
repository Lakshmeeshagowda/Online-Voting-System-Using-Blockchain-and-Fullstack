# Votereum — Ganache + MetaMask Setup Guide

## ✅ Prerequisites
1. **Node.js** (v18+) installed
2. **Ganache Desktop App** — [Download here](https://trufflesuite.com/ganache/)
3. **MetaMask** browser extension — [Install here](https://metamask.io/download/)

---

## Step 1: Start Ganache

1. Open the **Ganache Desktop App**
2. Click **Quickstart Ethereum** (or open an existing workspace)
3. Note the **RPC Server** shown at the top (should be `HTTP://127.0.0.1:7545`)
4. Leave Ganache running in the background

---

## Step 2: Deploy the Smart Contract

Open a terminal in this project folder and run:

```bash
npm run deploy
```

This will:
- ✅ Compile `ElectionSystem.sol`
- ✅ Deploy it to your local Ganache
- ✅ **Automatically update** `src/constants.ts` with the new contract address
- ✅ Print the admin wallet address and next steps

**You must see this output at the end:**
```
🎉  DEPLOYMENT COMPLETE!
```

---

## Step 3: Configure MetaMask

### 3a) Add Ganache Network
1. Open MetaMask → click the network dropdown (top)
2. Click **Add a custom network**
3. Fill in:
   - **Network name**: `Ganache Local`
   - **New RPC URL**: `http://127.0.0.1:7545`
   - **Chain ID**: `1337`
   - **Currency symbol**: `ETH`
4. Click **Save** and then switch to **Ganache Local**

### 3b) Import Admin Account
1. In Ganache, look at the first account in the list
2. Click the 🔑 **Key icon** to reveal its private key
3. Copy the private key
4. In MetaMask → click your avatar → **Import Account** → paste the private key
5. This account is now your **Admin** (it deployed the contract)

---

## Step 4: Run the App

```bash
npm run dev
```

Open your browser to the URL shown (usually `http://localhost:5173` or the express server port).

---

## Step 5: Use the App

1. **Login** with Google (Firebase auth)
2. Click **"Connect MetaMask"** in the top-right header
3. MetaMask will ask you to approve the connection — click **Connect**
4. You're ready! The header will show your wallet address + ETH balance

---

## Troubleshooting

### ❌ "Cannot connect to Ganache"
- Make sure Ganache is **running** before deploying
- Check that it's on port `7545` (see the RPC Server in Ganache UI)

### ❌ "Nonce too high" / Transaction fails
If you restart Ganache, MetaMask's nonce gets out of sync.
- In MetaMask → **Settings** → **Advanced** → **Clear activity tab data**
- Redeploy the contract: `npm run deploy`

### ❌ "Wrong Network" warning in app
- Open MetaMask → click the network dropdown → select **Ganache Local**

### ❌ MetaMask popup doesn't appear
- Check if MetaMask has a pending request (orange badge on the extension)
- Try refreshing the page

### ❌ HTTP/HTTPS mixed content error (if using HTTPS)
If the app is served over HTTPS and Ganache is HTTP:
1. In Chrome/Brave: click the lock icon in address bar
2. Go to **Site settings** → find **Insecure content** → set to **Allow**
3. Refresh the page

---

## How It All Works

```
User logs in with Google         → Firebase Auth (identity)
User clicks "Connect MetaMask"   → MetaMask wallet (blockchain identity)
User votes / nominates           → MetaMask signs a transaction
Transaction sent to Ganache      → Smart contract executes on-chain
Result mirrored to Firestore     → UI updates in real-time
```

The two identities are independent:
- **Firebase** = who you are (email, role, college data)
- **MetaMask** = your blockchain address (signs transactions)
