import { useState, useEffect } from "react";

function readImage(file: File, onLoad: (dataUrl: string) => void) {
  const reader = new FileReader();
  reader.onload = () => onLoad(reader.result as string);
  reader.readAsDataURL(file);
}

export function TraderProfileCard() {
  const [banner, setBanner] = useState(localStorage.getItem("traderBanner"));

  const handleBannerUpload = (file: File) => {
    readImage(file, (result) => {
      setBanner(result);
      localStorage.setItem("traderBanner", result);
    });
  };

  return (
    <div
      className="w-full rounded-2xl overflow-hidden relative"
      style={{
        background: "#0a0a0a",
        border: "1px solid rgba(255,255,255,0.04)",
        height: "70px",
      }}
    >
      <label className="block h-full cursor-pointer group relative">
        {banner ? (
          <img src={banner} alt="Trader banner" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#141428] via-[#101018] to-[#0a0a0a]" />
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
          <span className="text-[10px] text-white/0 group-hover:text-white/70 transition-colors">Upload banner</span>
        </div>
        <input
          type="file"
          accept="image/*,image/gif"
          hidden
          onChange={(e) => e.target.files?.[0] && handleBannerUpload(e.target.files[0])}
        />
      </label>
    </div>
  );
}
