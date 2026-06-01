import { GripVertical, ArrowUp, ArrowDown, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MediaUpload } from "@/components/ui/media-upload";

export type MediaGalleryItem = {
  url: string;
  type: "image" | "video";
};

const isVideoUrl = (url: string) => /(youtube\.com|youtu\.be|\.(mp4|webm|ogg|mov|m4v)(\?|#|$))/i.test(url);
const isImageUrl = (url: string) => /\.(jpg|jpeg|png|gif|webp|svg|avif|bmp|ico)(\?|#|$)/i.test(url);

const inferMediaType = (url: string, fallbackType: "image" | "video" = "image"): "image" | "video" => {
  if (isVideoUrl(url)) return "video";
  if (isImageUrl(url)) return "image";
  return fallbackType;
};

type MediaGalleryManagerProps = {
  label: string;
  items: MediaGalleryItem[];
  onChange: (items: MediaGalleryItem[]) => void;
  isRTL?: boolean;
  addButtonLabel?: string;
  emptyText?: string;
};

const normalizeItem = (item: Partial<MediaGalleryItem> | null | undefined): MediaGalleryItem => {
  const url = typeof item?.url === "string" ? item.url.trim() : "";
  const fallbackType = item?.type === "video" ? "video" : "image";
  return { url, type: inferMediaType(url, fallbackType) };
};

const moveItem = (items: MediaGalleryItem[], from: number, to: number): MediaGalleryItem[] => {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return items;
  }

  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
};

export function MediaGalleryManager({
  label,
  items,
  onChange,
  isRTL = false,
  addButtonLabel,
  emptyText,
}: MediaGalleryManagerProps) {
  const safeItems = Array.isArray(items) ? items.map(normalizeItem) : [];

  const updateItem = (index: number, patch: Partial<MediaGalleryItem>) => {
    onChange(
      safeItems.map((item, itemIndex) => (itemIndex === index ? normalizeItem({ ...item, ...patch }) : item)),
    );
  };

  const removeItem = (index: number) => {
    onChange(safeItems.filter((_, itemIndex) => itemIndex !== index));
  };

  const addItem = () => {
    onChange([...safeItems, { url: "", type: "image" }]);
  };

  const moveUp = (index: number) => {
    onChange(moveItem(safeItems, index, index - 1));
  };

  const moveDown = (index: number) => {
    onChange(moveItem(safeItems, index, index + 1));
  };

  const onDropMove = (from: number, to: number) => {
    onChange(moveItem(safeItems, from, to));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Button type="button" variant="outline" size="sm" onClick={addItem}>
          <Plus className="h-4 w-4" />
          <span className="ms-1">{addButtonLabel || (isRTL ? "إضافة وسائط" : "Add Media")}</span>
        </Button>
      </div>

      {safeItems.length === 0 ? (
        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          {emptyText || (isRTL ? "لا توجد وسائط مضافة" : "No media items yet")}
        </div>
      ) : (
        <div className="space-y-3">
          {safeItems.map((item, index) => (
            <div
              key={`${item.url}-${index}`}
              className="rounded-md border p-3"
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData("text/plain", String(index));
                event.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) => {
                event.preventDefault();
                const from = Number.parseInt(event.dataTransfer.getData("text/plain"), 10);
                if (!Number.isNaN(from)) {
                  onDropMove(from, index);
                }
              }}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <span>{isRTL ? `وسيط ${index + 1}` : `Media ${index + 1}`}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => moveUp(index)}
                    disabled={index === 0}
                    aria-label={isRTL ? "تحريك لأعلى" : "Move up"}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => moveDown(index)}
                    disabled={index === safeItems.length - 1}
                    aria-label={isRTL ? "تحريك لأسفل" : "Move down"}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(index)}
                    aria-label={isRTL ? "حذف" : "Remove"}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>{isRTL ? "النوع" : "Type"}</Label>
                  <Select
                    value={item.type}
                    onValueChange={(value) => updateItem(index, { type: value === "video" ? "video" : "image" })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="image">{isRTL ? "صورة" : "Image"}</SelectItem>
                      <SelectItem value="video">{isRTL ? "فيديو" : "Video"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <MediaUpload
                  value={item.url}
                  onChange={(url) => updateItem(index, { url, type: inferMediaType(url, item.type) })}
                  label={isRTL ? "الوسائط" : "Media"}
                  placeholder="https://..."
                  mediaType={item.type}
                  accept={item.type === "video" ? "video/*" : "image/*"}
                  showPreview
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
