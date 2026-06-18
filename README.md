# BigQuery Release Hub

A premium, interactive web dashboard built with **Python Flask** and plain vanilla **HTML**, **JavaScript (ES6)**, and **CSS**. It fetches, caches, structures, and displays the latest release notes from the Google Cloud BigQuery RSS feed, and integrates a simulated Twitter/X post editor for easy social sharing.

---

## ✨ Features

- **Granular Update Parsing:** Splits combined daily release logs into individual update cards (e.g., separating Features, Announcements, and Deprecations) so you can review and share specific updates.
- **In-Memory Caching:** Includes a smart 5-minute memory cache (TTL) in Flask to avoid rate-limits and optimize load times, with manual force-refresh capabilities.
- **Vibrant Dark Mode Theme:** Clean slate/dark theme designed with modern typography (Plus Jakarta Sans & JetBrains Mono), visual glow effects, custom scrollbars, and hover animations.
- **Live Search with Highlighting:** Dynamically filters feed cards as you type, highlighting query terms inside headings, bodies, and dates.
- **Category Navigation Filters:** Clickable tags to filter notes instantly by Features, Announcements, Deprecations, or Other changes.
- **Integrated Twitter/X Composer Panel:**
  - High-fidelity simulated Twitter post editor card.
  - Character counter that calculates length accurately (accounting for X's 23-character URL rules).
  - One-tap hashtag recommendations.
  - Direct Web Intent posting (`https://twitter.com/intent/tweet?text=...`) and quick copy-to-clipboard shortcut.

---

## 🛠️ Tech Stack

- **Backend:** Python 3.x, Flask
- **Frontend:** Vanilla HTML5, CSS3, JavaScript (ES6)
- **Icons & Fonts:** FontAwesome 6, Google Fonts (Plus Jakarta Sans, JetBrains Mono)
- **Feeds Source:** Google Cloud BigQuery Release Notes RSS/Atom Feed

---

## 🚀 Getting Started

### Prerequisites
Make sure you have Python 3 installed on your machine.

### 1. Clone & Navigate
Navigate to the directory containing this project:
```bash
cd bigquery-release-notes
```

### 2. Install Dependencies
Install Flask using `pip`:
```bash
pip install flask
```

### 3. Run the Server
Launch the Flask development server:
```bash
python app.py
```

By default, the server runs on:
👉 **[http://127.0.0.1:5000](http://127.0.0.1:5000)**

---

## 📂 Project Structure

```text
bigquery-release-notes/
│
├── app.py                 # Flask backend, XML parsing & cache controller
├── .gitignore             # Git ignore file for Python & Flask
├── README.md              # Project documentation (this file)
│
├── templates/
│   └── index.html         # Main dashboard HTML template
│
└── static/
    ├── css/
    │   └── style.css      # Custom HSL design tokens, themes & animations
    └── js/
        └── app.js         # State, search, filtering & social compose logic
```

---

## 🤝 Social Sharing Integration details

Twitter/X counts all web links as exactly **23 characters** inside a tweet body due to its `t.co` link-wrapper. The client-side JavaScript (`app.js`) handles this calculation:

```javascript
let currentLength = text.length;
const urlRegex = /(https?:\/\/[^\s]+)/g;
const urls = text.match(urlRegex) || [];

urls.forEach(url => {
    currentLength = currentLength - url.length + 23;
});
const remaining = 280 - currentLength;
```

This ensures that the live character counter and progress ring circle exactly match the rules on Twitter, preventing "tweet too long" errors upon redirecting.

---

## 📄 License
This project is licensed under the MIT License.
