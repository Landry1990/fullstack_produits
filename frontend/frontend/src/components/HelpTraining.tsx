import React, { useState } from 'react';
import { 
  BookOpen, Play, Search, ShoppingCart, Package,
  TrendingUp, Users, Settings, Truck, Clock, ChevronRight, Keyboard
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

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

const getCategories = (t: any): Category[] => [
  {
    id: 'ventes',
    label: t('help:training.categories.ventes'),
    color: 'text-success',
    bg: 'bg-success/10 border-emerald-200',
    icon: ShoppingCart,
    videos: [
      { id: 'v1', title: t('help:training.videos.v1'), duration: '3:20', youtubeId: 'YOUTUBE_ID_ICI' },
      { id: 'v2', title: t('help:training.videos.v2'), duration: '2:45', youtubeId: 'YOUTUBE_ID_ICI' },
      { id: 'v3', title: t('help:training.videos.v3'), duration: '4:10', youtubeId: 'YOUTUBE_ID_ICI' },
    ]
  },
  {
    id: 'stock',
    label: t('help:training.categories.stock'),
    color: 'text-warning',
    bg: 'bg-warning/10 border-amber-200',
    icon: Package,
    videos: [
      { id: 'v4', title: t('help:training.videos.v4'), duration: '5:00', youtubeId: 'YOUTUBE_ID_ICI' },
      { id: 'v5', title: t('help:training.videos.v5'), duration: '6:30', youtubeId: 'YOUTUBE_ID_ICI' },
      { id: 'v6', title: t('help:training.videos.v6'), duration: '3:15', youtubeId: 'YOUTUBE_ID_ICI' },
    ]
  },
  {
    id: 'fournisseurs',
    label: t('help:training.categories.fournisseurs'),
    color: 'text-primary',
    bg: 'bg-info/10 border-blue-200',
    icon: Truck,
    videos: [
      { id: 'v7', title: t('help:training.videos.v7'), duration: '4:50', youtubeId: 'YOUTUBE_ID_ICI' },
      { id: 'v8', title: t('help:training.videos.v8'), duration: '3:00', youtubeId: 'YOUTUBE_ID_ICI' },
    ]
  },
  {
    id: 'clients',
    label: t('help:training.categories.clients'),
    color: 'text-purple-600',
    bg: 'bg-secondary/10 border-purple-200',
    icon: Users,
    videos: [
      { id: 'v9', title: t('help:training.videos.v9'), duration: '4:00', youtubeId: 'YOUTUBE_ID_ICI' },
      { id: 'v10', title: t('help:training.videos.v10'), duration: '2:30', youtubeId: 'YOUTUBE_ID_ICI' },
    ]
  },
  {
    id: 'dashboard',
    label: t('help:training.categories.dashboard'),
    color: 'text-primary',
    bg: 'bg-primary/10 border-indigo-200',
    icon: TrendingUp,
    videos: [
      { id: 'v11', title: t('help:training.videos.v11'), duration: '3:45', youtubeId: 'YOUTUBE_ID_ICI' },
      { id: 'v12', title: t('help:training.videos.v12'), duration: '5:20', youtubeId: 'YOUTUBE_ID_ICI' },
    ]
  },
  {
    id: 'parametres',
    label: t('help:training.categories.parametres'),
    color: 'text-rose-600',
    bg: 'bg-rose-50 border-rose-200',
    icon: Settings,
    videos: [
      { id: 'v13', title: t('help:training.videos.v13'), duration: '4:00', youtubeId: 'YOUTUBE_ID_ICI' },
      { id: 'v14', title: t('help:training.videos.v14'), duration: '3:10', youtubeId: 'YOUTUBE_ID_ICI' },
    ]
  },
];

const getShortcuts = (t: any) => [
  { key: 'F2', label: t('help:training.shortcuts.f2') },
  { key: '/', label: t('help:training.shortcuts.slash') },
  { key: 'F4', label: t('help:training.shortcuts.f4') },
  { key: 'F9', label: t('help:training.shortcuts.f9'), highlight: true },
  { key: 'Ctrl+S', label: t('help:training.shortcuts.ctrl_s') },
  { key: 'Alt+Z', label: t('help:training.shortcuts.alt_z') },
  { key: 'Esc', label: t('help:training.close') },
];

const HelpTraining = () => {
  const { t } = useTranslation(['help', 'common']);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('ventes');
  const [activeVideo, setActiveVideo] = useState<Video | null>(null);

  const CATEGORIES = getCategories(t);
  const SHORTCUTS = getShortcuts(t);

  const currentCategory = CATEGORIES.find((c: Category) => c.id === activeCategory) || CATEGORIES[0];

  const filteredCategories = search.trim()
    ? CATEGORIES.map((cat: Category) => ({
        ...cat,
        videos: cat.videos.filter((v: Video) => v.title.toLowerCase().includes(search.toLowerCase()))
      })).filter((cat: Category) => cat.videos.length > 0)
    : CATEGORIES;

  const allVideos = search.trim() ? filteredCategories.flatMap((c: Category) => c.videos) : currentCategory.videos;

  return (
    <div className="min-h-screen bg-base-200/40 p-3 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 text-primary rounded-2xl">
              <BookOpen className="size-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-base-content tracking-tight">{t('help:training.title')}</h1>
              <p className="text-xs text-base-content/40 font-medium">{t('help:training.subtitle')}</p>
            </div>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-base-content/30" />
            <input
              type="text"
              placeholder={t('help:training.search_placeholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input input-bordered w-full pl-9 text-sm rounded-xl h-10"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

          {/* Sidebar catégories */}
          {!search && (
            <div className="lg:col-span-1 space-y-1">
              {CATEGORIES.map((cat: Category) => {
                const Icon = cat.icon;
                const isActive = cat.id === activeCategory;
                return (
                  <button
                    key={cat.id}
                    onClick={() => { setActiveCategory(cat.id); setActiveVideo(null); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all text-sm font-bold ${
                      isActive
                        ? 'bg-base-100 shadow-sm border border-base-200 text-base-content'
                        : 'text-base-content/50 hover:bg-base-100/60 hover:text-base-content'
                    }`}
                  >
                    <Icon className={`size-4 shrink-0 ${isActive ? cat.color : ''}`} />
                    <span>{cat.label}</span>
                    <span className={`ml-auto text-[10px] font-black px-1.5 py-0.5 rounded-full ${isActive ? cat.bg + ' ' + cat.color : 'bg-base-200 text-base-content/30'}`}>
                      {cat.videos.length}
                    </span>
                  </button>
                );
              })}

              {/* Raccourcis clavier */}
              <div className="mt-4 pt-4 border-t border-base-200">
                <div className="flex items-center gap-2 px-2 mb-3">
                  <Keyboard className="size-4 text-base-content/30" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-base-content/30">{t('help:training.shortcuts.title')}</span>
                </div>
                <div className="space-y-1.5">
                  {SHORTCUTS.map((s: any, i: number) => (
                    <div key={i} className="flex items-center justify-between px-2 py-1">
                      <span className="text-xs text-base-content/50">{s.label}</span>
                      <kbd className={`kbd kbd-xs text-[10px] ${s.highlight ? 'bg-primary text-white border-primary' : ''}`}>{s.key}</kbd>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Contenu principal */}
          <div className={`${search ? 'lg:col-span-4' : 'lg:col-span-3'} space-y-4`}>

            {/* Lecteur vidéo actif */}
            {activeVideo && (
              <div className="bg-base-100 rounded-2xl border border-base-200 shadow-sm overflow-hidden">
                <div className="aspect-video w-full bg-gray-950">
                  <iframe
                    className="size-full"
                    src={`https://www.youtube.com/embed/${activeVideo.youtubeId}?autoplay=1`}
                    title={activeVideo.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                <div className="p-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-base-content">{activeVideo.title}</h3>
                    <div className="flex items-center gap-1 text-xs text-base-content/40 mt-0.5">
                      <Clock className="size-3" />
                      <span>{activeVideo.duration}</span>
                    </div>
                  </div>
                  <button onClick={() => setActiveVideo(null)} className="btn btn-ghost btn-sm text-xs">{t('help:training.close')}</button>
                </div>
              </div>
            )}

            {/* Titre catégorie ou résultats recherche */}
            {search ? (
              <p className="text-sm font-bold text-base-content/50">
                {allVideos.length} {t('common:results', { count: allVideos.length })} « {search} »
              </p>
            ) : (
              <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-bold ${currentCategory.bg} ${currentCategory.color}`}>
                <currentCategory.icon className="size-4" />
                {currentCategory.label}
                <span className="ml-auto text-xs opacity-60">{currentCategory.videos.length} {t('help:training.videos_count')}{currentCategory.videos.length > 1 ? 's' : ''}</span>
              </div>
            )}

            {/* Grille de vidéos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(search ? allVideos : currentCategory.videos).map(video => (
                <button
                  key={video.id}
                  onClick={() => setActiveVideo(video)}
                  className="group bg-base-100 border border-base-200 rounded-2xl overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all text-left"
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-slate-900 overflow-hidden">
                    {video.youtubeId !== 'YOUTUBE_ID_ICI' ? (
                      <img
                        src={`https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`}
                        alt={video.title}
                        className="size-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="size-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
                        <div className="text-center">
                          <Play className="size-8 text-white/20 mx-auto mb-1" />
                          <span className="text-[10px] text-white/20 font-bold uppercase tracking-wider">{t('help:training.soon')}</span>
                        </div>
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="size-12 bg-base-100 rounded-full flex items-center justify-center shadow-xl">
                        <Play className="size-5 text-base-content ml-0.5" />
                      </div>
                    </div>
                    <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                      <Clock className="size-2.5" />
                      {video.duration}
                    </div>
                  </div>
                  {/* Info */}
                  <div className="p-3 flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-base-content leading-snug">{video.title}</p>
                    <ChevronRight className="size-4 text-base-content/20 shrink-0 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                </button>
              ))}
            </div>

            {allVideos.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
                <Search className="size-10 mb-3" />
                <p className="font-bold">{t('help:training.no_results')}</p>
                <p className="text-sm">{t('help:training.try_again')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpTraining;
