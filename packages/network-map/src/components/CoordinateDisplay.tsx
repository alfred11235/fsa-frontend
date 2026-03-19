interface CoordinateDisplayProps {
  lat: number;
  lng: number;
  zoom: number;
}

export default function CoordinateDisplay({ lat, lng, zoom }: CoordinateDisplayProps) {
  return (
    <div className="absolute bottom-2 left-2 z-10 flex items-center gap-3 rounded-md bg-white/90 px-3 py-1.5 text-xs text-gray-600 shadow-sm backdrop-blur-sm">
      <span>
        Lat: <strong>{lat.toFixed(5)}</strong>
      </span>
      <span>
        Lng: <strong>{lng.toFixed(5)}</strong>
      </span>
      <span>
        Zoom: <strong>{zoom.toFixed(1)}</strong>
      </span>
    </div>
  );
}
