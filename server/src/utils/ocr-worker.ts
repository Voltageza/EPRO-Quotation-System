/**
 * Singleton Tesseract.js OCR worker manager.
 * Lazily initialises on first OCR request and reuses the worker across calls.
 * Thread-safe: concurrent callers share the same init promise.
 */
import Tesseract from 'tesseract.js';

let worker: Tesseract.Worker | null = null;
let initPromise: Promise<Tesseract.Worker> | null = null;

async function getWorker(): Promise<Tesseract.Worker> {
  if (worker) return worker;

  // If another caller is already initialising, wait for that
  if (initPromise) return initPromise;

  initPromise = (async () => {
    console.log('  [OCR] Initialising Tesseract worker (first use)…');
    const w = await Tesseract.createWorker('eng');
    worker = w;
    console.log('  [OCR] Worker ready');
    return w;
  })();

  return initPromise;
}

/**
 * Run OCR on an image buffer and return the extracted text.
 */
export async function recognizeImage(imageBuffer: Buffer): Promise<string> {
  const w = await getWorker();
  const { data } = await w.recognize(imageBuffer);
  return data.text;
}

/**
 * Terminate the OCR worker (call on server shutdown).
 */
export async function terminateOcrWorker(): Promise<void> {
  if (worker) {
    await worker.terminate();
    worker = null;
    initPromise = null;
    console.log('  [OCR] Worker terminated');
  }
}
