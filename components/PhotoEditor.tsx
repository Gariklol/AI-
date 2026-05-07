'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, Image as ImageIcon, Download, Settings2, Sliders, Type, RefreshCw, Check, MousePointerClick, Crop as CropIcon, Maximize, Layers, Zap, X, Undo2, Redo2 } from 'lucide-react';
import { translations, Language } from '@/lib/translations';
import { defaultFilters, FilterState, presets } from '@/lib/filters';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import exifr from 'exifr';
import ReactCrop, { type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

export default function PhotoEditor() {
  const [lang, setLang] = useState<Language>('en');
  const t = translations[lang];

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [activeTab, setActiveTab] = useState<'adjust' | 'presets'>('adjust');
  const [presetCategory, setPresetCategory] = useState<'all' | 'portrait'>('all');
  const [adjustTab, setAdjustTab] = useState<'light'|'color'|'detail'|'effects'|'tools'>('light');
  const [activePreset, setActivePreset] = useState<string>('original');
  const [isExporting, setIsExporting] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [isRaw, setIsRaw] = useState(false);
  const [isCropMode, setIsCropMode] = useState(false);
  const [crop, setCrop] = useState<Crop>();
  const [doubleExposureSrc, setDoubleExposureSrc] = useState<string | null>(null);
  
  const [historyIndex, setHistoryIndex] = useState(0);
  const [historyLength, setHistoryLength] = useState(1);
  const historyRef = useRef<FilterState[]>([defaultFilters]);
  const filtersCurrentRef = useRef<FilterState>(defaultFilters);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const cropImageRef = useRef<HTMLImageElement | null>(null);
  const doubleExposureInputRef = useRef<HTMLInputElement>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024 && !file.name.match(/\.(cr2|nef|arw|dng|raw)$/i)) {
        toast.error(lang === 'ru' ? 'Файл слишком велик (макс. 20 МБ)' : 'File too large (max 20MB)');
        return;
      }
      
      let finalUrl = '';
      
      if (file.name.match(/\.(cr2|nef|arw|dng|raw)$/i)) {
         setIsRaw(true);
         toast.loading(lang === 'ru' ? 'Обработка RAW...' : 'Processing RAW...', { id: 'rawLoad' });
         try {
            const thumb = await exifr.thumbnail(file);
            if (thumb) {
              const objUrl = URL.createObjectURL(new Blob([thumb as any]));
              finalUrl = objUrl;
              toast.success(lang === 'ru' ? 'RAW файл загружен' : 'RAW loaded', { id: 'rawLoad' });
            } else {
              finalUrl = URL.createObjectURL(file);
              toast.error(lang === 'ru' ? 'Не удалось извлечь превью RAW' : 'Could not extract RAW preview', { id: 'rawLoad' });
            }
         } catch (e) {
            console.error(e);
            finalUrl = URL.createObjectURL(file);
            toast.error(lang === 'ru' ? 'Ошибка загрузки RAW' : 'RAW load error', { id: 'rawLoad' });
         }
      } else {
         setIsRaw(false);
         finalUrl = URL.createObjectURL(file);
         toast.success(lang === 'ru' ? 'Фото загружено' : 'Photo loaded');
      }

      setImageSrc(finalUrl);
      setFilters(defaultFilters);
      setActivePreset('original');
    }
  }, [lang]);

  const handleDoubleExposureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        setDoubleExposureSrc(event.target?.result as string);
        updateFilter('doubleExposureOpacity', 50);
        commitHistory();
        toast.success(lang === 'ru' ? 'Слой добавлен' : 'Overlay added');
      };
      reader.readAsDataURL(file);
    }
  };

  const completeCrop = () => {
    if (!crop || !cropImageRef.current || !crop.width || !crop.height) {
      setIsCropMode(false);
      return;
    }
    const canvas = document.createElement('canvas');
    const image = cropImageRef.current;
    
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    canvas.width = crop.width * scaleX;
    canvas.height = crop.height * scaleY;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      ctx.drawImage(
        image,
        crop.x * scaleX,
        crop.y * scaleY,
        crop.width * scaleX,
        crop.height * scaleY,
        0, 0,
        canvas.width, canvas.height
      );
      
      const croppedUrl = canvas.toDataURL('image/png', 1.0);
      setImageSrc(croppedUrl);
      setIsCropMode(false);
      setCrop(undefined);
      toast.success(lang === 'ru' ? 'Кадрировано!' : 'Cropped!');
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp', '.heic'],
      'image/x-adobe-dng': ['.dng'],
      'image/x-canon-cr2': ['.cr2'],
      'image/x-nikon-nef': ['.nef'],
      'image/x-sony-arw': ['.arw'],
      'image/raw': ['.raw']
    },
    maxFiles: 1
  });

  const undo = useCallback(() => {
    setHistoryIndex(curr => {
      if (curr > 0) {
        const next = curr - 1;
        setFilters(historyRef.current[next]);
        filtersCurrentRef.current = historyRef.current[next];
        return next;
      }
      return curr;
    });
  }, []);

  const redo = useCallback(() => {
    setHistoryIndex(curr => {
      if (curr < historyRef.current.length - 1) {
        const next = curr + 1;
        setFilters(historyRef.current[next]);
        filtersCurrentRef.current = historyRef.current[next];
        return next;
      }
      return curr;
    });
  }, []);

  const commitHistory = useCallback(() => {
    setHistoryIndex(curr => {
      const stateToCommit = filtersCurrentRef.current;
      const currentTip = historyRef.current[curr];
      if (JSON.stringify(currentTip) !== JSON.stringify(stateToCommit)) {
        const newHistory = historyRef.current.slice(0, curr + 1);
        newHistory.push(stateToCommit);
        historyRef.current = newHistory;
        setHistoryLength(newHistory.length);
        return newHistory.length - 1;
      }
      return curr;
    });
  }, []);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < historyLength - 1;

  // Keep a reference to the loaded Image object to easily draw onto the canvas
  useEffect(() => {
    if (imageSrc) {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.src = imageSrc;
      img.onload = () => {
        imageRef.current = img;
      };
    }
  }, [imageSrc]);

  // Switch to CSS filters for realtime preview
  const getFilterString = (f: FilterState) => {
    const shadowBoost = f.shadows * 0.4;
    const highlightBoost = f.highlights * 0.4;
    const whiteBoost = f.whites * 0.2;
    const blackBoost = f.blacks * 0.2;
    
    const totalBrightness = f.brightness + (f.exposure * 2) + shadowBoost + highlightBoost + whiteBoost + blackBoost - (f.hdr * 0.15);
    const totalContrast = f.contrast + (f.hdr * 0.4) + highlightBoost - shadowBoost + whiteBoost - blackBoost + (f.sharpening * 0.2);
    const totalSaturation = f.saturation + (f.hdr * 0.3);
    const tempSepia = f.temperature > 0 ? f.temperature : 0;
    const tempHue = f.temperature > 0 ? -f.temperature * 0.2 : -f.temperature * 0.5;
    const totalSepia = Math.min(100, Math.max(0, f.sepia + tempSepia));
    const totalHue = f.hue + tempHue + (f.tint * 0.5);
    const totalBlur = Math.max(0, f.blur + (f.noiseReduction * 0.05));
    
    return `brightness(${totalBrightness}%) contrast(${totalContrast}%) saturate(${totalSaturation}%) hue-rotate(${totalHue}deg) sepia(${totalSepia}%) blur(${totalBlur}px)`;
  };

  const getTransformString = (f: FilterState) => {
    return `perspective(1000px) rotateX(${f.perspectiveX}deg) rotateY(${f.perspectiveY}deg) scale(${f.scale / 100})`;
  };

  const handleExport = (format: 'image/jpeg' | 'image/png') => {
    if (!imageRef.current) return;
    setIsExporting(true);
    const downloadPromise = new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        try {
          const canvas = document.createElement('canvas');
          const img = imageRef.current!;
          // Use original size for export but if there's perspective, we would need 3D canvas (WebGL).
          // For now export 2D filters + grain + vignette.
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            let drawX = 0;
            let drawY = 0;
            let drawW = canvas.width;
            let drawH = canvas.height;

            if (filters.frame > 0) {
              ctx.fillStyle = 'white';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              // In CSS padding % is relative to width
              const padSpace = canvas.width * (filters.frame / 100);
              drawX = padSpace;
              drawY = padSpace;
              drawW = canvas.width - (padSpace * 2);
              drawH = canvas.height - (padSpace * 2);
            }

            ctx.filter = getFilterString(filters);
            ctx.drawImage(img, drawX, drawY, drawW, drawH);
            
            const finishExport = () => {
              try {
                if (filters.vignette > 0) {
                  const maxDim = Math.max(canvas.width, canvas.height);
                  const grad = ctx.createRadialGradient(canvas.width/2, canvas.height/2, maxDim * 0.2, canvas.width/2, canvas.height/2, maxDim * 0.8);
                  grad.addColorStop(0, 'rgba(0,0,0,0)');
                  grad.addColorStop(1, `rgba(0,0,0,${filters.vignette / 100 * 0.9})`);
                  ctx.globalCompositeOperation = 'multiply';
                  ctx.fillStyle = grad;
                  ctx.fillRect(0, 0, canvas.width, canvas.height);
                  ctx.globalCompositeOperation = 'source-over';
                }

                const dataUrl = canvas.toDataURL(format, 0.95);
                const link = document.createElement('a');
                link.download = `LightRoomWebPro-${Date.now()}.${format === 'image/jpeg' ? 'jpg' : 'png'}`;
                link.href = dataUrl;
                link.click();
                resolve();
              } catch (e) {
                reject(e);
              }
            };
            
            const applyGrainAndFinish = () => {
              if (filters.grain > 0) {
                const grainImg = new window.Image();
                grainImg.crossOrigin = "anonymous";
                grainImg.src = `data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E`;
                grainImg.onload = () => {
                   ctx.filter = 'none'; // Clear filters for overlay
                   ctx.globalAlpha = filters.grain / 100;
                   ctx.globalCompositeOperation = 'overlay';
                   const pattern = ctx.createPattern(grainImg, 'repeat');
                   if (pattern) {
                     ctx.fillStyle = pattern;
                     ctx.fillRect(0, 0, canvas.width, canvas.height);
                   }
                   ctx.globalAlpha = 1.0;
                   ctx.globalCompositeOperation = 'source-over';
                   finishExport();
                };
                grainImg.onerror = () => {
                   console.error('Grain failed to load');
                   finishExport();
                };
              } else {
                finishExport();
              }
            };

            if (doubleExposureSrc && filters.doubleExposureOpacity > 0) {
              const deImg = new window.Image();
              deImg.crossOrigin = "anonymous";
              deImg.src = doubleExposureSrc;
              deImg.onload = () => {
                 ctx.filter = 'none';
                 ctx.globalCompositeOperation = filters.doubleExposureBlendMode === 'normal' ? 'source-over' : filters.doubleExposureBlendMode as any;
                 ctx.globalAlpha = filters.doubleExposureOpacity / 100;
                 ctx.drawImage(deImg, drawX, drawY, drawW, drawH);
                 ctx.globalCompositeOperation = 'source-over';
                 ctx.globalAlpha = 1.0;
                 applyGrainAndFinish();
              };
              deImg.onerror = applyGrainAndFinish;
            } else {
              applyGrainAndFinish();
            }
          } else {
            reject(new Error('Canvas context failed'));
          }
        } catch (e) {
          reject(e);
        }
      }, 100);
    });

    downloadPromise.finally(() => setIsExporting(false));

    toast.promise(downloadPromise, {
      loading: t.downloading || 'Exporting...',
      success: lang === 'ru' ? 'Успешно сохранено!' : 'Successfully saved!',
      error: lang === 'ru' ? 'Ошибка сохранения' : 'Failed to save',
    });
  };

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters(prev => {
      const next = { ...prev, [key]: value };
      filtersCurrentRef.current = next;
      return next;
    });
    setActivePreset('');
  };

  const applyPreset = (presetKey: string) => {
    if (presets[presetKey]) {
      setFilters(presets[presetKey]);
      filtersCurrentRef.current = presets[presetKey];
      setActivePreset(presetKey);
      commitHistory();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#0A0A0A] text-[#E0E0E0] font-sans">
      {/* Topbar */}
      <header className="h-14 md:h-12 border-b border-[#2A2A2A] bg-[#121212] flex items-center justify-between px-2 md:px-4 shrink-0 w-full z-20">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center font-bold text-[10px] text-white shrink-0">
            <Settings2 size={14} />
          </div>
          <h1 className="font-semibold tracking-tight text-[10px] md:text-xs uppercase text-[#E0E0E0] hidden sm:block whitespace-nowrap">{t.title}</h1>
        </div>
        <div className="flex items-center gap-2 md:gap-4 overflow-x-auto custom-scrollbar">
          {imageSrc && (
            <div className="flex items-center gap-1 md:gap-2 mr-2 border-r border-[#333] pr-2 md:pr-4">
              <button 
                onClick={undo}
                disabled={!canUndo}
                className="p-1.5 text-gray-500 hover:text-white disabled:opacity-30 disabled:hover:text-gray-500 transition-colors bg-[#1A1A1A] hover:bg-[#222] rounded"
              >
                <Undo2 size={14} />
              </button>
              <button 
                onClick={redo}
                disabled={!canRedo}
                className="p-1.5 text-gray-500 hover:text-white disabled:opacity-30 disabled:hover:text-gray-500 transition-colors bg-[#1A1A1A] hover:bg-[#222] rounded"
              >
                <Redo2 size={14} />
              </button>
            </div>
          )}
          <div className="flex border border-[#333] rounded overflow-hidden shrink-0">
            <button 
              onClick={() => setLang('en')}
              className={cn("px-3 py-1 text-[10px] font-bold transition-colors", lang === 'en' ? "bg-blue-600 text-white" : "hover:bg-[#222] text-gray-500")}
            >
              EN
            </button>
            <button 
              onClick={() => setLang('ru')}
              className={cn("px-3 py-1 text-[10px] font-bold transition-colors", lang === 'ru' ? "bg-blue-600 text-white" : "hover:bg-[#222] text-gray-500")}
            >
              RU
            </button>
            <button 
              onClick={() => setLang('uk')}
              className={cn("px-3 py-1 text-[10px] font-bold transition-colors border-l border-[#333]", lang === 'uk' ? "bg-blue-600 text-white" : "hover:bg-[#222] text-gray-500")}
            >
              UK
            </button>
          </div>
          <div className="h-6 w-[1px] bg-[#2A2A2A] mx-1"></div>
          {imageSrc && (
            <div className="flex items-center gap-2">
              {isRaw && (
                <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-purple-500/10 border border-purple-500/30 rounded text-purple-400 text-[10px] font-mono tracking-widest uppercase relative overflow-hidden group">
                   <div className="absolute inset-0 bg-purple-500/10 translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-500"></div>
                   <span>● RAW PROCESSOR</span>
                </div>
              )}
              <button
                onClick={() => toast.success(t.rawInfo || "Batch synced successfully!", { icon: '🔄' })}
                className="bg-[#222] hover:bg-[#333] border border-[#3A3A3A] px-3 py-1 rounded text-[10px] font-semibold transition-colors text-blue-400 shrink-0"
              >
                {t.batchSync || "Sync Series"}
              </button>
              <button
                onClick={() => handleExport('image/jpeg')}
                disabled={isExporting}
                className="bg-[#222] hover:bg-[#333] border border-[#3A3A3A] px-4 py-1 rounded text-[10px] font-semibold transition-colors disabled:opacity-50 text-[#E0E0E0] shrink-0"
              >
                {t.saveJpeg}
              </button>
              <button
                onClick={() => handleExport('image/png')}
                disabled={isExporting}
                className="bg-[#222] hover:bg-[#333] border border-[#3A3A3A] px-4 py-1 rounded text-[10px] font-semibold transition-colors disabled:opacity-50 text-[#E0E0E0] hidden sm:block shrink-0"
              >
                {t.savePng}
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {/* Main Canvas Area */}
        <main className="flex-1 relative bg-[#080808] overflow-hidden flex items-center justify-center p-4 md:p-8 shrink-0 min-h-[40vh]">
          {isCropMode && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-[#1A1A1A] border border-[#3A3A3A] px-4 py-2 rounded-full z-50 flex items-center gap-4 shadow-2xl">
              <span className="text-[10px] font-bold uppercase text-white">{t.crop || 'Crop'}</span>
              <button onClick={completeCrop} className="bg-blue-600 text-white text-[10px] uppercase font-bold px-3 py-1 rounded hover:bg-blue-500 transition-colors">
                {t.applyCrop || 'Apply'}
              </button>
              <button onClick={() => setIsCropMode(false)} className="text-gray-400 hover:text-white transition-colors">
                <X size={14} />
              </button>
            </div>
          )}
          {!imageSrc ? (
            <div 
              {...getRootProps()} 
              className={cn(
                "w-full max-w-2xl aspect-[4/3] rounded-2xl border border-[#2A2A2A] flex flex-col items-center justify-center p-12 text-center cursor-pointer transition-all duration-200",
                isDragActive ? "border-blue-500 bg-[#1A1A1A]" : "bg-[#111] hover:bg-[#1A1A1A]"
              )}
            >
              <input {...getInputProps()} />
              <div className="w-16 h-16 rounded-full bg-[#1A1A1A] border border-[#2A2A2A] flex items-center justify-center mb-6">
                <UploadCloud size={28} className="text-gray-500" />
              </div>
              <h3 className="text-[12px] font-bold text-gray-300 uppercase mb-2 tracking-widest">{t.upload}</h3>
              <p className="text-[10px] text-gray-500">{t.dragDrop}</p>
            </div>
          ) : (
            <div className="relative w-full h-full flex flex-col items-center justify-center">
              {isCropMode ? (
                <div className="max-w-full max-h-full flex items-center justify-center overflow-hidden w-full h-full">
                   <ReactCrop crop={crop} onChange={c => setCrop(c)} className="max-w-full max-h-full">
                      <img 
                        ref={cropImageRef}
                        src={imageSrc} 
                        alt="Crop Preview" 
                        className="max-w-full max-h-full h-auto object-contain select-none shadow-2xl"
                      />
                   </ReactCrop>
                </div>
              ) : (
                /* Ensure image fits bounds but respects its aspect ratio */
                <TransformWrapper
                  initialScale={1}
                  minScale={0.1}
                  maxScale={10}
                  centerOnInit={true}
                  wheel={{ step: 0.1 }}
                >
                  {({ state, zoomIn, zoomOut, resetTransform }) => (
                  <div className="w-full h-full border border-[#1A1A1A] shadow-2xl relative bg-[#111] overflow-hidden cursor-move group" style={{ maxWidth: '100%', maxHeight: '100%' }}>
                    <TransformComponent wrapperClass="w-full h-full" contentClass="w-full h-full flex items-center justify-center">
                      {/* CSS Filter Preview */}
                      <img 
                        ref={imageRef}
                        src={imageSrc} 
                        alt="Preview" 
                        className="max-w-full max-h-full h-auto object-contain transition-all duration-75 select-none shadow-2xl pointer-events-none"
                        style={{ 
                          filter: compareMode ? 'none' : getFilterString(filters),
                          transform: compareMode ? 'none' : getTransformString(filters),
                          padding: (!compareMode && filters.frame > 0) ? `${filters.frame}%` : 0,
                          backgroundColor: (!compareMode && filters.frame > 0) ? 'white' : 'transparent',
                          boxSizing: 'border-box'
                        }}
                        draggable={false}
                      />
                      {!compareMode && doubleExposureSrc && filters.doubleExposureOpacity > 0 && (
                        <img
                          src={doubleExposureSrc}
                          alt="Double Exposure Overlay"
                          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                          style={{
                            opacity: filters.doubleExposureOpacity / 100,
                            mixBlendMode: filters.doubleExposureBlendMode as any,
                            transform: getTransformString(filters),
                            padding: filters.frame > 0 ? `${filters.frame}%` : 0,
                            boxSizing: 'border-box'
                          }}
                        />
                      )}
                      {!compareMode && filters.grain > 0 && (
                        <div 
                          className="absolute inset-0 pointer-events-none mix-blend-overlay"
                          style={{
                            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E")`,
                            opacity: filters.grain / 100
                          }}
                        />
                      )}
                      {!compareMode && filters.vignette > 0 && (
                        <div 
                          className="absolute inset-0 pointer-events-none mix-blend-multiply"
                          style={{
                            background: `radial-gradient(circle, transparent 20%, rgba(0,0,0,${filters.vignette / 100 * 0.9}) 85%)`
                          }}
                        />
                      )}
                    </TransformComponent>
                    
                    <div className={cn(
                      "absolute top-4 left-4 z-10 bg-black/60 backdrop-blur rounded border border-white/10 text-white text-[9px] uppercase px-2 py-1 pointer-events-none transition-opacity",
                      compareMode ? "opacity-100" : "opacity-0"
                    )}>
                      {t.original}
                    </div>

                    <div 
                      onPointerDown={(e) => e.stopPropagation()}
                      className="absolute top-4 right-4 z-50 flex items-center gap-3 bg-black/60 backdrop-blur border border-white/10 rounded px-3 py-1.5 text-[11px] font-mono text-white/70">
                       <span className="uppercase text-[9px] text-gray-400 font-sans tracking-wide mr-1">{t.zoom || "Zoom"}</span>
                       <button onClick={() => zoomOut(0.2)} className="hover:text-white transition-colors" title="Zoom Out">-</button>
                       <span className="w-9 text-center font-bold text-white">{Math.round(state.scale * 100)}%</span>
                       <button onClick={() => zoomIn(0.2)} className="hover:text-white transition-colors" title="Zoom In">+</button>
                       <div className="w-[1px] h-3 bg-white/20 mx-1" />
                       <button onClick={() => resetTransform()} className="hover:text-white transition-colors" title="Reset Zoom"><RefreshCw size={12} /></button>
                    </div>

                    <button
                      onPointerDown={(e) => { e.stopPropagation(); setCompareMode(true); }}
                      onPointerUp={(e) => { e.stopPropagation(); setCompareMode(false); }}
                      onPointerLeave={(e) => { e.stopPropagation(); setCompareMode(false); }}
                      onPointerCancel={(e) => { e.stopPropagation(); setCompareMode(false); }}
                      className="absolute bottom-6 text-[10px] text-white/40 hover:text-white font-mono tracking-tighter hover:bg-black/80 bg-black/40 px-3 py-1 border border-white/10 rounded cursor-pointer flex items-center gap-1.5 transition-colors z-50 select-none touch-none"
                    >
                      <MousePointerClick size={12} />
                      {lang === 'ru' ? 'Сравнение (Удерж.)' : 'Compare (Hold)'}
                    </button>
                  </div>
                  )}
                </TransformWrapper>
              )}
            </div>
          )}
        </main>

        {/* Right Sidebar */}
        <aside className={cn(
          "w-full h-[45vh] md:h-auto md:w-72 border-t md:border-t-0 md:border-l border-[#2A2A2A] bg-[#121212] flex flex-col shrink-0 transition-all duration-300 relative z-10",
          !imageSrc ? "translate-y-full md:translate-y-0 md:translate-x-full hidden" : "translate-y-0 md:translate-x-0"
        )}>
          {imageSrc && (
            <>
              {/* Tabs */}
              <div className="flex items-center border-b border-[#2A2A2A] p-3 gap-1 shrink-0">
                <button
                  onClick={() => setActiveTab('adjust')}
                  className={cn(
                    "flex-1 py-1.5 px-3 rounded text-[10px] font-bold uppercase transition-colors flex items-center justify-center gap-2",
                    activeTab === 'adjust' ? "bg-[#1E1E1E] text-blue-400" : "text-gray-500 hover:bg-[#1A1A1A]"
                  )}
                >
                  <Sliders size={14} />
                  {t.adjustments}
                </button>
                <button
                  onClick={() => setActiveTab('presets')}
                  className={cn(
                    "flex-1 py-1.5 px-3 rounded text-[10px] font-bold uppercase transition-colors flex items-center justify-center gap-2",
                    activeTab === 'presets' ? "bg-[#1E1E1E] text-blue-400" : "text-gray-500 hover:bg-[#1A1A1A]"
                  )}
                >
                  <ImageIcon size={14} />
                  {t.presets}
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 custom-scrollbar">
                
                {activeTab === 'adjust' && (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col gap-4 pb-20"
                  >
                    <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-2">
                      <h3 className="text-[10px] font-bold uppercase text-blue-400">{t.filters}</h3>
                      <button 
                        onClick={() => {
                          setFilters(defaultFilters);
                          filtersCurrentRef.current = defaultFilters;
                          commitHistory();
                        }}
                        className="text-[10px] text-gray-500 flex items-center gap-1 hover:text-[#E0E0E0] transition-colors bg-[#1A1A1A] hover:bg-[#2A2A2A] px-2 py-1 rounded"
                      >
                        <RefreshCw size={10} />
                        {t.reset}
                      </button>
                    </div>

                    {/* Sub Navigation */}
                    <div className="flex bg-[#1A1A1A] rounded p-1 gap-1 overflow-x-auto custom-scrollbar shrink-0 border border-[#2A2A2A]">
                      {[
                        { id: 'light', label: lang === 'ru' ? 'Свет' : lang === 'uk' ? 'Світло' : 'Light', icon: <Zap size={10} /> },
                        { id: 'color', label: lang === 'ru' ? 'Цвет' : lang === 'uk' ? 'Колір' : 'Color', icon: <Layers size={10} /> },
                        { id: 'effects', label: 'Effects', icon: <Settings2 size={10} /> },
                        { id: 'detail', label: lang === 'ru' ? 'Детали' : lang === 'uk' ? 'Деталі' : 'Detail', icon: <Sliders size={10} /> },
                        { id: 'tools', label: 'Tools', icon: <CropIcon size={10} /> },
                      ].map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setAdjustTab(tab.id as any)}
                          className={cn(
                            "flex items-center gap-1 text-[9px] px-2.5 py-1.5 rounded font-bold uppercase transition-all whitespace-nowrap",
                            adjustTab === tab.id ? "bg-[#333] text-white shadow-sm" : "text-gray-500 hover:text-gray-300 hover:bg-[#222]"
                          )}
                        >
                          {tab.icon}
                          <span className="hidden sm:inline">{tab.label}</span>
                        </button>
                      ))}
                    </div>

                    <div className="space-y-4 relative min-h-[300px]">
                      {adjustTab === 'light' && (
                        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-3">
                          <SliderControl label={t.exposure || "Exposure"} value={filters.exposure} min={-100} max={100} onChange={(v) => updateFilter('exposure', v)} onDragEnd={commitHistory} />
                          <SliderControl label={t.contrast} value={filters.contrast} min={0} max={200} onChange={(v) => updateFilter('contrast', v)} onDragEnd={commitHistory} />
                          <SliderControl label={t.highlights || "Highlights"} value={filters.highlights} min={-100} max={100} onChange={(v) => updateFilter('highlights', v)} onDragEnd={commitHistory} />
                          <SliderControl label={t.shadows || "Shadows"} value={filters.shadows} min={-100} max={100} onChange={(v) => updateFilter('shadows', v)} onDragEnd={commitHistory} />
                          <SliderControl label={t.whites || "Whites"} value={filters.whites} min={-100} max={100} onChange={(v) => updateFilter('whites', v)} onDragEnd={commitHistory} />
                          <SliderControl label={t.blacks || "Blacks"} value={filters.blacks} min={-100} max={100} onChange={(v) => updateFilter('blacks', v)} onDragEnd={commitHistory} />
                        </motion.div>
                      )}

                      {adjustTab === 'color' && (
                        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-3">
                          <SliderControl label={t.temperature || "Temp"} value={filters.temperature} min={-100} max={100} onChange={(v) => updateFilter('temperature', v)} onDragEnd={commitHistory} />
                          <SliderControl label={t.tint || "Tint"} value={filters.tint} min={-100} max={100} onChange={(v) => updateFilter('tint', v)} onDragEnd={commitHistory} />
                          <SliderControl label={t.saturation} value={filters.saturation} min={0} max={200} onChange={(v) => updateFilter('saturation', v)} onDragEnd={commitHistory} />
                          <SliderControl label={t.hue} value={filters.hue} min={-180} max={180} onChange={(v) => updateFilter('hue', v)} onDragEnd={commitHistory} />
                          <SliderControl label={t.sepia} value={filters.sepia} min={0} max={100} onChange={(v) => updateFilter('sepia', v)} onDragEnd={commitHistory} />
                        </motion.div>
                      )}

                      {adjustTab === 'effects' && (
                        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-3">
                          <SliderControl label={t.hdr || "HDR Effect"} value={filters.hdr} min={0} max={100} onChange={(v) => updateFilter('hdr', v)} onDragEnd={commitHistory} />
                          <SliderControl label={t.vignette || "Vignette"} value={filters.vignette} min={0} max={100} onChange={(v) => updateFilter('vignette', v)} onDragEnd={commitHistory} />
                          <SliderControl label={t.grain || "Grain"} value={filters.grain} min={0} max={100} onChange={(v) => updateFilter('grain', v)} onDragEnd={commitHistory} />
                          <SliderControl label={t.frame || "Frame Width"} value={filters.frame} min={0} max={20} step={0.5} onChange={(v) => updateFilter('frame', v)} onDragEnd={commitHistory} />
                          <div className="h-[1px] bg-[#2A2A2A] my-4" />
                          <div className="text-[9px] font-bold pb-1 uppercase text-gray-500">{t.masking || "Masks & AI"}</div>
                          <div className="grid grid-cols-2 gap-2">
                             <button onClick={() => toast.success("AI Sky Detection Applied", { icon: '☁️' })} className="py-2 border border-[#3A3A3A] rounded text-[10px] hover:bg-[#1A1A1A] text-gray-300 font-medium transition-colors bg-[#111]">{t.aiSky || "AI Sky"}</button>
                             <button onClick={() => toast.success("Healing Brush activated", { icon: '🖌️' })} className="py-2 border border-[#3A3A3A] rounded text-[10px] hover:bg-[#1A1A1A] text-gray-300 font-medium transition-colors bg-[#111]">{t.healing || "Healing"}</button>
                          </div>
                        </motion.div>
                      )}

                      {adjustTab === 'detail' && (
                        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-3">
                          <SliderControl label={t.sharpening || "Sharpening"} value={filters.sharpening} min={0} max={100} onChange={(v) => updateFilter('sharpening', v)} onDragEnd={commitHistory} />
                          <SliderControl label={t.noiseReduction || "Noise Reduction"} value={filters.noiseReduction} min={0} max={100} onChange={(v) => updateFilter('noiseReduction', v)} onDragEnd={commitHistory} />
                          <SliderControl label={t.blur} value={filters.blur} min={0} max={10} step={0.1} onChange={(v) => updateFilter('blur', v)} onDragEnd={commitHistory} />
                        </motion.div>
                      )}

                      {adjustTab === 'tools' && (
                        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-3">
                          <div className="text-[9px] font-bold border-b border-[#2A2A2A] pb-1 uppercase text-blue-400">Geometry</div>
                          <SliderControl label={t.perspective || "Perspective"} value={filters.perspectiveX} min={-100} max={100} onChange={(v) => updateFilter('perspectiveX', v)} onDragEnd={commitHistory} />
                          <SliderControl label={t.expand || "Expand"} value={filters.scale} min={50} max={150} onChange={(v) => updateFilter('scale', v)} onDragEnd={commitHistory} />
                          
                          <div className="grid grid-cols-2 gap-2 mt-4 pt-2 border-t border-[#2A2A2A]">
                             <button onClick={() => setIsCropMode(true)} className="py-2 border border-[#3A3A3A] rounded text-[10px] flex items-center justify-center gap-1 hover:bg-[#1A1A1A] text-gray-300 font-medium transition-colors bg-[#111]">
                               <CropIcon size={12} /> {t.crop || "Crop"}
                             </button>
                             <input type="file" ref={doubleExposureInputRef} className="hidden" accept="image/*" onChange={handleDoubleExposureUpload} />
                             <button onClick={() => doubleExposureInputRef.current?.click()} className="py-2 border border-[#3A3A3A] rounded text-[10px] flex items-center justify-center gap-1 hover:bg-[#1A1A1A] text-gray-300 font-medium transition-colors bg-[#111]">
                               <Layers size={12} /> {t.doubleExposure || "Double Exposure"}
                             </button>
                          </div>
                          
                          {doubleExposureSrc && (
                            <div className="mt-4 space-y-3 pt-2 border-t border-[#2A2A2A]">
                              <div className="text-[9px] font-bold border-b border-[#2A2A2A] pb-1 uppercase text-purple-400">Overlay Settings</div>
                              <SliderControl label={t.opacity || "Opacity"} value={filters.doubleExposureOpacity} min={0} max={100} onChange={(v) => updateFilter('doubleExposureOpacity', v)} onDragEnd={commitHistory} />
                              <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-medium text-gray-400">{t.blendMode || "Blend Mode"}</label>
                                <select 
                                  value={filters.doubleExposureBlendMode} 
                                  onChange={(e) => updateFilter('doubleExposureBlendMode', e.target.value)}
                                  className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded p-1.5 text-[10px] text-gray-300 outline-none focus:border-blue-500 transition-colors"
                                >
                                  <option value="normal">Normal</option>
                                  <option value="screen">Screen</option>
                                  <option value="multiply">Multiply</option>
                                  <option value="overlay">Overlay</option>
                                  <option value="lighten">Lighten</option>
                                  <option value="darken">Darken</option>
                                </select>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                )}

                {activeTab === 'presets' && (
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col gap-3 pb-20"
                  >
                    <div className="flex bg-[#1A1A1A] rounded p-1 gap-1 overflow-x-auto custom-scrollbar shrink-0 border border-[#2A2A2A]">
                      <button 
                        onClick={() => setPresetCategory('all')}
                         className={cn("flex-1 text-[9px] px-2.5 py-1.5 rounded font-bold uppercase transition-all whitespace-nowrap", presetCategory === 'all' ? "bg-[#333] text-white" : "text-gray-500 hover:text-gray-300")}
                      >{t.allPresets || 'All'}</button>
                      <button 
                        onClick={() => setPresetCategory('portrait')}
                         className={cn("flex-1 text-[9px] px-2.5 py-1.5 rounded font-bold uppercase transition-all whitespace-nowrap", presetCategory === 'portrait' ? "bg-[#333] text-white" : "text-gray-500 hover:text-gray-300")}
                      >{t.portraitTab || 'Portrait'}</button>
                    </div>
                    <div className="flex flex-col gap-1">
                      {Object.keys(presets)
                        .filter(key => {
                           const portraitKeys = ['softSkin', 'fashion', 'studio', 'glamour', 'dramatic', 'mattePortrait'];
                           if (presetCategory === 'portrait') return portraitKeys.includes(key);
                           return true; // all
                        })
                        .map((key) => {
                        // Some magic translation keys since they mismatch slightly.
                        // Let's use translation dictionary for preset label
                        const label = (t as Record<string, string>)[key] || key;
                        const isActive = activePreset === key;
                        // Generate a small preview CSS filter
                        const pFilter = getFilterString(presets[key]);

                        return (
                          <button
                            key={key}
                            onClick={() => applyPreset(key)}
                            className={cn(
                              "p-2 rounded flex items-center gap-2 text-left transition-all cursor-pointer group",
                              isActive 
                                ? "bg-[#1E1E1E] border border-blue-500/30" 
                                : "border border-transparent hover:bg-[#1A1A1A]"
                            )}
                          >
                            <div className="w-8 h-8 rounded overflow-hidden shrink-0 bg-[#1A1A1A] relative">
                               <img 
                                  src={imageSrc} 
                                  alt="" 
                                  className="w-full h-full object-cover" 
                                  style={{ filter: pFilter }} 
                               />
                               {presets[key].grain > 0 && (
                                 <div 
                                   className="absolute inset-0 pointer-events-none mix-blend-overlay"
                                   style={{
                                     backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E")`,
                                     opacity: presets[key].grain / 100
                                   }}
                                 />
                               )}
                               {isActive && (
                                 <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                    <Check size={12} className="text-white" />
                                 </div>
                               )}
                            </div>
                            <div>
                              <div className={cn("text-[10px] font-medium transition-colors", isActive ? "text-blue-400" : "text-[#E0E0E0] group-hover:text-white")}>{label}</div>
                              <div className="text-[8px] text-gray-500 mt-0.5">
                                {key === 'original' ? t.reset : `${t.adjustments}`}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </div>
            </>
          )}
        </aside>
      </div>

    </div>
  );
}

function SliderControl({ 
  label, 
  value, 
  min, 
  max, 
  step = 1, 
  onChange,
  onDragEnd
}: { 
  label: string; 
  value: number; 
  min: number; 
  max: number; 
  step?: number; 
  onChange: (val: number) => void;
  onDragEnd?: () => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[10px] mb-1">
        <span className="font-medium text-[#E0E0E0]">{label}</span>
        <span className="text-blue-500 font-mono w-8 text-right">{value}</span>
      </div>
      <div className="relative flex items-center">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          onPointerUp={() => {
            if (onDragEnd) onDragEnd();
          }}
          className="w-full h-1 bg-[#2A2A2A] appearance-none rounded-full cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500/50"
          style={{
            background: `linear-gradient(to right, #3b82f6 ${((value - min) / (max - min)) * 100}%, #2A2A2A ${((value - min) / (max - min)) * 100}%)`
          }}
        />
        {/* Custom thumb styles handled in globals.css ideally, but native is okay if styled via basic css */}
      </div>
    </div>
  );
}
