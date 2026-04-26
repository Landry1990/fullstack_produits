import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, Upload, Trash2, Search, Check, RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import PremiumModal from '../common/PremiumModal';
import { prescriptionOcrService } from '../../services/prescriptionOcrService';
import type { ScannedPrescription } from '../../services/prescriptionOcrService';
import fuzzysort from 'fuzzysort';
import axios from 'axios';
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
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const response = await axios.get(`${baseUrl}/api/produits/?page_size=10000`);
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

      // Fuzzy match products
      const matches: MatchResult[] = extracted.potential_products.map(ocrLine => {
        // Nettoyage du bruit OCR classique (posologie, grammaire) pour la recherche
        const cleanQuery = ocrLine
          .replace(/\b(boite|boites|comprimé|comprimés|cpr|gelules|sirop|ampoules|matin|midi|soir|posologie|ordonnance|qsp|jours|mois|de|la|le|les|des|un|une|et|a|au|dr|docteur)\b/gi, '')
          .replace(/[^\w\s]/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        const calculateSimilarity = (query: string, target: string) => {
            const qTokens = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
            const tTokens = target.toLowerCase().split(/\s+/).filter(w => w.length > 2);
            if (qTokens.length === 0) return 0;

            let matchesCount = 0;
            for (const q of qTokens) {
                let bestTokenScore = 0;
                for (const t of tTokens) {
                    if (t === q) { bestTokenScore = 1; break; }
                    // Tolérance aux petites fautes OCR via inclusion
                    if (t.includes(q) || q.includes(t)) bestTokenScore = Math.max(bestTokenScore, 0.7);
                }
                matchesCount += bestTokenScore;
            }
            return matchesCount / Math.max(qTokens.length, 1); // Score entre 0 et 1 (peut dépasser si très bien matché mais limité par principe)
        };

        const query = cleanQuery.length > 2 ? cleanQuery : ocrLine;

        // Scorer tous les produits avec l'algorithme sur-mesure
        const scoredProducts = products.map(p => ({
            obj: p,
            score: calculateSimilarity(query, p.name)
        })).sort((a, b) => b.score - a.score);

        // Récupérer le top 3 (score > 0.25 pour être permissif)
        const topResults = scoredProducts.filter(p => p.score > 0.25).slice(0, 3);

        return {
          ocrLine,
          matchedProduct: topResults[0] ? topResults[0].obj : null,
          score: topResults[0] ? topResults[0].score : 0,
          suggestions: topResults.map(r => r.obj),
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
      icon={<Camera className="w-5 h-5 text-primary" />}
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
                  className="flex-1 border-2 border-dashed border-base-content/10 rounded-2xl flex flex-col items-center justify-center gap-4 bg-base-200/50 hover:bg-base-200 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="p-4 bg-primary/10 rounded-full text-primary">
                    <Upload className="w-8 h-8" />
                  </div>
                  <div className="text-center">
                    <p className="font-bold">Glissez une image ici</p>
                    <p className="text-sm text-base-content/50">Ou cliquez pour parcourir</p>
                  </div>
                  <button 
                    className="btn btn-primary btn-sm rounded-lg"
                    onClick={(e) => { e.stopPropagation(); startCamera(); }}
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Utiliser la caméra
                  </button>
                </div>
              )}

              {showCamera && (
                <div className="relative flex-1 bg-black rounded-2xl overflow-hidden shadow-xl">
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-3">
                    <button className="btn btn-circle btn-primary btn-lg shadow-lg" onClick={capturePhoto}>
                      <div className="w-4 h-4 rounded-full border-2 border-white" />
                    </button>
                    <button className="btn btn-circle btn-ghost bg-white/20 backdrop-blur-md text-white" onClick={stopCamera}>
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}

              {preview && (
                <div className="relative flex-1 rounded-2xl overflow-hidden group shadow-lg bg-base-300">
                  <img src={preview} alt="Scan preview" className="w-full h-full object-contain" />
                  <div className="absolute top-4 right-4 flex gap-2">
                    <button className="btn btn-circle btn-sm btn-error shadow-lg" onClick={reset}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {!isProcessing && matchResults.length === 0 && (
                    <div className="absolute bottom-6 left-0 right-0 flex justify-center">
                      <button 
                        className="btn btn-primary px-8 rounded-xl shadow-xl shadow-primary/30"
                        onClick={processOcr}
                        disabled={loadingProducts}
                      >
                        {loadingProducts ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                        Lancer l'analyse OCR
                      </button>
                    </div>
                  )}
                </div>
              )}

              {isProcessing && (
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-base-content/50">
                    <span>Traitement OCR en cours...</span>
                    <span>{Math.round(progress * 100)}%</span>
                  </div>
                  <progress className="progress progress-primary w-full h-2" value={progress * 100} max="100"></progress>
                </div>
              )}
            </div>

            {/* Right Column: OCR Results */}
            <div className="flex flex-col bg-base-200/50 rounded-2xl border border-base-content/5 overflow-hidden">
                <div className="p-4 border-b border-base-content/5 bg-base-200/80 backdrop-blur-sm flex justify-between items-center">
                    <h3 className="font-bold flex items-center gap-2">
                        <Search className="w-4 h-4 text-primary" />
                        Médicaments identifiés
                    </h3>
                    <span className="badge badge-sm badge-secondary">{matchResults.filter(r => r.matchedProduct).length} reconnus</span>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {matchResults.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center p-8 text-center text-base-content/40 opacity-50 italic">
                      <AlertCircle className="w-12 h-12 mb-4 stroke-1" />
                      <p>Les produits détectés apparaîtront ici après l'analyse.</p>
                    </div>
                  ) : (
                    matchResults.map((result, idx) => (
                      <div key={idx} className={`p-3 rounded-xl border transition-all ${result.matchedProduct ? 'bg-success/5 border-success/30' : 'bg-base-100 border-base-content/10'}`}>
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[10px] font-bold text-base-content/40 uppercase tracking-tighter">Lu sur l'ordonnance :</span>
                          {result.matchedProduct && <Check className="w-4 h-4 text-success" />}
                        </div>
                        <p className="font-medium text-sm mb-2">{result.ocrLine}</p>
                        
                        <div className="space-y-1">
                          {result.suggestions.map((product, sIdx) => (
                            <button 
                                key={product.id}
                                className={`w-full text-left p-2 rounded-lg text-xs flex justify-between items-center transition-colors ${result.matchedProduct?.id === product.id ? 'bg-success text-success-content' : 'hover:bg-base-300 bg-base-200'}`}
                                onClick={() => handleSelectProduct(idx, product)}
                            >
                                <span className="truncate flex-1 font-bold">{product.name}</span>
                                <span className="ml-2 text-[10px] opacity-70">{product.selling_price} F</span>
                            </button>
                          ))}
                          
                          {result.suggestions.length === 0 && (
                              <p className="text-[10px] text-error flex items-center gap-1 py-1">
                                  <AlertCircle className="w-3 h-3" />
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
        <div className="p-6 bg-base-200/80 backdrop-blur-md border-t border-base-content/5 flex justify-between items-center">
            <div className="text-xs text-base-content/50">
                {extractionData && (
                    <div className="flex gap-4">
                        <span className="flex items-center gap-1"><Check className="w-3 h-3 text-success" /> Patient détecté</span>
                        <span className="flex items-center gap-1"><Check className="w-3 h-3 text-success" /> Médecin détecté</span>
                    </div>
                )}
            </div>
            <div className="flex gap-3">
                <button className="btn btn-ghost rounded-xl" onClick={onClose}>Annuler</button>
                <button 
                  className="btn btn-primary px-8 rounded-xl shadow-lg shadow-primary/20" 
                  disabled={matchResults.filter(r => r.matchedProduct).length === 0 || isProcessing}
                  onClick={validateScan}
                >
                  <Check className="w-4 h-4 mr-2" />
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
