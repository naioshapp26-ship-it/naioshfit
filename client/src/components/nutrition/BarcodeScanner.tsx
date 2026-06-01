import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Scan, Camera, Upload, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { NotFoundException } from "@zxing/library";

interface ScannedProduct {
  name: string;
  calories: number;
  proteins: number;
  carbs: number;
  fats: number;
  fiber: number;
  servingSize: string;
  servingSizeGrams: number;
  barcode: string;
}

interface BarcodeScannerProps {
  onProductScanned: (product: ScannedProduct) => void;
}

export function BarcodeScanner({ onProductScanned }: BarcodeScannerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanMethod, setScanMethod] = useState<'camera' | 'upload' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);

  // Initialize barcode reader
  useEffect(() => {
    codeReaderRef.current = new BrowserMultiFormatReader();
    
    return () => {
      stopCamera();
    };
  }, []);

  // Fetch product data from Open Food Facts API
  const fetchProductData = async (barcode: string): Promise<ScannedProduct | null> => {
    try {
      setIsProcessing(true);
      const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);
      const data = await response.json();

      if (data.status === 1 && data.product) {
        const product = data.product;
        const nutriments = product.nutriments || {};

        // Get serving size, defaulting to 100g if not available
        const servingSize = product.serving_quantity || 100;
        const servingSizeUnit = product.serving_quantity_unit || 'g';
        const servingSizeText = product.serving_size || `${servingSize}${servingSizeUnit}`;

        return {
          name: product.product_name || product.product_name_en || 'Unknown Product',
          calories: Math.round(nutriments['energy-kcal_100g'] || nutriments['energy-kcal'] || 0),
          proteins: parseFloat(nutriments.proteins_100g || nutriments.proteins || 0),
          carbs: parseFloat(nutriments.carbohydrates_100g || nutriments.carbohydrates || 0),
          fats: parseFloat(nutriments.fat_100g || nutriments.fat || 0),
          fiber: parseFloat(nutriments.fiber_100g || nutriments.fiber || 0),
          servingSize: servingSizeText,
          servingSizeGrams: typeof servingSize === 'number' ? servingSize : 100,
          barcode: barcode
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching product data:', error);
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  const startCamera = async () => {
    try {
      if (!codeReaderRef.current || !videoRef.current) return;

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      
      setIsScanning(true);
      startContinuousScanning();
    } catch (error) {
      console.error('Camera error:', error);
      toast({
        title: "Camera Error",
        description: "Unable to access camera. Please try uploading an image instead.",
        variant: "destructive"
      });
    }
  };

  const startContinuousScanning = async () => {
    if (!codeReaderRef.current || !videoRef.current) return;

    try {
      const result = await codeReaderRef.current.decodeFromVideoElement(videoRef.current);
      
      if (result) {
        const barcode = result.getText();
        await handleBarcodeDetected(barcode);
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        // No barcode found yet, continue scanning
        if (isScanning && videoRef.current) {
          requestAnimationFrame(startContinuousScanning);
        }
      } else {
        console.error('Scanning error:', error);
      }
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    
    const reader = codeReaderRef.current;
    if (reader && typeof reader.reset === "function") {
      reader.reset();
    }
    
    setIsScanning(false);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !codeReaderRef.current) return;

    try {
      setIsProcessing(true);
      const result = await codeReaderRef.current.decodeFromImageUrl(URL.createObjectURL(file));
      
      if (result) {
        const barcode = result.getText();
        await handleBarcodeDetected(barcode);
      }
    } catch (error) {
      console.error('Image scanning error:', error);
      toast({
        title: "Scanning Failed",
        description: "Could not detect a barcode in the image. Please try another image or use the camera.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBarcodeDetected = async (barcode: string) => {
    console.log('Barcode detected:', barcode);
    
    const product = await fetchProductData(barcode);
    
    if (product) {
      onProductScanned(product);
      toast({
        title: "Product Found!",
        description: `Successfully scanned: ${product.name}`,
      });
      setIsOpen(false);
      stopCamera();
      setScanMethod(null);
    } else {
      toast({
        title: "Product Not Found",
        description: `Barcode ${barcode} not found in database. Please add it manually.`,
        variant: "destructive"
      });
    }
  };

  const resetScanner = () => {
    stopCamera();
    setScanMethod(null);
    setIsProcessing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) {
        resetScanner();
      }
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Scan className="h-4 w-4 mr-2" />
          Scan Barcode
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Scan Product Barcode</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {!scanMethod && (
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                onClick={() => {
                  setScanMethod('camera');
                  startCamera();
                }}
                className="h-20 flex flex-col gap-2"
                disabled={isProcessing}
              >
                <Camera className="h-6 w-6" />
                Use Camera
              </Button>
              
              <Button
                variant="outline"
                onClick={() => {
                  setScanMethod('upload');
                  fileInputRef.current?.click();
                }}
                className="h-20 flex flex-col gap-2"
                disabled={isProcessing}
              >
                <Upload className="h-6 w-6" />
                Upload Image
              </Button>
            </div>
          )}

          {scanMethod === 'camera' && (
            <div className="space-y-4">
              <div className="relative">
                <video
                  ref={videoRef}
                  className="w-full h-64 bg-black rounded-lg"
                  playsInline
                />
                {isProcessing && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                    <Loader2 className="h-8 w-8 text-white animate-spin" />
                  </div>
                )}
              </div>
              
              <div className="text-center text-sm text-gray-600">
                Position the barcode in front of the camera. Scanning will happen automatically.
              </div>
              
              <Button variant="outline" onClick={resetScanner} className="w-full">
                Cancel
              </Button>
            </div>
          )}

          {scanMethod === 'upload' && (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              {isProcessing ? (
                <div className="text-center p-8 border-2 border-dashed border-gray-300 rounded-lg">
                  <Loader2 className="h-8 w-8 mx-auto mb-2 text-gray-400 animate-spin" />
                  <p className="text-sm text-gray-600">
                    Scanning barcode from image...
                  </p>
                </div>
              ) : (
                <div className="text-center p-8 border-2 border-dashed border-gray-300 rounded-lg">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-600">
                    Click "Upload Image" to select a photo of the barcode
                  </p>
                </div>
              )}
              
              <Button variant="outline" onClick={resetScanner} className="w-full" disabled={isProcessing}>
                Cancel
              </Button>
            </div>
          )}

          <div className="border-t pt-4">
            <p className="text-xs text-center text-gray-500">
              Product data provided by Open Food Facts
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}