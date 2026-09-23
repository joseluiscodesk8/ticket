export type MapsApp = "waze" | "google";

export const getMapsPref = (): MapsApp => {
  if (typeof window === "undefined") return "waze";
  try {
    return window.localStorage.getItem("map-app") === "google"
      ? "google"
      : "waze";
  } catch {
    return "waze";
  }
};

export const setMapsPref = (app: MapsApp): void => {
  try {
    window.localStorage.setItem("map-app", app);
  } catch {
    // ignorar si localStorage no está disponible
  }
};