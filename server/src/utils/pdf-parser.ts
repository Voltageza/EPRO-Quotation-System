/**
 * Parses solar panel datasheet PDFs (and images) to extract electrical specifications.
 * Uses regex patterns to find common spec formats from various manufacturers.
 *
 * Pipeline:
 *  1. Image file (PNG/JPG) → OCR directly
 *  2. Text PDF (≥50 chars extracted) → regex on text
 *  3. Image-based PDF (<50 chars) → render to images → OCR → regex
 */
import fs from 'fs';
import path from 'path';
import { recognizeImage } from './ocr-worker';
import { pdfToImages } from './pdf-to-images';

// pdf-parse has no types, so we use require
const pdfParse = require('pdf-parse');

export interface ExtractedPanelSpecs {
  power_w: number | null;
  voc: number | null;
  vmp: number | null;
  isc: number | null;
  imp: number | null;
  temp_coeff_voc: number | null;
  width_mm: number | null;
  height_mm: number | null;
  depth_mm: number | null;
  weight_kg: number | null;
  raw_text: string;
  missing_fields: string[];
  extraction_method: 'text' | 'ocr' | 'image-ocr';
}

// ---------------------------------------------------------------------------
// OCR text normalisation — fix common Tesseract misreads
// ---------------------------------------------------------------------------

function normalizeOcrText(text: string): string {
  return text
    // Common letter/digit confusions
    .replace(/(?<=\d)[O]/g, '0')       // 4O.5 → 40.5 (O after digit → 0)
    .replace(/[|](?=\d)/g, '1')        // |3.5 → 13.5 (pipe before digit → 1)
    .replace(/(?<=\d)[|](?=\d)/g, '1') // 4|.5 → 41.5
    .replace(/(?<=\d)[l](?=\d)/g, '1') // 4l.5 → 41.5 (lowercase L between digits)
    .replace(/[Il](?=sc|mp|pp)/g, 'I') // lsc → Isc, lmp → Imp
    .replace(/[0O](?=pen|Circuit)/gi, 'O') // 0pen Circuit → Open Circuit
    // Normalise special characters
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ');
}

// ---------------------------------------------------------------------------
// Regex extraction (pure function, works on any text)
// ---------------------------------------------------------------------------

function extractNumber(text: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const val = parseFloat(match[1]);
      if (!isNaN(val)) return val;
    }
  }
  return null;
}

