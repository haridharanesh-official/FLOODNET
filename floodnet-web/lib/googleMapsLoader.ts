// Google Maps JavaScript API dynamic loader
let loadPromise: Promise<any> | null = null;

export function getGoogleMapsApiKey(): string {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("floodnet_google_maps_api_key");
    if (stored && stored.trim()) {
      return stored.trim();
    }
  }
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
}

export function setGoogleMapsApiKey(key: string): void {
  if (typeof window !== "undefined") {
    if (key.trim()) {
      localStorage.setItem("floodnet_google_maps_api_key", key.trim());
    } else {
      localStorage.removeItem("floodnet_google_maps_api_key");
    }
    // Reset loader promise so script can reload if needed
    loadPromise = null;
  }
}

export function loadGoogleMaps(apiKey?: string): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Window is not available"));
  }

  if (window.google && window.google.maps) {
    return Promise.resolve(window.google.maps);
  }

  const keyToUse = apiKey || getGoogleMapsApiKey();

  // If already loading
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise((resolve, reject) => {
    // Check if script element already exists
    const existing = document.getElementById("google-maps-script");
    if (existing) {
      const check = setInterval(() => {
        if (window.google && window.google.maps) {
          clearInterval(check);
          resolve(window.google.maps);
        }
      }, 100);
      return;
    }

    const script = document.createElement("script");
    script.id = "google-maps-script";
    const keyParam = keyToUse ? `&key=${encodeURIComponent(keyToUse)}` : "";
    script.src = `https://maps.googleapis.com/maps/api/js?libraries=places,geometry${keyParam}&loading=async&v=weekly`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      if (window.google && window.google.maps) {
        resolve(window.google.maps);
      } else {
        const check = setInterval(() => {
          if (window.google && window.google.maps) {
            clearInterval(check);
            resolve(window.google.maps);
          }
        }, 50);
      }
    };

    script.onerror = (err) => {
      loadPromise = null;
      reject(err);
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}
