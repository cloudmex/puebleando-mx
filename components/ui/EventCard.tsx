"use client";

import { Event } from "@/types/events";
import { CATEGORIES } from "@/lib/data";

interface EventCardProps {
  event: Event;
  compact?: boolean;
}

export default function EventCard({ event, compact = false }: EventCardProps) {
  const cat = CATEGORIES.find((c) => c.id === event.category);

  return (
    <a
      href={event.source_url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block overflow-hidden rounded-xl border border-border bg-white shadow-card hover:shadow-card-hover transition-all duration-300"
    >
      <div className="flex">
        {/* Photo */}
        <div 
          className="relative shrink-0 w-24 h-24 bg-bg-muted overflow-hidden"
        >
          {event.image_url ? (
            <img
              src={event.image_url}
              alt={event.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl">
              📅
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 p-3 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span 
              className="tag" 
              style={{ 
                background: `${cat?.color}15`, 
                borderColor: `${cat?.color}30`,
                color: cat?.color || 'var(--text-secondary)'
              }}
            >
              {cat?.name || 'Evento'}
            </span>
            <span className="text-[10px] text-muted font-medium uppercase tracking-wider">
              {new Date(event.start_date).toLocaleDateString()}
            </span>
          </div>

          <h3 className="font-semibold text-sm leading-tight text-text line-clamp-2 mb-1 group-hover:text-terracota transition-colors">
            {event.title}
          </h3>

          {event.short_description && (
            <p className="text-xs text-text-secondary line-clamp-2 mb-2 leading-relaxed">
              {event.short_description}
            </p>
          )}
          
          <p className="text-[11px] text-text-secondary truncate">
            {event.venue_name || event.city || 'Ubicación pendiente'}
          </p>
        </div>
      </div>
    </a>
  );
}
