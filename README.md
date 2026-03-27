# <img src="public/icons/icon_48.png" width="45" align="left"> GEWU Aide

GEWU Aide is a Chrome extension for Web of Science users. It helps streamline common GEWU workflows on WoS, including query building, batch searching, metadata export, and PDF download support.

## What It Does

- Open a floating Batch Query panel directly on Web of Science pages
- Build and run WoS queries with OpenAI or LM Studio
- Run DOI-based and journal-based lookup workflows
- Export WoS records in TXT or BIB format
- Copy the current WoS SID quickly from the panel header
- Batch download PDFs from DOI lists

## Main Panels

- `Batch Query`
  - `DOI Query`
  - `WOS Data Export`
  - `Journal Query`
  - `WOS Query`
- `PDF Batch Download`

## Requirements

- Google Chrome
- Access to Web of Science
- Optional API access for advanced query features:
  - OpenAI API key
  - LM Studio local endpoint
  - EasyScholar API key

## Development

Install dependencies:

```bash
npm install
```

Start development mode:

```bash
npm run watch
```

Create a production build:

```bash
npm run build
```

The packaged extension files are generated in the [`build`](/Users/iipro/iiworkspace/gewu_chrome_aide/build) directory.

## Install Locally

1. Run `npm run build`
2. Open `chrome://extensions`
3. Enable `Developer mode`
4. Click `Load unpacked`
5. Select the [`build`](/Users/iipro/iiworkspace/gewu_chrome_aide/build) folder

## Notes

- This extension is designed for GEWU-related research workflows on Web of Science.
- API keys are stored locally in Chrome extension storage.
- Some features require the current page to be a valid Web of Science results page.