function extractSpecsFromText(text: string, method: 'text' | 'ocr' | 'image-ocr'): ExtractedPanelSpecs {
  // ---------- Power (Pmax) ----------
  const power_w = extractNumber(text, [
    // Table format: "Pmax) [W] 585" or "(Pmax) [W] 585"
    /(?:Pmax|Pmpp)\)?\s*\[W\]\s*(\d+(?:\.\d+)?)/i,
    // Table format: "Rated Maximum Power(Pmax) [W] 585"
    /(?:Maximum|Rated|Nominal)\s*(?:Max\s*)?Power[^[]*\[W\]\s*(\d+(?:\.\d+)?)/i,
    // Standard text: "Pmax: 585 W" or "Maximum Power: 585W"
    /(?:Pmax|Pmpp|Maximum\s*Power|Rated\s*Power|Nominal\s*Power)[:\s]*(\d+(?:\.\d+)?)\s*W/i,
    // Fallback: 3-4 digit number + W, but NOT "W/m" (STC irradiance 1000W/m²)
    /(\d{3,4})\s*W[p]?\b(?!\/)/i,
  ]);

  // ---------- Voc ----------
  const voc = extractNumber(text, [
    // Table format: "Voc) [V] 53.20"
    /\bVoc\)?\s*\[V\]\s*(\d+(?:\.\d+)?)/i,
    // Standard text: "Voc: 53.20 V"
    /(?:Voc|Open[\s-]*Circuit[\s-]*Voltage)[:\s]*(\d+(?:\.\d+)?)\s*V/i,
    // Fallback with bounded gap (max 30 chars, prevents cross-document matches)
    /\bVoc\b[^0-9]{0,30}(\d+(?:\.\d+)?)/i,
  ]);

  // ---------- Vmp ----------
  const vmp = extractNumber(text, [
    // Table format: "Vmp) [V] 44.56"
    /\bVmp[p]?\)?\s*\[V\]\s*(\d+(?:\.\d+)?)/i,
    // Standard text: "Vmp: 44.56 V"
    /(?:Vmp|Vmpp|Voltage\s*at\s*(?:Max|Maximum)\s*Power)[:\s]*(\d+(?:\.\d+)?)\s*V/i,
    // Fallback with bounded gap
    /\bVmp[p]?\b[^0-9]{0,30}(\d+(?:\.\d+)?)/i,
  ]);

  // ---------- Isc ----------
  const isc = extractNumber(text, [
    // Table format: "Isc) [A] 13.88"
    /\bIsc\)?\s*\[A\]\s*(\d+(?:\.\d+)?)/i,
    // Standard text: "Isc: 13.88 A"
    /(?:Isc|Short[\s-]*Circuit[\s-]*Current)[:\s]*(\d+(?:\.\d+)?)\s*A/i,
    // Fallback with bounded gap
    /\bIsc\b[^0-9]{0,30}(\d+(?:\.\d+)?)/i,
  ]);

  // ---------- Imp ----------
  // NOTE: \bImp\b prevents matching "imp" inside "improved" (which caused
  //       false matches like "12" from "12-year warranty" hundreds of chars away)
  const imp = extractNumber(text, [
    // Table format: "imp) [A] 13.13" or "(Imp) [A] 13.13"
    /\bImp[p]?\)?\s*\[A\]\s*(\d+(?:\.\d+)?)/i,
    // Long label: "Maximum Power Current(imp) [A] 13.13"
    /(?:Maximum\s*Power\s*Current|Current\s*at\s*(?:Max|Maximum)\s*Power)[^[]*\[A\]\s*(\d+(?:\.\d+)?)/i,
    // Standard text: "Imp: 13.13 A"
    /(?:Imp|Impp|Current\s*at\s*(?:Max|Maximum)\s*Power)[:\s]*(\d+(?:\.\d+)?)\s*A/i,
    // Fallback with word boundary + bounded gap (max 30 chars)
    /\bImp[p]?\b[^0-9]{0,30}(\d+(?:\.\d+)?)/i,
  ]);

  // ---------- Temperature coefficient of Voc (%/°C) ----------
  let temp_coeff_voc = extractNumber(text, [
    // Standard: "Temperature Coefficient of Voc: -0.275%/°C"
    /(?:Temp(?:erature)?\s*Coeff(?:icient)?\s*(?:of\s*)?Voc)[:\s]*([-]?\d+(?:\.\d+)?)\s*%/i,
    // With parenthetical: "Coefficient of Voc(B_Voc) -0.275%" or "Voc(β_Voc) -0.275%"
    /Voc\s*\([^)]*\)\s*([-]?\d+(?:\.\d+)?)\s*%/i,
    // Greek beta label: "β_Voc: -0.275%"
    /(?:β|βVoc|B_Voc|β_Voc|Voc\s*temp)[:\s)\]]*?([-]?\d+(?:\.\d+)?)\s*%/i,
    // Standard with slash: "Voc ... -0.275 %/°C"
    /Voc[^)]*?([-]?\d+\.\d+)\s*%\s*\/\s*°?C/i,
  ]);

  // Post-process OCR-mangled temp coefficient:
  //   OCR often drops the minus sign and/or decimal point from "-0.275"
  //   e.g. "B_Voc) 0275%°C" → parsed as 275, should be -0.275
  if (temp_coeff_voc === null || temp_coeff_voc > 1) {
    const ocrMatch = text.match(/(?:B_Voc|β_?Voc|Coefficient\s*of\s*Voc)\s*\)?\s*[-]?(\d{3,4})\s*%/i);
    if (ocrMatch) {
      // "0275" → 275 → 0.275 → -0.275
      const raw = parseInt(ocrMatch[1], 10);
      temp_coeff_voc = -(raw / 1000);
    }
  }
  // Voc temp coefficient is always negative (silicon physics) — fix sign if positive
  if (temp_coeff_voc !== null && temp_coeff_voc > 0 && temp_coeff_voc < 1) {
    temp_coeff_voc = -temp_coeff_voc;
  }

  // ---------- Dimensions ----------
  // Try "Dimensions" section first — handles OCR-garbled formats like "248582mme13452mme3sEImm"
  // (OCR merges digits and mangles × separators between L×W×D)
  // Pattern absorbs 0-2 extra junk digits before each "mm" anchor, \w? eats OCR'd "×"
  const dimMatch = text.match(
    /Dimensions\s*[:\s]*(\d{3,4})\d{0,2}\s*mm\s*\w?\s*(\d{3,4})\d{0,2}\s*mm(?:\s*\w?\s*(\d{2,3})\d{0,1}\s*mm)?/i
  );

  let width_mm: number | null = null;
  let height_mm: number | null = null;
  let depth_mm: number | null = null;

  if (dimMatch) {
    // Dimensions are usually L × W × D; length > width
    const d1 = parseInt(dimMatch[1], 10);
    const d2 = parseInt(dimMatch[2], 10);
    height_mm = Math.max(d1, d2);
    width_mm = Math.min(d1, d2);
    if (dimMatch[3]) depth_mm = parseInt(dimMatch[3], 10);
  }

  // Fall back to individual labelled patterns (text PDFs)
  if (width_mm === null) {
    width_mm = extractNumber(text, [
      /(?:Width)\s*[:\s]*(\d{3,4})\s*mm/i,
      /(\d{3,4})\s*[x×]\s*\d{3,4}\s*[x×]\s*\d{2,3}\s*mm/i,
    ]);
  }
  if (height_mm === null) {
    height_mm = extractNumber(text, [
      /(?:Height|Length)\s*[:\s]*(\d{3,4})\s*mm/i,
      /\d{3,4}\s*[x×]\s*(\d{3,4})\s*[x×]\s*\d{2,3}\s*mm/i,
    ]);
  }
  if (depth_mm === null) {
    depth_mm = extractNumber(text, [
      /(?:Depth|Thickness)\s*[:\s]*(\d{2,3})\s*mm/i,
      /\d{3,4}\s*[x×]\s*\d{3,4}\s*[x×]\s*(\d{2,3})\s*mm/i,
    ]);
  }

  // ---------- Weight ----------
  const weight_kg = extractNumber(text, [
    /(?:Weight)\s*[:\s]*(\d+(?:\.\d+)?)\s*kg/i,
    /(\d+(?:\.\d+)?)\s*kg/i,
  ]);

  // Determine missing fields
  const missing_fields: string[] = [];
  if (power_w === null) missing_fields.push('power_w');
  if (voc === null) missing_fields.push('voc');
  if (vmp === null) missing_fields.push('vmp');
  if (isc === null) missing_fields.push('isc');
  if (imp === null) missing_fields.push('imp');
  if (temp_coeff_voc === null) missing_fields.push('temp_coeff_voc');

  return {
    power_w, voc, vmp, isc, imp, temp_coeff_voc,
    width_mm, height_mm, depth_mm, weight_kg,
    raw_text: text.substring(0, 5000),
    missing_fields,
    extraction_method: method,
  };
}

