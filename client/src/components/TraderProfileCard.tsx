import { useState, useEffect } from "react";

async function readImageDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (file.type === "image/gif" || file.name.toLowerCase().endsWith(".gif")) {
        resolve(dataUrl);
        return;
      }

      const img = new Image();
      img.onload = () => {
        const maxWidth = 1600;
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas context unavailable"));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.75));
      };
      img.onerror = () => reject(new Error("Failed to load image for compression"));
      img.src = dataUrl;
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function TraderProfileCard() {
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    try {
      setBanner(localStorage.getItem("traderBanner"));
    } catch (error) {
      console.warn("Could not read traderBanner from localStorage", error);
    }
  }, []);

  const handleBannerUpload = async (file: File) => {
    try {
      const result = await readImageDataUrl(file);
      setBanner(result);
      try {
        localStorage.setItem("traderBanner", result);
      } catch (error) {
        console.warn("Failed to save trader banner to localStorage", error);
      }
    } catch (error) {
      console.error("Failed to process banner image", error);
    }
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
