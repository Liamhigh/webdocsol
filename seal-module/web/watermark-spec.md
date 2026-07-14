# Watermark Specification

## Image
- File: `watermark_portrait.png`
- Dimensions: 927 x 1200 pixels
- Format: PNG with transparency (RGBA)
- Aspect ratio: 0.7725 (portrait)

## Application
- Drawn as full-page background on every page
- Opacity: 20% (0.20)
- Scale: cover entire page (max of width/height ratios)
- Centred on page

## Content Scaling
- Original PDF content drawn at 88% of page size
- Centred on page: margin = (100% - 88%) / 2 = 6% each side
- Ensures no content overlaps watermark or QR code

## QR Code Position
- Size: 10% of min(page width, page height)
- Margin from top-right corner: 2.5% of min dimension
- NO border drawn around QR
- NO white rectangle behind QR
- QR PNG has built-in white quiet zone

## Footer
- Dark bar at bottom: 85% opacity
- Gold text: seal type label
- Blue text: Seal ID, SHA-512 prefix, timestamp, page numbers
- Grey text: verumglobal.foundation | OpenTimestamps | Patent Pending
