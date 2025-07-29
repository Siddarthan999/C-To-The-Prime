# MCP Server

This repository contains a Model Context Protocol (MCP) implementation. MCP is a protocol designed to facilitate communication between models and tools in a standardized way.

## Getting Started

### Prerequisites

- Visual Studio Code (VS Code) installed on your system.
- Node.js and npm installed.

### Installation

1. Clone this repository:

2. Install dependencies:
   ```bash
   npm install
   ```

### Usage in VS Code

1. Open the project folder in VS Code:
   ```bash
   code .
   ```

2. Ensure the MCP server is running (optional):
   ```bash
   npm start
   ```

3. Build it (Mandatory):
   ```bash
   npx tsc
   ```
   or
   ```bash
   npm run build
   ```

4. Use the MCP features in VSCode with GitHub copilot, e.g., by putting this into `.vscode/mcp.json`
   ```
   {
        "servers": {
            "my-mcp-server-fb6fa47e": {
               "type": "stdio",
               "command": "node",
               "args": [
                  "${workspaceFolder}/dist/index.js"
               ]
            }
        }
    }
   ```

## 📘 Configuration Guide

This guide explains how to configure access credentials for **Bitbucket** and **Google Drive API** in your environment variables or `.env` file.

---

## 🔷 Atlassian (Jira & Confluence) Setup

**To create an API token with scopes:**

- Log in to https://id.atlassian.com/manage-profile/security/api-tokens.

- Select **Create API** token with scopes.

- Give your API token a name that describes its purpose.

- Select an **expiration date** for the API token.

  - Token expiration is 1 to 365 days.

- Select the **app** you’d like the API token to access.

- Select the **scopes** to determine what the API token can do in Jira or Confluence.

- Select **Create**.

- Select **Copy to clipboard**, then paste the token to your script, or save it somewhere safe.

You can't recover the API token after you’re done with this step. We recommend saving your API token in a password manager.

## 🐙 Bitbucket Setup

### ✅ 1. `BITBUCKET_USERNAME`
Your Bitbucket username — **not your email**.

**🔍 How to find it:**
- Go to [Bitbucket Account Settings](https://bitbucket.org/account/settings/)
- Look under **Account Settings → Username**
- Copy the value

---

### ✅ 2. `BITBUCKET_APP_PASSWORD`
A special password used for API access (not your login password).

**🔐 How to create:**
- Go to [App Passwords Settings](https://bitbucket.org/account/settings/app-passwords/)
- Click **Create app password**
- Name it (e.g., `My API Script`)
- Select required permissions:
  - **Read access**: Repositories: Read, Pull requests: Read
  - **Write access**: Repositories: Write, etc.
- Click **Create** and **copy** the password — it won’t be shown again!

---

### ✅ 3. `BITBUCKET_WORKSPACE`
Your workspace ID (often your team name or Bitbucket username).

**🔍 How to find it:**
- Go to [Bitbucket Workspaces](https://bitbucket.org/account/workspaces/)
- Click the relevant workspace
- The workspace ID is the identifier shown in the URL:  
  `https://bitbucket.org/<workspace_id>/`

---

### 🧪 Bitbucket Example

```ini
BITBUCKET_USERNAME=johndoe
BITBUCKET_APP_PASSWORD=abc123yourapppassword
BITBUCKET_WORKSPACE=mycompanyteam
```

## 📂 Google Drive Integration Guide

### ✅ Enable the Google Drive API

**🔗 Quick Link:**  
👉 [Enable Google Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com)

---

### 📌 Step-by-Step Instructions

1. Open the [Google Cloud Console](https://console.cloud.google.com)
2. Select the correct project (top-left corner dropdown)
3. Go to **APIs & Services → Library**
4. Search for **Google Drive API**
5. Click it, then hit **Enable**

---

### ✅ 1. `GOOGLE_CLIENT_EMAIL`

This is the email address of your Google Service Account.

#### 🔧 Steps to get it:

1. Go to the [Google Cloud Console](https://console.cloud.google.com)
2. Select your project (or create a new one)
3. In the left sidebar, go to:  
   **IAM & Admin → Service Accounts**
4. Click **Create Service Account**
5. Name it → click **Create & Continue**
6. Assign roles (e.g., _Editor_ or _Drive API Admin_)
7. Click **Done**
8. Find your service account in the list
9. Click the 3 dots → **Manage Keys** → **Add Key → Create new key**
10. Choose **JSON** → Click **Create**

> 💾 This will download a `.json` file containing your credentials

---

### ✅ 2. `GOOGLE_PRIVATE_KEY`

This is extracted from the same `.json` file.

#### 🔍 How to extract:

Open the JSON file and look for these fields:

```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBgkqhki...\\n-----END PRIVATE KEY-----\\n",
  "client_email": "your-service-account-email@your-project.iam.gserviceaccount.com"
}
```

* GOOGLE_CLIENT_EMAIL → copy the client_email value

* GOOGLE_PRIVATE_KEY → copy the entire private_key string as is, including the \n newline characters.

```ini
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhki...\n-----END PRIVATE KEY-----\n"
```

### ✅ 3. GOOGLE_DRIVE_FOLDER_ID (optional)

This is the **ID of a folder on Google Drive** where files will be accessed or uploaded.

### 🔍 How to find it:

1. Open the folder in Google Drive.

2. Look at the URL:

```ini
https://drive.google.com/drive/u/0/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz
```
3. Copy the long string after /folders/ — that is your GOOGLE_DRIVE_FOLDER_ID.

```ini
GOOGLE_DRIVE_FOLDER_ID=1AbCdEfGhIjKlMnOpQrStUvWxYz
```

## ⚠️ You must share the folder with your service account’s email:

1. Get your client_email from your service account JSON (or your .env):

```ini
your-service-account@your-project.iam.gserviceaccount.com
```

2. Go to:
   * Your Drive Folder
   
   * Click Share.
   
   * Paste the service account email.
   
   * Set as Viewer or Editor (Viewer is enough for reading).
   
   * Click Send.
