import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, Upload, Trash2, Search, Check, RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import PremiumModal from '../common/PremiumModal';
import { prescriptionOcrService } from '../../services/prescriptionOcrService';
import type { ScannedPrescription } from '../../services/prescriptionOcrService';
import fuzzysort from 'fuzzysort';
import api from '../../services/api';
import { toast } from 'react-hot-toast';
import type { ProduitModel } from '../../types';

interface PrescriptionScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddProducts: (products: ProduitModel[]) => void;
  onExtractionDone: (data: Partial<ScannedPrescription> & { imageFile?: File }) => void;
}

interface MatchResult {
  ocrLine: string;
  matchedProduct: ProduitModel | null;
  score: number;
  suggestions: ProduitModel[];
}

const PrescriptionScannerModal: React.FC<PrescriptionScannerModalProps> = ({ 
  isOpen, 
  onClose, 
  onAddProducts,
  onExtractionDone 
}) => {
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [products, setProducts] = useState<ProduitModel[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [extractionData, setExtractionData] = useState<ScannedPrescription | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showCamera, setShowCamera] = useState(false);

  // Load products for fuzzy matching when modal opens
  useEffect(() => {
    if (isOpen && products.length === 0) {
      loadProducts();
    }
  }, [isOpen]);

  const loadProducts = async () => {
    setLoadingProducts(true);
    try {
      const response = await api.get('produits/', { params: { page_size: 10000 } });
      const results = Array.isArray(response.data) ? response.data : response.data.results;
      setProducts(results || []);
    } catch (err) {
      console.error('Failed to load products for OCR matching', err);
      toast.error('Erreur lors du chargement de la base produit');
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage(file);
      setPreview(URL.createObjectURL(file));
      setMatchResults([]);
      setShowCamera(false);
    }
  };

  const startCamera = async () => {
    setShowCamera(true);
    setPreview(null);
    setImage(null);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }
    } catch (err) {
      toast.error('Impossible d\'accéder à la caméra');
      setShowCamera(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' });
            setImage(file);
            setPreview(URL.createObjectURL(file));
            stopCamera();
          }
        }, 'image/jpeg', 0.9);
      }
    }
  };

  const processOcr = async () => {
    if (!image) return;

    setIsProcessing(true);
    setProgress(0);
    try {
      const result = await prescriptionOcrService.scanImage(image);
      const extracted = prescriptionOcrService.parseOcrResult(result);
      setExtractionData(extracted);

      // Fuzzy match products using fuzzysort (optimized)
      const matches: MatchResult[] = extracted.potential_products.map(ocrLine => {
        const cleanQuery = ocrLine
          .replace(/\b(boite|boites|comprimé|comprimés|cpr|gelules|sirop|ampoules|matin|midi|soir|posologie|ordonnance|qsp|jours|mois|de|la|le|les|des|un|une|et|a|au|dr|docteur)\b/gi, '')
          .replace(/[^\w\s]/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        const query = cleanQuery.length > 2 ? cleanQuery : ocrLine;

        // Utiliser fuzzysort pour un matching rapide et précis
        const results = fuzzysort.go(query, products, {
          key: 'name',
          limit: 3,
          threshold: -10000, // Ajuster si besoin pour être plus ou moins permissif
        });

        const topResults = results.map(r => r.obj);

        return {
          ocrLine,
          matchedProduct: topResults[0] || null,
          score: results[0] ? results[0].score : 0,
          suggestions: topResults,
        };
      });

      // Garder les lignes qui ont au moins une suggestion (laisser l'utilisateur juger)
      setMatchResults(matches.filter(m => m.suggestions.length > 0));
      
      if (matches.length === 0) {
        toast.error('Aucun produit reconnu sur l\'ordonnance');
      }
    } catch (err: any) {
      console.error('OCR Error:', err);
      const errorMessage = err && typeof err === 'object' && 'message' in err ? err.message : 'Détails dans la console (possible blocage antivirus)';
      toast.error(`Erreur lors du traitement OCR: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectProduct = (index: number, product: ProduitModel) => {
    const updated = [...matchResults];
    updated[index].matchedProduct = product;
    setMatchResults(updated);
  };

  const handleToggleProduct = (index: number) => {
      const updated = [...matchResults];
      if (updated[index].matchedProduct) {
          updated[index].matchedProduct = null;
      } else if (updated[index].suggestions.length > 0) {
          updated[index].matchedProduct = updated[index].suggestions[0];
      }
      setMatchResults(updated);
  }

  const validateScan = () => {
    const selectedProducts = matchResults
      .map(m => m.matchedProduct)
      .filter((p): p is ProduitModel => p !== null);

    onAddProducts(selectedProducts);
    
    if (extractionData) {
        onExtractionDone({
            ...extractionData,
            imageFile: image || undefined
        });
    }
    
    onClose();
    toast.success(`${selectedProducts.length} produits ajoutés`);
  };

  const reset = () => {
    setImage(null);
    setPreview(null);
    setMatchResults([]);
    setExtractionData(null);
    stopCamera();
  };

  return (
    <PremiumModal
      isOpen={isOpen}
      onClose={onClose}
      title="Scanner Ordonnance"
      subtitle="Capturez une photo pour extraction automatique avec OCR"
      icon={<Camera className="size-5 text-emerald-600" />}
      maxWidth="max-w-4xl"
    >
      <div className="flex flex-col h-[70vh]">

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">

            {/* Left Column: Image Source */}
            <div className="flex flex-col gap-4">
              {!preview && !showCamera && (
                <div
                  className="flex-1 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-4 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="p-4 bg-emerald-50 rounded-full text-emerald-600">
                    <Upload className="size-8" />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-slate-800">Glissez une image ici</p>
                    <p className="text-sm text-slate-400">Ou cliquez pour parcourir</p>
                  </div>
                  <button
                    className="inline-flex items-center justify-center h-8 px-4 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                    onClick={(e) => { e.stopPropagation(); startCamera(); }}
                  >
                    <Camera className="size-4 mr-2" />
                    Utiliser la caméra
                  </button>
                </div>
              )}

              {showCamera && (
                <div className="relative flex-1 bg-gray-950 rounded-2xl overflow-hidden shadow-xl">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="size-full object-cover"
                  />
                  <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-3">
                    <button className="inline-flex items-center justify-center size-14 rounded-full bg-emerald-600 text-white shadow-lg hover:bg-emerald-700 transition-colors" onClick={capturePhoto}>
                      <div className="size-4 rounded-full border-2 border-white" />
                    </button>
                    <button className="inline-flex items-center justify-center size-12 rounded-full bg-white/10 backdrop-blur-md text-white hover:bg-white/20 transition-colors" onClick={stopCamera}>
                      <Trash2 className="size-5" />
                    </button>
                  </div>
                </div>
              )}

              {preview && (
                <div className="relative flex-1 rounded-2xl overflow-hidden group shadow-lg bg-slate-200">
                  <img src={preview} alt="Scan preview" className="size-full object-contain" />
                  <div className="absolute top-4 right-4 flex gap-2">
                    <button className="inline-flex items-center justify-center size-9 rounded-full bg-red-600 text-white shadow-lg hover:bg-red-700 transition-colors" onClick={reset}>
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  {!isProcessing && matchResults.length === 0 && (
                    <div className="absolute bottom-6 left-0 right-0 flex justify-center">
                      <button
                        className="inline-flex items-center justify-center h-10 px-8 rounded-xl text-sm font-semibold bg-emerald-600 text-white shadow-lg hover:bg-emerald-700 transition-colors"
                        onClick={processOcr}
                        disabled={loadingProducts}
                      >
                        {loadingProducts ? <Loader2 className="size-4 animate-spin mr-2" /> : <RefreshCw className="size-4 mr-2" />}
                        Lancer l'analyse OCR
                      </button>
                    </div>
                  )}
                </div>
              )}

              {isProcessing && (
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
                    <span>Traitement OCR en cours...</span>
                    <span>{Math.round(progress * 100)}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-600 rounded-full transition-all" style={{ width: `${progress * 100}%` }}></div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: OCR Results */}
            <div className="flex flex-col bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-100/80 backdrop-blur-sm flex justify-between items-center">
                    <h3 className="font-bold flex items-center gap-2 text-slate-800">
                        <Search className="size-4 text-emerald-600" />
                        Médicaments identifiés
                    </h3>
                    <span className="inline-flex items-center px-2.5 h-6 text-xs rounded-full bg-slate-200 text-slate-700 font-medium">{matchResults.filter(r => r.matchedProduct).length} reconnus</span>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {matchResults.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 italic">
                      <AlertCircle className="size-12 mb-4 stroke-1" />
                      <p>Les produits détectés apparaîtront ici après l'analyse.</p>
                    </div>
                  ) : (
                    matchResults.map((result, idx) => (
                      <div key={idx} className={`p-3 rounded-xl border transition-all ${result.matchedProduct ? 'bg-emerald-50/50 border-emerald-200' : 'bg-white border-slate-100'}`}>
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Lu sur l'ordonnance :</span>
                          {result.matchedProduct && <Check className="size-4 text-emerald-600" />}
                        </div>
                        <p className="font-medium text-sm mb-2 text-slate-800">{result.ocrLine}</p>

                        <div className="space-y-1">
                          {result.suggestions.map((product, sIdx) => (
                            <button
                                key={product.id}
                                className={`w-full text-left p-2 rounded-lg text-xs flex justify-between items-center transition-colors ${result.matchedProduct?.id === product.id ? 'bg-emerald-600 text-white' : 'hover:bg-slate-100 bg-slate-50'}`}
                                onClick={() => handleSelectProduct(idx, product)}
                            >
                                <span className="truncate flex-1 font-bold">{product.name}</span>
                                <span className="ml-2 text-[10px] text-slate-400">{product.selling_price} F</span>
                            </button>
                          ))}

                          {result.suggestions.length === 0 && (
                              <p className="text-[10px] text-red-600 flex items-center gap-1 py-1">
                                  <AlertCircle className="size-3" />
                                  Aucune correspondance trouvée
                              </p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-100/80 backdrop-blur-md border-t border-slate-100 flex justify-between items-center">
            <div className="text-xs text-slate-400">
                {extractionData && (
                    <div className="flex gap-4">
                        <span className="flex items-center gap-1"><Check className="size-3 text-emerald-600" /> Patient détecté</span>
                        <span className="flex items-center gap-1"><Check className="size-3 text-emerald-600" /> Médecin détecté</span>
                    </div>
                )}
            </div>
            <div className="flex gap-3">
                <button className="inline-flex items-center justify-center h-9 px-4 rounded-xl text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors" onClick={onClose}>Annuler</button>
                <button
                  className="inline-flex items-center justify-center h-9 px-8 rounded-xl text-sm font-semibold bg-emerald-600 text-white shadow-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={matchResults.filter(r => r.matchedProduct).length === 0 || isProcessing}
                  onClick={validateScan}
                >
                  <Check className="size-4 mr-2" />
                  Valider et ajouter
                </button>
            </div>
        </div>
      </div>

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/*" 
        className="hidden" 
      />
      <canvas ref={canvasRef} className="hidden" />
    </PremiumModal>
  );
};

export default PrescriptionScannerModal;
