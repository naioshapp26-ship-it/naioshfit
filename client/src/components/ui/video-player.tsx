import React, { useState } from "react";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getYouTubeEmbedUrl, getYouTubeThumbnailUrl } from "@/lib/youtube-utils";

interface VideoPlayerProps {
  url: string;
  title?: string;
  thumbnailUrl?: string;
  className?: string;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  url,
  title,
  thumbnailUrl,
  className = ""
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  const embedUrl = getYouTubeEmbedUrl(url);
  const autoplayUrl = embedUrl.includes("?")
    ? `${embedUrl}&autoplay=1&fs=1&playsinline=1`
    : `${embedUrl}?autoplay=1&fs=1&playsinline=1`;
  const thumbnail = thumbnailUrl || getYouTubeThumbnailUrl(url);

  const handlePlay = () => {
    setShowVideo(true);
    setIsPlaying(true);
  };

  if (showVideo) {
    return (
      <Card className={`overflow-hidden ${className}`}>
        <div className="relative w-full aspect-video">
          <iframe
            src={autoplayUrl}
            title={title || "Video Tutorial"}
            className="absolute top-0 left-0 w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            style={{ 
              minHeight: '200px',
              width: '100%',
              height: '100%'
            }}
          />
        </div>
        {title && (
          <div className="p-3 bg-gray-50">
            <h4 className="font-medium text-sm">{title}</h4>
          </div>
        )}
      </Card>
    );
  }

  return (
    <Card className={`overflow-hidden cursor-pointer hover:shadow-lg transition-shadow ${className}`}>
      <div className="relative">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={title || "Video thumbnail"}
            className="w-full h-48 object-cover"
            onError={(e) => {
              // Fallback to a default thumbnail if image fails to load
              const target = e.target as HTMLImageElement;
              target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f0f0f0'/%3E%3Ctext x='50' y='50' text-anchor='middle' dy='0.3em' font-family='Arial, sans-serif' font-size='14' fill='%23666'%3EVideo%3C/text%3E%3C/svg%3E";
            }}
          />
        ) : (
          <div className="w-full h-48 bg-gray-200 flex items-center justify-center">
            <Play className="h-12 w-12 text-gray-400" />
          </div>
        )}
        
        {/* Play button overlay */}
        <div 
          className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center group hover:bg-opacity-40 transition-all"
          onClick={handlePlay}
        >
          <Button
            size="lg"
            className="rounded-full bg-white hover:bg-gray-100 text-black shadow-lg transform group-hover:scale-110 transition-all"
          >
            <Play className="h-6 w-6 ml-1" />
          </Button>
        </div>
      </div>
      
      {title && (
        <div className="p-3 bg-gray-50">
          <h4 className="font-medium text-sm line-clamp-2">{title}</h4>
          <p className="text-xs text-gray-500 mt-1">Click to play video tutorial</p>
        </div>
      )}
    </Card>
  );
};

export default VideoPlayer;