import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Clock, X, ShoppingCart, Package, Truck, Users, TrendingUp, Settings } from 'lucide-react';
import { Card, CardContent } from '../shadcn/card';
import { Button } from '../shadcn/button';
import { Badge } from '../shadcn/badge';
import { EmptyState } from '../ui/EmptyState';
import { HELP_VIDEO_YOUTUBE_IDS } from '../../config/helpVideos';
import type { TFunction } from 'i18next';

interface Video {
  id: string;
  title: string;
  duration: string;
  youtubeId: string;
}

interface Category {
  id: string;
  label: string;
  color: string;
  bg: string;
  icon: React.ElementType;
  videos: Video[];
}

const DEFAULT_YT_ID = 'YOUTUBE_ID_ICI';

function getVideoId(_t: TFunction, id: string): string {
  return HELP_VIDEO_YOUTUBE_IDS[id]?.trim() || DEFAULT_YT_ID;
}

function getCategories(t: TFunction): Category[] {
  return [
    {
      id: 'ventes',
      label: t('training.categories.ventes'),
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 border-emerald-200',
      icon: ShoppingCart,
      videos: [
        { id: 'v1', title: t('training.videos.v1'), duration: '3:20', youtubeId: getVideoId(t, 'v1') },
        { id: 'v2', title: t('training.videos.v2'), duration: '2:45', youtubeId: getVideoId(t, 'v2') },
        { id: 'v3', title: t('training.videos.v3'), duration: '4:10', youtubeId: getVideoId(t, 'v3') },
      ],
    },
    {
      id: 'stock',
      label: t('training.categories.stock'),
      color: 'text-amber-600',
      bg: 'bg-amber-50 border-amber-200',
      icon: Package,
      videos: [
        { id: 'v4', title: t('training.videos.v4'), duration: '5:00', youtubeId: getVideoId(t, 'v4') },
        { id: 'v5', title: t('training.videos.v5'), duration: '6:30', youtubeId: getVideoId(t, 'v5') },
        { id: 'v6', title: t('training.videos.v6'), duration: '3:15', youtubeId: getVideoId(t, 'v6') },
      ],
    },
    {
      id: 'fournisseurs',
      label: t('training.categories.fournisseurs'),
      color: 'text-blue-600',
      bg: 'bg-blue-50 border-blue-200',
      icon: Truck,
      videos: [
        { id: 'v7', title: t('training.videos.v7'), duration: '4:50', youtubeId: getVideoId(t, 'v7') },
        { id: 'v8', title: t('training.videos.v8'), duration: '3:00', youtubeId: getVideoId(t, 'v8') },
      ],
    },
    {
      id: 'clients',
      label: t('training.categories.clients'),
      color: 'text-purple-600',
      bg: 'bg-purple-50 border-purple-200',
      icon: Users,
      videos: [
        { id: 'v9', title: t('training.videos.v9'), duration: '4:00', youtubeId: getVideoId(t, 'v9') },
        { id: 'v10', title: t('training.videos.v10'), duration: '2:30', youtubeId: getVideoId(t, 'v10') },
      ],
    },
    {
      id: 'dashboard',
      label: t('training.categories.dashboard'),
      color: 'text-indigo-600',
      bg: 'bg-indigo-50 border-indigo-200',
      icon: TrendingUp,
      videos: [
        { id: 'v11', title: t('training.videos.v11'), duration: '3:45', youtubeId: getVideoId(t, 'v11') },
        { id: 'v12', title: t('training.videos.v12'), duration: '5:20', youtubeId: getVideoId(t, 'v12') },
      ],
    },
    {
      id: 'parametres',
      label: t('training.categories.parametres'),
      color: 'text-rose-600',
      bg: 'bg-rose-50 border-rose-200',
      icon: Settings,
      videos: [
        { id: 'v13', title: t('training.videos.v13'), duration: '4:00', youtubeId: getVideoId(t, 'v13') },
        { id: 'v14', title: t('training.videos.v14'), duration: '3:10', youtubeId: getVideoId(t, 'v14') },
      ],
    },
  ];
}