// ---------------------------------------------------------------------------
// OCR helpers
// ---------------------------------------------------------------------------

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg']);

function isImageFile(filePath: string): boolean {
  return IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

/**
 * OCR a single image buffer and return the recognised text.
 */
async function ocrImageBuffer(buffer: Buffer): Promise<string> {
  return recognizeImage(buffer);
}

/**
 * Render a PDF to images, OCR each page, and concatenate the text.
 */
async function ocrPdfFallback(pdfBuffer: Buffer): Promise<string> {
  console.log('  [OCR] PDF has no selectable text — falling back to OCR…');
  const pages = await pdfToImages(pdfBuffer);
  console.log(`  [OCR] Rendered ${pages.length} page(s) to images`);

  const texts: string[] = [];
  for (const page of pages) {
    const pageText = await ocrImageBuffer(page.buffer);
    if (pageText.trim()) {
      texts.push(pageText);
    }
  }

  const combined = texts.join('\n');
  console.log(`  [OCR] Extracted ${combined.length} characters via OCR`);
  return combined;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

const MIN_TEXT_CHARS = 50;

/**
 * Parse a panel datasheet file (PDF or image) and extract electrical specs.
 *
 * Pipeline:
 *  - Image file → OCR directly → regex
 *  - Text PDF (≥50 chars) → regex on extracted text
 *  - Image-based PDF (<50 chars) → render pages → OCR → regex
 */
export async function parsePanelDatasheet(filePath: string): Promise<ExtractedPanelSpecs> {
  const buffer = fs.readFileSync(filePath);

  // ---- Path 1: Direct image upload ----
  if (isImageFile(filePath)) {
    console.log('  [Parser] Image file detected — using OCR');
    const rawText = await ocrImageBuffer(buffer);
    const normalized = normalizeOcrText(rawText);
    return extractSpecsFromText(normalized, 'image-ocr');
  }

  // ---- Path 2 & 3: PDF file ----
  const data = await pdfParse(buffer);
  const pdfText: string = data.text || '';

  if (pdfText.trim().length >= MIN_TEXT_CHARS) {
    // Path 2: Text-based PDF
    console.log(`  [Parser] Text PDF — ${pdfText.trim().length} chars extracted`);
    return extractSpecsFromText(pdfText, 'text');
  }

  // Path 3: Image-based PDF — fall back to OCR
  const ocrText = await ocrPdfFallback(buffer);
  const normalized = normalizeOcrText(ocrText);
  return extractSpecsFromText(normalized, 'ocr');
}
