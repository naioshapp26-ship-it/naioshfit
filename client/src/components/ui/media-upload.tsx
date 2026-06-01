import React, { useEffect, useState, useRef } from "react";
import { Upload, X, Image as ImageIcon, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/LanguageContext";
import { getYouTubeEmbedUrl } from "@/lib/youtube-utils";

interface MediaUploadProps {
  value?: string;
  onChange: (url: string) => void;
  accept?: string; // e.g., "image/*" or "video/*"
  label?: string;
  placeholder?: string;
  maxSize?: number; // optional hard cap in bytes (overrides type defaults)
  required?: boolean;
  disabled?: boolean;
  showPreview?: boolean;
  mediaType?: 'image' | 'video' | 'any';
}

const IMAGE_MAX_SIZE = 50 * 1024 * 1024; // 50MB
const VIDEO_MAX_SIZE = 200 * 1024 * 1024; // 200MB
const DEFAULT_MAX_SIZE = IMAGE_MAX_SIZE;

export function MediaUpload({
  value = "",
  onChange,
  accept = "image/*,video/*",
  label,
  placeholder,
  maxSize,
  required = false,
  disabled = false,
  showPreview = true,
  mediaType = 'any'
}: MediaUploadProps) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string>(value);
  const [localObjectUrl, setLocalObjectUrl] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!uploading) {
      setPreview(value || "");
    }
  }, [value, uploading]);

  useEffect(() => {
    if (!localObjectUrl) return;
    return () => {
      URL.revokeObjectURL(localObjectUrl);
    };
  }, [localObjectUrl]);

  const getEffectiveMaxSize = (file: File) => {
    if (typeof maxSize === "number" && Number.isFinite(maxSize) && maxSize > 0) {
      return maxSize;
    }
    if (file.type.startsWith("video/")) {
      return VIDEO_MAX_SIZE;
    }
    if (file.type.startsWith("image/")) {
      return IMAGE_MAX_SIZE;
    }
    return DEFAULT_MAX_SIZE;
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size
    const effectiveMaxSize = getEffectiveMaxSize(file);
    if (file.size > effectiveMaxSize) {
      toast({
        title: t("error") || "Error",
        description: t("fileSizeExceedsLimit") || `File size exceeds limit of ${effectiveMaxSize / (1024 * 1024)}MB`,
        variant: "destructive",
      });
      return;
    }

    try {
      setUploading(true);

      // Show an immediate local preview while the network upload runs.
      const previousObjectUrl = localObjectUrl;
      const objectUrl = URL.createObjectURL(file);
      if (previousObjectUrl) {
        URL.revokeObjectURL(previousObjectUrl);
      }
      setLocalObjectUrl(objectUrl);
      setPreview(objectUrl);

      // Create form data
      const formData = new FormData();
      formData.append("file", file);

      // Determine file type for the upload endpoint
      let fileType = "other";
      if (file.type.startsWith("image/")) {
        fileType = "image";
      } else if (file.type.startsWith("video/")) {
        fileType = "video";
      }
      formData.append("fileType", fileType);
      formData.append("visibility", "coach_visible"); // Make accessible to coaches

      // Upload file
      const response = await fetch("/api/files/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Upload failed" }));
        throw new Error(error.message || "Upload failed");
      }

      const result = await response.json();
      const uploadedUrl = result.file?.fileUrl || result.fileUrl || result.url;

      if (!uploadedUrl) {
        throw new Error("No URL returned from upload");
      }

      // Update value
      onChange(uploadedUrl);
      setPreview(uploadedUrl);
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        setLocalObjectUrl("");
      }

      toast({
        title: t("success") || "Success",
        description: t("fileUploadedSuccess") || "File uploaded successfully",
      });
    } catch (error: any) {
      console.error("Upload error:", error);
      if (localObjectUrl) {
        URL.revokeObjectURL(localObjectUrl);
        setLocalObjectUrl("");
      }
      setPreview(value || "");
      toast({
        title: t("error") || "Error",
        description: error.message || t("failedToUploadFile") || "Failed to upload file",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleUrlChange = (url: string) => {
    const normalizedUrl = url.trim().startsWith("www.") ? `https://${url.trim()}` : url;
    onChange(normalizedUrl);
    setPreview(normalizedUrl);
  };

  const handleClear = () => {
    onChange("");
    setPreview("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const isImage = preview && (preview.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?|#|$)/i) || mediaType === 'image');
  const isVideo = preview && (preview.match(/\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i) || /(youtube\.com|youtu\.be)/i.test(preview) || mediaType === 'video');
  const isYoutubeVideo = !!preview && /(youtube\.com|youtu\.be)/i.test(preview);

  return (
    <div className="space-y-2">
      {label && (
        <Label>
          {label} {required && <span className="text-red-500">*</span>}
        </Label>
      )}

      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload" disabled={disabled}>
            <Upload className="w-4 h-4 mr-2" />
            {t("uploadFile") || "Upload"}
          </TabsTrigger>
          <TabsTrigger value="url" disabled={disabled}>
            {t("enterUrl") || "Enter URL"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-2">
          <div className="flex gap-2">
            <Input
              ref={fileInputRef}
              type="file"
              accept={accept}
              onChange={handleFileSelect}
              disabled={disabled || uploading}
              className="flex-1"
            />
            {preview && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleClear}
                disabled={disabled || uploading}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
          {uploading && (
            <p className="text-sm text-muted-foreground">{t("uploading") || "Uploading..."} {(t("largeVideoMayTakeLong") || "Large videos may take longer to finish.")}</p>
          )}
        </TabsContent>

        <TabsContent value="url" className="space-y-2">
          <div className="flex gap-2">
            <Input
              type="url"
              value={value}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder={placeholder || "https://..."}
              disabled={disabled}
              className="flex-1"
            />
            {preview && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleClear}
                disabled={disabled}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Preview */}
      {showPreview && preview && (
        <div className="mt-2 p-2 border rounded-lg">
          {isImage ? (
            <div className="relative">
              <img
                src={preview}
                alt="Preview"
                className="max-h-48 w-full object-contain rounded"
                onError={() => setPreview("")}
              />
            </div>
          ) : isVideo ? (
            <div className="relative">
              {isYoutubeVideo ? (
                <iframe
                  src={getYouTubeEmbedUrl(preview)}
                  title="Video preview"
                  className="h-48 w-full rounded border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video
                  src={preview}
                  className="max-h-48 w-full rounded"
                  controls
                  onError={() => setPreview("")}
                />
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {mediaType === 'image' ? <ImageIcon className="w-4 h-4" /> : <Video className="w-4 h-4" />}
              <span className="truncate">{preview}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
