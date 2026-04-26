import { createWorker } from 'tesseract.js';
import workerPath from 'tesseract.js/dist/worker.min.js?url';
import corePath from 'tesseract.js-core/tesseract-core.wasm.js?url';
export interface OcrResult {
  rawText: string;
  lines: string[];
  confidence: number;
}

export interface ScannedPrescription {
  patient_nom?: string;
  prescripteur_nom?: string;
  date_prescription?: string;
  potential_products: string[];
}

class PrescriptionOcrService {
  private worker: Tesseract.Worker | null = null;
  private isInitializing = false;

  async initialize(onProgress?: (progress: number) => void) {
    if (this.worker) return;
    if (this.isInitializing) return;

    this.isInitializing = true;
    try {
      this.worker = await createWorker('fra', 1, {
        workerBlobURL: false,
        workerPath: workerPath,
        corePath: corePath,
        logger: m => {
          if (m.status === 'recognizing text' && onProgress) {
            onProgress(m.progress);
          }
        },
      });
    } catch (error) {
      console.error('Failed to initialize Tesseract worker:', error);
      this.worker = null;
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  async scanImage(image: File | string): Promise<OcrResult> {
    if (!this.worker) {
      await this.initialize();
    }

    if (!this.worker) throw new Error('Worker not initialized');

    const result = await this.worker.recognize(image);
    
    return {
      rawText: result.data.text,
      lines: result.data.text ? result.data.text.split('\n').map(l => l.trim()).filter(Boolean) : [],
      confidence: result.data.confidence || 0,
    };
  }

  /**
   * Simple heuristics to extract info from prescription text
   */
  parseOcrResult(ocr: OcrResult): ScannedPrescription {
    const lines = ocr.lines;
    const result: ScannedPrescription = {
      potential_products: [],
    };

    // Heuristiques basiques (peuvent être améliorées avec regex)
    lines.forEach(line => {
      const cleanLine = line.trim();
      
      // Détection de dates (ex: 21/04/2024)
      const dateMatch = cleanLine.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
      if (dateMatch && !result.date_prescription) {
        // Tentative de formatage ISO
        try {
            const [_, day, month, year] = dateMatch;
            const fullYear = year.length === 2 ? `20${year}` : year;
            result.date_prescription = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        } catch(e) {}
      }

      // Détection de noms propres potentiels (Dr. X, Patient Y)
      if (cleanLine.toLowerCase().includes('dr') || cleanLine.toLowerCase().includes('docteur')) {
        result.prescripteur_nom = cleanLine;
      } else if (cleanLine.toLowerCase().includes('m.') || cleanLine.toLowerCase().includes('mme') || cleanLine.toLowerCase().includes('monsieur')) {
        result.patient_nom = cleanLine;
      } else if (cleanLine.length > 4 && this.looksLikeProduct(cleanLine)) {
        // Sinon, on considère que c'est une ligne de médicament potentiel
        result.potential_products.push(cleanLine);
      }
    });

    return result;
  }

  private looksLikeProduct(line: string): boolean {
    // Les lignes de produits ont souvent des dosages (mg, ml, g, cp)
    const indicators = ['mg', 'ml', ' g', 'cp', 'gel', 'amp', 'u.i', 'ui', 'cpr', 'flacon'];
    const hasIndicator = indicators.some(ind => line.toLowerCase().includes(ind));
    const isTooLong = line.length > 60;
    const hasTooManyNumbers = (line.match(/\d/g) || []).length > 10; // Probablement pas un nom de produit

    return hasIndicator || (line.length > 5 && !isTooLong && !hasTooManyNumbers);
  }

  async terminate() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}

export const prescriptionOcrService = new PrescriptionOcrService();
