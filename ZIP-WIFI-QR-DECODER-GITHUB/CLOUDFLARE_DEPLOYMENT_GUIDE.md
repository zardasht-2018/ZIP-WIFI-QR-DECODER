# Cloudflare Pages Deployment Guide — `ZIP-WIFI-QR-DECODER`

This guide walks you step-by-step through deploying **ZIP WiFi QR Decoder** to **Cloudflare Pages** using **GitHub Integration** (`GitHub Repository → Cloudflare Pages → Automatic Deployment`) so that every future update you make on GitHub automatically rebuilds and updates your live HTTPS website.

## Required Cloudflare Pages Build Summary

| Configuration Field | Required Value |
| :--- | :--- |
| **Deployment Method** | Connect to Git (GitHub Integration) |
| **Repository** | `ZIP-WIFI-QR-DECODER` |
| **Production branch** | `main` |
| **Framework preset** | `Vite` |
| **Build command** | `npm run build` |
| **Build output directory** | `dist` |
| **Root directory** | `/` *(default)* |

## Step-by-Step Deployment Instructions

### 1. Create or Sign In to Your Cloudflare Account
1. Open [https://dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up) (or [https://dash.cloudflare.com/login](https://dash.cloudflare.com/login) if you already have an account).
2. Verify your email address and open the main Cloudflare Dashboard.

### 2. Navigate to Workers & Pages and Connect GitHub
1. In the left sidebar of the Cloudflare Dashboard, click **Workers & Pages** (or **Compute (Workers) → Workers & Pages**).
2. Click the blue **Create** button in the top-right corner.
3. Select the **Pages** tab at the top of the creation screen.
4. Under **Import an existing Git repository**, click **Connect to Git**.

### 3. Authorize Cloudflare to Access Your GitHub Repository
1. Select the **GitHub** tab and click **Connect GitHub**.
2. Sign in to your GitHub account if prompted.
3. Choose **Only select repositories** (recommended for least-privilege security) and select **`ZIP-WIFI-QR-DECODER`** from the dropdown list, or select **All repositories** if preferred.
4. Click **Install & Authorize** to return to Cloudflare Pages.

### 4. Select the `ZIP-WIFI-QR-DECODER` Repository
1. Under **Select a repository**, click on **`ZIP-WIFI-QR-DECODER`**.
2. Click **Begin setup**.

### 5. Select `Vite` as the Framework Preset
1. In the **Set up builds and deployments** form, keep **Project name** as `zip-wifi-qr-decoder` (this determines your `.pages.dev` subdomain).
2. Open the **Framework preset** dropdown and select **`Vite`**.

### 6. Set `npm run build` as the Build Command
1. Confirm that the **Build command** field is set to:
   ```text
   npm run build
   ```

### 7. Set `dist` as the Build Output Directory
1. Confirm that the **Build output directory** field is set to:
   ```text
   dist
   ```

### 8. Select `main` as the Production Branch
1. Confirm that **Production branch** is set to:
   ```text
   main
   ```
2. Leave **Root directory (advanced)** as `/` (empty/default) because `package.json` is located directly at the repository root.
3. You do not need to add any secret environment variables (`NODE_VERSION` defaults to Node 18+ on Cloudflare Pages v2 build image).

### 9. Start the First Deployment
1. Click **Save and Deploy**.
2. Cloudflare Pages will clone your `ZIP-WIFI-QR-DECODER` repository, run `npm install`, execute `npm run build`, and publish the generated `dist/` directory to Cloudflare's global edge network (typically takes 45–90 seconds).

### 10. Find Your Public `.pages.dev` Website Address
1. Once the build log shows **Success! Your site is live!**, look at the top of the deployment card.
2. Your public HTTPS URL will be displayed in the format:
   ```text
   https://zip-wifi-qr-decoder.pages.dev
   ```
   *(or `https://zip-wifi-qr-decoder-<random>.pages.dev` if the base subdomain is already taken).*

### 11. Test the Application on iPhone (iOS Safari)
1. Open **Safari** on your iPhone and visit your `https://...pages.dev` URL.
2. Verify that the application opens directly to the clean **Home** screen showing **SCAN QR CODE**, **UPLOAD QR IMAGE**, and **PASTE QR CONTENT**.
3. Tap **UPLOAD QR IMAGE**, choose a Wi-Fi QR code screenshot from your iPhone Photos library, and confirm that the **Results** page immediately reveals the extracted **Wi-Fi Password**, **SSID**, **Security Type**, and **Hidden Network Status**.
4. *(Optional PWA Installation)*: Tap the **Share** button in Safari and select **Add to Home Screen** to install **ZIP WiFi QR Decoder** as a standalone app icon on your iPhone.

### 12. Test Live Camera Access Over HTTPS
1. Because Cloudflare Pages serves your site over **`https://`** with a valid TLS certificate and `public/_headers` includes `Permissions-Policy: camera=(self)`, live camera access is enabled on supported mobile and desktop browsers.
2. Tap **SCAN QR CODE** on your iPhone, Android phone, or laptop.
3. When the browser prompts *"Would Like to Access the Camera"*, tap **Allow**.
4. Point the rear camera at a Wi-Fi QR code (for example, on another phone screen or router label) and verify that the scanner automatically detects the QR code, stops the camera stream, and opens the **Results** page with the extracted password.

### 13. Update the GitHub Repository
1. Whenever you want to edit code or styles, open `https://github.com/<your-username>/ZIP-WIFI-QR-DECODER` in your browser.
2. Navigate to any file (or click **Add file → Upload files** to replace updated files) and commit your changes to the `main` branch.

### 14. Understand Automatic Cloudflare Deployments
1. Every commit pushed or uploaded to the **`main`** branch on GitHub automatically triggers a new **Production Deployment** on Cloudflare Pages within seconds.
2. Commits pushed to any non-`main` branch (or Pull Requests) automatically generate isolated **Preview Deployments** (`https://<hash>.zip-wifi-qr-decoder.pages.dev`) so you can test changes before merging to `main`.

### 15. Troubleshooting Failed Deployments

| Symptom / Error in Build Log | Cause & Resolution |
| :--- | :--- |
| **`ENOENT: no such file or directory, open '.../package.json'`** | The files were uploaded inside a nested subfolder (e.g. `ZIP-WIFI-QR-DECODER/package.json`). Either move `package.json` to the repository root `/` on GitHub, or set **Root directory** in Cloudflare Pages Settings → Builds & deployments to the subfolder name. |
| **`Output directory "dist" not found`** | Check **Settings → Builds & deployments** in Cloudflare Pages and ensure **Build command** is `npm run build` and **Build output directory** is `dist` (no leading slash). |
| **Camera says "Camera access requires HTTPS"** | Make sure you are opening the `https://...pages.dev` address rather than an unencrypted `http://` LAN IP address. |
| **Camera says "Permission denied"** | Tap the site icon (lock or settings icon) in your browser address bar, reset Camera permission to **Allow**, and tap **Retry Camera** inside the Scanner page. |

### Backup Option: Direct Upload of `ZIP-WIFI-QR-DECODER-CLOUDFLARE.zip`
While GitHub integration is the primary deployment method for automatic updates, you also have **`ZIP-WIFI-QR-DECODER-CLOUDFLARE.zip`** (which contains the pre-built production `dist/` contents with `index.html` at the ZIP root) as an instant offline backup or for manual drag-and-drop testing in Cloudflare Pages.
