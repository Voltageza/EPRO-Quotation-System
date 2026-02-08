/**
 * Converts PDF pages to PNG image buffers using pdftoimg-js.
 * Limited to first 4 pages (panel specs are always on pages 1-2).
 */
import { pdfToImg } from 'pdftoimg-js';

export interface PageImage {
  pageNumber: number;
  buffer: Buffer;
}

/**
 * Render a PDF buffer to an array of PNG image buffers.
 * pdfToImg accepts a TypedArray and returns base64-encoded PNG strings.
 * We convert those to Buffers for downstream OCR.
 *
 * @param pdfBuffer  The raw PDF file bytes
 * @param maxPages   Maximum pages to render (default 4)
 */
export async function pdfToImages(pdfBuffer: Buffer, maxPages = 4): Promise<PageImage[]> {
  const uint8 = new Uint8Array(pdfBuffer);
  const base64Images = await pdfToImg(uint8, {
    scale: 2.0,
    imgType: 'png',
    pages: 'all',
  });

  // pdfToImg returns string[] when pages is 'all'
  const images = (Array.isArray(base64Images) ? base64Images : [base64Images]).slice(0, maxPages);

  return images.map((dataUri, i) => {
    // pdfToImg returns data URIs like "data:image/png;base64,iVBOR..."
    const base64 = dataUri.replace(/^data:image\/\w+;base64,/, '');
    return {
      pageNumber: i + 1,
      buffer: Buffer.from(base64, 'base64'),
    };
  });
}