interface HelpVideosProps {
  search: string;
}

const HelpVideos: React.FC<HelpVideosProps> = ({ search }) => {
  const { t } = useTranslation('help');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeVideo, setActiveVideo] = useState<Video | null>(null);

  const categories = getCategories(t);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return categories;
    return categories
      .map((cat) => ({
        ...cat,
        videos: cat.videos.filter((v) => v.title.toLowerCase().includes(term)),
      }))
      .filter((cat) => cat.videos.length > 0);
  }, [categories, search]);

  const currentCategory = activeCategory
    ? categories.find((c) => c.id === activeCategory)
    : null;

  const visibleVideos = search.trim()
    ? filtered.flatMap((c) => c.videos)
    : currentCategory?.videos || [];

  const isPlaceholder = (v: Video) => v.youtubeId === 'YOUTUBE_ID_ICI';

  return (
    <div className="space-y-4">
      {activeVideo && (
        <Card className="overflow-hidden border-primary/20">
          <div className="aspect-video w-full max-h-[320px] sm:max-h-[420px] bg-gray-950">
            <iframe
              className="size-full"
              src={`https://www.youtube.com/embed/${activeVideo.youtubeId}?autoplay=1&mute=1&rel=0`}
              title={activeVideo.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          <div className="p-4 flex items-center justify-between bg-base-100">
            <div>
              <h3 className="font-bold text-base-content">{activeVideo.title}</h3>
              <div className="flex items-center gap-1 text-xs text-base-content/50 mt-0.5">
                <Clock className="size-3" />
                <span>{activeVideo.duration}</span>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setActiveVideo(null)}>
              <X className="size-4 mr-1" />
              {t('training.close')}
            </Button>
          </div>
        </Card>
      )}

      {/* Category chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveCategory(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
            activeCategory === null && !search
              ? 'bg-primary text-white border-primary'
              : 'bg-base-100 border-base-200 text-base-content/70 hover:bg-base-200'
          }`}
        >
          {t('overview.sections.videos.title')}
        </button>
        {categories.map((cat) => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                activeCategory === cat.id && !search
                  ? `${cat.bg} ${cat.color} border-transparent`
                  : 'bg-base-100 border-base-200 text-base-content/70 hover:bg-base-200'
              }`}
            >
              <Icon className="size-3.5" />
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Videos grid */}
      {visibleVideos.length === 0 ? (
        <EmptyState
          variant="base"
          className="py-16 opacity-70"
          icon={<Play className="size-8" />}
          title={t('training.no_results')}
          description={t('training.try_again')}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleVideos.map((video) => (
            <button
              key={video.id}
              onClick={() => !isPlaceholder(video) && setActiveVideo(video)}
              className="group text-left bg-base-100 border border-base-200 rounded-2xl overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:hover:translate-y-0"
              disabled={isPlaceholder(video)}
            >
              <div className="relative aspect-video bg-slate-900 overflow-hidden">
                {!isPlaceholder(video) ? (
                  <img
                    src={`https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`}
                    alt={video.title}
                    className="size-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="size-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
                    <div className="text-center">
                      <Play className="size-8 text-white/20 mx-auto mb-1" />
                      <span className="text-caption text-white/30 font-bold uppercase tracking-wider">
                        {t('training.soon')}
                      </span>
                    </div>
                  </div>
                )}
                {!isPlaceholder(video) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="size-12 bg-base-100 rounded-full flex items-center justify-center shadow-xl">
                      <Play className="size-5 text-base-content ml-0.5" />
                    </div>
                  </div>
                )}
                <div className="absolute bottom-2 right-2 bg-black/70 text-white text-caption font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                  <Clock className="size-2.5" />
                  {video.duration}
                </div>
                {isPlaceholder(video) && (
                  <Badge className="absolute top-2 left-2 bg-slate-700/80 text-white text-[10px]">
                    {t('training.soon')}
                  </Badge>
                )}
              </div>
              <div className="p-3 flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-base-content leading-snug">{video.title}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default HelpVideos;
